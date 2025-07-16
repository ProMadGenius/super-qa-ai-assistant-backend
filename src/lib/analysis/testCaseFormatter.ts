/**
 * Test Case Formatting Service
 * Handles formatting logic for different test case formats (Gherkin, Steps, Table)
 */

import { QAProfile } from '../schemas/QAProfile'
import { JiraTicket } from '../schemas/JiraTicket'

/**
 * Test case format-specific guidance for AI prompts
 */
export interface TestCaseFormatGuidance {
  format: 'gherkin' | 'steps' | 'table'
  description: string
  structure: string
  examples: string
  bestPractices: string[]
}

/**
 * Get detailed formatting guidance for AI prompt construction
 */
export function getTestCaseFormatGuidance(format: 'gherkin' | 'steps' | 'table'): TestCaseFormatGuidance {
  switch (format) {
    case 'gherkin':
      return {
        format: 'gherkin',
        description: 'Behavior-Driven Development format using Given-When-Then structure',
        structure: `
Scenario: [Clear scenario description]
Given [Initial context/preconditions]
When [Action or event]
Then [Expected outcome]
And [Additional conditions if needed]
Tags: [Optional tags for categorization]`,
        examples: `
Example:
Scenario: User successfully logs in with valid credentials
Given the user is on the login page
And the user has a valid account
When the user enters correct username and password
And clicks the login button
Then the user should be redirected to the dashboard
And a welcome message should be displayed
Tags: @authentication @happy-path`,
        bestPractices: [
          'Use clear, business-readable language',
          'Focus on user behavior and outcomes',
          'Keep scenarios focused on single functionality',
          'Use consistent terminology throughout',
          'Include both positive and negative scenarios',
          'Add relevant tags for test organization'
        ]
      }
    
    case 'steps':
      return {
        format: 'steps',
        description: 'Traditional step-by-step test case format with detailed actions and expected results',
        structure: `
Title: [Clear test case title]
Objective: [What this test validates]
Preconditions: [Setup requirements]
Steps:
  1. Action: [Detailed action to perform]
     Expected Result: [What should happen]
     Notes: [Optional additional information]
  2. Action: [Next action]
     Expected Result: [Expected outcome]
Postconditions: [Cleanup or final state]`,
        examples: `
Example:
Title: Verify user login with valid credentials
Objective: Ensure users can successfully authenticate with correct credentials
Preconditions: 
  - User account exists in system
  - Login page is accessible
Steps:
  1. Action: Navigate to login page
     Expected Result: Login form is displayed with username and password fields
  2. Action: Enter valid username in username field
     Expected Result: Username is accepted and field shows entered value
  3. Action: Enter valid password in password field
     Expected Result: Password is masked and field shows dots/asterisks
  4. Action: Click Login button
     Expected Result: User is redirected to dashboard page
     Notes: Redirect should happen within 3 seconds
Postconditions: User session is established and can access protected pages`,
        bestPractices: [
          'Write detailed, unambiguous actions',
          'Include specific expected results for each step',
          'Number steps sequentially',
          'Include setup and teardown requirements',
          'Add notes for complex or time-sensitive operations',
          'Specify exact UI elements to interact with'
        ]
      }
    
    case 'table':
      return {
        format: 'table',
        description: 'Data-driven test format using tabular structure for systematic validation',
        structure: `
Title: [Clear test case title]
Description: [What this test validates]
Test Data: [Array of input/output data combinations]
  - Input Field: [value]
  - Expected Output: [expected result]
Expected Outcome: [Overall expected result]
Notes: [Optional additional information]`,
        examples: `
Example:
Title: Validate user registration form with various input combinations
Description: Ensure registration form properly validates different input scenarios
Test Data:
  - Username: "validuser", Email: "user@example.com", Password: "SecurePass123"
    Expected: Registration successful, confirmation email sent
  - Username: "", Email: "user@example.com", Password: "SecurePass123"
    Expected: Error message "Username is required"
  - Username: "validuser", Email: "invalid-email", Password: "SecurePass123"
    Expected: Error message "Please enter a valid email address"
  - Username: "validuser", Email: "user@example.com", Password: "123"
    Expected: Error message "Password must be at least 8 characters"
Expected Outcome: Form validates all inputs correctly and provides appropriate feedback
Notes: Test with both keyboard and mouse interactions`,
        bestPractices: [
          'Include comprehensive data combinations',
          'Test boundary conditions and edge cases',
          'Organize data logically (valid cases first, then invalid)',
          'Include expected outcomes for each data set',
          'Consider performance implications for large data sets',
          'Document any special data setup requirements'
        ]
      }
    
    default:
      throw new Error(`Unsupported test case format: ${format}`)
  }
}

