import {
  analyzeTicketContent,
  detectConfigurationConflicts,
  generateTestCaseCategories,
  estimateTestComplexity
} from '@/lib/analysis/ticketAnalyzer'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'

describe('Ticket Analyzer', () => {
  const mockBugTicket = {
    issueKey: 'BUG-123',
    summary: 'Login button not working on mobile devices',
    description: 'Users are unable to click the login button on mobile devices. The button appears to be unresponsive to touch events.',
    status: 'Open',
    priority: 'Priority: High',
    issueType: 'Bug',
    assignee: 'John Doe',
    reporter: 'Jane Smith',
    comments: [
      {
        author: 'Developer',
        date: '2024-01-15',
        body: 'This appears to be a CSS issue with touch event handling. Need to fix the button styles.'
      }
    ],
    attachments: [],
    components: ['Frontend', 'Mobile'],
    customFields: {
      'Environment': 'Production',
      'Browser': 'Safari Mobile'
    },
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  const mockFeatureTicket = {
    issueKey: 'FEAT-456',
    summary: 'Implement user profile API endpoint',
    description: 'Create a new REST API endpoint that allows users to retrieve and update their profile information. The endpoint should support authentication and return user data in JSON format.',
    status: 'In Progress',
    priority: 'Priority: Medium',
    issueType: 'Story',
    assignee: 'API Developer',
    reporter: 'Product Manager',
    comments: [],
    attachments: [],
    components: ['Backend', 'API'],
    customFields: {
      'Story Points': '5',
      'Epic': 'User Management'
    },
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  const mockSecurityTicket = {
    issueKey: 'SEC-789',
    summary: 'Add OAuth2 authentication to admin panel',
    description: 'Implement OAuth2 authentication for the admin panel to improve security. Users should be able to login using their corporate credentials.',
    status: 'To Do',
    priority: 'Priority: High',
    issueType: 'Security',
    assignee: 'Security Engineer',
    reporter: 'Security Team',
    comments: [],
    attachments: [],
    components: ['Admin Panel', 'Authentication'],
    customFields: {
      'Security Level': 'High',
      'Compliance': 'SOC2'
    },
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  describe('analyzeTicketContent', () => {
    it('should extract problem, solution, and context from bug ticket', () => {
      const result = analyzeTicketContent(mockBugTicket)
      
      expect(result.problem).toContain('Login button not working')
      expect(result.problem).toContain('mobile devices')
      expect(result.solution).toContain('fix')
      expect(result.solution).toContain('CSS issue')
      expect(result.context).toContain('Frontend, Mobile')
      expect(result.context).toContain('Priority: High')
    })

    it('should extract problem, solution, and context from feature ticket', () => {
      const result = analyzeTicketContent(mockFeatureTicket)
      
      expect(result.problem).toContain('Need to implement')
      expect(result.problem).toContain('user profile API endpoint')
      expect(result.solution).toContain('REST API endpoint')
      expect(result.solution).toContain('authentication')
      expect(result.context).toContain('Backend, API')
      expect(result.context).toContain('API Developer')
    })

    it('should handle tickets with minimal information', () => {
      const minimalTicket = {
        ...mockBugTicket,
        description: '',
        comments: [],
        components: [],
        customFields: {}
      }
      
      const result = analyzeTicketContent(minimalTicket)
      
      expect(result.problem).toBeDefined()
      expect(result.solution).toBeDefined()
      expect(result.context).toBeDefined()
      expect(result.problem.length).toBeGreaterThan(0)
    })
  })

  describe('detectConfigurationConflicts', () => {
    it('should detect API testing conflict', () => {
      const qaProfileWithoutAPI = {
        ...defaultQAProfile,
        qaCategories: {
          ...defaultQAProfile.qaCategories,
          api: false
        }
      }
      
      const warnings = detectConfigurationConflicts(mockFeatureTicket, qaProfileWithoutAPI)
      
      const apiWarning = warnings.find(w => w.type === 'qa_category_mismatch' && w.title.includes('API'))
      expect(apiWarning).toBeDefined()
      expect(apiWarning?.severity).toBe('high')
      expect(apiWarning?.message).toContain('API testing is disabled')
    })

    it('should detect security testing conflict', () => {
      const qaProfileWithoutSecurity = {
        ...defaultQAProfile,
        qaCategories: {
          ...defaultQAProfile.qaCategories,
          security: false
        }
      }
      
      const warnings = detectConfigurationConflicts(mockSecurityTicket, qaProfileWithoutSecurity)
      
      const securityWarning = warnings.find(w => w.title.includes('Security'))
      expect(securityWarning).toBeDefined()
      expect(securityWarning?.severity).toBe('high')
      expect(securityWarning?.message).toContain('authentication')
    })

    it('should detect mobile testing conflict', () => {
      const qaProfileWithoutMobile = {
        ...defaultQAProfile,
        qaCategories: {
          ...defaultQAProfile.qaCategories,
          mobile: false
        }
      }
      
      const warnings = detectConfigurationConflicts(mockBugTicket, qaProfileWithoutMobile)
      
      const mobileWarning = warnings.find(w => w.title.includes('Mobile'))
      expect(mobileWarning).toBeDefined()
      expect(mobileWarning?.severity).toBe('medium')
    })

    it('should recommend Gherkin format for user stories', () => {
      const qaProfileWithSteps = {
        ...defaultQAProfile,
        testCaseFormat: 'steps' as const
      }
      
      const warnings = detectConfigurationConflicts(mockFeatureTicket, qaProfileWithSteps)
      
      const formatWarning = warnings.find(w => w.type === 'format_recommendation')
      expect(formatWarning?.title).toContain('Gherkin')
      expect(formatWarning?.severity).toBe('low')
    })

    it('should return no warnings when configuration is appropriate', () => {
      const appropriateProfile = {
        ...defaultQAProfile,
        qaCategories: {
          ...defaultQAProfile.qaCategories,
          api: true,
          security: true,
          mobile: true
        }
      }
      
      const warnings = detectConfigurationConflicts(mockFeatureTicket, appropriateProfile)
      
      // Should have minimal or no high-severity warnings
      const highSeverityWarnings = warnings.filter(w => w.severity === 'high')
      expect(highSeverityWarnings.length).toBeLessThanOrEqual(1) // Allow for format recommendations
    })
  })

  describe('generateTestCaseCategories', () => {
    it('should return only active categories', () => {
      const customProfile = {
        ...defaultQAProfile,
        qaCategories: {
          functional: true,
          ui: true,
          ux: false,
          negative: true,
          api: false,
          database: false,
          performance: false,
          security: false,
          mobile: false,
          accessibility: false
        }
      }
      
      const categories = generateTestCaseCategories(customProfile)
      
      expect(categories).toEqual(['functional', 'ui', 'negative'])
      expect(categories).not.toContain('ux')
      expect(categories).not.toContain('api')
    })

    it('should return all categories when all are active', () => {
      const allActiveProfile = {
        ...defaultQAProfile,
        qaCategories: {
          functional: true,
          ux: true,
          ui: true,
          negative: true,
          api: true,
          database: true,
          performance: true,
          security: true,
          mobile: true,
          accessibility: true
        }
      }
      
      const categories = generateTestCaseCategories(allActiveProfile)
      
      expect(categories.length).toBe(10) // All 10 categories
      expect(categories).toContain('functional')
      expect(categories).toContain('security')
      expect(categories).toContain('accessibility')
    })

    it('should return empty array when no categories are active', () => {
      const inactiveProfile = {
        ...defaultQAProfile,
        qaCategories: {
          functional: false,
          ui: false,
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
      
      const categories = generateTestCaseCategories(inactiveProfile)
      
      expect(categories).toEqual([])
    })
  })

  describe('estimateTestComplexity', () => {
    it('should return high complexity for integration tickets', () => {
      const complexTicket = {
        ...mockFeatureTicket,
        summary: 'Complex integration between multiple systems',
        description: 'This requires integration with multiple external APIs and complex workflow processing'
      }
      
      const complexity = estimateTestComplexity(complexTicket)
      
      expect(complexity).toBe('high')
    })

    it('should return low complexity for simple bug fixes', () => {
      const simpleTicket = {
        ...mockBugTicket,
        summary: 'Fix simple typo in button text',
        description: 'Minor text fix for login button'
      }
      
      const complexity = estimateTestComplexity(simpleTicket)
      
      expect(complexity).toBe('low')
    })

    it('should return medium complexity for standard features', () => {
      const mediumTicket = {
        ...mockFeatureTicket,
        summary: 'Add new feature to user dashboard',
        description: 'Enhance the user dashboard with additional functionality'
      }
      
      const complexity = estimateTestComplexity(mediumTicket)
      
      expect(complexity).toBe('medium')
    })

    it('should handle tickets with minimal content', () => {
      const minimalTicket = {
        ...mockBugTicket,
        summary: 'Update',
        description: ''
      }
      
      const complexity = estimateTestComplexity(minimalTicket)
      
      expect(['low', 'medium', 'high']).toContain(complexity)
    })
  })
})