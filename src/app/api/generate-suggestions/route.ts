import { NextRequest, NextResponse } from 'next/server'
import { generateTextWithFailover } from '@/lib/ai/providerFailover'
import { z } from 'zod'
import { handleAIError, handleValidationError } from '../../../lib/ai/errorHandler'
import {
  documentAssumptions
} from '../../../lib/ai/uncertaintyHandler'
import { v4 as uuidv4 } from 'uuid'
import {
  qaSuggestionTool,
  createQASuggestion,
  QASuggestion,
  QASuggestionsResponse,
  SuggestionType
} from '../../../lib/schemas/QASuggestion'
import { QACanvasDocument } from '../../../lib/schemas/QACanvasDocument'
import {
  analyzeCoverageGaps,
  generateClarificationQuestions,
  identifyEdgeCases,
  generateTestPerspectives,
  mapGapToSuggestionType,
  mapAmbiguityToSuggestionType,
  mapEdgeCaseToSuggestionType,
  mapPerspectiveToSuggestionType
} from '../../../lib/ai/suggestionAlgorithms'
import {
  IntentAnalyzer,
  SectionTargetDetector,
  DependencyAnalyzer,
  type IntentAnalysisResult,
  type CanvasSection,
  type SectionTargetResult
} from '../../../lib/ai/intent'

/**
 * Schema for generate suggestions request payload
 */
const generateSuggestionsPayloadSchema = z.object({
  currentDocument: z.object({
    ticketSummary: z.object({
      problem: z.string(),
      solution: z.string(),
      context: z.string()
    }),
    configurationWarnings: z.array(z.any()).optional(),
    acceptanceCriteria: z.array(z.any()),
    testCases: z.array(z.any()),
    metadata: z.object({
      ticketId: z.string(),
      qaProfile: z.any(),
      generatedAt: z.string()
    })
  }),
  maxSuggestions: z.number().min(1).max(10).default(3),
  focusAreas: z.array(z.string()).optional(),
  excludeTypes: z.array(z.string()).default([]),
  requestId: z.string().optional(),
  userContext: z.string().optional().describe('Optional user context or intent for targeted suggestions'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional()
  })).optional().describe('Optional conversation history for contextual suggestions')
})

type GenerateSuggestionsPayload = z.infer<typeof generateSuggestionsPayloadSchema>

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * POST /api/generate-suggestions
 * Generates contextual QA suggestions based on current document content
 */
