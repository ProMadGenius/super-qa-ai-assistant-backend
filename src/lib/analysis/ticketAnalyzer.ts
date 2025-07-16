/**
 * Ticket Analysis Service
 * Handles intelligent analysis of Jira tickets for QA documentation generation
 */

import { JiraTicket } from '../schemas/JiraTicket'
import { QAProfile } from '../schemas/QAProfile'

/**
 * Ticket summary structure
 */
export interface TicketSummary {
  problem: string
  solution: string
  context: string
}

/**
 * Configuration warning structure
 */
export interface ConfigurationWarning {
  type: 'category_mismatch' | 'missing_capability' | 'recommendation'
  title: string
  message: string
  recommendation: string
  severity: 'high' | 'medium' | 'low'
}

/**
 * Analyze ticket content and extract problem, solution, and context
 */
export function analyzeTicketContent(ticket: JiraTicket): TicketSummary {
  // Extract problem from summary and description
  const problem = extractProblemStatement(ticket)
  
  // Extract solution from description and comments
  const solution = extractSolutionStatement(ticket)
  
  // Extract context from components, custom fields, and metadata
  const context = extractContextInformation(ticket)
  
  return {
    problem,
    solution,
    context
  }
}

/**
 * Extract problem statement from ticket data
 */
function extractProblemStatement(ticket: JiraTicket): string {
  const summary = ticket.summary.toLowerCase()
  const description = ticket.description.toLowerCase()
  
  // Common problem indicators
  const problemKeywords = [
    'bug', 'issue', 'error', 'problem', 'fail', 'broken', 'not working',
    'unable to', 'cannot', 'does not', 'missing', 'incorrect'
  ]
  
  // Check if this is a bug/issue ticket
  if (ticket.issueType.toLowerCase().includes('bug') || 
      problemKeywords.some(keyword => summary.includes(keyword) || description.includes(keyword))) {
    
    // Extract the core problem
    let problemText = ticket.summary
    
    // Add context from description if it provides more clarity
    if (ticket.description && ticket.description.length > 0) {
      const descriptionLines = ticket.description.split('\n').slice(0, 2) // First 2 lines
      const relevantDescription = descriptionLines.join(' ').substring(0, 200)
      if (relevantDescription.trim() && !problemText.toLowerCase().includes(relevantDescription.toLowerCase().substring(0, 50))) {
        problemText += `. ${relevantDescription}`
      }
    }
    
    return problemText.trim()
  }
  
  // For feature/story tickets, the "problem" is the need or requirement
  return `Need to implement: ${ticket.summary}`
}

/**
 * Extract solution statement from ticket data
 */
function extractSolutionStatement(ticket: JiraTicket): string {
  const description = ticket.description
  const issueType = ticket.issueType.toLowerCase()
  
  // For bugs, look for solution in description or comments
  if (issueType.includes('bug')) {
    // Look for solution indicators in description
    const solutionKeywords = ['fix', 'resolve', 'solution', 'implement', 'change', 'update', 'modify']
    
    if (description) {
      const sentences = description.split(/[.!?]+/)
      const solutionSentence = sentences.find(sentence => 
        solutionKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
      )
      
      if (solutionSentence) {
        return solutionSentence.trim()
      }
    }
    
    // Check recent comments for solution information
    const recentComments = ticket.comments.slice(-3) // Last 3 comments
    for (const comment of recentComments) {
      if (solutionKeywords.some(keyword => comment.body.toLowerCase().includes(keyword))) {
        return comment.body.substring(0, 200).trim() + (comment.body.length > 200 ? '...' : '')
      }
    }
    
    return `Fix the issue described in: ${ticket.summary}`
  }
  
  // For features/stories, the solution is the implementation
  if (description && description.length > 0) {
    // Take the first meaningful paragraph from description
    const paragraphs = description.split('\n\n').filter(p => p.trim().length > 20)
    if (paragraphs.length > 0) {
      return paragraphs[0].substring(0, 300).trim() + (paragraphs[0].length > 300 ? '...' : '')
    }
  }
  
  return `Implement the feature as described in: ${ticket.summary}`
}

/**
 * Extract context information from ticket metadata
 */
