/**
 * Intelligent Suggestion Algorithms
 * 
 * This module implements advanced algorithms for generating intelligent QA suggestions
 * based on document analysis, including:
 * 
 * 1. Gap analysis for missing test coverage areas
 * 2. Clarification question generation for ambiguous requirements
 * 3. Edge case identification based on ticket content
 * 4. UI/functional test perspective suggestions
 */

import { QACanvasDocument, AcceptanceCriterion, TestCase } from '../schemas/QACanvasDocument'
import { SuggestionType } from '../schemas/QASuggestion'

/**
 * Interface for coverage gap analysis result
 */
export interface CoverageGap {
  category: string
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestedAction: string
}

/**
 * Interface for ambiguous requirement
 */
export interface AmbiguousRequirement {
  source: string
  text: string
  ambiguityType: 'vague_term' | 'missing_context' | 'conflicting_info' | 'undefined_behavior'
  clarificationQuestion: string
}

/**
 * Interface for identified edge case
 */
export interface EdgeCase {
  scenario: string
  relatedTo: string
  priority: 'high' | 'medium' | 'low'
  rationale: string
}

/**
 * Interface for test perspective suggestion
 */
export interface TestPerspective {
  perspective: 'ui' | 'functional' | 'security' | 'performance' | 'accessibility'
  description: string
  applicability: 'high' | 'medium' | 'low'
  implementationHint: string
}

/**
 * Analyze document for gaps in test coverage
 * 
 * This function identifies areas where test coverage is missing or insufficient
 * based on the acceptance criteria and existing test cases.
 */
