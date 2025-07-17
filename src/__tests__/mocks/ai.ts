/**
 * Mock for the AI SDK
 */

import { vi } from 'vitest';

// Create a mock tool function
export const tool = vi.fn().mockImplementation((config) => {
  return {
    ...config,
    _isTool: true
  };
});

// Mock generateObject function
export const generateObject = vi.fn();

// Mock generateText function
export const generateText = vi.fn();

// Mock streamText function
export const streamText = vi.fn();

// Export the mocked module
export default {
  tool,
  generateObject,
  generateText,
  streamText
};