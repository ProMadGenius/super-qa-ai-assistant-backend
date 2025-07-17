import { openai, createOpenAI } from '@ai-sdk/openai'
import { anthropic, createAnthropic } from '@ai-sdk/anthropic'
import { LanguageModelV1 } from '@ai-sdk/provider'

// Load environment variables
if (typeof window === 'undefined') {
  require('dotenv').config()
}

/**
 * Helicone configuration interface
 */
interface HeliconeConfig {
  apiKey: string
  enabled: boolean
  rateLimitPolicy?: string
  userId?: string
  propertyTag?: string
}

/**
 * Get Helicone configuration from environment variables
 */
function getHeliconeConfig(): HeliconeConfig {
  return {
    apiKey: process.env.HELICONE_API_KEY || '',
    enabled: process.env.HELICONE_ENABLED === 'true',
    rateLimitPolicy: process.env.HELICONE_RATE_LIMIT_POLICY,
    userId: process.env.HELICONE_USER_ID,
    propertyTag: process.env.HELICONE_PROPERTY_TAG || 'super-qa-ai'
  }
}

/**
 * Get Helicone headers for requests
 */
function getHeliconeHeaders(provider: 'openai' | 'anthropic', model: string): Record<string, string> {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    return {}
  }

  const headers: Record<string, string> = {
    'Helicone-Auth': `Bearer ${config.apiKey}`,
    'Helicone-Property-Tag': config.propertyTag || 'super-qa-ai',
    'Helicone-Property-Environment': process.env.NODE_ENV || 'development',
    'Helicone-Property-Model': model,
    'Helicone-Property-Provider': provider
  }

  if (config.userId) {
    headers['Helicone-User-Id'] = config.userId
  }

  if (config.rateLimitPolicy) {
    headers['Helicone-RateLimit-Policy'] = config.rateLimitPolicy
  }

  return headers
}

/**
 * Create OpenAI client with Helicone monitoring
 */
export function createOpenAIWithHelicone(model: string): LanguageModelV1 {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    // Return standard OpenAI client if Helicone is disabled
    return openai(model)
  }

  // Create OpenAI client with Helicone proxy URL and headers
  console.log(`[Helicone] Monitoring enabled for OpenAI model: ${model}`)
  console.log('[Helicone] OpenAI Config:', JSON.stringify(config, null, 2));

  const headers = {
    'Helicone-Auth': `Bearer ${config.apiKey}`,
    'Helicone-Property-Tag': config.propertyTag || 'super-qa-ai',
    'Helicone-Property-Environment': process.env.NODE_ENV || 'development',
    'Helicone-Property-Model': model,
    'Helicone-Property-Provider': 'openai',
    'Helicone-Property-Application': 'super-qa-ai-backend',
    ...(config.userId && { 'Helicone-User-Id': config.userId }),
    ...(config.rateLimitPolicy && { 'Helicone-RateLimit-Policy': config.rateLimitPolicy })
  };

  console.log('[Helicone] OpenAI Headers:', JSON.stringify(headers, null, 2));
  console.log('[Helicone] OpenAI Base URL:', 'https://oai.helicone.ai/v1');
  
  try {
    // Create custom OpenAI client with Helicone proxy
    const heliconeOpenAI = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://oai.helicone.ai/v1',
      headers
    })
    
    return heliconeOpenAI(model)
  } catch (error) {
    console.warn('[Helicone] Failed to create Helicone-enabled OpenAI client, falling back to standard client:', error)
    return openai(model)
  }
}

/**
 * Create Anthropic client with Helicone monitoring
 */
export function createAnthropicWithHelicone(model: string): LanguageModelV1 {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    // Return standard Anthropic client if Helicone is disabled
    return anthropic(model)
  }

  // Create Anthropic client with Helicone proxy URL and headers
  console.log(`[Helicone] Monitoring enabled for Anthropic model: ${model}`)
  console.log('[Helicone] Anthropic Config:', JSON.stringify(config, null, 2));

  const headers = {
    'Helicone-Auth': `Bearer ${config.apiKey}`,
    'Helicone-Property-Tag': config.propertyTag || 'super-qa-ai',
    'Helicone-Property-Environment': process.env.NODE_ENV || 'development',
    'Helicone-Property-Model': model,
    'Helicone-Property-Provider': 'anthropic',
    'Helicone-Property-Application': 'super-qa-ai-backend',
    ...(config.userId && { 'Helicone-User-Id': config.userId }),
    ...(config.rateLimitPolicy && { 'Helicone-RateLimit-Policy': config.rateLimitPolicy })
  };

  console.log('[Helicone] Anthropic Headers:', JSON.stringify(headers, null, 2));
  console.log('[Helicone] Anthropic Base URL:', 'https://anthropic.helicone.ai');
  
  try {
    // Create custom Anthropic client with Helicone proxy
    const heliconeAnthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://anthropic.helicone.ai',
      headers
    })
    
    return heliconeAnthropic(model)
  } catch (error) {
    console.warn('[Helicone] Failed to create Helicone-enabled Anthropic client, falling back to standard client:', error)
    return anthropic(model)
  }
}

/**
 * Create AI model with Helicone monitoring based on provider
 */
export function createModelWithHelicone(provider: 'openai' | 'anthropic', model: string): LanguageModelV1 {
  switch (provider) {
    case 'openai':
      return createOpenAIWithHelicone(model)
    case 'anthropic':
      return createAnthropicWithHelicone(model)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

/**
 * Log custom event to Helicone
 */
export async function logHeliconeEvent(eventName: string, properties: Record<string, any> = {}) {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    return // Skip logging if Helicone is disabled
  }

  try {
    // You can add custom event logging here if needed
    console.log(`[Helicone Event] ${eventName}:`, properties)
  } catch (error) {
    console.error('Failed to log Helicone event:', error)
  }
}