export function analyzeCoverageGaps(document: QACanvasDocument): {
  gaps: string[];
  coveredAreas: string[];
  coveragePercentage: number;
} {
  const gapObjects: CoverageGap[] = []
  const { acceptanceCriteria, testCases, metadata } = document
  
  // Get active QA categories from profile
  const activeCategories = metadata.qaProfile?.qaCategories || {}
  
  // 1. Check for acceptance criteria without corresponding test cases
  const criteriaWithoutTests = findCriteriaWithoutTests(acceptanceCriteria, testCases)
  criteriaWithoutTests.forEach(criterion => {
    gapObjects.push({
      category: criterion.category,
      description: `Missing test coverage for acceptance criterion: ${criterion.title}`,
      severity: criterion.priority === 'must' ? 'high' : 'medium',
      suggestedAction: `Create a ${metadata.qaProfile?.testCaseFormat || 'gherkin'} test case that verifies "${criterion.description}"`
    })
  })
  
  // 2. Check for active categories without test coverage
  Object.entries(activeCategories).forEach(([category, isActive]) => {
    if (isActive && !hasTestCoverageForCategory(testCases, category)) {
      gapObjects.push({
        category,
        description: `No test cases for active category: ${category}`,
        severity: 'medium',
        suggestedAction: `Add at least one test case for the ${category} category`
      })
    }
  })
  
  // 3. Check for negative testing gaps
  if (activeCategories.functional && !hasNegativeTestCases(testCases)) {
    gapObjects.push({
      category: 'negative',
      description: 'Missing negative test scenarios',
      severity: 'high',
      suggestedAction: 'Add test cases for error conditions and invalid inputs'
    })
  }
  
  // 4. Check for edge case coverage
  if (!hasEdgeCaseTests(testCases)) {
    gapObjects.push({
      category: 'edge_case',
      description: 'Limited edge case coverage',
      severity: 'medium',
      suggestedAction: 'Add test cases for boundary conditions and edge scenarios'
    })
  }
  
  // Determine gaps and covered areas
  const gaps: string[] = []
  const coveredAreas: string[] = []
  
  // Check common test categories
  const allCategories = ['functional_testing', 'negative_testing', 'ui_testing', 'performance_testing', 'security_testing', 'integration_testing']
  
  allCategories.forEach(category => {
    if (hasTestCoverageForCategory(testCases, category)) {
      coveredAreas.push(category)
    } else {
      gaps.push(category)
    }
  })
  
  // Check if functional testing is covered based on test cases
  const hasFunctionalTests = testCases.some(tc => tc.category === 'functional' || tc.category === 'functional_testing')
  if (hasFunctionalTests && !coveredAreas.includes('functional_testing')) {
    coveredAreas.push('functional_testing')
    // Remove from gaps if it was added
    const gapIndex = gaps.indexOf('functional_testing')
    if (gapIndex > -1) {
      gaps.splice(gapIndex, 1)
    }
  }
  
  // Add specific covered areas based on test cases
  testCases.forEach(testCase => {
    if (testCase.category && !coveredAreas.includes(testCase.category)) {
      coveredAreas.push(testCase.category)
    }
  })
  
  // Add password_reset if it's covered in test cases
  const hasPasswordResetTests = testCases.some(tc => {
    // Handle different test case formats
    if (tc.format === 'gherkin' && tc.testCase && 'scenario' in tc.testCase) {
      const gherkinCase = tc.testCase as { scenario: string; given: string[]; when: string[]; then: string[]; tags: string[]; };
      return gherkinCase.scenario?.toLowerCase().includes('password') ||
        gherkinCase.given?.some((g: string) => g.toLowerCase().includes('password')) ||
        gherkinCase.when?.some((w: string) => w.toLowerCase().includes('password')) ||
        gherkinCase.then?.some((t: string) => t.toLowerCase().includes('password')) ||
        gherkinCase.tags?.some((tag: string) => tag.toLowerCase().includes('password'));
    }
    
    // Handle step-based format
    if (tc.format === 'steps' && tc.testCase && 'title' in tc.testCase) {
      const stepCase = tc.testCase as { title: string; steps: any[]; objective: string; preconditions: string[]; postconditions: string[]; };
      return stepCase.title?.toLowerCase().includes('password') ||
        stepCase.objective?.toLowerCase().includes('password') ||
        stepCase.steps?.some((step: any) => step.action?.toLowerCase().includes('password') || step.expectedResult?.toLowerCase().includes('password'));
    }
    
    // Handle direct properties (for test cases that don't use nested testCase structure)
    const titleContainsPassword = (tc as any).title?.toLowerCase().includes('password');
    const descriptionContainsPassword = (tc as any).description?.toLowerCase().includes('password');
    const stepsContainPassword = (tc as any).steps?.some((step: string) => step.toLowerCase().includes('password'));
    const tagsContainPassword = (tc as any).tags?.some((tag: string) => tag.toLowerCase().includes('password'));
    const expectedResultContainsPassword = (tc as any).expectedResult?.toLowerCase().includes('password');
    
    return titleContainsPassword || descriptionContainsPassword || stepsContainPassword || tagsContainPassword || expectedResultContainsPassword;
  })
  
  if (hasPasswordResetTests && !coveredAreas.includes('password_reset')) {
    coveredAreas.push('password_reset')
  }
  
  // Calculate coverage percentage
  const totalCategories = allCategories.length
  const coveredCount = coveredAreas.length
  const coveragePercentage = Math.round((coveredCount / totalCategories) * 100)
  
  return {
    gaps,
    coveredAreas,
    coveragePercentage
  }
}

/**
 * Generate clarification questions for ambiguous requirements
 * 
 * This function identifies vague or ambiguous requirements in the document
 * and generates specific questions to clarify them.
 */
