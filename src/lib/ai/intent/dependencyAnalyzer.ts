/**
 * DependencyAnalyzer - Detects dependencies between canvas sections
 * Analyzes when changes in one section affect others and determines cascade requirements
 */

import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { 
  DependencyAnalysisResult, 
  SectionDependency,
  CanvasSection,
  DependencyValidationResult,
  DependencyConflict,
  ConflictResolutionSuggestion,
  ResolutionAction,
  DependencyChangeNotification,
  ConflictType,
  ConflictSeverity
} from './types'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import { SECTION_DEPENDENCIES } from './constants'
import { canvasSectionSchema } from './types'

/**
 * AI tool for dependency analysis
 */
const dependencyAnalysisTool = tool({
  description: "Analyze dependencies between canvas sections and determine cascade requirements",
  parameters: z.object({
    affectedSections: z.array(canvasSectionSchema).describe("Sections that would be affected by the proposed changes"),
    dependencies: z.array(z.object({
      from: canvasSectionSchema,
      to: canvasSectionSchema,
      relationship: z.enum(['derives_from', 'validates', 'implements', 'references']),
      strength: z.enum(['strong', 'medium', 'weak'])
    })).describe("Detected dependencies between sections"),
    cascadeRequired: z.boolean().describe("Whether cascade updates are required"),
    impactAssessment: z.string().describe("Assessment of the impact of proposed changes"),
    conflictRisk: z.enum(['high', 'medium', 'low']).describe("Risk of conflicts if changes are made")
  })
})

/**
 * AI tool for conflict detection
 */
const conflictDetectionTool = tool({
  description: "Detect conflicts and inconsistencies between canvas sections",
  parameters: z.object({
    conflicts: z.array(z.object({
      type: z.enum(['inconsistent_content', 'missing_dependency', 'circular_dependency', 'orphaned_content', 'version_mismatch']),
      severity: z.enum(['critical', 'major', 'minor', 'warning']),
      affectedSections: z.array(canvasSectionSchema),
      description: z.string(),
      currentState: z.string(),
      expectedState: z.string(),
      suggestedResolution: z.string(),
      autoResolvable: z.boolean()
    })).describe("Detected conflicts between sections"),
    validationScore: z.number().min(0).max(100).describe("Overall validation score (0-100)"),
    warnings: z.array(z.string()).describe("Non-critical warnings about the canvas state")
  })
})

/**
 * DependencyAnalyzer class for analyzing section dependencies
 */
export class DependencyAnalyzer {
  private readonly model = openai('gpt-4o-mini')

  /**
   * Analyze dependencies for target sections and proposed changes
   */
  async analyzeDependencies(
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument,
    proposedChanges: string
  ): Promise<DependencyAnalysisResult> {
    try {
      // Perform static dependency analysis first
      const staticAnalysis = this.performStaticAnalysis(targetSections, currentCanvas)
      
      // Use AI for dynamic dependency analysis
      const aiAnalysis = await this.performAIAnalysis(
        targetSections, 
        currentCanvas, 
        proposedChanges,
        staticAnalysis
      )
      
      // Combine static and AI analysis with validation
      return await this.combineAnalysisResults(
        staticAnalysis, 
        aiAnalysis, 
        currentCanvas, 
        proposedChanges, 
        targetSections
      )
      
    } catch (error) {
      console.error('Dependency analysis failed:', error)
      return this.createFallbackResult(targetSections, error as Error)
    }
  }

  /**
   * Perform static dependency analysis based on predefined rules
   */
  private performStaticAnalysis(
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument
  ): Partial<DependencyAnalysisResult> {
    const affectedSections: CanvasSection[] = [...targetSections]
    const dependencies: SectionDependency[] = []
    let cascadeRequired = false

    // Check each target section for dependencies
    for (const section of targetSections) {
      const sectionDeps = SECTION_DEPENDENCIES[section] || []
      
      for (const dep of sectionDeps) {
        dependencies.push(dep)
        
        // Add affected section if not already included
        if (!affectedSections.includes(dep.to)) {
          affectedSections.push(dep.to)
        }
        
        // Strong dependencies require cascade updates
        if (dep.strength === 'strong') {
          cascadeRequired = true
        }
      }
    }

    // Assess conflict risk based on canvas state
    const conflictRisk = this.assessConflictRisk(targetSections, currentCanvas)

    return {
      affectedSections,
      dependencies,
      cascadeRequired,
      conflictRisk
    }
  }

