import { NextRequest, NextResponse } from 'next/server'
import { generateQADocumentWithFailover } from '@/lib/ai/providerFailover'
import {
  validateTicketAnalysisPayload,
  type TicketAnalysisPayload
} from '@/lib/schemas/TicketAnalysisPayload'
import {
  qaCanvasDocumentSchema,
  type QACanvasDocument
} from '@/lib/schemas/QACanvasDocument'
import { handleValidationError, handleAIError } from '@/lib/ai/errorHandler'
import {
  generatePartialResults,
  UncertaintyType
} from '@/lib/ai/uncertaintyHandler'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/analyze-ticket
 * 
 * Analyzes a Jira ticket and generates comprehensive QA documentation
 * using AI-powered analysis with structured output.
 */
export async function POST(request: NextRequest) {
  // Generate a unique request ID for tracking and debugging
  const requestId = uuidv4()

  try {
    // Parse and validate the request body
    const body = await request.json()
    const validationResult = validateTicketAnalysisPayload(body)

    if (!validationResult.success) {
      return handleValidationError(validationResult.error.issues, requestId)
    }

    const { qaProfile, ticketJson }: TicketAnalysisPayload = validationResult.data

    // Document any assumptions we need to make based on the input data
    const assumptions = []

    // Check for potential configuration issues
    if (!qaProfile.testCaseFormat) {
      assumptions.push({
        type: UncertaintyType.MISSING_CONTEXT,
        description: 'No test case format specified, defaulting to Gherkin format',
        alternatives: ['Step-by-step', 'Table format'],
        confidence: 0.7,
        impact: 'medium'
      })
    }

    // Check for minimal ticket information
    if (!ticketJson.description || ticketJson.description.trim().length < 50) {
      assumptions.push({
        type: UncertaintyType.MISSING_CONTEXT,
        description: 'Limited ticket description provided, may affect quality of generated test cases',
        confidence: 0.9,
        impact: 'high'
      })
    }

    // Check for potential conflicts in QA categories
    const activeCategories = Object.entries(qaProfile.qaCategories)
      .filter(([_, active]) => active)
      .map(([category]) => category)

    if (activeCategories.includes('api') && !ticketJson.description.toLowerCase().includes('api')) {
      assumptions.push({
        type: UncertaintyType.CONFLICTING_REQUIREMENTS,
        description: 'API testing category is enabled but ticket may not involve API functionality',
        confidence: 0.6,
        impact: 'medium'
      })
    }

    // Build comprehensive system prompt for QA analysis
    const systemPrompt = `You are a world-class QA analyst tasked with creating comprehensive test documentation. 

Your role is to:
1. Analyze Jira tickets and translate technical requirements into clear, testable documentation
2. Generate acceptance criteria and test cases based on the ticket content and QA profile
3. Identify potential issues, edge cases, and testing gaps
4. Provide structured, actionable QA documentation

Always follow these principles:
- Write clear, unambiguous acceptance criteria
- Create comprehensive test cases covering happy paths, edge cases, and error scenarios
- Consider the user experience and business impact
- Ensure all requirements are testable and measurable`

    // Build detailed analysis prompt
    const analysisPrompt = `Analyze this Jira ticket and create comprehensive QA documentation:

**TICKET INFORMATION:**
- Issue Key: ${ticketJson.issueKey}
- Summary: ${ticketJson.summary}
- Type: ${ticketJson.issueType}
- Priority: ${ticketJson.priority}
- Status: ${ticketJson.status}
- Assignee: ${ticketJson.assignee || 'Unassigned'}
- Reporter: ${ticketJson.reporter}

**DESCRIPTION:**
${ticketJson.description}

**COMPONENTS:**
${ticketJson.components.length > 0 ? ticketJson.components.join(', ') : 'None specified'}

**CUSTOM FIELDS:**
${Object.entries(ticketJson.customFields).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

**COMMENTS (${ticketJson.comments.length} total):**
${ticketJson.comments.map((comment, index) =>
      `${index + 1}. ${comment.author} (${comment.date}): ${comment.body.substring(0, 200)}${comment.body.length > 200 ? '...' : ''}`
    ).join('\n')}

**QA PROFILE SETTINGS:**
- Test Case Format: ${qaProfile.testCaseFormat}
- Active Categories: ${Object.entries(qaProfile.qaCategories)
        .filter(([_, active]) => active)
        .map(([category]) => category)
        .join(', ')}
- Include Comments: ${qaProfile.includeComments}
- Include Images: ${qaProfile.includeImages}

**INSTRUCTIONS:**
1. Create a simplified explanation of what this ticket is about (problem, solution, context)
2. Check if there are any conflicts between the ticket requirements and QA profile settings
3. Generate detailed acceptance criteria based on the ticket content
4. Create comprehensive test cases in the specified format (${qaProfile.testCaseFormat})
5. Focus on the active QA categories: ${Object.entries(qaProfile.qaCategories)
        .filter(([_, active]) => active)
        .map(([category]) => category)
        .join(', ')}

Generate a complete QACanvasDocument with all sections properly filled out.`

    // Enhance system prompt with uncertainty handling if needed
    let enhancedSystemPrompt = systemPrompt
    if (assumptions.length > 0) {
      enhancedSystemPrompt = `${systemPrompt}

## Uncertainty Handling Instructions:

I've detected some ambiguity in the input data. Please follow these guidelines:

1. When making assumptions:
   - Document any assumptions in the configurationWarnings section
   - Provide clear recommendations for how to address these issues
   - Ensure the generated document is still useful despite ambiguities

2. For conflicting requirements:
   - Prioritize the most likely interpretation based on the ticket content
   - Document alternative interpretations in the configurationWarnings section
   - Provide test cases that cover multiple interpretations when possible

3. For missing information:
   - Generate the best possible document with available information
   - Clearly indicate where more information would improve the results
   - Provide placeholder content that can be easily updated later

Specific assumptions detected in this request:
${assumptions.map(a => `- ${a.description}`).join('\n')}
`
    }

    // Generate structured QA documentation using AI
    const startTime = Date.now()

    try {
      // Debug: Log the schema being sent to AI providers
      console.log('Schema being sent to AI providers:')
      console.log(JSON.stringify(qaCanvasDocumentSchema, null, 2))

      // Use the new generateQADocumentWithFailover function
      const generatedDocument = await generateQADocumentWithFailover<QACanvasDocument>(
        qaCanvasDocumentSchema,
        analysisPrompt,
        {
          temperature: 0.1,
          maxTokens: 4000
        }
      );
      const generationTime = Date.now() - startTime

      // Debug: Log the generated document structure
      console.log('Generated document structure:', JSON.stringify(generatedDocument, null, 2))
      console.log('Generated document keys:', Object.keys(generatedDocument || {}))

      // Check if the document has the expected structure
      if (!generatedDocument) {
        console.error('Generated document is null or undefined')
        throw new Error('AI failed to generate document')
      }

      if (!generatedDocument.ticketSummary) {
        console.error('Generated document missing ticketSummary')
      }

      if (!generatedDocument.acceptanceCriteria) {
        console.error('Generated document missing acceptanceCriteria')
      }

      if (!generatedDocument.testCases) {
        console.error('Generated document missing testCases')
      }

      // Enhance the generated document with metadata
      const enhancedDocument: QACanvasDocument = {
        ...generatedDocument,
        metadata: {
          generatedAt: new Date().toISOString(),
          qaProfile,
          ticketId: ticketJson.issueKey,
          documentVersion: '1.0',
          aiModel: process.env.AI_MODEL || 'o4-mini', // Usar la variable de entorno centralizada
          generationTime,
          wordCount: generatedDocument ? estimateWordCount(generatedDocument) : 0,
          // Store assumptions in regenerationReason if there are any
          regenerationReason: assumptions.length > 0 ? `Generated with ${assumptions.length} assumptions` : undefined
        }
      }

      // Return the generated QA documentation
      return NextResponse.json(enhancedDocument, { status: 200 })
    } catch (error) {
      console.error('Error generating complete document:', error)
      // Don't attempt partial generation, just throw the error to be handled by the outer catch
      throw error
    }

  } catch (error) {
    console.error('Error in /api/analyze-ticket:', error)
    return handleAIError(error, requestId)
  }
}

