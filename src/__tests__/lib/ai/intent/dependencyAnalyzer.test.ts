/**
 * Unit tests for DependencyAnalyzer
 * Tests dependency detection and cascade analysis with various scenarios
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { DependencyAnalyzer } from '../../../../lib/ai/intent/dependencyAnalyzer'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { CanvasSection, SectionDependency } from '../../../../lib/ai/intent/types'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config)
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}))

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer
  let mockGenerateText: Mock

  beforeEach(async () => {
    analyzer = new DependencyAnalyzer()
    const aiModule = await import('ai')
    mockGenerateText = vi.mocked(aiModule).generateText as Mock
  })

  describe('analyzeDependencies', () => {
    it('should detect acceptance criteria to test cases dependency', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'dependencyAnalysis',
          args: {
            affectedSections: ['acceptanceCriteria', 'testCases'],
            dependencies: [{
              from: 'acceptanceCriteria',
              to: 'testCases',
              relationship: 'derives_from',
              strength: 'strong'
            }],
            cascadeRequired: true,
            impactAssessment: 'Test cases will need to be updated to match new acceptance criteria',
            conflictRisk: 'medium'
          }
        }]
      })

      const result = await analyzer.analyzeDependencies(
        ['acceptanceCriteria'],
        createMockCanvas(),
        'Update acceptance criteria to be more specific'
      )

      expect(result.affectedSections).toContain('acceptanceCriteria')
      expect(result.affectedSections).toContain('testCases')
      expect(result.cascadeRequired).toBe(true)
      expect(result.dependencies).toHaveLength(1)
      expect(result.dependencies[0].relationship).toBe('derives_from')
      expect(result.dependencies[0].strength).toBe('strong')
    })

    it('should detect multiple dependencies for ticket summary changes', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'dependencyAnalysis',
          args: {
            affectedSections: ['ticketSummary', 'acceptanceCriteria', 'testCases'],
            dependencies: [
              {
                from: 'ticketSummary',
                to: 'acceptanceCriteria',
                relationship: 'implements',
                strength: 'medium'
              },
              {
                from: 'ticketSummary',
                to: 'testCases',
                relationship: 'validates',
                strength: 'medium'
              }
            ],
            cascadeRequired: false,
            impactAssessment: 'Changes to ticket summary may require review of acceptance criteria and test cases',
            conflictRisk: 'medium'
          }
        }]
      })

      const result = await analyzer.analyzeDependencies(
        ['ticketSummary'],
        createMockCanvas(),
        'Update ticket summary with new requirements'
      )

      expect(result.affectedSections).toHaveLength(3)
      expect(result.dependencies).toHaveLength(2)
      expect(result.dependencies.some(d => d.relationship === 'implements')).toBe(true)
      expect(result.dependencies.some(d => d.relationship === 'validates')).toBe(true)
    })

    it('should assess conflict risk correctly', async () => {
      const complexCanvas = createMockCanvas()
      // Add many items to increase complexity
      for (let i = 0; i < 20; i++) {
        complexCanvas.acceptanceCriteria.push({
          id: `ac-${i}`,
          title: `Criterion ${i}`,
          description: `Description ${i}`,
          priority: 'must',
          category: 'functional',
          testable: true
        })
      }

      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'dependencyAnalysis',
          args: {
            affectedSections: ['acceptanceCriteria', 'testCases'],
            dependencies: [{
              from: 'acceptanceCriteria',
              to: 'testCases',
              relationship: 'derives_from',
              strength: 'strong'
            }],
            cascadeRequired: true,
            impactAssessment: 'High risk due to complex canvas with many existing items',
            conflictRisk: 'high'
          }
        }]
      })

      const result = await analyzer.analyzeDependencies(
        ['acceptanceCriteria'],
        complexCanvas,
        'Major changes to acceptance criteria'
      )

      expect(result.conflictRisk).toBe('high')
      expect(result.cascadeRequired).toBe(true)
    })

    it('should handle AI service failures gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))

      const result = await analyzer.analyzeDependencies(
        ['acceptanceCriteria'],
        createMockCanvas(),
        'Update criteria'
      )

      // Should fallback to static analysis
      expect(result.affectedSections).toContain('acceptanceCriteria')
      expect(result.dependencies).toBeDefined()
      expect(result.impactAssessment).toBeDefined()
    })

    it('should detect no dependencies for isolated sections', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'dependencyAnalysis',
          args: {
            affectedSections: ['configurationWarnings'],
            dependencies: [],
            cascadeRequired: false,
            impactAssessment: 'Configuration warnings are isolated and do not affect other sections',
            conflictRisk: 'low'
          }
        }]
      })

      const result = await analyzer.analyzeDependencies(
        ['configurationWarnings'],
        createMockCanvas(),
        'Update configuration warnings'
      )

      expect(result.affectedSections).toHaveLength(1)
      expect(result.dependencies).toHaveLength(0)
      expect(result.cascadeRequired).toBe(false)
      expect(result.conflictRisk).toBe('low')
    })

    it('should combine static and AI analysis results', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'dependencyAnalysis',
          args: {
            affectedSections: ['acceptanceCriteria', 'testCases'],
            dependencies: [{
              from: 'acceptanceCriteria',
              to: 'testCases',
              relationship: 'derives_from',
              strength: 'strong'
            }],
            cascadeRequired: true,
            impactAssessment: 'AI detected strong dependency requiring cascade updates',
            conflictRisk: 'medium'
          }
        }]
      })

      const result = await analyzer.analyzeDependencies(
        ['acceptanceCriteria'],
        createMockCanvas(),
        'Modify acceptance criteria'
      )

      // Should include both static and AI analysis
      expect(result.affectedSections).toContain('acceptanceCriteria')
      expect(result.affectedSections).toContain('testCases')
      expect(result.cascadeRequired).toBe(true)
      expect(result.impactAssessment).toContain('AI detected')
    })

    it('should handle multiple target sections', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'dependencyAnalysis',
          args: {
            affectedSections: ['acceptanceCriteria', 'testCases', 'ticketSummary'],
            dependencies: [
              {
                from: 'acceptanceCriteria',
                to: 'testCases',
                relationship: 'derives_from',
                strength: 'strong'
              },
              {
                from: 'ticketSummary',
                to: 'acceptanceCriteria',
                relationship: 'implements',
                strength: 'medium'
              }
            ],
            cascadeRequired: true,
            impactAssessment: 'Multiple sections with complex dependencies',
            conflictRisk: 'high'
          }
        }]
      })

      const result = await analyzer.analyzeDependencies(
        ['acceptanceCriteria', 'ticketSummary'],
        createMockCanvas(),
        'Update multiple sections'
      )

      expect(result.affectedSections.length).toBeGreaterThanOrEqual(2)
      expect(result.dependencies.length).toBeGreaterThanOrEqual(1)
      expect(result.cascadeRequired).toBe(true)
    })
  })

  describe('utility methods', () => {
    it('should detect circular dependencies', () => {
      const circularDeps: SectionDependency[] = [
        {
          from: 'acceptanceCriteria',
          to: 'testCases',
          relationship: 'derives_from',
          strength: 'strong',
          description: 'Test'
        },
        {
          from: 'testCases',
          to: 'acceptanceCriteria',
          relationship: 'validates',
          strength: 'strong',
          description: 'Test'
        }
      ]

      const hasCircular = analyzer.hasCircularDependencies(circularDeps)
      expect(hasCircular).toBe(true)
    })

    it('should not detect circular dependencies in valid dependency chain', () => {
      const validDeps: SectionDependency[] = [
        {
          from: 'ticketSummary',
          to: 'acceptanceCriteria',
          relationship: 'implements',
          strength: 'medium',
          description: 'Test'
        },
        {
          from: 'acceptanceCriteria',
          to: 'testCases',
          relationship: 'derives_from',
          strength: 'strong',
          description: 'Test'
        }
      ]

      const hasCircular = analyzer.hasCircularDependencies(validDeps)
      expect(hasCircular).toBe(false)
    })

    it('should get dependent sections correctly', () => {
      const deps: SectionDependency[] = [
        {
          from: 'acceptanceCriteria',
          to: 'testCases',
          relationship: 'derives_from',
          strength: 'strong',
          description: 'Test'
        },
        {
          from: 'acceptanceCriteria',
          to: 'configurationWarnings',
          relationship: 'references',
          strength: 'weak',
          description: 'Test'
        }
      ]

      const dependents = analyzer.getDependentSections('acceptanceCriteria', deps)
      expect(dependents).toContain('testCases')
      expect(dependents).toContain('configurationWarnings')
      expect(dependents).toHaveLength(2)
    })

    it('should get dependency sources correctly', () => {
      const deps: SectionDependency[] = [
        {
          from: 'ticketSummary',
          to: 'acceptanceCriteria',
          relationship: 'implements',
          strength: 'medium',
          description: 'Test'
        },
        {
          from: 'acceptanceCriteria',
          to: 'testCases',
          relationship: 'derives_from',
          strength: 'strong',
          description: 'Test'
        }
      ]

      const sources = analyzer.getDependencySources('testCases', deps)
      expect(sources).toContain('acceptanceCriteria')
      expect(sources).toHaveLength(1)
    })

    it('should handle empty dependency arrays', () => {
      const dependents = analyzer.getDependentSections('acceptanceCriteria', [])
      const sources = analyzer.getDependencySources('testCases', [])
      const hasCircular = analyzer.hasCircularDependencies([])

      expect(dependents).toHaveLength(0)
      expect(sources).toHaveLength(0)
      expect(hasCircular).toBe(false)
    })
  })

  describe('static analysis', () => {
    it('should perform static analysis without AI', async () => {
      // Force AI to fail to test static analysis
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await analyzer.analyzeDependencies(
        ['acceptanceCriteria'],
        createMockCanvas(),
        'Update criteria'
      )

      // Should still detect basic dependencies from static rules
      expect(result.affectedSections).toContain('acceptanceCriteria')
      expect(result.dependencies).toBeDefined()
      expect(result.conflictRisk).toBeDefined()
    })

    it('should assess conflict risk based on canvas complexity', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const simpleCanvas = createMockCanvas()
      simpleCanvas.acceptanceCriteria = []
      simpleCanvas.testCases = []

      const result = await analyzer.analyzeDependencies(
        ['ticketSummary'],
        simpleCanvas,
        'Simple change'
      )

      expect(result.conflictRisk).toBe('low')
    })
  })

  describe('dependency validation and conflict detection', () => {
    beforeEach(() => {
      // Mock conflict detection tool calls
      mockGenerateText.mockImplementation((params) => {
        if (params.tools?.conflictDetection) {
          return Promise.resolve({
            toolCalls: [{
              toolName: 'conflictDetection',
              args: {
                conflicts: [],
                validationScore: 85,
                warnings: []
              }
            }]
          })
        }
        // Default dependency analysis mock
        return Promise.resolve({
          toolCalls: [{
            toolName: 'dependencyAnalysis',
            args: {
              affectedSections: ['acceptanceCriteria'],
              dependencies: [],
              cascadeRequired: false,
              impactAssessment: 'No significant impact',
              conflictRisk: 'low'
            }
          }]
        })
      })
    })

    describe('validateDependencies', () => {
      it('should detect missing test cases for acceptance criteria', async () => {
        const canvas = createMockCanvas()
        canvas.testCases = [] // Remove test cases

        const result = await analyzer.validateDependencies(canvas)

        expect(result.isValid).toBe(false)
        expect(result.conflicts).toHaveLength(1)
        expect(result.conflicts[0].type).toBe('missing_dependency')
        expect(result.conflicts[0].severity).toBe('major')
        expect(result.conflicts[0].affectedSections).toContain('acceptanceCriteria')
        expect(result.conflicts[0].affectedSections).toContain('testCases')
      })

      it('should detect orphaned test cases without acceptance criteria', async () => {
        const canvas = createMockCanvas()
        canvas.acceptanceCriteria = [] // Remove acceptance criteria

        const result = await analyzer.validateDependencies(canvas)

        expect(result.isValid).toBe(true) // Minor issue, still valid
        expect(result.conflicts).toHaveLength(1)
        expect(result.conflicts[0].type).toBe('orphaned_content')
        expect(result.conflicts[0].severity).toBe('minor')
        expect(result.conflicts[0].affectedSections).toContain('testCases')
      })

      it('should detect missing ticket summary with existing content', async () => {
        const canvas = createMockCanvas()
        canvas.ticketSummary.problem = '' // Empty problem

        const result = await analyzer.validateDependencies(canvas)

        expect(result.conflicts.some(c => c.type === 'missing_dependency' && 
          c.affectedSections.includes('ticketSummary'))).toBe(true)
      })

      it('should warn about imbalanced content ratios', async () => {
        const canvas = createMockCanvas()
        // Add many test cases for few acceptance criteria
        for (let i = 0; i < 10; i++) {
          canvas.testCases.push({
            format: 'gherkin',
            id: `tc-${i}`,
            category: 'functional',
            priority: 'high',
            testCase: {
              scenario: `Test scenario ${i}`,
              given: ['Given condition'],
              when: ['When action'],
              then: ['Then result'],
              tags: ['@test']
            }
          })
        }

        const result = await analyzer.validateDependencies(canvas)

        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some(w => w.includes('muchos más casos de prueba'))).toBe(true)
      })

      it('should handle AI conflict detection integration', async () => {
        mockGenerateText.mockImplementation((params) => {
          if (params.tools?.conflictDetection) {
            return Promise.resolve({
              toolCalls: [{
                toolName: 'conflictDetection',
                args: {
                  conflicts: [{
                    type: 'inconsistent_content',
                    severity: 'major',
                    affectedSections: ['acceptanceCriteria', 'testCases'],
                    description: 'Test cases do not match acceptance criteria',
                    currentState: 'Mismatched content',
                    expectedState: 'Aligned content',
                    suggestedResolution: 'Update test cases to match criteria',
                    autoResolvable: false
                  }],
                  validationScore: 60,
                  warnings: ['Content alignment issues detected']
                }
              }]
            })
          }
          return Promise.resolve({ toolCalls: [] })
        })

        const result = await analyzer.validateDependencies(
          createMockCanvas(),
          'Update acceptance criteria significantly',
          ['acceptanceCriteria']
        )

        expect(result.conflicts.length).toBeGreaterThanOrEqual(1)
        expect(result.conflicts.some(c => c.type === 'inconsistent_content')).toBe(true)
        // Score is averaged between static (100) and AI (60), so expect around 80
        expect(result.validationScore).toBeGreaterThanOrEqual(60)
        expect(result.warnings).toContain('Content alignment issues detected')
      })

      it('should combine static and AI validation results', async () => {
        const canvas = createMockCanvas()
        canvas.testCases = [] // This will trigger static validation

        mockGenerateText.mockImplementation((params) => {
          if (params.tools?.conflictDetection) {
            return Promise.resolve({
              toolCalls: [{
                toolName: 'conflictDetection',
                args: {
                  conflicts: [{
                    type: 'version_mismatch',
                    severity: 'minor',
                    affectedSections: ['acceptanceCriteria'],
                    description: 'Format inconsistency detected',
                    currentState: 'Mixed formats',
                    expectedState: 'Consistent format',
                    suggestedResolution: 'Standardize format',
                    autoResolvable: true
                  }],
                  validationScore: 75,
                  warnings: []
                }
              }]
            })
          }
          return Promise.resolve({ toolCalls: [] })
        })

        const result = await analyzer.validateDependencies(
          canvas,
          'Format changes',
          ['acceptanceCriteria']
        )

        // Should have both static (missing_dependency) and AI (version_mismatch) conflicts
        expect(result.conflicts.length).toBeGreaterThanOrEqual(2)
        expect(result.conflicts.some(c => c.type === 'missing_dependency')).toBe(true)
        expect(result.conflicts.some(c => c.type === 'version_mismatch')).toBe(true)
      })

      it('should handle validation failures gracefully', async () => {
        mockGenerateText.mockRejectedValue(new Error('AI service failed'))

        // Use a canvas that will trigger static validation issues
        const canvas = createMockCanvas()
        canvas.testCases = [] // This will trigger missing_dependency conflict

        const result = await analyzer.validateDependencies(
          canvas,
          'Some changes',
          ['acceptanceCriteria']
        )

        // Should have at least the static validation conflict (missing test cases)
        expect(result.conflicts.length).toBeGreaterThanOrEqual(1)
        expect(result.conflicts.some(c => c.type === 'missing_dependency')).toBe(true)
        // Validation score should be reduced due to missing test cases
        expect(result.validationScore).toBeLessThan(100)
      })
    })

    describe('conflict resolution suggestions', () => {
      it('should generate resolution suggestions for missing dependencies', async () => {
        const canvas = createMockCanvas()
        canvas.testCases = []

        const result = await analyzer.validateDependencies(canvas)

        expect(result.suggestions).toHaveLength(1)
        expect(result.suggestions[0].title).toBe('Dependencia Faltante')
        // The missing_dependency conflict generates actions for both testCases and acceptanceCriteria
        expect(result.suggestions[0].actions.length).toBeGreaterThanOrEqual(1)
        expect(result.suggestions[0].actions.some(a => a.type === 'add_content')).toBe(true)
        expect(result.suggestions[0].actions.some(a => a.section === 'testCases')).toBe(true)
      })

      it('should prioritize suggestions by severity', async () => {
        mockGenerateText.mockImplementation((params) => {
          if (params.tools?.conflictDetection) {
            return Promise.resolve({
              toolCalls: [{
                toolName: 'conflictDetection',
                args: {
                  conflicts: [
                    {
                      type: 'inconsistent_content',
                      severity: 'critical',
                      affectedSections: ['acceptanceCriteria'],
                      description: 'Critical issue',
                      currentState: 'Bad',
                      expectedState: 'Good',
                      suggestedResolution: 'Fix critical issue',
                      autoResolvable: false
                    },
                    {
                      type: 'version_mismatch',
                      severity: 'minor',
                      affectedSections: ['testCases'],
                      description: 'Minor issue',
                      currentState: 'OK',
                      expectedState: 'Better',
                      suggestedResolution: 'Fix minor issue',
                      autoResolvable: true
                    }
                  ],
                  validationScore: 70,
                  warnings: []
                }
              }]
            })
          }
          return Promise.resolve({ toolCalls: [] })
        })

        const result = await analyzer.validateDependencies(
          createMockCanvas(),
          'Changes',
          ['acceptanceCriteria']
        )

        expect(result.suggestions.length).toBeGreaterThanOrEqual(2)
        // Critical issues should come first
        expect(result.suggestions[0].priority).toBe('high')
      })

      it('should estimate resolution effort correctly', async () => {
        const canvas = createMockCanvas()
        canvas.testCases = []

        const result = await analyzer.validateDependencies(canvas)

        const suggestion = result.suggestions[0]
        // The missing_dependency conflict is auto-resolvable, so effort should be 'low'
        expect(suggestion.estimatedEffort).toBe('low')
      })
    })

    describe('change notifications', () => {
      it('should generate critical conflict notifications', async () => {
        const validationResult = {
          isValid: false,
          conflicts: [{
            type: 'inconsistent_content' as const,
            severity: 'critical' as const,
            affectedSections: ['acceptanceCriteria'] as const,
            description: 'Critical conflict',
            currentState: 'Bad',
            expectedState: 'Good',
            suggestedResolution: 'Fix it',
            autoResolvable: false
          }],
          warnings: [],
          suggestions: [],
          validationScore: 30
        }

        const notifications = analyzer.generateChangeNotifications(
          validationResult,
          ['acceptanceCriteria']
        )

        expect(notifications).toHaveLength(1)
        expect(notifications[0].type).toBe('error')
        expect(notifications[0].title).toBe('Conflictos Críticos Detectados')
        expect(notifications[0].dismissible).toBe(false)
        expect(notifications[0].actions).toHaveLength(2)
      })

      it('should generate success notifications for valid state', async () => {
        const validationResult = {
          isValid: true,
          conflicts: [],
          warnings: [],
          suggestions: [],
          validationScore: 95
        }

        const notifications = analyzer.generateChangeNotifications(
          validationResult,
          ['acceptanceCriteria']
        )

        expect(notifications).toHaveLength(1)
        expect(notifications[0].type).toBe('success')
        expect(notifications[0].title).toBe('Dependencias Validadas')
      })

      it('should generate warning notifications for major conflicts', async () => {
        const validationResult = {
          isValid: true,
          conflicts: [{
            type: 'missing_dependency' as const,
            severity: 'major' as const,
            affectedSections: ['testCases'] as const,
            description: 'Major issue',
            currentState: 'Missing',
            expectedState: 'Present',
            suggestedResolution: 'Add content',
            autoResolvable: true
          }],
          warnings: [],
          suggestions: [],
          validationScore: 70
        }

        const notifications = analyzer.generateChangeNotifications(
          validationResult,
          ['testCases']
        )

        expect(notifications.some(n => n.type === 'warning')).toBe(true)
      })

      it('should generate info notifications for warnings', async () => {
        const validationResult = {
          isValid: true,
          conflicts: [],
          warnings: ['Some recommendation', 'Another tip'],
          suggestions: [],
          validationScore: 85
        }

        const notifications = analyzer.generateChangeNotifications(
          validationResult,
          ['acceptanceCriteria']
        )

        expect(notifications.some(n => n.type === 'info')).toBe(true)
        expect(notifications.find(n => n.type === 'info')?.title).toBe('Recomendaciones')
      })
    })

    describe('conflict detection utilities', () => {
      it('should identify conflicts that would be created by changes', async () => {
        mockGenerateText.mockImplementation((params) => {
          if (params.tools?.conflictDetection) {
            return Promise.resolve({
              toolCalls: [{
                toolName: 'conflictDetection',
                args: {
                  conflicts: [{
                    type: 'inconsistent_content',
                    severity: 'major',
                    affectedSections: ['acceptanceCriteria', 'testCases'],
                    description: 'Would create inconsistency',
                    currentState: 'Consistent',
                    expectedState: 'Inconsistent after changes',
                    suggestedResolution: 'Revise changes',
                    autoResolvable: false
                  }],
                  validationScore: 40,
                  warnings: []
                }
              }]
            })
          }
          return Promise.resolve({ toolCalls: [] })
        })

        const wouldCreate = await analyzer.wouldCreateConflicts(
          createMockCanvas(),
          'Major breaking changes',
          ['acceptanceCriteria']
        )

        expect(wouldCreate).toBe(true)
      })

      it('should identify auto-resolvable conflicts', async () => {
        const validationResult = {
          isValid: false,
          conflicts: [
            {
              type: 'missing_dependency' as const,
              severity: 'major' as const,
              affectedSections: ['testCases'] as const,
              description: 'Auto-resolvable',
              currentState: 'Missing',
              expectedState: 'Present',
              suggestedResolution: 'Generate automatically',
              autoResolvable: true
            },
            {
              type: 'inconsistent_content' as const,
              severity: 'major' as const,
              affectedSections: ['acceptanceCriteria'] as const,
              description: 'Manual resolution needed',
              currentState: 'Inconsistent',
              expectedState: 'Consistent',
              suggestedResolution: 'Manual review required',
              autoResolvable: false
            }
          ],
          warnings: [],
          suggestions: [],
          validationScore: 60
        }

        const autoResolvable = analyzer.getAutoResolvableConflicts(validationResult)
        const manualResolution = analyzer.getManualResolutionConflicts(validationResult)

        expect(autoResolvable).toHaveLength(1)
        expect(autoResolvable[0].autoResolvable).toBe(true)
        expect(manualResolution).toHaveLength(1)
        expect(manualResolution[0].autoResolvable).toBe(false)
      })
    })

    describe('integration with dependency analysis', () => {
      it('should include validation results in dependency analysis', async () => {
        const canvas = createMockCanvas()
        canvas.testCases = [] // This will trigger validation issues

        mockGenerateText.mockImplementation((params) => {
          if (params.tools?.dependencyAnalysis) {
            return Promise.resolve({
              toolCalls: [{
                toolName: 'dependencyAnalysis',
                args: {
                  affectedSections: ['acceptanceCriteria', 'testCases'],
                  dependencies: [{
                    from: 'acceptanceCriteria',
                    to: 'testCases',
                    relationship: 'derives_from',
                    strength: 'strong'
                  }],
                  cascadeRequired: true,
                  impactAssessment: 'Significant impact',
                  conflictRisk: 'high'
                }
              }]
            })
          }
          if (params.tools?.conflictDetection) {
            return Promise.resolve({
              toolCalls: [{
                toolName: 'conflictDetection',
                args: {
                  conflicts: [],
                  validationScore: 80,
                  warnings: []
                }
              }]
            })
          }
          return Promise.resolve({ toolCalls: [] })
        })

        const result = await analyzer.analyzeDependencies(
          ['acceptanceCriteria'],
          canvas,
          'Update acceptance criteria'
        )

        expect(result.validationResult).toBeDefined()
        expect(result.validationResult?.conflicts).toBeDefined()
        expect(result.validationResult?.validationScore).toBeDefined()
      })
    })
  })
})

/**
 * Helper function to create a mock QA Canvas Document
 */
function createMockCanvas(): QACanvasDocument {
  return {
    ticketSummary: {
      problem: 'Test problem',
      solution: 'Test solution',
      context: 'Test context'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Test criterion',
        description: 'Test description',
        priority: 'must',
        category: 'functional',
        testable: true
      }
    ],
    testCases: [
      {
        format: 'gherkin',
        id: 'tc-1',
        category: 'functional',
        priority: 'high',
        testCase: {
          scenario: 'Test scenario',
          given: ['Given condition'],
          when: ['When action'],
          then: ['Then result'],
          tags: ['@test']
        }
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      qaProfile: {
        qaCategories: {
          functional: true,
          ux: false,
          ui: false,
          negative: false,
          api: false,
          database: false,
          performance: false,
          security: false,
          mobile: false,
          accessibility: false
        },
        testCaseFormat: 'gherkin'
      },
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  }
}