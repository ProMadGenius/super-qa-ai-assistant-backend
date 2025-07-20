import { NextRequest, NextResponse } from 'next/server'
import {
  validateTicketAnalysisPayload,
  type TicketAnalysisPayload
} from '@/lib/schemas/TicketAnalysisPayload'
import {
  type QACanvasDocument
} from '@/lib/schemas/QACanvasDocument'
import { handleValidationError, handleAIError } from '@/lib/ai/errorHandler'
import {
  UncertaintyType
} from '@/lib/ai/uncertaintyHandler'
import { v4 as uuidv4 } from 'uuid'
import {
  processAndUploadImages,
  prepareAttachmentImages,
  prepareCommentImages
} from '@/lib/utils/imageProcessor'
import { generateQADocumentBySections } from '@/lib/ai/sectionGenerators'

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * POST /api/analyze-ticket
 * 
 * Analyzes a Jira ticket and generates comprehensive QA documentation
 * using AI-powered analysis with structured output.
 */
export async function POST(request: NextRequest) {
  // Generate a unique request ID for tracking and debugging
  const requestId = uuidv4()
  const requestStartTime = Date.now()

  console.log(`🚀 [${requestId}] Starting analyze-ticket request...`)

  try {
    // Parse and validate the request body
    const parseStartTime = Date.now()
    const body = await request.json()
    const parseTime = Date.now() - parseStartTime
    console.log(`📋 [${requestId}] Request parsing completed in ${parseTime}ms`)

    // Debug: Log the received data structure
    console.log('🔍 Received request body structure:')
    console.log('- ticketJson keys:', Object.keys(body.ticketJson || {}))
    console.log('- attachments count:', body.ticketJson?.attachments?.length || 0)
    console.log('- comments count:', body.ticketJson?.comments?.length || 0)
    console.log('- includeImages setting:', body.qaProfile?.includeImages)

    if (body.ticketJson?.attachments?.length > 0) {
      console.log('📎 Attachments found:')
      body.ticketJson.attachments.forEach((att: any, i: number) => {
        console.log(`  ${i + 1}. ${att.name} (${att.mime}) - ${att.size} bytes - tooBig: ${att.tooBig}`)
        console.log(`     Has data: ${att.data ? 'YES' : 'NO'} (${att.data ? att.data.substring(0, 50) + '...' : 'N/A'})`)
      })
    }

    const validationStartTime = Date.now()
    const validationResult = validateTicketAnalysisPayload(body)
    const validationTime = Date.now() - validationStartTime
    console.log(`✅ [${requestId}] Validation completed in ${validationTime}ms`)

    if (!validationResult.success) {
      return handleValidationError(validationResult.error.issues, requestId)
    }

    const { qaProfile, ticketJson }: TicketAnalysisPayload = validationResult.data

    // Document any assumptions we need to make based on the input data
    const assumptionsStartTime = Date.now()
    const assumptions = []

    // Check for potential configuration issues
    if (!qaProfile.testCaseFormat) {
      assumptions.push({
        type: UncertaintyType.MISSING_CONTEXT,
        description: 'No test case format specified, defaulting to Gherkin format',
        alternatives: ['Step-by-step', 'Table format'],
        confidence: 0.7,
        impact: 'medium'
      })
    }

    // Check for minimal ticket information
    if (!ticketJson.description || ticketJson.description.trim().length < 50) {
      assumptions.push({
        type: UncertaintyType.MISSING_CONTEXT,
        description: 'Limited ticket description provided, may affect quality of generated test cases',
        confidence: 0.9,
        impact: 'high'
      })
    }

    // Check for potential conflicts in QA categories
    const activeCategories = Object.entries(qaProfile.qaCategories)
      .filter(([, active]) => active)
      .map(([category]) => category)

    if (activeCategories.includes('api') && !ticketJson.description.toLowerCase().includes('api')) {
      assumptions.push({
        type: UncertaintyType.CONFLICTING_REQUIREMENTS,
        description: 'API testing category is enabled but ticket may not involve API functionality',
        confidence: 0.6,
        impact: 'medium'
      })
    }

    const assumptionsTime = Date.now() - assumptionsStartTime
    console.log(`🔍 [${requestId}] Assumptions analysis completed in ${assumptionsTime}ms (${assumptions.length} assumptions)`)

    // Build comprehensive system prompt for QA analysis
    const promptStartTime = Date.now()
    const systemPrompt = `You are a world-class QA analyst tasked with creating comprehensive test documentation. 

Your role is to:
1. Analyze Jira tickets and translate technical requirements into clear, testable documentation
2. Generate acceptance criteria and test cases based on the ticket content and QA profile
3. Identify potential issues, edge cases, and testing gaps
4. Provide structured, actionable QA documentation

Always follow these principles:
- Write clear, unambiguous acceptance criteria
- Create comprehensive test cases covering happy paths, edge cases, and error scenarios
- Consider the user experience and business impact
- Ensure all requirements are testable and measurable`

    // Process and upload images if includeImages is enabled
    let uploadedImages: any[] = []
    let imageAttachments: any[] = []
    let commentImages: any[] = []

    const imageProcessingStartTime = Date.now()
    if (qaProfile.includeImages) {
      console.log(`🖼️ [${requestId}] Processing images (includeImages = true)...`)

      // Prepare images for upload
      const attachmentImages = prepareAttachmentImages(ticketJson.attachments)
      const commentImageData = prepareCommentImages(ticketJson.comments)

      console.log(`📎 Prepared ${attachmentImages.length} attachment images`)
      console.log(`💬 Prepared ${commentImageData.length} comment images`)

      // Upload images internally and get URLs
      const allImages = [...attachmentImages, ...commentImageData]

      if (allImages.length > 0) {
        console.log(`🚀 Processing ${allImages.length} images internally...`)

        try {
          const imageUploadStartTime = Date.now()
          uploadedImages = await processAndUploadImages(allImages)
          const imageUploadTime = Date.now() - imageUploadStartTime
          console.log(`✅ [${requestId}] Successfully processed ${uploadedImages.length} images in ${imageUploadTime}ms`)

          // Log processed image details
          uploadedImages.forEach((img: any, i: number) => {
            console.log(`   ${i + 1}. ${img.originalName} -> ${img.url}`)
            console.log(`       📏 Size: ${(img.size / 1024).toFixed(1)}KB (was ${(img.originalSize / 1024).toFixed(1)}KB)`)
            console.log(`       📐 Dimensions: ${img.dimensions.width}x${img.dimensions.height}`)
            console.log(`       🔧 Processed: ${img.processed ? 'Yes' : 'No'}`)
            if (img.processingInfo) {
              console.log(`       ⚙️ Processing: Quality=${img.processingInfo.qualityApplied}%, Resized=${img.processingInfo.resized}, Compressed=${img.processingInfo.compressed}`)
            }
            console.log(`       🌐 URL: ${img.absoluteUrl}`)
          })

          // Separate uploaded images by source
          imageAttachments = uploadedImages.filter(img => img.source === 'attachment')
          commentImages = uploadedImages.filter(img => img.source === 'comment')

          console.log(`📊 Final counts: ${imageAttachments.length} attachments, ${commentImages.length} comments`)
        } catch (uploadError) {
          const imageUploadTime = Date.now() - imageProcessingStartTime
          console.error(`❌ [${requestId}] Failed to process images after ${imageUploadTime}ms:`, uploadError)
          // Continue without images
          imageAttachments = []
          commentImages = []
        }
      } else {
        console.log(`ℹ️ [${requestId}] No images to process`)
      }
    } else {
      // Just get image info without uploading
      imageAttachments = ticketJson.attachments.filter(attachment =>
        attachment.mime.startsWith('image/') && !attachment.tooBig
      )
      commentImages = ticketJson.comments.flatMap(comment => comment.images || [])
    }

    const imageProcessingTime = Date.now() - imageProcessingStartTime
    console.log(`🖼️ [${requestId}] Image processing phase completed in ${imageProcessingTime}ms`)

    const promptTime = Date.now() - promptStartTime
    console.log(`📝 [${requestId}] Prompt construction completed in ${promptTime}ms`)

    // Generate structured QA documentation using AI
    const aiGenerationStartTime = Date.now()
    console.log(`🤖 [${requestId}] Starting AI document generation...`)

    try {
      // Use parallel section generation for improved performance
      console.log(`🚀 [${requestId}] Using parallel section generation...`)
      const generatedDocumentBase = await generateQADocumentBySections(
        ticketJson,
        qaProfile,
        assumptions,
        requestId
      )
      
      const generationTime = Date.now() - aiGenerationStartTime
      console.log(`🤖 [${requestId}] AI document generation completed in ${generationTime}ms`)

      // Add metadata to complete the document structure (wordCount calculated after)
      const generatedDocument: QACanvasDocument = {
        ...generatedDocumentBase,
        metadata: {
          generatedAt: new Date().toISOString(),
          qaProfile,
          ticketId: ticketJson.issueKey,
          documentVersion: '1.0',
          aiModel: (() => {
            const primaryProvider = process.env.PRIMARY_PROVIDER || 'openai';
            return primaryProvider === 'openai'
              ? (process.env.OPENAI_MODEL || 'gpt-4o-mini')
              : (process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022');
          })(),
          generationTime,
          wordCount: 0, // Will be calculated below
          regenerationReason: assumptions.length > 0 ? `Generated with ${assumptions.length} assumptions` : undefined
        }
      }
      
      // Calculate word count now that we have the complete document
      generatedDocument.metadata.wordCount = estimateWordCount(generatedDocument)

      // Debug: Log the generated document structure
      console.log('Generated document structure:', JSON.stringify(generatedDocument, null, 2))
      console.log('Generated document keys:', Object.keys(generatedDocument || {}))

      // Check if the document has the expected structure
      console.log(`📋 [${requestId}] Generated document structure:`, Object.keys(generatedDocument))
      
      if (!generatedDocument) {
        console.error(`❌ [${requestId}] Generated document is null or undefined`)
        throw new Error('AI failed to generate document')
      }

      if (!generatedDocument.ticketSummary) {
        console.error(`❌ [${requestId}] Generated document missing ticketSummary`)
      } else {
        console.log(`✅ [${requestId}] Ticket summary present:`, Object.keys(generatedDocument.ticketSummary))
      }

      if (!generatedDocument.acceptanceCriteria) {
        console.error(`❌ [${requestId}] Generated document missing acceptanceCriteria`)
      } else {
        console.log(`✅ [${requestId}] Acceptance criteria present: ${generatedDocument.acceptanceCriteria.length} items`)
      }

      if (!generatedDocument.testCases) {
        console.error(`❌ [${requestId}] Generated document missing testCases`)
      } else {
        console.log(`✅ [${requestId}] Test cases present: ${generatedDocument.testCases.length} items`)
      }

      // Document enhancement (metadata already added above)
      const enhancementStartTime = Date.now()
      const enhancedDocument = generatedDocument

      const enhancementTime = Date.now() - enhancementStartTime
      const totalRequestTime = Date.now() - requestStartTime

      console.log(`✅ [${requestId}] Document enhancement completed in ${enhancementTime}ms`)
      console.log(`🎯 [${requestId}] TOTAL REQUEST TIME: ${totalRequestTime}ms`)
      console.log(`📊 [${requestId}] Timing breakdown:`)
      console.log(`   - Parsing: ${parseTime}ms`)
      console.log(`   - Validation: ${validationTime}ms`)
      console.log(`   - Assumptions: ${assumptionsTime}ms`)
      console.log(`   - Prompt construction: ${promptTime}ms`)
      console.log(`   - Image processing: ${imageProcessingTime}ms`)
      console.log(`   - AI generation: ${generationTime}ms`)
      console.log(`   - Enhancement: ${enhancementTime}ms`)

      // Return the generated QA documentation with CORS headers
      return NextResponse.json(enhancedDocument, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      })
    } catch (error) {
      const generationTime = Date.now() - aiGenerationStartTime
      console.error(`❌ [${requestId}] Error generating complete document after ${generationTime}ms:`, error)
      // Don't attempt partial generation, just throw the error to be handled by the outer catch
      throw error
    }

  } catch (error) {
    const totalRequestTime = Date.now() - requestStartTime
    console.error(`❌ [${requestId}] Error in /api/analyze-ticket after ${totalRequestTime}ms:`, error)
    return handleAIError(error, requestId)
  }
}