/**
 * Helper function to estimate word count in the generated document
 */
function estimateWordCount(document: QACanvasDocument): number {
  let wordCount = 0

  // Count words in ticket summary
  wordCount += countWords(document.ticketSummary.problem)
  wordCount += countWords(document.ticketSummary.solution)
  wordCount += countWords(document.ticketSummary.context)

  // Count words in configuration warnings
  document.configurationWarnings.forEach(warning => {
    wordCount += countWords(warning.message)
    wordCount += countWords(warning.recommendation)
  })

  // Count words in acceptance criteria
  document.acceptanceCriteria.forEach(criterion => {
    wordCount += countWords(criterion.title)
    wordCount += countWords(criterion.description)
  })

  // Count words in test cases
  document.testCases.forEach(testCase => {
    if (testCase.format === 'gherkin') {
      wordCount += countWords(testCase.testCase.scenario)
      testCase.testCase.given.forEach(given => wordCount += countWords(given))
      testCase.testCase.when.forEach(when => wordCount += countWords(when))
      testCase.testCase.then.forEach(then => wordCount += countWords(then))
    } else if (testCase.format === 'steps') {
      wordCount += countWords(testCase.testCase.title)
      wordCount += countWords(testCase.testCase.objective)
      testCase.testCase.steps.forEach(step => {
        wordCount += countWords(step.action)
        wordCount += countWords(step.expectedResult)
      })
    } else if (testCase.format === 'table') {
      wordCount += countWords(testCase.testCase.title)
      wordCount += countWords(testCase.testCase.description)
      wordCount += countWords(testCase.testCase.expectedOutcome)
    }
  })

  return wordCount
}

/**
 * Helper function to count words in a string
 */
function countWords(text: string | undefined | null): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}