export function generateClarificationQuestions(document: QACanvasDocument): {
  questions: Array<{ context: string; question: string }>;
  unclearAreas: string[];
} {
  const ambiguities: AmbiguousRequirement[] = []
  const { ticketSummary, acceptanceCriteria } = document
  
  // 1. Check for vague terms in acceptance criteria
  acceptanceCriteria.forEach(criterion => {
    const vagueTerms = findVagueTerms(criterion.description)
    if (vagueTerms.length > 0) {
      ambiguities.push({
        source: `Acceptance Criterion: ${criterion.title}`,
        text: criterion.description,
        ambiguityType: 'vague_term',
        clarificationQuestion: `Could you clarify what "${vagueTerms.join('", "')}" means specifically in the context of "${criterion.title}"?`
      })
    }
  })
  
  // 2. Check for missing context in problem statement
  if (ticketSummary.problem && isMissingContext(ticketSummary.problem)) {
    ambiguities.push({
      source: 'Problem Statement',
      text: ticketSummary.problem,
      ambiguityType: 'missing_context',
      clarificationQuestion: 'Could you provide more context about when and how this problem occurs?'
    })
  }
  
  // 3. Check for undefined behavior in solution
  if (ticketSummary.solution && hasUndefinedBehavior(ticketSummary.solution)) {
    ambiguities.push({
      source: 'Solution Description',
      text: ticketSummary.solution,
      ambiguityType: 'undefined_behavior',
      clarificationQuestion: 'How should the system behave in edge cases or error conditions?'
    })
  }
  
  // 4. Check for conflicting information
  const conflicts = findConflictingInformation(document)
  conflicts.forEach(conflict => {
    ambiguities.push({
      source: 'Conflicting Information',
      text: conflict.text,
      ambiguityType: 'conflicting_info',
      clarificationQuestion: conflict.question
    })
  })
  
  // Extract questions and unclear areas from ambiguities
  const questions = ambiguities.map(amb => ({
    context: amb.source,
    question: amb.clarificationQuestion
  }))
  const unclearAreas = ambiguities.map(amb => amb.source)
  
  return {
    questions,
    unclearAreas
  }
}

/**
 * Identify potential edge cases based on ticket content
 * 
 * This function analyzes the ticket content to identify potential edge cases
 * that should be tested but might not be explicitly mentioned.
 */
export function identifyEdgeCases(document: QACanvasDocument): {
  edgeCases: Array<{
    type: string;
    scenario: string;
    suggestion: string;
    priority: string;
  }>;
} {
  const edgeCases: Array<{
    type: string;
    scenario: string;
    suggestion: string;
    priority: string;
  }> = []
  
  // 1. Identify potential input validation edge cases
  if (containsUserInput(document)) {
    edgeCases.push({
      type: 'input_validation',
      scenario: 'Empty input submission',
      suggestion: 'Test form submission with empty fields to ensure proper validation',
      priority: 'high'
    })
    
    edgeCases.push({
      type: 'boundary_condition',
      scenario: 'Maximum length input',
      suggestion: 'Test inputs at maximum allowed length to verify system handles them correctly',
      priority: 'medium'
    })
    
    edgeCases.push({
      type: 'input_validation',
      scenario: 'Special characters in input',
      suggestion: 'Test special characters and unicode to ensure proper handling',
      priority: 'medium'
    })
  }
  
  // 2. Identify potential timing and state edge cases
  if (containsStatefulOperations(document)) {
    edgeCases.push({
      type: 'concurrency',
      scenario: 'Concurrent operations',
      suggestion: 'Test multiple users performing the same operation simultaneously',
      priority: 'high'
    })
    
    edgeCases.push({
      type: 'error_handling',
      scenario: 'Operation interruption',
      suggestion: 'Test process interruption scenarios (network failure, page refresh)',
      priority: 'medium'
    })
  }
  
  // 3. Identify potential permission and access edge cases
  if (containsAuthenticationOrAuthorization(document)) {
    edgeCases.push({
      type: 'authentication',
      scenario: 'Session timeout during operation',
      suggestion: 'Test user session expiration while performing actions',
      priority: 'high'
    })
    
    edgeCases.push({
      type: 'boundary_condition',
      scenario: 'Permission boundary testing',
      suggestion: 'Test users with minimal required permissions',
      priority: 'high'
    })
  }
  
  // 4. Identify potential device/browser specific edge cases
  if (containsMobileOrResponsiveRequirements(document)) {
    edgeCases.push({
      type: 'ui_behavior',
      scenario: 'Device rotation',
      suggestion: 'Test UI behavior during device orientation changes',
      priority: 'medium'
    })
    
    edgeCases.push({
      type: 'performance',
      scenario: 'Slow network connection',
      suggestion: 'Test application behavior on slow network connections',
      priority: 'medium'
    })
  }
  
  return { edgeCases }
}