export async function POST(request: NextRequest) {
  // Generate a unique request ID for tracking and debugging
  const requestId = uuidv4()

  try {
    // Check for API key configuration
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'CONFIGURATION_ERROR',
          message: 'API key is not configured',
          details: 'OpenAI API key is required for AI processing'
        },
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      )
    }

    // Parse and validate the request body
    const body = await request.json()
    const validationResult = generateSuggestionsPayloadSchema.safeParse(body)

    if (!validationResult.success) {
      return handleValidationError(validationResult.error.issues, requestId)
    }

    const {
      currentDocument,
      maxSuggestions,
      focusAreas,
      excludeTypes,
      userContext,
      conversationHistory
    }: GenerateSuggestionsPayload = validationResult.data

    // Initialize intent analysis components for contextual awareness
    let intentAnalysisResult: IntentAnalysisResult | null = null
    let targetSections: CanvasSection[] = []
    let suggestionPriorities: string[] = []

    try {
      // Perform intent analysis if user context is provided
      if (userContext) {
        const intentAnalyzer = new IntentAnalyzer()
        const sectionTargetDetector = new SectionTargetDetector()

        // Analyze user intent for targeted suggestions
        const uiMessages = (conversationHistory || []).map((msg, index) => ({
          id: `msg-${index}`,
          role: msg.role,
          content: msg.content,
          createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date()
        })) as any
        
        intentAnalysisResult = await intentAnalyzer.analyzeIntent(
          userContext,
          uiMessages,
          currentDocument as any
        )

        // Detect target sections for focused suggestions
        const sectionTargetResult = await sectionTargetDetector.detectTargetSections(
          userContext,
          currentDocument as any
        )

        targetSections = sectionTargetResult.primaryTargets
        
        // Adjust suggestion priorities based on intent
        suggestionPriorities = mapIntentToSuggestionPriorities(intentAnalysisResult)

        console.log(`🎯 Intent analysis: ${intentAnalysisResult.intent} (confidence: ${intentAnalysisResult.confidence})`)
        console.log(`🎯 Target sections: ${targetSections.join(', ')}`)
      }
    } catch (intentError) {
      console.warn('Intent analysis failed, proceeding with standard suggestions:', intentError)
      // Continue with standard suggestion generation
    }

    // Build context-aware prompt for suggestion generation
    const suggestionPrompt = buildEnhancedSuggestionPrompt(
      currentDocument as QACanvasDocument,
      maxSuggestions,
      focusAreas,
      excludeTypes,
      intentAnalysisResult,
      targetSections,
      userContext
    )

    // Check for potential ambiguities in the request
    const requestContext = {
      currentDocument: currentDocument as QACanvasDocument,
      userPreferences: {
        focusAreas,
        excludeTypes,
        maxSuggestions
      },
      intentContext: intentAnalysisResult
    }

    // Document any assumptions we need to make
    documentAssumptions(['Processing QA suggestions request with intent analysis'])

    // Generate suggestions using AI with intent-based filtering
    const suggestions: QASuggestion[] = []

    // Build comprehensive prompt for AI suggestion generation
    const aiPrompt = suggestionPrompt

    // Generate all suggestions using AI
    for (let i = 0; i < maxSuggestions; i++) {
      try {
        console.log(`🤖 Generating AI suggestion ${i + 1} of ${maxSuggestions}`)

        const aiResponse = await generateTextWithFailover(
          `${aiPrompt}\n\nGenerate suggestion ${i + 1} of ${maxSuggestions}. Make it unique and different from any previous suggestions.`,
          {
            system: getSuggestionSystemPrompt(),
            tools: { qaSuggestionTool },
            temperature: 0.4 + (i * 0.1), // Increase temperature for variety
            maxTokens: 1000,
          }
        )

        // Validate AI response format
        if (typeof aiResponse === 'string' || !aiResponse || !aiResponse.toolCalls) {
          console.warn(`Invalid AI response format for suggestion ${i + 1}:`, aiResponse)
          continue
        }

        const { toolCalls } = aiResponse

        // Extract suggestion from tool calls
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0]
          if (toolCall.toolName === 'qaSuggestionTool') {
            const suggestionData = toolCall.args

            // Apply focus areas and exclude types filtering
            if (focusAreas && focusAreas.length > 0 && !focusAreas.includes(suggestionData.suggestionType)) {
              console.log(`🔍 Skipping suggestion ${i + 1} - not in focus areas`)
              continue
            }

            if (excludeTypes && excludeTypes.length > 0 && excludeTypes.includes(suggestionData.suggestionType)) {
              console.log(`🚫 Skipping suggestion ${i + 1} - in exclude types`)
              continue
            }

            const suggestion = createQASuggestion({
              suggestionType: suggestionData.suggestionType,
              title: suggestionData.title,
              description: suggestionData.description,
              targetSection: suggestionData.targetSection,
              priority: suggestionData.priority || 'medium',
              reasoning: suggestionData.reasoning,
              implementationHint: suggestionData.implementationHint,
              relatedRequirements: [], // Could be enhanced to extract from document
              estimatedEffort: suggestionData.estimatedEffort || 'medium',
              tags: suggestionData.tags || []
            })

            suggestions.push(suggestion)
            console.log(`✅ Generated suggestion ${i + 1}: ${suggestion.title}`)
          }
        }
      } catch (error) {
        console.warn(`❌ Failed to generate AI suggestion ${i + 1}:`, error)
        // Continue with other suggestions even if one fails
      }
    }

    // If no suggestions were generated, return an error
    if (suggestions.length === 0) {
      return NextResponse.json(
        {
          error: 'AI_GENERATION_ERROR',
          message: 'Failed to generate any suggestions',
          details: 'The AI was unable to generate suggestions for the provided document',
          requestId,
          errorCode: 'NO_SUGGESTIONS',
          retryable: true,
          suggestions: [
            'Try modifying your focus areas or removing exclusions',
            'Ensure the document contains sufficient content for analysis',
            'Try again with different parameters'
          ]
        },
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      )
    }

    // Build response
    const response: QASuggestionsResponse = {
      suggestions,
      totalCount: suggestions.length,
      generatedAt: new Date().toISOString(),
      contextSummary: buildContextSummary(currentDocument as QACanvasDocument)
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })

  } catch (error) {
    console.error('API Route Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    return handleAIError(error, requestId)
  }
}