/**
 * Generate format-specific prompt guidance for AI
 */
export function generateFormatPromptGuidance(
  format: 'gherkin' | 'steps' | 'table',
  ticket: JiraTicket,
  qaProfile: QAProfile
): string {
  const guidance = getTestCaseFormatGuidance(format)
  const activeCategories = Object.entries(qaProfile.qaCategories)
    .filter(([_, active]) => active)
    .map(([category]) => category)
    .join(', ')
  
  return `
**TEST CASE FORMAT: ${format.toUpperCase()}**

${guidance.description}

**STRUCTURE TO FOLLOW:**
${guidance.structure}

**EXAMPLE:**
${guidance.examples}

**BEST PRACTICES FOR THIS FORMAT:**
${guidance.bestPractices.map(practice => `- ${practice}`).join('\n')}

**SPECIFIC REQUIREMENTS FOR THIS TICKET:**
- Focus on these QA categories: ${activeCategories}
- Ticket type: ${ticket.issueType}
- Priority: ${ticket.priority}
- Components: ${ticket.components.join(', ') || 'None specified'}

**CONTENT GUIDELINES:**
- Create test cases that directly validate the ticket requirements
- Include both positive (happy path) and negative (error) scenarios
- Ensure test cases are executable and specific
- Use consistent terminology from the ticket description
- Consider the user perspective and business impact
- Include appropriate priority levels (high, medium, low)
`
}

/**
 * Validate test case format requirements
 */
