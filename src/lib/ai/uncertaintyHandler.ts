/**
 * AI Uncertainty Handler
 * Provides utilities for managing AI uncertainty and ambiguity
 */

/**
 * Types of AI uncertainty
 */
export enum UncertaintyType {
  AMBIGUOUS_REQUEST = 'AMBIGUOUS_REQUEST',
  MISSING_CONTEXT = 'MISSING_CONTEXT',
  MULTIPLE_INTERPRETATIONS = 'MULTIPLE_INTERPRETATIONS',
  CONFLICTING_REQUIREMENTS = 'CONFLICTING_REQUIREMENTS',
  TECHNICAL_LIMITATION = 'TECHNICAL_LIMITATION'
}

/**
 * Structure for documenting AI assumptions
 */
export interface Assumption {
  type: UncertaintyType
  description: string
  alternatives?: string[]
  confidence?: number // 0-1 scale
  impact?: 'high' | 'medium' | 'low'
}

/**
 * Structure for clarifying questions
 */
export interface ClarifyingQuestion {
  question: string
  context: string
  options?: string[]
  relatedTo?: string
}

/**
 * Structure for partial results
 */
export interface PartialResult {
  completedSections: string[]
  missingSections: string[]
  reason: string
  fallbackContent?: any
}

/**
 * Generate clarifying questions based on ambiguous requirements (original implementation)
 */
export function generateClarifyingQuestionsDetailed(
  ambiguities: string[],
  context: any
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = []

  for (const ambiguity of ambiguities) {
    // Generate specific questions based on the type of ambiguity
    if (ambiguity.toLowerCase().includes('format')) {
      questions.push({
        question: `What format would you prefer for ${ambiguity}?`,
        context: 'Format specification',
        options: ['Gherkin', 'Step-by-step', 'Table format'],
        relatedTo: 'testCaseFormat'
      })
    } else if (ambiguity.toLowerCase().includes('category') || 
               ambiguity.toLowerCase().includes('type')) {
      questions.push({
        question: `Which testing categories should be included for ${ambiguity}?`,
        context: 'Testing scope',
        options: ['Functional', 'UI/UX', 'API', 'Performance', 'Security'],
        relatedTo: 'qaCategories'
      })
    } else if (ambiguity.toLowerCase().includes('priority') || 
               ambiguity.toLowerCase().includes('importance')) {
      questions.push({
        question: `What priority level should be assigned to ${ambiguity}?`,
        context: 'Test prioritization',
        options: ['Critical', 'High', 'Medium', 'Low'],
        relatedTo: 'priority'
      })
    } else {
      // Generic clarifying question
      questions.push({
        question: `Could you please clarify what you mean by "${ambiguity}"?`,
        context: 'General clarification',
        relatedTo: 'general'
      })
    }
  }

  return questions
}

/**
 * Generate clarifying questions using AI function (for tests)
 */
export async function generateClarifyingQuestions(
  request: string,
  aiFunction: (input: any, context?: any) => Promise<any>,
  context?: any
): Promise<string[]> {
  try {
    const result = await aiFunction(request, context)
    const questions = Array.isArray(result) ? result : [result]
    
    // Apply maxQuestions limit if specified
    const maxQuestions = context?.maxQuestions || 3 // Default to 3 questions
    return questions.slice(0, maxQuestions)
  } catch (error) {
    throw error
  }
}

/**
 * Document assumptions made during AI processing
 * This is the original function that returns Assumption objects
 */
export function documentAssumptionsDetailed(
  request: any,
  context: any
): Assumption[] {
  const assumptions: Assumption[] = []

  // Check for missing test case format
  if (!context?.userPreferences?.testCaseFormat) {
    assumptions.push({
      type: UncertaintyType.MISSING_CONTEXT,
      description: 'No test case format specified, defaulting to Gherkin format',
      alternatives: ['Step-by-step', 'Table format'],
      confidence: 0.7,
      impact: 'medium'
    })
  }

  // Check for ambiguous requirements
  if (request.content && typeof request.content === 'string') {
    const content = request.content.toLowerCase()
    
    // Check for vague terms that might need clarification
    const vagueTerms = ['improve', 'enhance', 'better', 'fix', 'update']
    for (const term of vagueTerms) {
      if (content.includes(term)) {
        assumptions.push({
          type: UncertaintyType.AMBIGUOUS_REQUEST,
          description: `The request contains the vague term "${term}" which could have multiple interpretations`,
          confidence: 0.6,
          impact: 'medium'
        })
        break
      }
    }
    
    // Check for potentially conflicting requirements
    if (content.includes('comprehensive') && content.includes('simple')) {
      assumptions.push({
        type: UncertaintyType.CONFLICTING_REQUIREMENTS,
        description: 'Request asks for both "comprehensive" and "simple" which may be conflicting goals',
        confidence: 0.8,
        impact: 'high'
      })
    }
  }

  return assumptions
}