/**
 * Build suggestion generation prompt with document context
 */
function buildSuggestionPrompt(
  document: QACanvasDocument,
  maxSuggestions: number,
  focusAreas?: string[],
  excludeTypes?: string[]
): string {
  // Get active QA categories from profile
  const activeCategories = document.metadata.qaProfile ?
    Object.entries(document.metadata.qaProfile.qaCategories || {})
      .filter(([_, active]) => active)
      .map(([category]) => category)
      .join(', ')
    : 'Not specified'

  // Format current test cases summary
  const testCasesSummary = document.testCases.map((tc, index) =>
    `${index + 1}. ${tc.category} - ${tc.priority} priority`
  ).join('\n')

  // Format acceptance criteria summary
  const acceptanceCriteriaSummary = document.acceptanceCriteria.map((ac, index) =>
    `${index + 1}. ${ac.title} (${ac.priority}, ${ac.category})`
  ).join('\n')

  return `Analyze this QA documentation and generate ${maxSuggestions} actionable suggestions to improve test coverage and quality.

**DOCUMENT CONTEXT:**
- Ticket ID: ${document.metadata.ticketId}
- Problem: ${document.ticketSummary.problem}
- Solution: ${document.ticketSummary.solution}
- Context: ${document.ticketSummary.context}

**CURRENT ACCEPTANCE CRITERIA (${document.acceptanceCriteria.length} total):**
${acceptanceCriteriaSummary || 'None defined'}

**CURRENT TEST CASES (${document.testCases.length} total):**
${testCasesSummary || 'None defined'}

**CONFIGURATION WARNINGS:**
${document.configurationWarnings && document.configurationWarnings.length > 0
      ? document.configurationWarnings.map(w => `- ${w.title}: ${w.message}`).join('\n')
      : 'None'
    }

**QA PROFILE:**
- Test Case Format: ${document.metadata.qaProfile?.testCaseFormat || 'Not specified'}
- Active Categories: ${activeCategories}

**SUGGESTION REQUIREMENTS:**
${focusAreas && focusAreas.length > 0
      ? `- Focus on these areas: ${focusAreas.join(', ')}`
      : '- Consider all relevant QA areas'
    }
${excludeTypes && excludeTypes.length > 0
      ? `- Exclude these suggestion types: ${excludeTypes.join(', ')}`
      : ''
    }

**ANALYSIS GUIDELINES:**
1. **Identify gaps** in current test coverage
2. **Suggest edge cases** that aren't currently covered
3. **Recommend improvements** to existing test cases or criteria
4. **Consider user experience** and real-world scenarios
5. **Focus on actionable suggestions** that can be implemented
6. **Prioritize based on risk** and business impact
7. **Ensure suggestions are specific** and not generic advice

Generate suggestions that will genuinely improve the quality and completeness of this QA documentation.`
}

