import { 
  qaProfileSchema, 
  qaCategoriesSchema, 
  testCaseFormatSchema,
  defaultQAProfile,
  type QAProfile,
  type QACategories,
  type TestCaseFormat
} from '@/lib/schemas/QAProfile'

describe('QAProfile Schema Validation', () => {
  describe('qaCategoriesSchema', () => {
    it('should validate valid QA categories', () => {
      const validCategories: QACategories = {
        functional: true,
        ux: false,
        ui: true,
        negative: false,
        api: true,
        database: false,
        performance: true,
        security: false,
        mobile: true,
        accessibility: false
      }

      const result = qaCategoriesSchema.safeParse(validCategories)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validCategories)
      }
    })

    it('should reject invalid QA categories with non-boolean values', () => {
      const invalidCategories = {
        functional: 'true', // string instead of boolean
        ux: false,
        ui: true,
        negative: false,
        api: true,
        database: false,
        performance: true,
        security: false,
        mobile: true,
        accessibility: false
      }

      const result = qaCategoriesSchema.safeParse(invalidCategories)
      expect(result.success).toBe(false)
    })

    it('should reject QA categories with missing required fields', () => {
      const incompleteCategories = {
        functional: true,
        ux: false,
        // missing other required fields
      }

      const result = qaCategoriesSchema.safeParse(incompleteCategories)
      expect(result.success).toBe(false)
    })
  })

  describe('testCaseFormatSchema', () => {
    it('should validate valid test case formats', () => {
      const validFormats: TestCaseFormat[] = ['gherkin', 'steps', 'table']

      validFormats.forEach(format => {
        const result = testCaseFormatSchema.safeParse(format)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe(format)
        }
      })
    })

    it('should reject invalid test case formats', () => {
      const invalidFormats = ['invalid', 'markdown', 'json', '']

      invalidFormats.forEach(format => {
        const result = testCaseFormatSchema.safeParse(format)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('qaProfileSchema', () => {
    it('should validate complete valid QA profile', () => {
      const validProfile: QAProfile = {
        qaCategories: {
          functional: true,
          ux: true,
          ui: false,
          negative: true,
          api: false,
          database: false,
          performance: false,
          security: true,
          mobile: true,
          accessibility: true
        },
        testCaseFormat: 'gherkin',
        autoRefresh: true,
        includeComments: true,
        includeImages: false,
        operationMode: 'online',
        showNotifications: true
      }

      const result = qaProfileSchema.safeParse(validProfile)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validProfile)
      }
    })

    it('should validate the default QA profile', () => {
      const result = qaProfileSchema.safeParse(defaultQAProfile)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(defaultQAProfile)
      }
    })

    it('should reject QA profile with invalid test case format', () => {
      const invalidProfile = {
        qaCategories: {
          functional: true,
          ux: true,
          ui: false,
          negative: true,
          api: false,
          database: false,
          performance: false,
          security: true,
          mobile: true,
          accessibility: true
        },
        testCaseFormat: 'invalid-format'
      }

      const result = qaProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })

    it('should reject QA profile with missing qaCategories', () => {
      const invalidProfile = {
        testCaseFormat: 'steps'
        // missing qaCategories
      }

      const result = qaProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(qaProfileSchema.safeParse(null).success).toBe(false)
      expect(qaProfileSchema.safeParse(undefined).success).toBe(false)
      expect(qaCategoriesSchema.safeParse(null).success).toBe(false)
      expect(testCaseFormatSchema.safeParse(null).success).toBe(false)
    })

    it('should handle empty objects', () => {
      expect(qaProfileSchema.safeParse({}).success).toBe(false)
      expect(qaCategoriesSchema.safeParse({}).success).toBe(false)
    })

    it('should handle arrays instead of objects', () => {
      expect(qaProfileSchema.safeParse([]).success).toBe(false)
      expect(qaCategoriesSchema.safeParse([]).success).toBe(false)
    })
  })
})