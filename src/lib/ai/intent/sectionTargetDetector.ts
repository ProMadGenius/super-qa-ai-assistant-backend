/**
 * SectionTargetDetector - AI-powered identification of canvas sections needing modification
 * Uses pure AI analysis without hardcoded keywords for language-agnostic section detection
 */

import { tool } from 'ai'
import { generateTextWithFailover } from '../providerFailover'
import { z } from 'zod'
import type { 
  SectionTargetResult, 
  CanvasSection 
} from './types'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import { canvasSectionSchema } from './types'

/**
 * AI tool for pure section target detection - no hardcoded keywords needed
 */
const sectionTargetDetectionTool = tool({
  description: "Identify which canvas sections should be targeted for modification using AI analysis only",
  parameters: z.object({
    primaryTargets: z.array(canvasSectionSchema).describe("Main sections that should be modified based on user intent"),
    secondaryTargets: z.array(canvasSectionSchema).describe("Sections that might be affected indirectly or as dependencies"),
    confidence: z.number().min(0).max(1).describe("AI confidence in section detection accuracy"),
    reasoning: z.string().describe("Clear explanation of why these specific sections were selected"),
    detectedLanguage: z.string().describe("Language detected in user message"),
    contextualHints: z.array(z.string()).describe("Key phrases or context clues that influenced section selection"),
    dependencyAnalysis: z.string().describe("Analysis of how sections might affect each other"),
    urgencyLevel: z.enum(['low', 'medium', 'high']).describe("Perceived urgency for modifying these sections")
  })
})

/**
 * SectionTargetDetector class for identifying target canvas sections
 */
export class SectionTargetDetector {
  // No need for model instance - using failover system

  /**
   * Detect target sections using pure AI analysis - no hardcoded keywords
   */
  async detectTargetSections(
    userMessage: string,
    currentCanvas?: QACanvasDocument
  ): Promise<SectionTargetResult> {
    try {
      console.log('🎯 Starting AI-powered section target detection...')
      
      // Use pure AI analysis for section detection
      const aiResult = await this.performPureAIDetection(userMessage, currentCanvas)
      
      // Validate sections against current canvas state
      const validatedResult = this.validateSections(aiResult, currentCanvas)
      
      console.log(`✅ Detected sections: ${validatedResult.primaryTargets.join(', ')} (confidence: ${validatedResult.confidence})`)
      return validatedResult
      
    } catch (error) {
      console.error('❌ Section target detection failed:', error)
      return this.createFallbackResult(userMessage, error as Error)
    }
  }

  /**
   * Perform pure AI-based section detection without hardcoded keywords
   */
  private async performPureAIDetection(
    userMessage: string,
    currentCanvas?: QACanvasDocument
  ): Promise<SectionTargetResult> {
    const systemPrompt = this.buildAISystemPrompt(currentCanvas)
    
    try {
      console.log('🧠 Sending message to AI for section target detection...')
      
      const result = await generateTextWithFailover(
        `
Analyze this user message and identify which canvas sections need modification:

USER MESSAGE: "${userMessage}"

${currentCanvas ? `
CURRENT CANVAS STATE:
- Ticket Summary: ${currentCanvas.ticketSummary.problem ? 'Present' : 'Missing'}
- Acceptance Criteria: ${currentCanvas.acceptanceCriteria.length} items
- Test Cases: ${currentCanvas.testCases.length} items
- Configuration Warnings: ${currentCanvas.configurationWarnings.length} items
- Ticket ID: ${currentCanvas.metadata.ticketId}
` : 'No canvas currently available.'}

Identify the target sections with high precision and explain your reasoning.
        `,
        {
          system: systemPrompt,
          tools: { sectionTargetDetection: sectionTargetDetectionTool },
          toolChoice: 'required',
          maxTokens: 1000,
          temperature: 0.1 // Low temperature for consistent detection
        }
      )

      // Handle both string and object responses from failover system
      if (typeof result === 'string') {
        throw new Error('Section detection received text response instead of tool calls')
      }

      const toolCall = result.toolCalls?.[0]
      if (toolCall?.toolName === 'sectionTargetDetection') {
        const args = toolCall.args
        console.log(`🎯 AI detected sections: ${args.primaryTargets.join(', ')} (${args.confidence})`)
        
        return {
          primaryTargets: args.primaryTargets,
          secondaryTargets: args.secondaryTargets,
          keywords: args.contextualHints || [], // Use AI-detected hints instead of hardcoded keywords
          confidence: args.confidence,
          detectionMethod: 'ai_analysis'
        }
      }
      
      throw new Error('AI did not return expected section detection')
      
    } catch (error) {
      console.error('❌ AI section detection failed:', error)
      throw error
    }
  }