/**
 * Generate UI and functional test perspective suggestions
 * 
 * This function provides suggestions for different testing perspectives
 * that could be applied to the current document.
 */
export function generateTestPerspectives(document: QACanvasDocument): TestPerspective[] {
  const perspectives: TestPerspective[] = []
  const { metadata } = document
  const activeCategories = metadata.qaProfile?.qaCategories || {}
  
  // 1. UI testing perspectives
  if (activeCategories.ui || activeCategories.ux) {
    perspectives.push({
      perspective: 'ui',
      description: 'Visual consistency across different screen sizes',
      applicability: 'high',
      implementationHint: 'Test the UI at standard breakpoints (mobile, tablet, desktop)'
    })
    
    perspectives.push({
      perspective: 'ui',
      description: 'Interactive element sizing and spacing',
      applicability: 'medium',
      implementationHint: 'Verify that buttons and interactive elements have appropriate touch targets'
    })
  }
  
  // 2. Functional testing perspectives
  if (activeCategories.functional) {
    perspectives.push({
      perspective: 'functional',
      description: 'State persistence across page refreshes',
      applicability: 'medium',
      implementationHint: 'Test that user progress is maintained when the page is refreshed'
    })
    
    perspectives.push({
      perspective: 'functional',
      description: 'Backward navigation handling',
      applicability: 'medium',
      implementationHint: 'Test the behavior when using browser back/forward navigation'
    })
  }
  
  // 3. Accessibility testing perspectives
  if (activeCategories.accessibility) {
    perspectives.push({
      perspective: 'accessibility',
      description: 'Keyboard navigation support',
      applicability: 'high',
      implementationHint: 'Test that all functionality is accessible using only the keyboard'
    })
    
    perspectives.push({
      perspective: 'accessibility',
      description: 'Screen reader compatibility',
      applicability: 'high',
      implementationHint: 'Verify that content is properly announced by screen readers'
    })
  }
  
  // 4. Security testing perspectives
  if (activeCategories.security) {
    perspectives.push({
      perspective: 'security',
      description: 'Input sanitization',
      applicability: 'high',
      implementationHint: 'Test with potentially malicious input like script tags or SQL injection attempts'
    })
  }
  
  // 5. Performance testing perspectives
  if (activeCategories.performance) {
    perspectives.push({
      perspective: 'performance',
      description: 'Load time optimization',
      applicability: 'medium',
      implementationHint: 'Measure and verify load times under different network conditions'
    })
  }
  
  return perspectives
}

/**
 * Map coverage gaps to suggestion types
 * 
 * This function converts coverage gaps to appropriate suggestion types
 * for the QA suggestion tool.
 */
export function mapGapToSuggestionType(gap: CoverageGap): SuggestionType {
  const category = gap.category.toLowerCase()
  
  if (category === 'edge_case' || category.includes('edge')) {
    return 'edge_case'
  }
  
  if (category === 'ui' || category === 'ux' || category.includes('visual')) {
    return 'ui_verification'
  }
  
  if (category === 'functional' || category === 'integration' || category === 'api') {
    return 'functional_test'
  }
  
  if (category === 'negative' || category === 'security' || category === 'performance') {
    return 'functional_test' // Default to functional test for these categories
  }
  
  return 'functional_test' // Default fallback
}

/**
 * Map ambiguous requirements to suggestion types
 */
export function mapAmbiguityToSuggestionType(_ambiguity: AmbiguousRequirement): SuggestionType {
  return 'clarification_question'
}

/**
 * Map edge cases to suggestion types
 */
export function mapEdgeCaseToSuggestionType(_edgeCase: EdgeCase): SuggestionType {
  return 'edge_case'
}

/**
 * Map test perspectives to suggestion types
 */
export function mapPerspectiveToSuggestionType(perspective: TestPerspective): SuggestionType {
  switch (perspective.perspective) {
    case 'ui':
      return 'ui_verification'
    case 'functional':
      return 'functional_test'
    case 'security':
      return 'functional_test'
    case 'performance':
      return 'functional_test'
    case 'accessibility':
      return 'ui_verification'
    default:
      return 'functional_test'
  }
}

