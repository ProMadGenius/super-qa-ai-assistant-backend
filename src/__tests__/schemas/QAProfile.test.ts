/**
 * Comprehensive tests for QAProfile schema
 */

import { describe, test, expect } from 'vitest';
import { 
  qaProfileSchema,
  qaCategoriesSchema,
  testCaseFormatSchema,
  defaultQAProfile
} from '../../lib/schemas/QAProfile';

describe('QAProfile Schema', () => {
  test('should validate a complete valid QAProfile', () => {
    const validProfile = {
      qaCategories: {
        functional: true,
        ui: true,
        ux: false,
        api: true,
        security: true,
        performance: false,
        accessibility: false,
        mobile: false,
        negative: true,
        database: false
      },
      testCaseFormat: 'gherkin',
      autoRefresh: true,
      includeComments: true,
      includeImages: false,
      operationMode: 'online',
      showNotifications: true
    };

    const result = qaProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validProfile);
    }
  });

  test('should validate QACategories schema', () => {
    const validCategories = {
      functional: true,
      ui: true,
      ux: false,
      api: true,
      security: true,
      performance: false,
      accessibility: false,
      mobile: false,
      negative: true,
      database: false
    };

    const result = qaCategoriesSchema.safeParse(validCategories);
    expect(result.success).toBe(true);

    // Test invalid categories
    const invalidCategories = {
      functional: 'yes', // Should be boolean
      ui: true,
      // Missing other required categories
    };

    const invalidResult = qaCategoriesSchema.safeParse(invalidCategories);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
      
      // Check specific validation errors
      const functionalIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('functional'));
      // There will be missing required field errors
      const hasRequiredErrors = invalidResult.error.issues.some(issue => 
        issue.code === 'invalid_type');
      
      expect(functionalIssue).toBeDefined();
      expect(hasRequiredErrors).toBe(true);
    }
  });

  test('should validate testCaseFormat schema', () => {
    // Test valid formats
    const validFormats = ['gherkin', 'steps', 'table'];
    
    validFormats.forEach(format => {
      const result = testCaseFormatSchema.safeParse(format);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(format);
      }
    });

    // Test invalid format
    const invalidFormat = 'invalid-format';
    const invalidResult = testCaseFormatSchema.safeParse(invalidFormat);
    expect(invalidResult.success).toBe(false);
  });

  test('should provide default QA profile', () => {
    expect(defaultQAProfile).toBeDefined();
    expect(defaultQAProfile.qaCategories).toBeDefined();
    expect(defaultQAProfile.qaCategories.functional).toBe(true);
    expect(defaultQAProfile.testCaseFormat).toBe('steps');
    
    // Validate default profile against schema
    const result = qaProfileSchema.safeParse(defaultQAProfile);
    expect(result.success).toBe(true);
  });

  test('should validate QAProfile with all required fields', () => {
    const completeProfile = {
      qaCategories: {
        functional: true,
        ui: false,
        ux: false,
        api: false,
        security: false,
        performance: false,
        accessibility: false,
        mobile: false,
        negative: false,
        database: false
      },
      testCaseFormat: 'steps' as const,
      autoRefresh: true,
      includeComments: true,
      includeImages: true,
      operationMode: 'offline' as const,
      showNotifications: true
    };

    const result = qaProfileSchema.safeParse(completeProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qaCategories).toEqual(completeProfile.qaCategories);
      expect(result.data.testCaseFormat).toBe('steps');
      expect(result.data.operationMode).toBe('offline');
    }
  });

  test('should reject invalid QAProfile', () => {
    const invalidProfile = {
      // Missing qaCategories
      testCaseFormat: 'invalid-format', // Invalid enum value
      autoRefresh: 'yes', // Should be boolean
      operationMode: 'invalid-mode' // Invalid enum value
    };

    const invalidResult = qaProfileSchema.safeParse(invalidProfile);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
      
      // Just check that we have validation errors - the specific fields may vary
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
    }
  });

  test('should validate all operation modes', () => {
    const validModes = ['online', 'offline'];
    
    validModes.forEach(mode => {
      const profile = {
        ...defaultQAProfile,
        operationMode: mode
      };
      
      const result = qaProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.operationMode).toBe(mode);
      }
    });
  });

  test('should handle boolean flags correctly', () => {
    const booleanFlags = ['autoRefresh', 'includeComments', 'includeImages', 'showNotifications'];
    
    // Test true values
    const trueProfile = {
      ...defaultQAProfile,
      autoRefresh: true,
      includeComments: true,
      includeImages: true,
      showNotifications: true
    };
    
    const trueResult = qaProfileSchema.safeParse(trueProfile);
    expect(trueResult.success).toBe(true);
    
    // Test false values
    const falseProfile = {
      ...defaultQAProfile,
      autoRefresh: false,
      includeComments: false,
      includeImages: false,
      showNotifications: false
    };
    
    const falseResult = qaProfileSchema.safeParse(falseProfile);
    expect(falseResult.success).toBe(true);
    
    // Test invalid values
    booleanFlags.forEach(flag => {
      const invalidProfile = {
        ...defaultQAProfile,
        [flag]: 'not-a-boolean'
      };
      
      const invalidResult = qaProfileSchema.safeParse(invalidProfile);
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        const flagIssue = invalidResult.error.issues.find(issue => 
          issue.path.includes(flag));
        expect(flagIssue).toBeDefined();
      }
    });
  });
});