  /**
   * Perform AI-based dependency analysis
   */
  private async performAIAnalysis(
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument,
    proposedChanges: string,
    staticAnalysis: Partial<DependencyAnalysisResult>
  ): Promise<Partial<DependencyAnalysisResult>> {
    
    const systemPrompt = this.buildSystemPrompt(currentCanvas, staticAnalysis)
    
    try {
      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: `
Analiza las dependencias entre secciones del lienzo QA para los siguientes cambios propuestos:

Secciones objetivo: ${targetSections.join(', ')}
Cambios propuestos: "${proposedChanges}"

Estado actual del lienzo:
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length} items
- Casos de prueba: ${currentCanvas.testCases.length} items
- Resumen del ticket: ${currentCanvas.ticketSummary.problem ? 'Presente' : 'Ausente'}
- Advertencias: ${currentCanvas.configurationWarnings.length} items

Análisis estático detectado:
- Secciones afectadas: ${staticAnalysis.affectedSections?.join(', ') || 'Ninguna'}
- Dependencias: ${staticAnalysis.dependencies?.length || 0} encontradas
- Cascada requerida: ${staticAnalysis.cascadeRequired ? 'Sí' : 'No'}

Proporciona un análisis detallado de las dependencias y el impacto de los cambios.
        `,
        tools: { dependencyAnalysis: dependencyAnalysisTool },
        toolChoice: 'required',
        maxTokens: 1000,
        temperature: 0.1
      })

      const toolCall = result.toolCalls[0]
      if (toolCall?.toolName === 'dependencyAnalysis') {
        const args = toolCall.args
        return {
          affectedSections: args.affectedSections,
          dependencies: args.dependencies.map(dep => ({
            from: dep.from,
            to: dep.to,
            relationship: dep.relationship,
            strength: dep.strength,
            description: this.getRelationshipDescription(dep.relationship, dep.from, dep.to)
          })),
          cascadeRequired: args.cascadeRequired,
          impactAssessment: args.impactAssessment,
          conflictRisk: args.conflictRisk
        }
      }
      