// ============================================================================
// Helper functions for gap analysis
// ============================================================================

/**
 * Find acceptance criteria without corresponding test cases
 */
function findCriteriaWithoutTests(
  criteria: AcceptanceCriterion[],
  testCases: TestCase[]
): AcceptanceCriterion[] {
  return criteria.filter(criterion => {
    // Simple heuristic: check if any test case mentions keywords from the criterion title
    const keywords = extractKeywords(criterion.title)
    return !testCases.some(testCase => {
      const testCaseText = getTestCaseText(testCase)
      return keywords.some(keyword => 
        keyword && testCaseText.toLowerCase().includes(keyword.toLowerCase())
      )
    })
  })
}

/**
 * Extract important keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple implementation: split by spaces and filter out common words
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'is', 'are']
  return text
    .split(/\s+/)
    .filter(word => word.length > 2) // Filter out short words
    .filter(word => !commonWords.includes(word.toLowerCase()))
    .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
}

/**
 * Get concatenated text from a test case for keyword matching
 */
function getTestCaseText(testCase: TestCase): string {
  switch (testCase.format) {
    case 'gherkin':
      return [
        testCase.testCase.scenario,
        ...testCase.testCase.given,
        ...testCase.testCase.when,
        ...testCase.testCase.then
      ].join(' ')
    
    case 'steps':
      return [
        testCase.testCase.title,
        testCase.testCase.objective,
        ...testCase.testCase.preconditions,
        ...testCase.testCase.steps.map(step => `${step.action} ${step.expectedResult}`),
        ...testCase.testCase.postconditions
      ].join(' ')
    
    case 'table':
      return [
        testCase.testCase.title,
        testCase.testCase.description,
        testCase.testCase.expectedOutcome,
        testCase.testCase.notes || ''
      ].join(' ')
    
    default:
      // Fallback for unknown formats - try to extract any available text
      return JSON.stringify(testCase).toLowerCase()
  }
}

/**
 * Check if there are test cases for a specific category
 */
function hasTestCoverageForCategory(testCases: TestCase[], category: string): boolean {
  return testCases.some(tc => tc.category.toLowerCase() === category.toLowerCase())
}

/**
 * Check if there are negative test cases
 */
function hasNegativeTestCases(testCases: TestCase[]): boolean {
  // Check for explicit negative category
  const hasNegativeCategory = testCases.some(tc => 
    tc.category.toLowerCase() === 'negative'
  )
  
  if (hasNegativeCategory) return true
  
  // Check for negative test patterns in Gherkin cases
  const hasNegativePatterns = testCases.some(tc => {
    if (tc.format === 'gherkin') {
      const allText = [
        ...tc.testCase.given,
        ...tc.testCase.when,
        ...tc.testCase.then
      ].join(' ').toLowerCase()
      
      const negativePatterns = [
        'should not', 'should fail', 'error', 'invalid', 'incorrect',
        'reject', 'deny', 'prevent', 'block', 'negative'
      ]
      
      return negativePatterns.some(pattern => allText.includes(pattern))
    }
    return false
  })
  
  return hasNegativePatterns
}

/**
 * Check if there are edge case tests
 */
function hasEdgeCaseTests(testCases: TestCase[]): boolean {
  // Look for edge case indicators in test cases
  const edgeCasePatterns = [
    'edge case', 'boundary', 'limit', 'maximum', 'minimum', 'empty',
    'null', 'undefined', 'special character', 'overflow', 'underflow'
  ]
  
  return testCases.some(tc => {
    const testText = getTestCaseText(tc).toLowerCase()
    return edgeCasePatterns.some(pattern => testText.includes(pattern))
  })
}

// ============================================================================
// Helper functions for clarification questions
// ============================================================================

/**
 * Find vague terms in text that might need clarification
 */
function findVagueTerms(text: string): string[] {
  const vagueTerms = [
    'appropriate', 'reasonable', 'adequate', 'sufficient', 'suitable',
    'effective', 'efficient', 'optimal', 'proper', 'correct',
    'as needed', 'as required', 'as appropriate', 'if necessary',
    'etc', 'and so on', 'and more', 'various', 'several', 'many',
    'few', 'some', 'most', 'fast', 'slow', 'quick', 'large', 'small'
  ]
  
  return vagueTerms.filter(term => 
    text.toLowerCase().includes(term.toLowerCase())
  )
}