function extractContextInformation(ticket: JiraTicket): string {
  const contextParts: string[] = []
  
  // Add component context
  if (ticket.components.length > 0) {
    contextParts.push(`Affects components: ${ticket.components.join(', ')}`)
  }
  
  // Add priority context
  if (ticket.priority && ticket.priority !== 'None') {
    contextParts.push(`Priority: ${ticket.priority}`)
  }
  
  // Add custom field context (if relevant)
  const relevantCustomFields = Object.entries(ticket.customFields)
    .filter(([key, value]) => value && typeof value === 'string' && value.length > 0)
    .slice(0, 2) // Limit to 2 most relevant
  
  if (relevantCustomFields.length > 0) {
    const customFieldText = relevantCustomFields
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
    contextParts.push(customFieldText)
  }
  
  // Add assignee context if available
  if (ticket.assignee && ticket.assignee !== 'Unassigned') {
    contextParts.push(`Assigned to: ${ticket.assignee}`)
  }
  
  return contextParts.join('. ') || 'General development task'
}

/**
 * Detect configuration conflicts between ticket requirements and QA settings
 */
export function detectConfigurationConflicts(
  ticket: JiraTicket, 
  qaProfile: QAProfile
): ConfigurationWarning[] {
  const warnings: ConfigurationWarning[] = []
  
  // Check for API testing needs
  if (requiresAPITesting(ticket) && !qaProfile.qaCategories.api) {
    warnings.push({
      type: 'category_mismatch',
      title: 'API Testing Recommended',
      message: 'This ticket appears to involve API changes or integrations, but API testing is disabled in your QA profile.',
      recommendation: 'Consider enabling API testing category to ensure comprehensive coverage of backend functionality.',
      severity: 'high'
    })
  }
  
  // Check for database testing needs
  if (requiresDatabaseTesting(ticket) && !qaProfile.qaCategories.database) {
    warnings.push({
      type: 'category_mismatch',
      title: 'Database Testing Recommended',
      message: 'This ticket involves database changes or data operations, but database testing is disabled.',
      recommendation: 'Enable database testing category to cover data integrity, migrations, and query performance.',
      severity: 'high'
    })
  }
  
  // Check for security testing needs
  if (requiresSecurityTesting(ticket) && !qaProfile.qaCategories.security) {
    warnings.push({
      type: 'category_mismatch',
      title: 'Security Testing Recommended',
      message: 'This ticket involves authentication, authorization, or sensitive data handling.',
      recommendation: 'Enable security testing category to ensure proper validation of security controls.',
      severity: 'high'
    })
  }
  
  // Check for performance testing needs
  if (requiresPerformanceTesting(ticket) && !qaProfile.qaCategories.performance) {
    warnings.push({
      type: 'category_mismatch',
      title: 'Performance Testing Recommended',
      message: 'This ticket may impact system performance or involves large data operations.',
      recommendation: 'Consider enabling performance testing to validate response times and resource usage.',
      severity: 'medium'
    })
  }
  
  // Check for mobile testing needs
  if (requiresMobileTesting(ticket) && !qaProfile.qaCategories.mobile) {
    warnings.push({
      type: 'category_mismatch',
      title: 'Mobile Testing Recommended',
      message: 'This ticket affects mobile functionality or responsive design.',
      recommendation: 'Enable mobile testing category to ensure cross-device compatibility.',
      severity: 'medium'
    })
  }
  
  // Check for accessibility testing needs
  if (requiresAccessibilityTesting(ticket) && !qaProfile.qaCategories.accessibility) {
    warnings.push({
      type: 'category_mismatch',
      title: 'Accessibility Testing Recommended',
      message: 'This ticket involves UI changes that may affect accessibility compliance.',
      recommendation: 'Enable accessibility testing to ensure WCAG compliance and inclusive design.',
      severity: 'medium'
    })
  }
  
  // Check test case format recommendations
  const formatRecommendation = recommendTestCaseFormat(ticket, qaProfile)
  if (formatRecommendation) {
    warnings.push(formatRecommendation)
  }
  
  return warnings
}

/**
 * Check if ticket requires API testing
 */
function requiresAPITesting(ticket: JiraTicket): boolean {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const apiKeywords = [
    'api', 'endpoint', 'rest', 'graphql', 'webhook', 'integration',
    'service', 'microservice', 'backend', 'server', 'request', 'response'
  ]
  
  return apiKeywords.some(keyword => content.includes(keyword)) ||
         ticket.components.some(comp => comp.toLowerCase().includes('api') || comp.toLowerCase().includes('backend'))
}

/**
 * Check if ticket requires database testing
 */
