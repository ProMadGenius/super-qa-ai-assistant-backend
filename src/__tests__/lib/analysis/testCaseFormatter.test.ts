import {
  getTestCaseFormatGuidance,
  generateFormatPromptGuidance,
  validateFormatRequirements,
  getRecommendedTestCaseCount,
  generateCategoryTestSuggestions
} from '@/lib/analysis/testCaseFormatter'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'
import { describe, it, expect } from 'vitest'

describe('Test Case Formatter', () => {
  const mockTicket = {
    issueKey: 'TEST-123',
    summary: 'Implement user login functionality',
    description: 'Create a login form that allows users to authenticate',
    status: 'In Progress',
    priority: 'Priority: High',
    issueType: 'Story',
    assignee: 'Developer',
    reporter: 'Product Manager',
    comments: [],
    attachments: [],
    components: ['Frontend', 'Authentication'],
    customFields: {},
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  describe('getTestCaseFormatGuidance', () => {
    it('should return Gherkin format guidance', () => {
      const guidance = getTestCaseFormatGuidance('gherkin')
      
      expect(guidance.format).toBe('gherkin')
      expect(guidance.description).toContain('Given-When-Then')
      expect(guidance.structure).toContain('Scenario:')
      expect(guidance.structure).toContain('Given')
      expect(guidance.structure).toContain('When')
      expect(guidance.structure).toContain('Then')
      expect(guidance.examples).toContain('Scenario:')
      expect(guidance.bestPractices.length).toBeGreaterThan(0)
    })

    it('should return Steps format guidance', () => {
      const guidance = getTestCaseFormatGuidance('steps')
      
      expect(guidance.format).toBe('steps')
      expect(guidance.description).toContain('step-by-step')
      expect(guidance.structure).toContain('Title:')
      expect(guidance.structure).toContain('Objective:')
      expect(guidance.structure).toContain('Steps:')
      expect(guidance.structure).toContain('Expected Result:')
      expect(guidance.examples).toContain('Title:')
      expect(guidance.bestPractices.length).toBeGreaterThan(0)
    })

    it('should return Table format guidance', () => {
      const guidance = getTestCaseFormatGuidance('table')
      
      expect(guidance.format).toBe('table')
      expect(guidance.description).toContain('tabular')
      expect(guidance.structure).toContain('Test Data:')
      expect(guidance.structure).toContain('Expected Outcome:')
      expect(guidance.examples).toContain('Test Data:')
      expect(guidance.bestPractices.length).toBeGreaterThan(0)
    })

    it('should throw error for unsupported format', () => {
      expect(() => {
        getTestCaseFormatGuidance('invalid' as any)
      }).toThrow('Unsupported test case format')
    })
  })

  describe('generateFormatPromptGuidance', () => {
    it('should generate comprehensive prompt guidance for Gherkin', () => {
      const guidance = generateFormatPromptGuidance('gherkin', mockTicket, defaultQAProfile)
      
      expect(guidance).toContain('TEST CASE FORMAT: GHERKIN')
      expect(guidance).toContain('Given-When-Then')
      expect(guidance).toContain('Story') // ticket type
      expect(guidance).toContain('Priority: High')
      expect(guidance).toContain('Frontend, Authentication') // components
      expect(guidance).toContain('functional') // active categories
    })

    it('should include active QA categories in guidance', () => {
      const customProfile = {
        ...defaultQAProfile,
        qaCategories: {
          functional: true,
          ui: true,
          ux: false,
          negative: false,
          api: false,
          database: false,
          performance: false,
          security: false,
          mobile: false,
          accessibility: false
        }
      }
      
      const guidance = generateFormatPromptGuidance('steps', mockTicket, customProfile)
      
      expect(guidance).toContain('functional, ui')
      expect(guidance).not.toContain('api')
      expect(guidance).not.toContain('security')
    })

    it('should include ticket-specific information', () => {
      const guidance = generateFormatPromptGuidance('table', mockTicket, defaultQAProfile)
      
      expect(guidance).toContain(mockTicket.issueType)
      expect(guidance).toContain(mockTicket.priority)
      expect(guidance).toContain(mockTicket.components.join(', '))
    })
  })

  describe('validateFormatRequirements', () => {
    describe('Gherkin validation', () => {
      it('should validate correct Gherkin format', () => {
        const validGherkin = {
          scenario: 'User logs in successfully',
          given: ['User is on login page'],
          when: ['User enters credentials'],
          then: ['User is redirected to dashboard'],
          tags: ['@authentication']
        }
        
        const result = validateFormatRequirements('gherkin', validGherkin)
        
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('should detect missing Gherkin requirements', () => {
        const invalidGherkin = {
          scenario: 'User logs in',
          given: [],
          when: ['User enters credentials']
          // Missing 'then'
        }
        
        const result = validateFormatRequirements('gherkin', invalidGherkin)
        
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Gherkin format requires at least one Given statement')
        expect(result.errors).toContain('Gherkin format requires at least one Then statement')
      })
    })

    describe('Steps validation', () => {
      it('should validate correct Steps format', () => {
        const validSteps = {
          title: 'Test user login',
          objective: 'Verify login functionality',
          steps: [
            {
              stepNumber: 1,
              action: 'Navigate to login page',
              expectedResult: 'Login form is displayed'
            }
          ],
          preconditions: [],
          postconditions: []
        }
        
        const result = validateFormatRequirements('steps', validSteps)
        
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('should detect missing Steps requirements', () => {
        const invalidSteps = {
          title: 'Test login',
          steps: [
            {
              action: 'Click login'
              // Missing expectedResult
            }
          ]
          // Missing objective
        }
        
        const result = validateFormatRequirements('steps', invalidSteps)
        
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Steps format requires an objective')
        expect(result.errors).toContain('Step 1 requires an expected result')
      })
    })

    describe('Table validation', () => {
      it('should validate correct Table format', () => {
        const validTable = {
          title: 'Login validation test',
          description: 'Test various login scenarios',
          testData: [
            { username: 'valid', password: 'valid', expected: 'success' }
          ],
          expectedOutcome: 'All scenarios pass validation'
        }
        
        const result = validateFormatRequirements('table', validTable)
        
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('should detect missing Table requirements', () => {
        const invalidTable = {
          title: 'Login test'
          // Missing description, testData, expectedOutcome
        }
        
        const result = validateFormatRequirements('table', invalidTable)
        
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Table format requires a description')
        expect(result.errors).toContain('Table format requires test data array')
        expect(result.errors).toContain('Table format requires an expected outcome')
      })
    })
  })

  describe('getRecommendedTestCaseCount', () => {
    it('should return appropriate counts for low complexity', () => {
      const counts = getRecommendedTestCaseCount(mockTicket, 'gherkin', 'low')
      
      expect(counts.min).toBeGreaterThan(0)
      expect(counts.max).toBeGreaterThan(counts.min)
      expect(counts.recommended).toBeGreaterThanOrEqual(counts.min)
      expect(counts.recommended).toBeLessThanOrEqual(counts.max)
    })

    it('should return higher counts for high complexity', () => {
      const lowCounts = getRecommendedTestCaseCount(mockTicket, 'gherkin', 'low')
      const highCounts = getRecommendedTestCaseCount(mockTicket, 'gherkin', 'high')
      
      expect(highCounts.recommended).toBeGreaterThan(lowCounts.recommended)
      expect(highCounts.max).toBeGreaterThan(lowCounts.max)
    })

    it('should adjust counts based on format', () => {
      const gherkinCounts = getRecommendedTestCaseCount(mockTicket, 'gherkin', 'medium')
      const stepsCounts = getRecommendedTestCaseCount(mockTicket, 'steps', 'medium')
      const tableCounts = getRecommendedTestCaseCount(mockTicket, 'table', 'medium')
      
      // Steps should have fewer (more detailed), table should have more (data-driven)
      expect(stepsCounts.recommended).toBeLessThanOrEqual(gherkinCounts.recommended)
      expect(tableCounts.recommended).toBeGreaterThanOrEqual(gherkinCounts.recommended)
    })
  })

  describe('generateCategoryTestSuggestions', () => {
    it('should generate suggestions for functional category', () => {
      const suggestions = generateCategoryTestSuggestions(['functional'], mockTicket)
      
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].category).toBe('functional')
      expect(suggestions[0].suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].suggestions[0]).toContain('functionality')
    })

    it('should generate suggestions for multiple categories', () => {
      const suggestions = generateCategoryTestSuggestions(['functional', 'ui', 'security'], mockTicket)
      
      expect(suggestions).toHaveLength(3)
      expect(suggestions.map(s => s.category)).toEqual(['functional', 'ui', 'security'])
      
      const uiSuggestions = suggestions.find(s => s.category === 'ui')
      expect(uiSuggestions?.suggestions[0]).toContain('UI elements')
      
      const securitySuggestions = suggestions.find(s => s.category === 'security')
      expect(securitySuggestions?.suggestions[0]).toContain('authentication')
    })

    it('should return empty array for no categories', () => {
      const suggestions = generateCategoryTestSuggestions([], mockTicket)
      
      expect(suggestions).toEqual([])
    })

    it('should generate appropriate suggestions for each category type', () => {
      const allCategories = [
        'functional', 'ui', 'ux', 'negative', 'api', 
        'database', 'performance', 'security', 'mobile', 'accessibility'
      ]
      
      const suggestions = generateCategoryTestSuggestions(allCategories, mockTicket)
      
      expect(suggestions).toHaveLength(10)
      
      // Verify each category has relevant suggestions
      const categoryMap = suggestions.reduce((acc, s) => {
        acc[s.category] = s.suggestions
        return acc
      }, {} as Record<string, string[]>)
      
      expect(categoryMap.api[0]).toContain('API')
      expect(categoryMap.database[0]).toContain('data')
      expect(categoryMap.performance[0]).toContain('response times')
      expect(categoryMap.mobile[0]).toContain('touch')
      expect(categoryMap.accessibility[0]).toContain('keyboard')
    })
  })
})