      throw new Error('AI dependency analysis did not return expected tool call')
      
    } catch (error) {
      console.error('AI dependency analysis failed:', error)
      return staticAnalysis
    }
  }

  /**
   * Build system prompt for AI dependency analysis
   */
  private buildSystemPrompt(
    currentCanvas: QACanvasDocument,
    staticAnalysis: Partial<DependencyAnalysisResult>
  ): string {
    return `
Eres un experto en análisis de dependencias para documentación QA que identifica cómo los cambios en una sección afectan otras secciones.

SECCIONES DEL LIENZO:
1. **ticketSummary**: Resumen del ticket (problema, solución, contexto)
2. **acceptanceCriteria**: Criterios de aceptación
3. **testCases**: Casos de prueba
4. **configurationWarnings**: Advertencias de configuración

TIPOS DE RELACIONES:
- **derives_from**: Una sección se deriva de otra (ej: test cases de acceptance criteria)
- **validates**: Una sección valida otra (ej: test cases validan ticket summary)
- **implements**: Una sección implementa otra (ej: acceptance criteria implementan ticket summary)
- **references**: Una sección hace referencia a otra

FUERZA DE DEPENDENCIAS:
- **strong**: Cambios requieren actualización obligatoria de la sección dependiente
- **medium**: Cambios probablemente requieren actualización
- **weak**: Cambios podrían requerir actualización

REGLAS DE DEPENDENCIAS COMUNES:
1. **acceptanceCriteria → testCases**: STRONG (los test cases se derivan de los criterios)
2. **ticketSummary → acceptanceCriteria**: MEDIUM (criterios implementan el resumen)
3. **ticketSummary → testCases**: MEDIUM (test cases validan el resumen)
4. **acceptanceCriteria ↔ testCases**: STRONG (bidireccional, deben estar sincronizados)

EVALUACIÓN DE RIESGO DE CONFLICTOS:
- **high**: Cambios complejos que afectan múltiples secciones con dependencias fuertes
- **medium**: Cambios que afectan algunas dependencias
- **low**: Cambios aislados con pocas dependencias

CONTEXTO DEL LIENZO ACTUAL:
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length}
- Casos de prueba: ${currentCanvas.testCases.length}
- Complejidad: ${this.assessCanvasComplexity(currentCanvas)}
    `
  }

  /**
   * Combine static and AI analysis results
   */
  private async combineAnalysisResults(
    staticAnalysis: Partial<DependencyAnalysisResult>,
    aiAnalysis: Partial<DependencyAnalysisResult>,
    currentCanvas?: QACanvasDocument,
    proposedChanges?: string,
    targetSections?: CanvasSection[]
  ): Promise<DependencyAnalysisResult> {
    // Combine affected sections
    const allAffectedSections = [
      ...(staticAnalysis.affectedSections || []),
      ...(aiAnalysis.affectedSections || [])
    ]
    const affectedSections = [...new Set(allAffectedSections)]

    // Combine dependencies (AI takes precedence for conflicts)
    const staticDeps = staticAnalysis.dependencies || []
    const aiDeps = aiAnalysis.dependencies || []
    
    // Create a map to avoid duplicates
    const depMap = new Map<string, SectionDependency>()
    
    // Add static dependencies first
    for (const dep of staticDeps) {
      const key = `${dep.from}-${dep.to}-${dep.relationship}`
      depMap.set(key, dep)
    }
    
    // Add AI dependencies (overwrite if exists)
    for (const dep of aiDeps) {
      const key = `${dep.from}-${dep.to}-${dep.relationship}`
      depMap.set(key, dep)
    }
    
    const dependencies = Array.from(depMap.values())

    // Determine cascade requirement (true if either analysis says true)
    const cascadeRequired = Boolean(
      staticAnalysis.cascadeRequired || aiAnalysis.cascadeRequired
    )

    // Use AI impact assessment if available, otherwise generate one
    const impactAssessment = aiAnalysis.impactAssessment || 
      this.generateImpactAssessment(affectedSections, dependencies, cascadeRequired)

    // Use AI conflict risk if available, otherwise use static
    const conflictRisk = aiAnalysis.conflictRisk || 
      staticAnalysis.conflictRisk || 'medium'

    // Perform validation if we have the necessary context
    let validationResult: DependencyValidationResult | undefined
    if (currentCanvas && proposedChanges && targetSections) {
      try {
        validationResult = await this.validateDependencies(currentCanvas, proposedChanges, targetSections)
      } catch (error) {
        console.warn('Validation failed during analysis combination:', error)
      }
    }

    return {
      affectedSections,
      dependencies,
      cascadeRequired,
      impactAssessment,
      conflictRisk,
      validationResult
    }
  }

  /**
   * Assess conflict risk based on canvas state and target sections
   */
  private assessConflictRisk(
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument
  ): 'high' | 'medium' | 'low' {
    let riskScore = 0

    // Multiple sections increase risk
    if (targetSections.length > 2) riskScore += 2
    else if (targetSections.length > 1) riskScore += 1

    // Complex canvas increases risk
    const totalItems = currentCanvas.acceptanceCriteria.length + 
                      currentCanvas.testCases.length
    if (totalItems > 15) riskScore += 2
    else if (totalItems > 5) riskScore += 1

    // Modifying acceptance criteria with existing test cases is high risk
    if (targetSections.includes('acceptanceCriteria') && 
        currentCanvas.testCases.length > 0) {
      riskScore += 2
    }

    // Modifying ticket summary with existing content is medium risk
    if (targetSections.includes('ticketSummary') && 
        (currentCanvas.acceptanceCriteria.length > 0 || currentCanvas.testCases.length > 0)) {
      riskScore += 1
    }

    if (riskScore >= 4) return 'high'
    if (riskScore >= 2) return 'medium'
    return 'low'
  }

  /**
   * Assess canvas complexity
   */
  private assessCanvasComplexity(currentCanvas: QACanvasDocument): string {
    const totalItems = currentCanvas.acceptanceCriteria.length + 
                      currentCanvas.testCases.length +
                      currentCanvas.configurationWarnings.length

    if (totalItems > 15) return 'complex'
    if (totalItems > 5) return 'medium'
    return 'simple'
  }

  /**
   * Get description for relationship type
   */
  private getRelationshipDescription(
    relationship: SectionDependency['relationship'],
    from: CanvasSection,
    to: CanvasSection
  ): string {
    const sectionNames = {
      ticketSummary: 'resumen del ticket',
      acceptanceCriteria: 'criterios de aceptación',
      testCases: 'casos de prueba',
      configurationWarnings: 'advertencias de configuración',
      metadata: 'metadatos'
    }

    const fromName = sectionNames[from]
    const toName = sectionNames[to]

    switch (relationship) {
      case 'derives_from':
        return `${toName} se derivan de ${fromName}`
      case 'validates':
        return `${toName} validan ${fromName}`
      case 'implements':
        return `${toName} implementan ${fromName}`
      case 'references':
        return `${toName} hacen referencia a ${fromName}`
      default:
        return `${fromName} está relacionado con ${toName}`
    }
  }

  /**
   * Generate impact assessment
   */
  private generateImpactAssessment(
    affectedSections: CanvasSection[],
    dependencies: SectionDependency[],
    cascadeRequired: boolean
  ): string {
    const sectionCount = affectedSections.length
    const strongDeps = dependencies.filter(d => d.strength === 'strong').length
    
    let assessment = `Los cambios afectarán ${sectionCount} sección${sectionCount > 1 ? 'es' : ''}.`
    
    if (strongDeps > 0) {
      assessment += ` Se detectaron ${strongDeps} dependencia${strongDeps > 1 ? 's' : ''} fuerte${strongDeps > 1 ? 's' : ''}.`
    }
    
    if (cascadeRequired) {
      assessment += ' Se requieren actualizaciones en cascada para mantener la coherencia.'
    }
    
    if (affectedSections.includes('testCases') && affectedSections.includes('acceptanceCriteria')) {
      assessment += ' Los casos de prueba deberán revisarse para asegurar que siguen validando los criterios actualizados.'
    }
    
    return assessment
  }

  /**
   * Create fallback result when analysis fails
   */
  private createFallbackResult(
    targetSections: CanvasSection[],
    error: Error
  ): DependencyAnalysisResult {
    console.warn('Using fallback dependency analysis due to error:', error.message)
    
    // Simple fallback: assume basic dependencies
    const affectedSections = [...targetSections]
    const dependencies: SectionDependency[] = []
    
    // Add basic acceptance criteria -> test cases dependency if relevant
    if (targetSections.includes('acceptanceCriteria')) {
      dependencies.push({
        from: 'acceptanceCriteria',
        to: 'testCases',
        relationship: 'derives_from',
        strength: 'strong',
        description: 'Los casos de prueba se derivan de los criterios de aceptación'
      })
      if (!affectedSections.includes('testCases')) {
        affectedSections.push('testCases')
      }
    }
    
    return {
      affectedSections,
      dependencies,
      cascadeRequired: dependencies.some(d => d.strength === 'strong'),
      impactAssessment: `Análisis básico: ${affectedSections.length} sección${affectedSections.length > 1 ? 'es' : ''} afectada${affectedSections.length > 1 ? 's' : ''}.`,
      conflictRisk: 'medium'
    }
  }

  /**
   * Check if sections have circular dependencies
   */
  hasCircularDependencies(dependencies: SectionDependency[]): boolean {
    const graph = new Map<CanvasSection, CanvasSection[]>()
    
    // Build adjacency list
    for (const dep of dependencies) {
      if (!graph.has(dep.from)) {
        graph.set(dep.from, [])
      }
      graph.get(dep.from)!.push(dep.to)
    }
    
    // DFS to detect cycles
    const visited = new Set<CanvasSection>()
    const recursionStack = new Set<CanvasSection>()
    
    const hasCycle = (node: CanvasSection): boolean => {
      visited.add(node)
      recursionStack.add(node)
      
      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true
        } else if (recursionStack.has(neighbor)) {
          return true
        }
      }
      
      recursionStack.delete(node)
      return false
    }
    
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return true
      }
    }
    
    return false
  }

  /**
   * Get sections that depend on a given section
   */
  getDependentSections(
    section: CanvasSection,
    dependencies: SectionDependency[]
  ): CanvasSection[] {
    return dependencies
      .filter(dep => dep.from === section)
      .map(dep => dep.to)
  }

  /**
   * Get sections that a given section depends on
   */
  getDependencySources(
    section: CanvasSection,
    dependencies: SectionDependency[]
  ): CanvasSection[] {
    return dependencies
      .filter(dep => dep.to === section)
      .map(dep => dep.from)
  }

  /**
   * Validate dependencies and detect conflicts between sections
   */
  async validateDependencies(
    currentCanvas: QACanvasDocument,
    proposedChanges?: string,
    targetSections?: CanvasSection[]
  ): Promise<DependencyValidationResult> {
    try {
      // Perform static validation checks
      const staticValidation = this.performStaticValidation(currentCanvas)
      
      // Perform AI-based conflict detection if we have proposed changes
      let aiValidation: Partial<DependencyValidationResult> = {}
      if (proposedChanges && targetSections) {
        aiValidation = await this.performAIConflictDetection(
          currentCanvas, 
          proposedChanges, 
          targetSections
        )
      }
      
      // Combine validation results
      return this.combineValidationResults(staticValidation, aiValidation)
      
    } catch (error) {
      console.error('Dependency validation failed:', error)
      return this.createFallbackValidationResult(error as Error)
    }
  }

  /**
   * Perform static validation checks
   */
  private performStaticValidation(currentCanvas: QACanvasDocument): Partial<DependencyValidationResult> {
    const conflicts: DependencyConflict[] = []
    const warnings: string[] = []
    let validationScore = 100

    // Check for missing test cases when acceptance criteria exist
    if (currentCanvas.acceptanceCriteria.length > 0 && currentCanvas.testCases.length === 0) {
      conflicts.push({
        type: 'missing_dependency',
        severity: 'major',
        affectedSections: ['acceptanceCriteria', 'testCases'],
        description: 'Existen criterios de aceptación pero no hay casos de prueba correspondientes',
        currentState: `${currentCanvas.acceptanceCriteria.length} criterios de aceptación, 0 casos de prueba`,
        expectedState: 'Al menos un caso de prueba por cada criterio de aceptación',
        suggestedResolution: 'Generar casos de prueba basados en los criterios de aceptación existentes',
        autoResolvable: true
      })
      validationScore -= 20
    }

    // Check for orphaned test cases (test cases without corresponding acceptance criteria)
    if (currentCanvas.testCases.length > 0 && currentCanvas.acceptanceCriteria.length === 0) {
      conflicts.push({
        type: 'orphaned_content',
        severity: 'minor',
        affectedSections: ['testCases', 'acceptanceCriteria'],
        description: 'Existen casos de prueba pero no hay criterios de aceptación que los respalden',
        currentState: `${currentCanvas.testCases.length} casos de prueba, 0 criterios de aceptación`,
        expectedState: 'Criterios de aceptación que justifiquen los casos de prueba',
        suggestedResolution: 'Crear criterios de aceptación basados en los casos de prueba existentes',
        autoResolvable: false
      })
      validationScore -= 10
    }

    // Check for empty ticket summary with existing content
    if (!currentCanvas.ticketSummary.problem && 
        (currentCanvas.acceptanceCriteria.length > 0 || currentCanvas.testCases.length > 0)) {
      conflicts.push({
        type: 'missing_dependency',
        severity: 'minor',
        affectedSections: ['ticketSummary'],
        description: 'Faltan detalles en el resumen del ticket pero existe contenido en otras secciones',
        currentState: 'Resumen del ticket vacío o incompleto',
        expectedState: 'Resumen del ticket con problema, solución y contexto definidos',
        suggestedResolution: 'Completar el resumen del ticket basándose en el contenido existente',
        autoResolvable: false
      })
      validationScore -= 15
    }

    // Check for imbalanced content (too many test cases vs acceptance criteria)
    const ratio = currentCanvas.acceptanceCriteria.length > 0 ? 
      currentCanvas.testCases.length / currentCanvas.acceptanceCriteria.length : 0
    
    if (ratio > 5) {
      warnings.push('Hay muchos más casos de prueba que criterios de aceptación. Considera consolidar o revisar la cobertura.')
      validationScore -= 5
    } else if (ratio > 0 && ratio < 0.5) {
      warnings.push('Hay pocos casos de prueba en relación a los criterios de aceptación. Considera añadir más cobertura.')
      validationScore -= 5
    }

    // Check for configuration warnings that might indicate structural issues
    if (currentCanvas.configurationWarnings.length > 3) {
      warnings.push('Múltiples advertencias de configuración pueden indicar problemas estructurales en el lienzo.')
      validationScore -= 5
    }

    return {
      isValid: conflicts.filter(c => c.severity === 'critical' || c.severity === 'major').length === 0,
      conflicts,
      warnings,
      validationScore: Math.max(0, validationScore)
    }
  }

  /**
   * Perform AI-based conflict detection
   */
  private async performAIConflictDetection(
    currentCanvas: QACanvasDocument,
    proposedChanges: string,
    targetSections: CanvasSection[]
  ): Promise<Partial<DependencyValidationResult>> {
    
    const systemPrompt = this.buildConflictDetectionPrompt(currentCanvas)
    
    try {
      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: `
Analiza los siguientes cambios propuestos para detectar conflictos y problemas de consistencia:

Secciones objetivo: ${targetSections.join(', ')}
Cambios propuestos: "${proposedChanges}"

Estado actual del lienzo:
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.map((ac, i) => `${i+1}. ${ac.description}`).join('\n  ')}
- Casos de prueba: ${currentCanvas.testCases.map((tc, i) => `${i+1}. ${tc.description}`).join('\n  ')}
- Resumen del ticket: ${currentCanvas.ticketSummary.problem || 'No definido'}

Identifica conflictos potenciales, inconsistencias y problemas de validación que podrían surgir con estos cambios.
        `,
        tools: { conflictDetection: conflictDetectionTool },
        toolChoice: 'required',
        maxTokens: 1500,
        temperature: 0.1
      })

      const toolCall = result.toolCalls[0]
      if (toolCall?.toolName === 'conflictDetection') {
        const args = toolCall.args
        return {
          conflicts: args.conflicts.map(conflict => ({
            ...conflict,
            affectedSections: conflict.affectedSections
          })),
          warnings: args.warnings,
          validationScore: args.validationScore,
          isValid: args.conflicts.filter(c => c.severity === 'critical' || c.severity === 'major').length === 0
        }
      }
      
      throw new Error('AI conflict detection did not return expected tool call')
      
    } catch (error) {
      console.error('AI conflict detection failed:', error)
      return {}
    }
  }

  /**
   * Build system prompt for conflict detection
   */
  private buildConflictDetectionPrompt(currentCanvas: QACanvasDocument): string {
    return `
Eres un experto en validación de documentación QA que detecta conflictos e inconsistencias entre secciones del lienzo.

TIPOS DE CONFLICTOS:
1. **inconsistent_content**: Contenido contradictorio entre secciones
2. **missing_dependency**: Dependencias requeridas que faltan
3. **circular_dependency**: Dependencias circulares detectadas
4. **orphaned_content**: Contenido sin dependencias apropiadas
5. **version_mismatch**: Diferentes versiones o formatos entre secciones

SEVERIDADES:
- **critical**: Bloquea la funcionalidad, debe resolverse inmediatamente
- **major**: Afecta significativamente la calidad, debe resolverse pronto
- **minor**: Problema menor que puede resolverse después
- **warning**: Advertencia que no bloquea pero debe considerarse

REGLAS DE VALIDACIÓN:
1. Los casos de prueba deben derivarse de criterios de aceptación
2. Los criterios de aceptación deben implementar el resumen del ticket
3. No debe haber contenido huérfano sin justificación
4. Las dependencias deben ser consistentes y no circulares
5. El formato y estilo debe ser coherente entre secciones

CONTEXTO DEL LIENZO:
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length}
- Casos de prueba: ${currentCanvas.testCases.length}
- Resumen completo: ${currentCanvas.ticketSummary.problem ? 'Sí' : 'No'}
- Advertencias existentes: ${currentCanvas.configurationWarnings.length}

Analiza cuidadosamente las inconsistencias potenciales y proporciona resoluciones específicas y accionables.
    `
  }

  /**
   * Combine validation results from static and AI analysis
   */
  private combineValidationResults(
    staticValidation: Partial<DependencyValidationResult>,
    aiValidation: Partial<DependencyValidationResult>
  ): DependencyValidationResult {
    // Combine conflicts
    const allConflicts = [
      ...(staticValidation.conflicts || []),
      ...(aiValidation.conflicts || [])
    ]
    
    // Remove duplicates based on type and affected sections
    const conflictMap = new Map<string, DependencyConflict>()
    for (const conflict of allConflicts) {
      const key = `${conflict.type}-${conflict.affectedSections.sort().join('-')}`
      if (!conflictMap.has(key) || conflict.severity === 'critical') {
        conflictMap.set(key, conflict)
      }
    }
    const conflicts = Array.from(conflictMap.values())

    // Combine warnings
    const allWarnings = [
      ...(staticValidation.warnings || []),
      ...(aiValidation.warnings || [])
    ]
    const warnings = [...new Set(allWarnings)]

    // Calculate combined validation score
    const staticScore = staticValidation.validationScore || 50
    const aiScore = aiValidation.validationScore || 50
    const validationScore = Math.round((staticScore + aiScore) / 2)

    // Generate resolution suggestions
    const suggestions = this.generateResolutionSuggestions(conflicts)

    return {
      isValid: conflicts.filter(c => c.severity === 'critical' || c.severity === 'major').length === 0,
      conflicts,
      warnings,
      suggestions,
      validationScore
    }
  }

  /**
   * Generate resolution suggestions for conflicts
   */
  private generateResolutionSuggestions(conflicts: DependencyConflict[]): ConflictResolutionSuggestion[] {
    const suggestions: ConflictResolutionSuggestion[] = []

    for (const conflict of conflicts) {
      const suggestion: ConflictResolutionSuggestion = {
        conflictId: `${conflict.type}-${Date.now()}`,
        title: this.getConflictTitle(conflict.type),
        description: conflict.suggestedResolution,
        actions: this.generateResolutionActions(conflict),
        estimatedEffort: this.estimateResolutionEffort(conflict),
        priority: this.mapSeverityToPriority(conflict.severity),
        affectedSections: conflict.affectedSections
      }
      suggestions.push(suggestion)
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Generate resolution actions for a conflict
   */
  private generateResolutionActions(conflict: DependencyConflict): ResolutionAction[] {
    const actions: ResolutionAction[] = []

    switch (conflict.type) {
      case 'missing_dependency':
        if (conflict.affectedSections.includes('testCases')) {
          actions.push({
            type: 'add_content',
            section: 'testCases',
            description: 'Generar casos de prueba basados en criterios de aceptación'
          })
        }
        if (conflict.affectedSections.includes('acceptanceCriteria')) {
          actions.push({
            type: 'add_content',
            section: 'acceptanceCriteria',
            description: 'Crear criterios de aceptación faltantes'
          })
        }
        break

      case 'inconsistent_content':
        for (const section of conflict.affectedSections) {
          actions.push({
            type: 'modify_section',
            section,
            description: `Actualizar contenido en ${section} para mantener consistencia`
          })
        }
        break

      case 'orphaned_content':
        actions.push({
          type: 'add_content',
          section: conflict.affectedSections[0],
          description: 'Crear dependencias apropiadas para el contenido huérfano'
        })
        break

      case 'circular_dependency':
        actions.push({
          type: 'modify_section',
          section: conflict.affectedSections[0],
          description: 'Reestructurar dependencias para eliminar ciclos'
        })
        break

      case 'version_mismatch':
        for (const section of conflict.affectedSections) {
          actions.push({
            type: 'modify_section',
            section,
            description: `Estandarizar formato en ${section}`
          })
        }
        break
    }

    return actions
  }

  /**
   * Get human-readable title for conflict type
   */
  private getConflictTitle(type: ConflictType): string {
    const titles = {
      inconsistent_content: 'Contenido Inconsistente',
      missing_dependency: 'Dependencia Faltante',
      circular_dependency: 'Dependencia Circular',
      orphaned_content: 'Contenido Huérfano',
      version_mismatch: 'Formato Inconsistente'
    }
    return titles[type] || 'Conflicto Desconocido'
  }

  /**
   * Estimate effort required to resolve conflict
   */
  private estimateResolutionEffort(conflict: DependencyConflict): 'low' | 'medium' | 'high' {
    if (conflict.autoResolvable) return 'low'
    
    switch (conflict.severity) {
      case 'critical': return 'high'
      case 'major': return 'medium'
      case 'minor': return 'low'
      case 'warning': return 'low'
      default: return 'medium'
    }
  }

  /**
   * Map conflict severity to priority
   */
  private mapSeverityToPriority(severity: ConflictSeverity): 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'high'
      case 'major': return 'high'
      case 'minor': return 'medium'
      case 'warning': return 'low'
      default: return 'medium'
    }
  }

  /**
   * Create fallback validation result when validation fails
   */
  private createFallbackValidationResult(error: Error): DependencyValidationResult {
    console.warn('Using fallback validation result due to error:', error.message)
    
    return {
      isValid: false,
      conflicts: [{
        type: 'version_mismatch',
        severity: 'warning',
        affectedSections: ['ticketSummary', 'acceptanceCriteria', 'testCases'],
        description: 'No se pudo completar la validación de dependencias',
        currentState: 'Validación fallida',
        expectedState: 'Validación exitosa',
        suggestedResolution: 'Revisar manualmente la consistencia entre secciones',
        autoResolvable: false
      }],
      warnings: ['La validación automática falló. Se recomienda revisión manual.'],
      suggestions: [],
      validationScore: 50
    }
  }

  /**
   * Generate user notifications for dependency changes
   */
  generateChangeNotifications(
    validationResult: DependencyValidationResult,
    affectedSections: CanvasSection[]
  ): DependencyChangeNotification[] {
    const notifications: DependencyChangeNotification[] = []

    // Critical conflicts notification
    const criticalConflicts = validationResult.conflicts.filter(c => c.severity === 'critical')
    if (criticalConflicts.length > 0) {
      notifications.push({
        type: 'error',
        title: 'Conflictos Críticos Detectados',
        message: `Se detectaron ${criticalConflicts.length} conflicto${criticalConflicts.length > 1 ? 's' : ''} crítico${criticalConflicts.length > 1 ? 's' : ''} que deben resolverse antes de continuar.`,
        affectedSections,
        actions: [
          { label: 'Revisar Conflictos', action: 'review_conflicts' },
          { label: 'Aplicar Sugerencias', action: 'apply_suggestions' }
        ],
        dismissible: false,
        timestamp: new Date().toISOString()
      })
    }

    // Major conflicts notification
    const majorConflicts = validationResult.conflicts.filter(c => c.severity === 'major')
    if (majorConflicts.length > 0) {
      notifications.push({
        type: 'warning',
        title: 'Problemas de Consistencia',
        message: `Se detectaron ${majorConflicts.length} problema${majorConflicts.length > 1 ? 's' : ''} de consistencia que deberían resolverse.`,
        affectedSections,
        actions: [
          { label: 'Ver Detalles', action: 'review_conflicts' },
          { label: 'Aceptar Cambios', action: 'accept_changes' }
        ],
        dismissible: true,
        timestamp: new Date().toISOString()
      })
    }

    // Success notification for valid state
    if (validationResult.isValid && validationResult.validationScore > 80) {
      notifications.push({
        type: 'success',
        title: 'Dependencias Validadas',
        message: 'Todas las dependencias están correctamente configuradas y no se detectaron conflictos.',
        affectedSections,
        dismissible: true,
        timestamp: new Date().toISOString()
      })
    }

    // Warnings notification
    if (validationResult.warnings.length > 0) {
      notifications.push({
        type: 'info',
        title: 'Recomendaciones',
        message: `Se generaron ${validationResult.warnings.length} recomendación${validationResult.warnings.length > 1 ? 'es' : ''} para mejorar la calidad del lienzo.`,
        affectedSections,
        actions: [
          { label: 'Ver Recomendaciones', action: 'review_conflicts' }
        ],
        dismissible: true,
        timestamp: new Date().toISOString()
      })
    }

    return notifications
  }

  /**
   * Check if proposed changes would create conflicts
   */
  async wouldCreateConflicts(
    currentCanvas: QACanvasDocument,
    proposedChanges: string,
    targetSections: CanvasSection[]
  ): Promise<boolean> {
    const validationResult = await this.validateDependencies(
      currentCanvas, 
      proposedChanges, 
      targetSections
    )
    
    return validationResult.conflicts.some(c => 
      c.severity === 'critical' || c.severity === 'major'
    )
  }

  /**
   * Get auto-resolvable conflicts
   */
  getAutoResolvableConflicts(validationResult: DependencyValidationResult): DependencyConflict[] {
    return validationResult.conflicts.filter(c => c.autoResolvable)
  }

  /**
   * Get manual resolution conflicts
   */
  getManualResolutionConflicts(validationResult: DependencyValidationResult): DependencyConflict[] {
    return validationResult.conflicts.filter(c => !c.autoResolvable)
  }
}