/**
 * Document assumptions - formats assumptions as a string (for tests)
 */
export function documentAssumptions(assumptions: string[]): string {
  if (!assumptions || assumptions.length === 0) {
    return ''
  }

  let result = 'Based on your request, I made the following assumptions:\n\n'
  
  for (const assumption of assumptions) {
    result += `• ${assumption}\n`
  }
  
  result += '\nPlease let me know if any of these assumptions are incorrect and I will adjust my response accordingly.'
  
  return result
}

/**
 * Generate partial results when complete processing is not possible
 */
export function generatePartialResults(
  request: any,
  context: any,
  error?: Error
): PartialResult {
  // Determine which sections can be completed based on available information
  const completedSections: string[] = []
  const missingSections: string[] = []
  
  // Check if we can generate ticket summary
  if (context.currentDocument?.ticketSummary) {
    completedSections.push('ticketSummary')
  } else {
    missingSections.push('ticketSummary')
  }
  
  // Check if we can generate acceptance criteria
  if (context.currentDocument?.acceptanceCriteria?.length > 0) {
    completedSections.push('acceptanceCriteria')
  } else {
    missingSections.push('acceptanceCriteria')
  }
  
  // Check if we can generate test cases
  if (context.currentDocument?.testCases?.length > 0) {
    completedSections.push('testCases')
  } else {
    missingSections.push('testCases')
  }
  
  // Determine reason for partial results
  let reason = 'Insufficient information to complete all sections'
  if (error) {
    reason = `Error during processing: ${error.message}`
  } else if (missingSections.includes('ticketSummary')) {
    reason = 'Missing ticket information'
  } else if (missingSections.includes('acceptanceCriteria')) {
    reason = 'Unable to extract acceptance criteria from ticket'
  }
  
  // Create fallback content for missing sections
  const fallbackContent: any = {}
  
  if (missingSections.includes('ticketSummary')) {
    fallbackContent.ticketSummary = {
      problem: 'Unable to determine problem from provided information',
      solution: 'Please provide more details about the solution',
      context: 'Additional context needed'
    }
  }
  
  if (missingSections.includes('acceptanceCriteria')) {
    fallbackContent.acceptanceCriteria = [
      {
        title: 'Please specify acceptance criteria',
        description: 'No acceptance criteria could be determined from the provided information',
        category: 'unknown',
        priority: 'medium'
      }
    ]
  }
  
  if (missingSections.includes('testCases')) {
    fallbackContent.testCases = [
      {
        title: 'Sample test case (placeholder)',
        category: 'functional',
        priority: 'medium',
        format: 'steps',
        testCase: {
          title: 'Placeholder test case',
          objective: 'Please provide more information to generate proper test cases',
          steps: [
            {
              action: 'Provide more specific requirements',
              expectedResult: 'Detailed test cases can be generated'
            }
          ]
        }
      }
    ]
  }
  
  return {
    completedSections,
    missingSections,
    reason,
    fallbackContent
  }
}

/**
 * Format AI response with try-verify-feedback pattern
 */
export function formatTryVerifyFeedbackResponse(
  response: any,
  assumptions: Assumption[],
  clarifyingQuestions?: ClarifyingQuestion[]
): string {
  let formattedResponse = ''
  
  // Add assumptions section if there are any
  if (assumptions.length > 0) {
    formattedResponse += '## Assumptions Made\n\n'
    formattedResponse += 'I made the following assumptions while processing your request:\n\n'
    
    for (const assumption of assumptions) {
      formattedResponse += `- **${assumption.description}**`
      
      if (assumption.impact) {
        formattedResponse += ` (Impact: ${assumption.impact})`
      }
      
      formattedResponse += '\n'
      
      if (assumption.alternatives && assumption.alternatives.length > 0) {
        formattedResponse += `  Alternatives: ${assumption.alternatives.join(', ')}\n`
      }
    }
    
    formattedResponse += '\n'
  }
  
  // Add the main response content
  formattedResponse += response
  
  // Add clarifying questions if there are any
  if (clarifyingQuestions && clarifyingQuestions.length > 0) {
    formattedResponse += '\n\n## Clarifying Questions\n\n'
    formattedResponse += 'To improve the results, please provide more information about:\n\n'
    
    for (const question of clarifyingQuestions) {
      formattedResponse += `- **${question.question}**\n`
      
      if (question.options && question.options.length > 0) {
        formattedResponse += `  Options: ${question.options.join(', ')}\n`
      }
    }
  }
  
  // Add feedback request
  formattedResponse += '\n\n## Feedback\n\n'
  formattedResponse += 'Please let me know if the above meets your requirements or if you would like me to make any adjustments.'
  
  return formattedResponse
}