export function validateFormatRequirements(
  format: 'gherkin' | 'steps' | 'table',
  testCaseData: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  switch (format) {
    case 'gherkin':
      if (!testCaseData.scenario) errors.push('Gherkin format requires a scenario')
      if (!testCaseData.given || !Array.isArray(testCaseData.given) || testCaseData.given.length === 0) {
        errors.push('Gherkin format requires at least one Given statement')
      }
      if (!testCaseData.when || !Array.isArray(testCaseData.when) || testCaseData.when.length === 0) {
        errors.push('Gherkin format requires at least one When statement')
      }
      if (!testCaseData.then || !Array.isArray(testCaseData.then) || testCaseData.then.length === 0) {
        errors.push('Gherkin format requires at least one Then statement')
      }
      break
    
    case 'steps':
      if (!testCaseData.title) errors.push('Steps format requires a title')
      if (!testCaseData.objective) errors.push('Steps format requires an objective')
      if (!testCaseData.steps || !Array.isArray(testCaseData.steps) || testCaseData.steps.length === 0) {
        errors.push('Steps format requires at least one step')
      } else {
        testCaseData.steps.forEach((step: any, index: number) => {
          if (!step.action) errors.push(`Step ${index + 1} requires an action`)
          if (!step.expectedResult) errors.push(`Step ${index + 1} requires an expected result`)
        })
      }
      break
    
    case 'table':
      if (!testCaseData.title) errors.push('Table format requires a title')
      if (!testCaseData.description) errors.push('Table format requires a description')
      if (!testCaseData.expectedOutcome) errors.push('Table format requires an expected outcome')
      if (!testCaseData.testData || !Array.isArray(testCaseData.testData)) {
        errors.push('Table format requires test data array')
      }
      break
    
    default:
      errors.push(`Unsupported format: ${format}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get recommended test case count based on ticket complexity and format
 */
export function getRecommendedTestCaseCount(
  ticket: JiraTicket,
  format: 'gherkin' | 'steps' | 'table',
  complexity: 'low' | 'medium' | 'high'
): { min: number; max: number; recommended: number } {
  const baseCount = {
    low: { min: 2, max: 4, recommended: 3 },
    medium: { min: 3, max: 6, recommended: 4 },
    high: { min: 4, max: 8, recommended: 6 }
  }
  
  const formatMultiplier = {
    gherkin: 1.0,  // Standard count
    steps: 0.8,    // Slightly fewer due to more detailed steps
    table: 1.2     // More scenarios due to data-driven nature
  }
  
  const base = baseCount[complexity]
  const multiplier = formatMultiplier[format]
  
  return {
    min: Math.max(1, Math.floor(base.min * multiplier)),
    max: Math.ceil(base.max * multiplier),
    recommended: Math.ceil(base.recommended * multiplier)
  }
}

/**
 * Generate category-specific test case suggestions
 */
export function generateCategoryTestSuggestions(
  categories: string[],
  ticket: JiraTicket
): { category: string; suggestions: string[] }[] {
  const suggestions: { category: string; suggestions: string[] }[] = []
  
  categories.forEach(category => {
    switch (category) {
      case 'functional':
        suggestions.push({
          category: 'functional',
          suggestions: [
            'Test core functionality works as specified',
            'Verify all business rules are enforced',
            'Test integration with dependent systems',
            'Validate data processing and calculations'
          ]
        })
        break
      
      case 'ui':
        suggestions.push({
          category: 'ui',
          suggestions: [
            'Verify UI elements are displayed correctly',
            'Test responsive design across screen sizes',
            'Validate form layouts and field alignment',
            'Check visual consistency with design system'
          ]
        })
        break
      
      case 'ux':
        suggestions.push({
          category: 'ux',
          suggestions: [
            'Test user workflow and navigation flow',
            'Verify intuitive user interactions',
            'Test error message clarity and helpfulness',
            'Validate loading states and feedback'
          ]
        })
        break
      
      case 'negative':
        suggestions.push({
          category: 'negative',
          suggestions: [
            'Test with invalid input data',
            'Verify error handling for edge cases',
            'Test system behavior under failure conditions',
            'Validate security boundaries and access controls'
          ]
        })
        break
      
      case 'api':
        suggestions.push({
          category: 'api',
          suggestions: [
            'Test API endpoints with valid requests',
            'Verify response formats and status codes',
            'Test authentication and authorization',
            'Validate rate limiting and error responses'
          ]
        })
        break
      
      case 'database':
        suggestions.push({
          category: 'database',
          suggestions: [
            'Test data persistence and retrieval',
            'Verify database constraints and validations',
            'Test transaction handling and rollbacks',
            'Validate data migration and schema changes'
          ]
        })
        break
      
      case 'performance':
        suggestions.push({
          category: 'performance',
          suggestions: [
            'Test response times under normal load',
            'Verify system behavior with large datasets',
            'Test concurrent user scenarios',
            'Validate memory and resource usage'
          ]
        })
        break
      
      case 'security':
        suggestions.push({
          category: 'security',
          suggestions: [
            'Test authentication and session management',
            'Verify input validation and sanitization',
            'Test authorization and access controls',
            'Validate data encryption and protection'
          ]
        })
        break
      
      case 'mobile':
        suggestions.push({
          category: 'mobile',
          suggestions: [
            'Test touch interactions and gestures',
            'Verify responsive behavior on mobile devices',
            'Test orientation changes and screen sizes',
            'Validate mobile-specific functionality'
          ]
        })
        break
      
      case 'accessibility':
        suggestions.push({
          category: 'accessibility',
          suggestions: [
            'Test keyboard navigation and focus management',
            'Verify screen reader compatibility',
            'Test color contrast and visual accessibility',
            'Validate ARIA labels and semantic markup'
          ]
        })
        break
    }
  })
  
  return suggestions
}