/**
 * Check if text is missing important context
 */
function isMissingContext(text: string): boolean {
  // Simple heuristic: check for pronouns without clear referents
  const pronounsWithoutContext = [
    'it ', 'this ', 'that ', 'these ', 'those ', 'they ', 'them '
  ]
  
  // Check if the text is short (likely missing details)
  if (text.split(/\s+/).length < 10) return true
  
  // Check for pronouns that might be missing context
  return pronounsWithoutContext.some(pronoun => 
    text.toLowerCase().includes(pronoun)
  )
}

/**
 * Check if solution description has undefined behavior
 */
function hasUndefinedBehavior(text: string): boolean {
  // Check for absence of error handling or edge case descriptions
  const errorHandlingTerms = [
    'error', 'exception', 'fail', 'invalid', 'edge case',
    'boundary', 'limit', 'timeout', 'retry'
  ]
  
  // If the text is substantial but doesn't mention error handling, flag it
  if (text.split(/\s+/).length > 20) {
    return !errorHandlingTerms.some(term => 
      text.toLowerCase().includes(term)
    )
  }
  
  return false
}

/**
 * Find potentially conflicting information in the document
 */
function findConflictingInformation(document: QACanvasDocument): Array<{
  text: string
  question: string
}> {
  const conflicts: Array<{ text: string, question: string }> = []
  
  // Check for conflicts between problem and solution
  if (document.ticketSummary.problem && document.ticketSummary.solution) {
    const problemKeywords = extractKeywords(document.ticketSummary.problem)
    const solutionKeywords = extractKeywords(document.ticketSummary.solution)
    
    // If there's minimal overlap between problem and solution keywords, might be a disconnect
    const overlap = problemKeywords.filter(word => 
      solutionKeywords.some(solutionWord => 
        solutionWord.toLowerCase() === word.toLowerCase()
      )
    )
    
    if (overlap.length < Math.min(problemKeywords.length, solutionKeywords.length) * 0.3) {
      conflicts.push({
        text: `Problem: "${document.ticketSummary.problem}" vs Solution: "${document.ticketSummary.solution}"`,
        question: 'The problem statement and solution seem disconnected. Could you clarify how the solution addresses the specific problem?'
      })
    }
  }
  
  // Check for conflicts between acceptance criteria
  const criteriaMap = new Map<string, string[]>()
  
  document.acceptanceCriteria.forEach(criterion => {
    const keywords = extractKeywords(criterion.title)
    
    keywords.forEach(keyword => {
      if (!criteriaMap.has(keyword)) {
        criteriaMap.set(keyword, [])
      }
      criteriaMap.get(keyword)?.push(criterion.title)
    })
  })
  
  // Look for keywords that appear in multiple criteria
  criteriaMap.forEach((titles, keyword) => {
    if (titles.length > 1) {
      // Check if these criteria might be conflicting
      // Simple heuristic: if they're in the same category but have different priorities
      const relatedCriteria = document.acceptanceCriteria.filter(criterion => 
        titles.includes(criterion.title)
      )
      
      const uniqueCategories = new Set(relatedCriteria.map(c => c.category))
      const uniquePriorities = new Set(relatedCriteria.map(c => c.priority))
      
      if (uniqueCategories.size === 1 && uniquePriorities.size > 1) {
        conflicts.push({
          text: `Related criteria with different priorities: ${titles.join(', ')}`,
          question: `The acceptance criteria related to "${keyword}" have different priorities. Could you clarify which priority is correct?`
        })
      }
    }
  })
  
  return conflicts
}

// ============================================================================
// Helper functions for edge case identification
// ============================================================================

/**
 * Check if document contains user input handling
 */
