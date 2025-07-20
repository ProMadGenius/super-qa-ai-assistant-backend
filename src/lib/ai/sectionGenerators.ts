/**
 * Section-based QA document generation with optimized prompts
 * Generates document sections in parallel for better performance and quality
 */

import { generateTextWithFailover } from './providerFailover'
import { z } from 'zod'
import type { QACanvasDocument } from '../schemas/QACanvasDocument'
import type { TicketAnalysisPayload } from '../schemas/TicketAnalysisPayload'

// Schemas for individual sections
const ticketSummarySchema = z.object({
  problem: z.string().describe('Root issue and business impact'),
  solution: z.string().describe('What is actually being implemented'),
  context: z.string().describe('How this fits the broader strategy')
})

const acceptanceCriteriaSchema = z.array(z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['must', 'should', 'could']),
  category: z.string(),
  testable: z.boolean()
}))

const testCasesSchema = z.array(z.object({
  format: z.string(),
  id: z.string(),
  category: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedTime: z.string().optional(),
  testCase: z.union([
    // Gherkin format
    z.object({
      scenario: z.string(),
      given: z.array(z.string()),
      when: z.array(z.string()),
      then: z.array(z.string()),
      tags: z.array(z.string())
    }),
    // Steps format
    z.object({
      title: z.string(),
      objective: z.string(),
      steps: z.array(z.object({
        action: z.string(),
        expectedResult: z.string()
      }))
    }),
    // Table format
    z.object({
      title: z.string(),
      description: z.string(),
      expectedOutcome: z.string()
    })
  ])
}))

const configurationWarningsSchema = z.array(z.object({
  type: z.string(),
  title: z.string(),
  message: z.string(),
  recommendation: z.string(),
  severity: z.enum(['low', 'medium', 'high'])
}))

/**
 * Build base context shared across all section generators
 */
function buildBaseContext(ticketJson: any, qaProfile: any): string {
  const activeCategories = Object.entries(qaProfile.qaCategories)
    .filter(([_, active]) => active)
    .map(([category]) => category)
    .join(', ')

  // Get only the most relevant comments (last 3 + any with key decisions)
  const keyComments = ticketJson.comments
    .slice(-3) // Last 3 comments
    .map((comment: any, index: number) => 
      `${comment.author}: ${comment.body.substring(0, 200)}${comment.body.length > 200 ? '...' : ''}`
    )
    .join('\n')

  return `**TICKET CONTEXT:**
- Issue: ${ticketJson.issueKey} - ${ticketJson.summary}
- Type: ${ticketJson.issueType} | Priority: ${ticketJson.priority} | Status: ${ticketJson.status}
- Assignee: ${ticketJson.assignee || 'Unassigned'}

**DESCRIPTION:**
${ticketJson.description.substring(0, 1000)}${ticketJson.description.length > 1000 ? '...' : ''}

**KEY RECENT COMMENTS:**
${keyComments || 'No recent comments'}

**CUSTOM FIELDS:**
${Object.entries(ticketJson.customFields).slice(0, 3).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

**QA PROFILE:**
- Format: ${qaProfile.testCaseFormat}
- Active Categories: ${activeCategories}
- Include Images: ${qaProfile.includeImages}`
}

/**
 * Generate ticket summary section
 */