/**
 * Get system prompt for suggestion generation
 */
function getSuggestionSystemPrompt(): string {
  return `You are a senior QA analyst and testing expert. Your role is to analyze QA documentation and provide specific, actionable suggestions to improve test coverage and quality.

## Your Expertise:
- **Test Coverage Analysis**: Identify gaps in functional, UI, security, performance, and edge case testing
- **Risk Assessment**: Prioritize suggestions based on business impact and technical risk
- **Best Practices**: Apply industry-standard QA methodologies and testing patterns
- **User Experience**: Consider real-world usage scenarios and user journeys
- **Technical Depth**: Understand both manual and automated testing approaches

## Suggestion Guidelines:
- **Be Specific**: Provide concrete, actionable recommendations rather than generic advice
- **Explain Value**: Clearly articulate why each suggestion improves quality or coverage
- **Consider Context**: Tailor suggestions to the specific ticket, technology, and business domain
- **Prioritize Impact**: Focus on suggestions that provide the highest value for testing effort
- **Stay Practical**: Ensure suggestions can be realistically implemented by the QA team

## Types of Suggestions to Consider:
- **Edge Cases**: Boundary conditions, error states, unusual user behaviors
- **UI Verification**: Visual consistency, responsive design, accessibility compliance
- **Functional Tests**: Core business logic, integration points, data validation
- **Negative Tests**: Error handling, invalid inputs, system failures
- **Performance Tests**: Load handling, response times, resource usage
- **Security Tests**: Authentication, authorization, data protection
- **Integration Tests**: API interactions, third-party services, data flow

Always use the qaSuggestionTool to structure your suggestions properly.`
}

/**
 * Build enhanced suggestion generation prompt with intent analysis context
 */
function buildEnhancedSuggestionPrompt(
  document: QACanvasDocument,
  maxSuggestions: number,
  focusAreas?: string[],
  excludeTypes?: string[],
  intentAnalysisResult?: IntentAnalysisResult | null,
  targetSections?: CanvasSection[],
  userContext?: string
): string {
  // Get active QA categories from profile
  const activeCategories = document.metadata.qaProfile ?
    Object.entries(document.metadata.qaProfile.qaCategories || {})
      .filter(([_, active]) => active)
      .map(([category]) => category)
      .join(', ')
    : 'Not specified'

  // Format current test cases summary
  const testCasesSummary = document.testCases.map((tc, index) =>
    `${index + 1}. ${tc.category} - ${tc.priority} priority`
  ).join('\n')

  // Format acceptance criteria summary
  const acceptanceCriteriaSummary = document.acceptanceCriteria.map((ac, index) =>
    `${index + 1}. ${ac.title} (${ac.priority}, ${ac.category})`
  ).join('\n')

  // Build intent-aware context
  let intentContext = ''
  if (intentAnalysisResult && userContext) {
    intentContext = `

**USER INTENT ANALYSIS:**
- User Context: "${userContext}"
- Detected Intent: ${intentAnalysisResult.intent}
- Confidence: ${(intentAnalysisResult.confidence * 100).toFixed(1)}%
- Target Sections: ${targetSections?.join(', ') || 'All sections'}
- Reasoning: ${intentAnalysisResult.reasoning}

**INTENT-BASED FOCUS:**
${getIntentBasedFocus(intentAnalysisResult, targetSections)}
`
  }

  return `Analyze this QA documentation and generate ${maxSuggestions} actionable suggestions to improve test coverage and quality.

**DOCUMENT CONTEXT:**
- Ticket ID: ${document.metadata.ticketId}
- Problem: ${document.ticketSummary.problem}
- Solution: ${document.ticketSummary.solution}
- Context: ${document.ticketSummary.context}

**CURRENT ACCEPTANCE CRITERIA (${document.acceptanceCriteria.length} total):**
${acceptanceCriteriaSummary || 'None defined'}

**CURRENT TEST CASES (${document.testCases.length} total):**
${testCasesSummary || 'None defined'}

**CONFIGURATION WARNINGS:**
${document.configurationWarnings && document.configurationWarnings.length > 0
      ? document.configurationWarnings.map(w => `- ${w.title}: ${w.message}`).join('\n')
      : 'None'
    }

**QA PROFILE:**
- Test Case Format: ${document.metadata.qaProfile?.testCaseFormat || 'Not specified'}
- Active Categories: ${activeCategories}
${intentContext}
**SUGGESTION REQUIREMENTS:**
${focusAreas && focusAreas.length > 0
      ? `- Focus on these areas: ${focusAreas.join(', ')}`
      : '- Consider all relevant QA areas'
    }
${excludeTypes && excludeTypes.length > 0
      ? `- Exclude these suggestion types: ${excludeTypes.join(', ')}`
      : ''
    }
${targetSections && targetSections.length > 0
      ? `- Prioritize suggestions for: ${targetSections.join(', ')}`
      : ''
    }

**ANALYSIS GUIDELINES:**
1. **Identify gaps** in current test coverage
2. **Suggest edge cases** that aren't currently covered
3. **Recommend improvements** to existing test cases or criteria
4. **Consider user experience** and real-world scenarios
5. **Focus on actionable suggestions** that can be implemented
6. **Prioritize based on risk** and business impact
7. **Ensure suggestions are specific** and not generic advice
${intentAnalysisResult ? '8. **Align with user intent** and provide contextually relevant suggestions' : ''}

Generate suggestions that will genuinely improve the quality and completeness of this QA documentation.`
}