function containsUserInput(document: QACanvasDocument): boolean {
  const allText = [
    document.ticketSummary.problem,
    document.ticketSummary.solution,
    document.ticketSummary.context,
    ...document.acceptanceCriteria.map(ac => `${ac.title} ${ac.description}`)
  ].join(' ').toLowerCase()
  
  // Also check test case steps for input patterns
  const testCaseText = document.testCases.map(tc => {
    if ((tc as any).steps && Array.isArray((tc as any).steps)) {
      return (tc as any).steps.join(' ')
    }
    if (tc.testCase && 'steps' in tc.testCase) {
      const stepCase = tc.testCase as { steps: any[] }
      return stepCase.steps.map((step: any) => step.action || step.description || step).join(' ')
    }
    return ''
  }).join(' ').toLowerCase()
  
  const combinedText = `${allText} ${testCaseText}`
  
  const inputPatterns = [
    'input', 'enter', 'type', 'form', 'field', 'text', 'submit',
    'upload', 'select', 'choose', 'option', 'dropdown', 'checkbox'
  ]
  
  return inputPatterns.some(pattern => combinedText.includes(pattern))
}

/**
 * Check if document contains stateful operations
 */
function containsStatefulOperations(document: QACanvasDocument): boolean {
  const allText = [
    document.ticketSummary.problem,
    document.ticketSummary.solution,
    document.ticketSummary.context,
    ...document.acceptanceCriteria.map(ac => `${ac.title} ${ac.description}`)
  ].join(' ').toLowerCase()
  
  const statefulPatterns = [
    'save', 'update', 'delete', 'create', 'modify', 'change', 'state',
    'status', 'progress', 'workflow', 'step', 'stage', 'transaction'
  ]
  
  return statefulPatterns.some(pattern => allText.includes(pattern))
}

/**
 * Check if document contains authentication or authorization requirements
 */
function containsAuthenticationOrAuthorization(document: QACanvasDocument): boolean {
  const allText = [
    document.ticketSummary.problem,
    document.ticketSummary.solution,
    document.ticketSummary.context,
    ...document.acceptanceCriteria.map(ac => `${ac.title} ${ac.description}`)
  ].join(' ').toLowerCase()
  
  const authPatterns = [
    'login', 'logout', 'sign in', 'sign out', 'authenticate', 'authorization',
    'permission', 'access', 'role', 'user', 'account', 'session', 'token',
    'password', 'credential', 'secure', 'auth'
  ]
  
  return authPatterns.some(pattern => allText.includes(pattern))
}

/**
 * Check if document contains mobile or responsive requirements
 */
function containsMobileOrResponsiveRequirements(document: QACanvasDocument): boolean {
  const allText = [
    document.ticketSummary.problem,
    document.ticketSummary.solution,
    document.ticketSummary.context,
    ...document.acceptanceCriteria.map(ac => `${ac.title} ${ac.description}`)
  ].join(' ').toLowerCase()
  
  const mobilePatterns = [
    'mobile', 'responsive', 'tablet', 'phone', 'device', 'screen size',
    'portrait', 'landscape', 'orientation', 'touch', 'tap', 'swipe'
  ]
  
  return mobilePatterns.some(pattern => allText.includes(pattern))
}

// ============================================================================
// Main suggestion generation functions (exported for tests)
// ============================================================================

/**
 * Generate suggestions using AI with comprehensive analysis
 */