export async function generateTicketSummary(
  ticketJson: any,
  qaProfile: any,
  requestId: string
): Promise<{ problem: string; solution: string; context: string }> {
  const startTime = Date.now()
  console.log(`📋 [${requestId}] Generating ticket summary...`)

  const baseContext = buildBaseContext(ticketJson, qaProfile)
  
  const prompt = `${baseContext}

**TASK:** Generate ONLY the ticket summary section.

Analyze the ticket and create a concise summary focusing on:

1. **Problem**: What is the root issue and its business impact?
2. **Solution**: What is ACTUALLY being implemented based on recent comments and current status?
3. **Context**: How does this work fit into the broader resolution strategy?

**ANALYSIS FOCUS:**
- Read the description to understand the original problem
- Check recent comments to understand current implementation scope
- Identify if this is a complete fix, partial solution, or diagnostic work
- Consider the business impact and user experience

**REQUIREMENTS:**
- Be specific and actionable
- Focus on what's actually being built (not just the original problem)
- Keep each section concise but informative
- Use clear, professional language

Generate a JSON object with problem, solution, and context fields.`

  try {
    const result = await generateTextWithFailover(prompt, {
      system: 'You are a senior QA analyst specializing in ticket analysis. Generate precise, actionable ticket summaries based on actual implementation scope.',
      temperature: 0.1,
      maxTokens: 800
    })

    // Extract text from GenerateTextResult object
    const responseText = typeof result === 'string' ? result : result.text
    
    if (!responseText) {
      throw new Error('No text content in AI response for ticket summary')
    }
    
    // Parse JSON from string response
    const cleanedResult = responseText.trim()
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
    
    const parsed = JSON.parse(cleanedResult)
    const validated = ticketSummarySchema.parse(parsed)
    
    const duration = Date.now() - startTime
    console.log(`✅ [${requestId}] Ticket summary generated in ${duration}ms`)
    return validated
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ [${requestId}] Ticket summary generation failed after ${duration}ms:`, error)
    throw error
  }
}

/**
 * Generate acceptance criteria section
 */
export async function generateAcceptanceCriteria(
  ticketJson: any,
  qaProfile: any,
  requestId: string
): Promise<Array<{
  id: string;
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  category: string;
  testable: boolean;
}>> {
  const startTime = Date.now()
  console.log(`📝 [${requestId}] Generating acceptance criteria...`)

  const baseContext = buildBaseContext(ticketJson, qaProfile)
  
  const prompt = `${baseContext}

**TASK:** Generate ONLY acceptance criteria (3-5 criteria).

Based on the ticket analysis, create specific, testable acceptance criteria that define what "done" looks like.

**CRITERIA REQUIREMENTS:**
- Each criterion must be specific and measurable
- Must be aligned with actual implementation scope (not just original problem)
- Must have clear pass/fail conditions
- Should cover the most critical functionality
- Must be testable by QA team

**PRIORITY GUIDELINES:**
- "must": Core functionality that must work
- "should": Important features that should work
- "could": Nice-to-have features

**CATEGORY GUIDELINES:**
- Use categories from active QA profile: ${Object.entries(qaProfile.qaCategories)
    .filter(([_, active]) => active)
    .map(([category]) => category)
    .join(', ')}

**FORMAT:**
Generate a JSON array of acceptance criteria objects with:
- id: "ac-1", "ac-2", etc.
- title: Brief, clear title
- description: Detailed description of what must be satisfied
- priority: "must", "should", or "could"
- category: One of the active categories
- testable: true (all criteria must be testable)

Focus on what's actually being implemented based on the ticket context.`

  try {
    const result = await generateTextWithFailover(prompt, {
      system: 'You are a senior QA analyst specializing in acceptance criteria. Generate specific, testable criteria that define clear success conditions.',
      temperature: 0.2,
      maxTokens: 1000
    })

    // Extract text from GenerateTextResult object
    const responseText = typeof result === 'string' ? result : result.text
    
    if (!responseText) {
      throw new Error('No text content in AI response for acceptance criteria')
    }
    
    const cleanedResult = responseText.trim()
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
    
    const parsed = JSON.parse(cleanedResult)
    const validated = acceptanceCriteriaSchema.parse(parsed)
    
    const duration = Date.now() - startTime
    console.log(`✅ [${requestId}] Acceptance criteria generated in ${duration}ms (${validated.length} criteria)`)
    return validated
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ [${requestId}] Acceptance criteria generation failed after ${duration}ms:`, error)
    throw error
  }
}

/**
 * Generate test cases section
 */
export async function generateTestCases(
  ticketJson: any,
  qaProfile: any,
  requestId: string
): Promise<Array<any>> {
  const startTime = Date.now()
  console.log(`🧪 [${requestId}] Generating test cases...`)

  const baseContext = buildBaseContext(ticketJson, qaProfile)
  
  const activeCategories = Object.entries(qaProfile.qaCategories)
    .filter(([_, active]) => active)
    .map(([category]) => category)
    .join(', ')

  const prompt = `${baseContext}

**TASK:** Generate ONLY test cases (3-5 test cases) in ${qaProfile.testCaseFormat} format.

Create comprehensive test cases that validate the acceptance criteria and cover:

**COVERAGE AREAS:**
- Happy path scenarios (main functionality working correctly)
- Edge cases based on ticket complexity
- Error conditions and validation (if applicable)
- Integration points (if mentioned in ticket)

**TEST CATEGORIES:**
Focus on these active categories: ${activeCategories}

**FORMAT REQUIREMENTS:**
- Use ${qaProfile.testCaseFormat} format consistently
- Each test case MUST include: format, id, category, priority, testCase object
- The "format" field must be exactly: "${qaProfile.testCaseFormat}"
- Include realistic test data and scenarios
- Add relevant tags for organization

**${qaProfile.testCaseFormat.toUpperCase()} FORMAT SPECIFICS:**
${qaProfile.testCaseFormat === 'gherkin' ? `
- scenario: Clear scenario name
- given: Preconditions (array of strings)
- when: Actions taken (array of strings)  
- then: Expected outcomes (array of strings)
- tags: Relevant tags like @functional, @ui, etc.
` : qaProfile.testCaseFormat === 'steps' ? `
- title: Test case title
- objective: What this test validates
- steps: Array of {action, expectedResult} objects
` : `
- title: Test case title
- description: What is being tested
- expectedOutcome: What should happen
`}

**PRIORITY GUIDELINES:**
- high: Critical functionality that must work
- medium: Important features
- low: Edge cases and nice-to-have validation

Generate a JSON array of test case objects that thoroughly validate the implementation.`

  try {
    const result = await generateTextWithFailover(prompt, {
      system: `You are a senior QA engineer specializing in ${qaProfile.testCaseFormat} test case creation. Generate comprehensive, realistic test cases that provide thorough coverage.`,
      temperature: 0.3,
      maxTokens: 1200
    })

    // Extract text from GenerateTextResult object
    const responseText = typeof result === 'string' ? result : result.text
    
    if (!responseText) {
      throw new Error('No text content in AI response for test cases')
    }
    
    const cleanedResult = responseText.trim()
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
    
    const parsed = JSON.parse(cleanedResult)
    const validated = testCasesSchema.parse(parsed)
    
    const duration = Date.now() - startTime
    console.log(`✅ [${requestId}] Test cases generated in ${duration}ms (${validated.length} test cases)`)
    return validated
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ [${requestId}] Test cases generation failed after ${duration}ms:`, error)
    throw error
  }
}

