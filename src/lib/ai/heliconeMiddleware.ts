/**
 * Helicone Middleware for AI Request Monitoring
 * 
 * This middleware intercepts AI requests and adds Helicone headers
 * for monitoring, analytics, and cost tracking.
 */

import { NextRequest } from 'next/server'

// Load environment variables
if (typeof window === 'undefined') {
  require('dotenv').config()
}

/**
 * Helicone configuration
 */
interface HeliconeConfig {
  apiKey: string
  enabled: boolean
  baseUrl: string
  rateLimitPolicy?: string
  userId?: string
  propertyTag: string
}

/**
 * Get Helicone configuration from environment variables
 */
function getHeliconeConfig(): HeliconeConfig {
  return {
    apiKey: process.env.HELICONE_API_KEY || '',
    enabled: process.env.HELICONE_ENABLED === 'true',
    baseUrl: 'https://gateway.helicone.ai',
    rateLimitPolicy: process.env.HELICONE_RATE_LIMIT_POLICY,
    userId: process.env.HELICONE_USER_ID,
    propertyTag: process.env.HELICONE_PROPERTY_TAG || 'super-qa-ai'
  }
}

/**
 * Create Helicone headers for AI requests
 */
export function createHeliconeHeaders(
  provider: 'openai' | 'anthropic',
  model: string,
  requestId?: string,
  additionalProperties?: Record<string, string>
): Record<string, string> {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    return {}
  }

  const headers: Record<string, string> = {
    'Helicone-Auth': `Bearer ${config.apiKey}`,
    'Helicone-Property-Tag': config.propertyTag,
    'Helicone-Property-Environment': process.env.NODE_ENV || 'development',
    'Helicone-Property-Model': model,
    'Helicone-Property-Provider': provider,
    'Helicone-Property-Application': 'super-qa-ai-backend'
  }

  // Add request ID if provided
  if (requestId) {
    headers['Helicone-Request-Id'] = requestId
  }

  // Add user ID if configured
  if (config.userId) {
    headers['Helicone-User-Id'] = config.userId
  }

  // Add rate limit policy if configured
  if (config.rateLimitPolicy) {
    headers['Helicone-RateLimit-Policy'] = config.rateLimitPolicy
  }

  // Add additional properties
  if (additionalProperties) {
    Object.entries(additionalProperties).forEach(([key, value]) => {
      headers[`Helicone-Property-${key}`] = value
    })
  }

  return headers
}

/**
 * Get the appropriate base URL for the provider with Helicone proxy
 */
export function getHeliconeProxyUrl(provider: 'openai' | 'anthropic'): string {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    // Return standard URLs if Helicone is disabled
    return provider === 'openai' 
      ? 'https://api.openai.com/v1'
      : 'https://api.anthropic.com'
  }

  // Return Helicone proxy URLs
  return provider === 'openai'
    ? 'https://oai.helicone.ai/v1'
    : 'https://anthropic.helicone.ai'
}

/**
 * Log custom event to Helicone
 */
export async function logHeliconeEvent(
  eventName: string,
  properties: Record<string, any> = {},
  requestId?: string
): Promise<void> {
  const config = getHeliconeConfig()
  
  if (!config.enabled || !config.apiKey) {
    return // Skip logging if Helicone is disabled
  }

  try {
    const eventData = {
      event: eventName,
      properties: {
        ...properties,
        tag: config.propertyTag,
        environment: process.env.NODE_ENV || 'development',
        application: 'super-qa-ai-backend',
        ...(requestId && { requestId })
      },
      timestamp: new Date().toISOString()
    }

    // Log to console for now (you can extend this to make actual API calls)
    console.log(`[Helicone Event] ${eventName}:`, eventData)
    
    // TODO: Implement actual Helicone event logging API call if needed
    // await fetch('https://api.helicone.ai/v1/events', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${config.apiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(eventData)
    // })

  } catch (error) {
    console.error('Failed to log Helicone event:', error)
  }
}

/**
 * Middleware to add Helicone tracking to API requests
 */
export function withHeliconeTracking(
  provider: 'openai' | 'anthropic',
  model: string,
  requestId: string,
  endpoint: string
) {
  return {
    headers: createHeliconeHeaders(provider, model, requestId, {
      endpoint,
      timestamp: new Date().toISOString()
    }),
    baseUrl: getHeliconeProxyUrl(provider),
    onSuccess: (response: any) => {
      logHeliconeEvent('ai_request_success', {
        provider,
        model,
        endpoint,
        responseTime: response.responseTime || 0
      }, requestId)
    },
    onError: (error: any) => {
      logHeliconeEvent('ai_request_error', {
        provider,
        model,
        endpoint,
        error: error.message || 'Unknown error'
      }, requestId)
    }
  }
}

/**
 * Check if Helicone is enabled and configured
 */
export function isHeliconeEnabled(): boolean {
  const config = getHeliconeConfig()
  return config.enabled && !!config.apiKey
}

/**
 * Get Helicone dashboard URL for monitoring
 */
export function getHeliconeMonitoringUrl(): string {
  return 'https://helicone.ai/dashboard'
}