/**
 * Process ambiguous request with try-verify-feedback pattern
 * Integrates with provider failover logic for resilient processing
 */
export async function processAmbiguousRequest(
  request: any,
  context: any,
  processor: (req: any, ctx: any) => Promise<any>
): Promise<any> {
  try {
    // Document any assumptions we're making
    const assumptions = documentAssumptionsDetailed(request, context)
    
    // Process the request with our best interpretation
    // The processor function should already be using provider failover internally
    const result = await processor(request, context)
    
    // Generate clarifying questions for any ambiguities
    const ambiguities = extractAmbiguities(request, context)
    const clarifyingQuestions = generateClarifyingQuestionsDetailed(
      ambiguities,
      context
    )
    
    // Format the response with assumptions and clarifying questions
    if (typeof result === 'string') {
      return formatTryVerifyFeedbackResponse(result, assumptions, clarifyingQuestions)
    } else {
      // For object responses, add metadata about assumptions and questions
      return {
        ...result,
        metadata: {
          ...(result.metadata || {}),
          assumptions,
          clarifyingQuestions,
          processingNotes: 'Response generated with uncertainty management and provider failover',
          processingDetails: {
            assumptionsCount: assumptions.length,
            clarifyingQuestionsCount: clarifyingQuestions.length,
            ambiguitiesDetected: ambiguities.length > 0
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in ambiguous request processing:', error)
    
    // Check if this is a provider failover error
    const isFailoverError = error instanceof Error && 
      (error.message.includes('All providers failed') || 
       error.message.includes('No available AI providers'));
    
    // Generate partial results based on what we can process
    const partialResult = generatePartialResults(request, context, error instanceof Error ? error : new Error(String(error)))
    
    // Return partial results with explanation
    return {
      partialResult,
      error: isFailoverError 
        ? 'Unable to process the request due to AI provider issues' 
        : 'Unable to fully process the request due to ambiguity or missing information',
      errorType: isFailoverError ? 'PROVIDER_ERROR' : 'AMBIGUITY_ERROR',
      suggestions: isFailoverError 
        ? [
            'Try again in a few moments',
            'The system will automatically attempt to use alternative providers',
            'Contact your administrator if this issue persists'
          ]
        : [
            'Try providing more specific information',
            'Check if all required fields are included',
            'Consider breaking down complex requests into simpler ones'
          ]
    }
  }
}

/**
 * Extract potential ambiguities from a request
 */
function extractAmbiguities(request: any, context: any): string[] {
  const ambiguities: string[] = []
  
  if (request.content && typeof request.content === 'string') {
    const content = request.content.toLowerCase()
    
    // Check for vague terms that might need clarification
    const vagueTerms = [
      { term: 'improve', context: 'test coverage' },
      { term: 'enhance', context: 'test cases' },
      { term: 'better', context: 'acceptance criteria' },
      { term: 'fix', context: 'documentation' },
      { term: 'update', context: 'test scenarios' }
    ]
    
    for (const { term, context: termContext } of vagueTerms) {
      if (content.includes(term)) {
        ambiguities.push(`${term} ${termContext}`)
      }
    }
    
    // Check for references to undefined elements
    const potentialReferences = [
      'this test case', 'that section', 'those criteria', 
      'it', 'them', 'that part'
    ]
    
    for (const ref of potentialReferences) {
      if (content.includes(ref)) {
        ambiguities.push(`reference to "${ref}"`)
      }
    }
  }
  
  // Check for missing required context
  if (!context.userPreferences?.testCaseFormat) {
    ambiguities.push('test case format')
  }
  
  if (!context.userPreferences?.focusAreas || context.userPreferences.focusAreas.length === 0) {
    ambiguities.push('testing focus areas')
  }
  
  return ambiguities
}

/**
 * Handle ambiguous requests with AI processing
 */
export async function handleAmbiguousRequest(
  request: string,
  aiFunction: (input: any, context?: any) => Promise<any>,
  context?: any
): Promise<any> {
  try {
    const result = await aiFunction(request, context)
    
    return {
      response: result.response || result,
      assumptions: result.assumptions || []
    }
  } catch (error) {
    throw error
  }
}

/**
 * Try-verify-feedback pattern implementation
 */
export async function tryVerifyFeedbackPattern(
  request: string,
  aiFunction: (input: any, options?: any) => Promise<any>,
  verifyFunction?: (result: any) => { valid: boolean; issues: string[] },
  maxRetries: number = 3
): Promise<any> {
  try {
    // First call: try to get a result from the AI function
    const tryResult = await aiFunction(request, { mode: 'try' })
    
    // Second call: verify the result
    const verifyResult = await aiFunction(request, { mode: 'verify' })
    
    return {
      response: tryResult.response || 'Here is my best attempt at processing your request.',
      assumptions: tryResult.assumptions || [],
      verified: verifyResult.valid !== false,
      issues: verifyResult.issues || []
    }
  } catch (error) {
    throw error
  }
}

/**
 * Graceful degradation when complete processing fails
 */
export async function gracefulDegradation(
  request: string,
  completeFunction: (input: any) => Promise<any>,
  partialFunction?: (input: any) => Promise<any>,
  fallbackFunction?: (input: any) => Promise<any>
): Promise<any> {
  try {
    // Try complete processing first
    const result = await completeFunction(request)
    return {
      success: true,
      partial: false,
      result: result.result || result,
      ...result
    }
  } catch (completeError) {
    console.warn('Complete processing failed, trying partial processing:', completeError)
    
    if (partialFunction) {
      try {
        const partialResult = await partialFunction(request)
        return {
          success: true,
          partial: true,
          result: partialResult.result || partialResult,
          ...partialResult
        }
      } catch (partialError) {
        console.warn('Partial processing also failed:', partialError)
        
        // Return error with the partial processing error message
        return {
          success: false,
          partial: false,
          error: {
            message: (partialError as Error).message || 'Partial processing failed'
          }
        }
      }
    }
    
    // Fallback to basic processing
    if (fallbackFunction) {
      try {
        const fallbackResult = await fallbackFunction(request)
        return {
          success: true,
          partial: true,
          result: fallbackResult.result || fallbackResult,
          fallback: true,
          ...fallbackResult
        }
      } catch (fallbackError) {
        console.warn('Fallback processing also failed:', fallbackError)
      }
    }
    
    // Generate minimal fallback result
    return {
      success: false,
      partial: false,
      error: {
        message: 'All processing methods failed',
        originalError: completeError
      },
      result: {
        message: 'Unable to process request completely',
        partialContent: request,
        suggestions: [
          'Try simplifying the request',
          'Provide more specific information',
          'Check if all required parameters are included'
        ]
      }
    }
  }
}

/**
 * Detect uncertainty in AI responses
 */
export function detectUncertainty(response: string): {
  uncertain: boolean
  confidenceScore: number
  uncertaintyIndicators: string[]
} {
  const uncertaintyPhrases = [
    "i'm not sure", "not sure", "i don't know", "don't know",
    "i think", "i believe", "probably", "maybe", "might be",
    "could be", "seems like", "appears to", "likely", "possibly",
    "uncertain", "unclear", "ambiguous", "vague",
    "i assume", "assuming", "presumably", "potentially", "perhaps", "roughly",
    "it's unclear", "without more", "don't have enough", "multiple ways",
    "could be interpreted", "looking for", "what you mean"
  ]
  
  const hedgingWords = [
    'somewhat', 'rather', 'quite', 'fairly', 'relatively',
    'generally', 'typically', 'usually', 'often', 'sometimes'
  ]
  
  const questionMarks = (response.match(/\?/g) || []).length
  const responseLength = response.length
  const lowerResponse = response.toLowerCase()
  
  const foundUncertaintyPhrases: string[] = []
  const foundHedgingWords: string[] = []
  
  // Check for uncertainty phrases
  for (const phrase of uncertaintyPhrases) {
    if (lowerResponse.includes(phrase)) {
      foundUncertaintyPhrases.push(phrase)
    }
  }
  
  // Check for hedging words
  for (const word of hedgingWords) {
    if (lowerResponse.includes(word)) {
      foundHedgingWords.push(word)
    }
  }
  
  // Calculate confidence score
  let confidenceScore = 1.0
  
  // Reduce confidence significantly for uncertainty phrases
  confidenceScore -= foundUncertaintyPhrases.length * 0.3
  
  // Reduce confidence for hedging words
  confidenceScore -= foundHedgingWords.length * 0.1
  
  // Reduce confidence for excessive question marks
  if (questionMarks > 1) {
    confidenceScore -= (questionMarks - 1) * 0.2
  }
  
  // Reduce confidence for very short responses (might indicate uncertainty)
  if (responseLength < 50) {
    confidenceScore -= 0.2
  }
  
  // Ensure confidence score is between 0 and 1
  confidenceScore = Math.max(0, Math.min(1, confidenceScore))
  
  const uncertaintyIndicators = [...foundUncertaintyPhrases, ...foundHedgingWords]
  if (questionMarks > 1) {
    uncertaintyIndicators.push(`multiple questions (${questionMarks})`)
  }
  if (responseLength < 50) {
    uncertaintyIndicators.push('very short response')
  }
  
  return {
    uncertain: confidenceScore < 0.7 || foundUncertaintyPhrases.length > 0,
    confidenceScore,
    uncertaintyIndicators
  }
}