import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { 
  validateTicketAnalysisPayload,
  type TicketAnalysisPayload 
} from '@/lib/schemas/TicketAnalysisPayload'
import { 
  qaCanvasDocumentSchema,
  type QACanvasDocument 
} from '@/lib/schemas/QACanvasDocument'

/**
 * POST /api/analyze-ticket
 * 
 * Analyzes a Jira ticket and generates comprehensive QA documentation
 * using AI-powered analysis with structured output.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json()
    const validationResult = validateTicketAnalysisPayload(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        },
        { status: 400 }
      )
    }

    const { qaProfile, ticketJson }: TicketAnalysisPayload = validationResult.data

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

    // Generate structured QA documentation using AI
    const startTime = Date.now()
    
    const { object: generatedDocument } = await generateObject({
      model: openai('gpt-4o'),
      schema: qaCanvasDocumentSchema,
      system: systemPrompt,
      prompt: analysisPrompt,
      temperature: 0.3, // Lower temperature for more consistent, structured output
    })

    const generationTime = Date.now() - startTime

    // Enhance the generated document with metadata
    const enhancedDocument: QACanvasDocument = {
      ...generatedDocument,
      metadata: {
        ...generatedDocument.metadata,
        generatedAt: new Date().toISOString(),
        qaProfile,
        ticketId: ticketJson.issueKey,
        documentVersion: '1.0',
        aiModel: 'gpt-4o',
        generationTime,
        wordCount: estimateWordCount(generatedDocument)
      }
    }

    // Return the generated QA documentation
    return NextResponse.json(enhancedDocument, { status: 200 })

  } catch (error) {
    console.error('Error in /api/analyze-ticket:', error)

    // Handle specific AI SDK errors
    if (error instanceof Error) {
      if (error.message.includes('AI_NoObjectGeneratedError')) {
        return NextResponse.json(
          {
            error: 'AI_GENERATION_ERROR',
            message: 'Failed to generate structured QA documentation',
            details: 'The AI model was unable to generate a valid document structure'
          },
          { status: 500 }
        )
      }

      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return NextResponse.json(
          {
            error: 'RATE_LIMIT_ERROR',
            message: 'AI service rate limit exceeded',
            details: 'Please try again in a few moments'
          },
          { status: 429 }
        )
      }
    }

    // Generic server error
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while analyzing the ticket',
        details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
      },
      { status: 500 }
    )
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
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}