/**
 * Map intent analysis result to suggestion priorities
 */
function mapIntentToSuggestionPriorities(intentResult: IntentAnalysisResult): string[] {
  const priorities: string[] = []

  switch (intentResult.intent) {
    case 'modify_canvas':
      priorities.push('coverage_gap', 'improvement', 'edge_case')
      break
    case 'provide_information':
      priorities.push('clarification', 'best_practice', 'explanation')
      break
    case 'ask_clarification':
      priorities.push('clarification', 'specification', 'example')
      break
    default:
      priorities.push('coverage_gap', 'improvement', 'edge_case')
  }

  // Add section-specific priorities
  if (intentResult.targetSections.includes('acceptanceCriteria')) {
    priorities.push('functional', 'specification')
  }
  if (intentResult.targetSections.includes('testCases')) {
    priorities.push('edge_case', 'negative_test', 'automation')
  }

  return priorities
}

/**
 * Get intent-based focus description
 */
function getIntentBasedFocus(intentResult: IntentAnalysisResult, targetSections?: CanvasSection[]): string {
  let focus = ''

  switch (intentResult.intent) {
    case 'modify_canvas':
      focus = 'Focus on suggestions that help improve and expand the current QA documentation.'
      break
    case 'provide_information':
      focus = 'Focus on suggestions that provide clarity and additional context to existing content.'
      break
    case 'ask_clarification':
      focus = 'Focus on suggestions that help clarify ambiguous or incomplete areas.'
      break
    default:
      focus = 'Focus on comprehensive QA improvements.'
  }

  if (targetSections && targetSections.length > 0) {
    focus += ` Pay special attention to the ${targetSections.join(' and ')} section(s).`
  }

  return focus
}

/**
 * Build context summary for the response
 */
function buildContextSummary(document: QACanvasDocument): string {
  const testCaseCount = document.testCases.length
  const acceptanceCriteriaCount = document.acceptanceCriteria.length
  const warningCount = document.configurationWarnings?.length || 0

  return `Analyzed QA documentation for ${document.metadata.ticketId} containing ${acceptanceCriteriaCount} acceptance criteria, ${testCaseCount} test cases${warningCount > 0 ? `, and ${warningCount} configuration warnings` : ''}.`
}