/**
 * Helper function to estimate word count in the generated document
 */
function estimateWordCount(document: QACanvasDocument): number {
  let wordCount = 0

  // Count words in ticket summary
  wordCount += countWords(document.ticketSummary.problem)
  wordCount += countWords(document.ticketSummary.solution)
  wordCount += countWords(document.ticketSummary.context)

  // Count words in configuration warnings
  document.configurationWarnings.forEach(warning => {
    wordCount += countWords(warning.message)
    wordCount += countWords(warning.recommendation)
  })

  // Count words in acceptance criteria
  document.acceptanceCriteria.forEach(criterion => {
    wordCount += countWords(criterion.title)
    wordCount += countWords(criterion.description)
  })

  // Count words in test cases
  document.testCases.forEach(testCase => {
    if (testCase.format === 'gherkin') {
      wordCount += countWords(testCase.testCase.scenario)
      testCase.testCase.given.forEach(given => wordCount += countWords(given))
      testCase.testCase.when.forEach(when => wordCount += countWords(when))
      testCase.testCase.then.forEach(then => wordCount += countWords(then))
    } else if (testCase.format === 'steps') {
      wordCount += countWords(testCase.testCase.title)
      wordCount += countWords(testCase.testCase.objective)
      testCase.testCase.steps.forEach(step => {
        wordCount += countWords(step.action)
        wordCount += countWords(step.expectedResult)
      })
    } else if (testCase.format === 'table') {
      wordCount += countWords(testCase.testCase.title)
      wordCount += countWords(testCase.testCase.description)
      wordCount += countWords(testCase.testCase.expectedOutcome)
    }
  })

  return wordCount
}

/**
 * Helper function to count words in a string
 */
function countWords(text: string | undefined | null): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}