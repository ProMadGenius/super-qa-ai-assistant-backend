import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { handleAIError, handleValidationError } from '../../../lib/ai/errorHandler'
import { 
  qaSuggestionTool,
  validateGenerateSuggestionsRequest,
  createQASuggestion,
  QASuggestion,
  QASuggestionsResponse
} from '../../../lib/schemas/QASuggestion'
import { QACanvasDocument } from '../../../lib/schemas/QACanvasDocument'

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
  requestId: z.string().optional()
})

type GenerateSuggestionsPayload = z.infer<typeof generateSuggestionsPayloadSchema>

/**
 * POST /api/generate-suggestions
 * Generates contextual QA suggestions based on current document content
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json()
    const validationResult = generateSuggestionsPayloadSchema.safeParse(body)
    
    if (!validationResult.success) {
      return handleValidationError(validationResult.error.issues)
    }

    const { 
      currentDocument, 
      maxSuggestions, 
      focusAreas, 
      excludeTypes,
      requestId 
    }: GenerateSuggestionsPayload = validationResult.data

    // Build context-aware prompt for suggestion generation
    const suggestionPrompt = buildSuggestionPrompt(
      currentDocument as QACanvasDocument, 
      maxSuggestions,
      focusAreas,
      excludeTypes
    )

    // Generate suggestions using AI with tool calling
    const suggestions: QASuggestion[] = []
    
    for (let i = 0; i < maxSuggestions; i++) {
      try {
        const { text, toolCalls } = await generateText({
          model: openai('gpt-4o'),
          system: getSuggestionSystemPrompt(),
          prompt: `${suggestionPrompt}\n\nGenerate suggestion ${i + 1} of ${maxSuggestions}. Make it unique and different from any previous suggestions.`,
          tools: { qaSuggestionTool },
          temperature: 0.4, // Slightly higher for more creative suggestions
          maxTokens: 1000,
        })

        // Extract suggestion from tool calls
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0]
          if (toolCall.toolName === 'qaSuggestionTool') {
            const suggestionData = toolCall.args
            const suggestion = createQASuggestion({
              suggestionType: suggestionData.suggestionType,
              title: suggestionData.title,
              description: suggestionData.description,
              targetSection: suggestionData.targetSection,
              priority: suggestionData.priority || 'medium',
              reasoning: suggestionData.reasoning,
              implementationHint: suggestionData.implementationHint,
              relatedRequirements: [], // Could be enhanced to extract from document
              estimatedEffort: suggestionData.estimatedEffort,
              tags: suggestionData.tags || []
            })
            
            suggestions.push(suggestion)
          }
        }
      } catch (error) {
        console.warn(`Failed to generate suggestion ${i + 1}:`, error)
        // Continue with other suggestions even if one fails
      }
    }

    // If no suggestions were generated, return an error
    if (suggestions.length === 0) {
      return NextResponse.json(
        {
          error: 'AI_GENERATION_ERROR',
          message: 'Failed to generate any suggestions',
          details: 'The AI was unable to generate suggestions for the provided document'
        },
        { status: 500 }
      )
    }

    // Build response
    const response: QASuggestionsResponse = {
      suggestions,
      totalCount: suggestions.length,
      generatedAt: new Date().toISOString(),
      contextSummary: buildContextSummary(currentDocument as QACanvasDocument)
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    return handleAIError(error)
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
  ? `- Exclude these types: ${excludeTypes.join(', ')}`
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
 * Build context summary for the response
 */
function buildContextSummary(document: QACanvasDocument): string {
  const testCaseCount = document.testCases.length
  const acceptanceCriteriaCount = document.acceptanceCriteria.length
  const warningCount = document.configurationWarnings?.length || 0
  
  return `Analyzed QA documentation for ${document.metadata.ticketId} containing ${acceptanceCriteriaCount} acceptance criteria, ${testCaseCount} test cases${warningCount > 0 ? `, and ${warningCount} configuration warnings` : ''}.`
}