/**
 * Generate configuration warnings section
 */
export async function generateConfigurationWarnings(
  ticketJson: any,
  qaProfile: any,
  assumptions: any[],
  requestId: string
): Promise<Array<{
  type: string;
  title: string;
  message: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}>> {
  const startTime = Date.now()
  console.log(`⚠️ [${requestId}] Generating configuration warnings...`)

  if (assumptions.length === 0) {
    console.log(`✅ [${requestId}] No configuration warnings needed (0 assumptions)`)
    return []
  }

  const baseContext = buildBaseContext(ticketJson, qaProfile)
  
  const prompt = `${baseContext}

**TASK:** Generate configuration warnings based on detected assumptions and potential issues.

**DETECTED ASSUMPTIONS:**
${assumptions.map(a => `- ${a.description} (confidence: ${a.confidence}, impact: ${a.impact})`).join('\n')}

**ANALYSIS REQUIREMENTS:**
- Convert each assumption into a actionable warning
- Provide specific recommendations for resolution
- Assess severity based on impact on QA process
- Focus on practical, actionable guidance

**SEVERITY GUIDELINES:**
- high: Critical issues that significantly impact testing
- medium: Important issues that should be addressed
- low: Minor issues or suggestions for improvement

**WARNING TYPES:**
- category_mismatch: QA categories don't match ticket content
- missing_context: Insufficient information for complete testing
- conflicting_requirements: Contradictory information detected
- configuration_issue: QA profile settings may not be optimal

Generate a JSON array of warning objects with type, title, message, recommendation, and severity.`

  try {
    const result = await generateTextWithFailover(prompt, {
      system: 'You are a QA configuration specialist. Generate actionable warnings that help improve the QA process and document quality.',
      temperature: 0.1,
      maxTokens: 800
    })

    // Extract text from GenerateTextResult object
    const responseText = typeof result === 'string' ? result : result.text
    
    if (!responseText) {
      throw new Error('No text content in AI response for configuration warnings')
    }
    
    const cleanedResult = responseText.trim()
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
    
    const parsed = JSON.parse(cleanedResult)
    const validated = configurationWarningsSchema.parse(parsed)
    
    const duration = Date.now() - startTime
    console.log(`✅ [${requestId}] Configuration warnings generated in ${duration}ms (${validated.length} warnings)`)
    return validated
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ [${requestId}] Configuration warnings generation failed after ${duration}ms:`, error)
    // Return empty array on failure - warnings are not critical
    return []
  }
}

/**
 * Generate complete QA document using parallel section generation
 */
export async function generateQADocumentBySections(
  ticketJson: any,
  qaProfile: any,
  assumptions: any[],
  requestId: string
): Promise<Omit<QACanvasDocument, 'metadata'>> {
  const startTime = Date.now()
  console.log(`🚀 [${requestId}] Starting parallel section generation...`)

  try {
    // Generate all sections in parallel for maximum performance
    const [
      ticketSummary,
      acceptanceCriteria,
      testCases,
      configurationWarnings
    ] = await Promise.all([
      generateTicketSummary(ticketJson, qaProfile, requestId),
      generateAcceptanceCriteria(ticketJson, qaProfile, requestId),
      generateTestCases(ticketJson, qaProfile, requestId),
      generateConfigurationWarnings(ticketJson, qaProfile, assumptions, requestId)
    ])

    const totalTime = Date.now() - startTime
    console.log(`🎯 [${requestId}] Parallel section generation completed in ${totalTime}ms`)
    console.log(`📊 [${requestId}] Generated: summary, ${acceptanceCriteria.length} criteria, ${testCases.length} test cases, ${configurationWarnings.length} warnings`)

    return {
      ticketSummary,
      acceptanceCriteria,
      testCases,
      configurationWarnings
    }
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`❌ [${requestId}] Parallel section generation failed after ${totalTime}ms:`, error)
    throw error
  }
}