  /**
   * Build AI system prompt for pure section detection
   */
  private buildAISystemPrompt(currentCanvas?: QACanvasDocument): string {
    return `
You are an expert QA documentation analyst that identifies which canvas sections need modification based on user intent.

AVAILABLE CANVAS SECTIONS:

1. **ticketSummary**: Ticket summary (problem, solution, context)
   - When users want to modify the overall description, problem statement, or solution approach
   - Examples: "change the problem description", "update the context", "fix the summary"

2. **acceptanceCriteria**: Acceptance criteria and requirements
   - When users want to modify, add, or remove acceptance criteria
   - Examples: "add new criteria", "fix the requirements", "criteria are wrong", "missing conditions"
   - MOST COMMON section for modifications

3. **testCases**: Test cases and scenarios
   - When users want to modify, add, or remove test cases
   - Examples: "add test cases", "fix the tests", "test scenarios are wrong", "missing edge cases"

4. **configurationWarnings**: Configuration warnings and alerts
   - When users want to address configuration issues or warnings
   - Examples: "fix the warnings", "configuration problems", "resolve alerts"

5. **metadata**: Document metadata and settings
   - RARELY modified by users - usually system-managed
   - Only when explicitly mentioned: "change the metadata", "update document info"

CRITICAL ANALYSIS RULES:

1. **Primary Targets**: Sections the user explicitly mentions or clearly intends to modify
2. **Secondary Targets**: Sections that might be affected as dependencies or side effects

3. **Section Dependencies**:
   - acceptanceCriteria changes → testCases might need updates
   - ticketSummary changes → acceptanceCriteria and testCases might need updates
   - testCases changes → rarely affects other sections

4. **Confidence Levels**:
   - High (0.8+): Explicit mention or clear intent for specific sections
   - Medium (0.5-0.8): Clear implication but not explicit
   - Low (0.2-0.5): Inference based on context
   - Very Low (<0.2): Pure guesswork

5. **Default Assumptions**:
   - When users complain something is "wrong" without specifying → assume acceptanceCriteria
   - When users want "improvements" without specifying → assume acceptanceCriteria
   - When users mention "tests" or "testing" → testCases
   - When users mention "problem" or "solution" → ticketSummary

6. **Language Agnostic**:
   - Work with ANY language: Spanish, English, mixed, or others
   - Focus on intent rather than specific keywords
   - Understand context and meaning regardless of language

7. **Limits**:
   - Maximum 3 primary targets (prioritize quality over quantity)
   - Maximum 2 secondary targets
   - Be decisive - avoid empty results

CURRENT CANVAS CONTEXT:
${currentCanvas ? `
- Has Summary: ${currentCanvas.ticketSummary.problem ? 'Yes' : 'No'}
- Acceptance Criteria: ${currentCanvas.acceptanceCriteria.length} items
- Test Cases: ${currentCanvas.testCases.length} items
- Configuration Warnings: ${currentCanvas.configurationWarnings.length} items
- Ticket ID: ${currentCanvas.metadata.ticketId}
` : 'No canvas available - user might be starting fresh'}

Be confident, decisive, and language-agnostic in your section detection.
    `
  }



  /**
   * Create fallback result when AI detection fails
   */
  private createFallbackResult(userMessage: string, error: Error): SectionTargetResult {
    console.warn('🚨 Using fallback section detection due to AI error:', error.message)
    
    // Smart fallback: assume acceptanceCriteria (most common modification target)
    // This is safer than trying to parse keywords when AI fails
    return {
      primaryTargets: ['acceptanceCriteria'], // Most common section for modifications
      secondaryTargets: [], // Don't guess secondary targets in fallback
      keywords: [], // No keywords in pure AI approach
      confidence: 0.4, // Lower confidence since this is fallback
      detectionMethod: 'ai_analysis' // Still AI-based, just fallback
    }
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): SectionTargetResult {
    return {
      primaryTargets: [],
      secondaryTargets: [],
      keywords: [],
      confidence: 0,
      detectionMethod: 'keyword'
    }
  }

  /**
   * Validate detected sections against available canvas sections
   */
  validateSections(
    result: SectionTargetResult,
    currentCanvas?: QACanvasDocument
  ): SectionTargetResult {
    if (!currentCanvas) {
      return result
    }

    // Filter out sections that don't make sense for current canvas state
    const validPrimaryTargets = result.primaryTargets.filter(section => {
      switch (section) {
        case 'ticketSummary':
          return true // Always valid
        case 'acceptanceCriteria':
          return true // Always valid
        case 'testCases':
          return true // Always valid
        case 'configurationWarnings':
          return currentCanvas.configurationWarnings.length > 0
        case 'metadata':
          return false // Usually not user-modifiable
        default:
          return true
      }
    })

    const validSecondaryTargets = result.secondaryTargets.filter(section => 
      !validPrimaryTargets.includes(section)
    )

    return {
      ...result,
      primaryTargets: validPrimaryTargets,
      secondaryTargets: validSecondaryTargets
    }
  }

  /**
   * Get section display names for user communication
   */
  getSectionDisplayNames(sections: CanvasSection[], language: 'es' | 'en' = 'es'): string[] {
    const displayNames = {
      es: {
        ticketSummary: 'Resumen del ticket',
        acceptanceCriteria: 'Criterios de aceptación',
        testCases: 'Casos de prueba',
        configurationWarnings: 'Advertencias de configuración',
        metadata: 'Metadatos'
      },
      en: {
        ticketSummary: 'Ticket summary',
        acceptanceCriteria: 'Acceptance criteria',
        testCases: 'Test cases',
        configurationWarnings: 'Configuration warnings',
        metadata: 'Metadata'
      }
    }

    return sections.map(section => displayNames[language][section])
  }
}