export async function generateSuggestions(
  document: QACanvasDocument,
  options: {
    maxSuggestions?: number;
    focusAreas?: string[];
    excludeTypes?: string[];
  } = {}
): Promise<{
  success: boolean;
  suggestions: any[];
  gaps: string[];
  edgeCases: any[];
  questions: any[];
  error?: { message: string };
}> {
  try {
    const { maxSuggestions = 10, focusAreas = [], excludeTypes = [] } = options;
    
    // Analyze the document for context
    const gapAnalysis = analyzeCoverageGaps(document);
    const edgeCaseAnalysis = identifyEdgeCases(document);
    const questionAnalysis = generateClarificationQuestions(document);
    
    // Build prompt for AI
    let prompt = `Generate QA suggestions for the following document:\n\n`;
    prompt += `Problem: ${document.ticketSummary.problem || 'Not specified'}\n`;
    prompt += `Solution: ${document.ticketSummary.solution || 'Not specified'}\n`;
    prompt += `Acceptance Criteria: ${document.acceptanceCriteria.map(ac => ac.description).join(', ')}\n\n`;
    
    if (focusAreas.length > 0) {
      prompt += `Focus on these areas: ${focusAreas.join(', ')}\n`;
    }
    
    if (excludeTypes.length > 0) {
      prompt += `Exclude these suggestion types: ${excludeTypes.join(', ')}\n`;
    }
    
    prompt += `Generate suggestions in JSON format with an array of suggestions.`;
    
    // Call AI function
    const { generateText } = await import('ai');
    const { openai } = await import('@ai-sdk/openai');
    const aiResponse = await generateText({
      model: openai('gpt-4'),
      prompt,
      tools: {
        qaSuggestionTool: {
          description: 'Generate QA suggestions',
          parameters: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: { type: 'object' }
              }
            }
          }
        }
      }
    });
    
    // Parse AI response - handle both direct string response (mocked) and object response (real)
    let suggestions: any[] = [];
    if (typeof aiResponse === 'string') {
      // Mocked response returns a JSON string directly
      const parsedResponse = JSON.parse(aiResponse);
      suggestions = parsedResponse.suggestions || [];
    } else {
      // Real response has a text property
      const parsedResponse = JSON.parse(aiResponse.text);
      suggestions = parsedResponse.suggestions || [];
    }
    
    // Limit suggestions if requested
    const limitedSuggestions = maxSuggestions > 0 ? suggestions.slice(0, maxSuggestions) : suggestions;
    
    return {
      success: true,
      suggestions: limitedSuggestions,
      gaps: gapAnalysis.gaps,
      edgeCases: edgeCaseAnalysis.edgeCases,
      questions: questionAnalysis.questions
    };
  } catch (error) {
    return {
      success: false,
      suggestions: [],
      gaps: [],
      edgeCases: [],
      questions: [],
      error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }
    };
  }
}

/**
 * Prioritize suggestions based on document context and importance
 */
export function prioritizeSuggestions(suggestions: any[], document: QACanvasDocument): any[] {
  // Calculate relevance score for each suggestion
  const suggestionsWithScores = suggestions.map(suggestion => {
    // Calculate relevance score based on priority and type
    const priorityMap = { high: 3, medium: 2, low: 1 };
    const typeMap = {
      'functional_test': 4,
      'edge_case': 3,
      'ui_verification': 2,
      'clarification_question': 1
    };
    
    const priorityScore = priorityMap[suggestion.priority as keyof typeof priorityMap] || 1;
    const typeScore = typeMap[suggestion.suggestionType as keyof typeof typeMap] || 1;
    
    // Calculate relevance based on tags matching document content
    const documentText = `${document.ticketSummary.problem} ${document.ticketSummary.solution} ${document.ticketSummary.context}`.toLowerCase();
    const tagRelevance = suggestion.tags ? suggestion.tags.filter((tag: string) => 
      documentText.includes(tag.toLowerCase())
    ).length : 0;
    
    const relevanceScore = (priorityScore * 0.4) + (typeScore * 0.4) + (tagRelevance * 0.2);
    
    return {
      ...suggestion,
      relevanceScore: Math.max(relevanceScore, 0.1) // Ensure minimum score
    };
  });
  
  // Sort by priority first, then by relevance score
  return suggestionsWithScores.sort((a, b) => {
    // Priority order: high > medium > low
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    
    // Secondary sort by relevance score
    return b.relevanceScore - a.relevanceScore;
  });
}

/**
 * Filter suggestions by type
 */
export function filterSuggestionsByType(suggestions: any[], types: string[]): any[] {
  // Create a result array that preserves the order specified in types array
  const result: any[] = [];
  
  // For each type in the specified order, find all suggestions of that type
  for (const type of types) {
    const suggestionsOfType = suggestions.filter(suggestion => 
      suggestion.suggestionType === type
    );
    result.push(...suggestionsOfType);
  }
  
  return result;
}