function requiresDatabaseTesting(ticket: JiraTicket): boolean {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const dbKeywords = [
    'database', 'db', 'sql', 'query', 'table', 'migration', 'schema',
    'data', 'storage', 'persistence', 'repository', 'model'
  ]
  
  return dbKeywords.some(keyword => content.includes(keyword))
}

/**
 * Check if ticket requires security testing
 */
function requiresSecurityTesting(ticket: JiraTicket): boolean {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const securityKeywords = [
    'auth', 'login', 'password', 'token', 'security', 'permission',
    'role', 'access', 'encrypt', 'decrypt', 'ssl', 'https', 'oauth'
  ]
  
  return securityKeywords.some(keyword => content.includes(keyword))
}

/**
 * Check if ticket requires performance testing
 */
function requiresPerformanceTesting(ticket: JiraTicket): boolean {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const performanceKeywords = [
    'performance', 'slow', 'speed', 'optimization', 'cache', 'load',
    'scale', 'memory', 'cpu', 'timeout', 'latency', 'throughput'
  ]
  
  return performanceKeywords.some(keyword => content.includes(keyword)) ||
         ticket.priority.toLowerCase().includes('high')
}

/**
 * Check if ticket requires mobile testing
 */
function requiresMobileTesting(ticket: JiraTicket): boolean {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const mobileKeywords = [
    'mobile', 'responsive', 'tablet', 'phone', 'ios', 'android',
    'touch', 'swipe', 'gesture', 'viewport', 'breakpoint'
  ]
  
  return mobileKeywords.some(keyword => content.includes(keyword))
}

/**
 * Check if ticket requires accessibility testing
 */
function requiresAccessibilityTesting(ticket: JiraTicket): boolean {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const a11yKeywords = [
    'accessibility', 'a11y', 'wcag', 'screen reader', 'keyboard',
    'contrast', 'aria', 'alt text', 'focus', 'disability'
  ]
  
  return a11yKeywords.some(keyword => content.includes(keyword))
}

/**
 * Recommend optimal test case format based on ticket content
 */
function recommendTestCaseFormat(ticket: JiraTicket, qaProfile: QAProfile): ConfigurationWarning | null {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  
  // Recommend Gherkin for user-facing features
  if (qaProfile.testCaseFormat !== 'gherkin' && 
      (content.includes('user') || content.includes('customer') || 
       content.includes('interface') || ticket.issueType.toLowerCase().includes('story'))) {
    return {
      type: 'recommendation',
      title: 'Gherkin Format Recommended',
      message: 'This user-facing feature would benefit from Gherkin format for better stakeholder communication.',
      recommendation: 'Consider using Gherkin format (Given-When-Then) for clearer business requirement validation.',
      severity: 'low'
    }
  }
  
  // Recommend table format for data-heavy testing
  if (qaProfile.testCaseFormat !== 'table' && 
      (content.includes('data') || content.includes('import') || 
       content.includes('export') || content.includes('batch'))) {
    return {
      type: 'recommendation',
      title: 'Table Format Recommended',
      message: 'This data-focused ticket would benefit from table format for systematic data validation.',
      recommendation: 'Consider using table format for comprehensive data scenario coverage.',
      severity: 'low'
    }
  }
  
  return null
}

/**
 * Generate test case categories based on active QA profile settings
 */
export function generateTestCaseCategories(qaProfile: QAProfile): string[] {
  return Object.entries(qaProfile.qaCategories)
    .filter(([_, active]) => active)
    .map(([category]) => category)
}

/**
 * Estimate test case complexity based on ticket content
 */
export function estimateTestComplexity(ticket: JiraTicket): 'low' | 'medium' | 'high' {
  const content = `${ticket.summary} ${ticket.description}`.toLowerCase()
  const complexityIndicators = {
    high: ['integration', 'complex', 'multiple', 'workflow', 'process', 'system'],
    medium: ['feature', 'enhancement', 'update', 'modify', 'change'],
    low: ['fix', 'bug', 'simple', 'minor', 'small']
  }
  
  // Check for high complexity indicators
  if (complexityIndicators.high.some(indicator => content.includes(indicator))) {
    return 'high'
  }
  
  // Check for low complexity indicators
  if (complexityIndicators.low.some(indicator => content.includes(indicator))) {
    return 'low'
  }
  
  // Default to medium complexity
  return 'medium'
}