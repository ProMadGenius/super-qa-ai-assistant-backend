# Helicone Integration Guide

## 🚀 Overview

Helicone is integrated into the Super QA AI Backend to provide comprehensive AI monitoring, analytics, and cost tracking. This guide covers setup, configuration, and usage.

## 📋 Features

- **Request Monitoring**: Track all AI API calls in real-time
- **Cost Analytics**: Monitor spending across OpenAI and Anthropic
- **Performance Metrics**: Response times, success rates, and error tracking
- **Rate Limiting**: Control API usage with custom policies
- **Custom Properties**: Tag requests for better organization
- **Provider Failover Tracking**: Monitor failover events and provider health

## 🛠️ Setup Instructions

### 1. Create Helicone Account

1. Visit [https://helicone.ai](https://helicone.ai)
2. Sign up for a free account
3. Generate an API key from your dashboard

### 2. Automated Setup

Run the setup script:

```bash
node scripts/setup-helicone.js
```

### 3. Manual Configuration

Add these variables to your `.env` file:

```env
# Helicone Configuration (AI Monitoring & Analytics)
HELICONE_API_KEY=your_api_key_here
HELICONE_ENABLED=true
HELICONE_RATE_LIMIT_POLICY=          # Optional: rate limiting policy name
HELICONE_USER_ID=                    # Optional: user ID for tracking
HELICONE_PROPERTY_TAG=super-qa-ai    # Optional: tag for organizing requests
```

## 🔧 Configuration Options

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `HELICONE_API_KEY` | Your Helicone API key | Yes | - |
| `HELICONE_ENABLED` | Enable/disable monitoring | No | `false` |
| `HELICONE_RATE_LIMIT_POLICY` | Rate limiting policy name | No | - |
| `HELICONE_USER_ID` | User ID for request tracking | No | - |
| `HELICONE_PROPERTY_TAG` | Tag for organizing requests | No | `super-qa-ai` |

## 📊 Monitoring Features

### Request Tracking

All AI requests are automatically tracked with:

- **Provider**: OpenAI or Anthropic
- **Model**: Specific model used (e.g., gpt-4o-mini, claude-3-5-haiku)
- **Environment**: development, staging, or production
- **Endpoint**: API endpoint that made the request
- **Request ID**: Unique identifier for debugging
- **Timestamp**: When the request was made

### Custom Events

The system logs custom events for:

- **Provider Selection**: When a provider is chosen
- **Failover Events**: When failover occurs between providers
- **Success/Error Events**: Request outcomes
- **Circuit Breaker Events**: When circuit breakers open/close

### Properties and Tags

Each request includes custom properties:

```javascript
{
  tag: 'super-qa-ai',
  environment: 'development',
  model: 'gpt-4o-mini',
  provider: 'openai',
  endpoint: '/api/analyze-ticket',
  requestId: 'uuid-here',
  failover_disabled: true,
  primary_provider: 'openai'
}
```

## 🔍 Usage Examples

### Checking Helicone Status

```typescript
import { isHeliconeEnabled } from '@/lib/ai/heliconeMiddleware'

if (isHeliconeEnabled()) {
  console.log('Helicone monitoring is active')
}
```

### Logging Custom Events

```typescript
import { logHeliconeEvent } from '@/lib/ai/heliconeMiddleware'

await logHeliconeEvent('custom_event', {
  feature: 'ticket_analysis',
  user_id: 'user123',
  success: true
})
```

### Creating Helicone Headers

```typescript
import { createHeliconeHeaders } from '@/lib/ai/heliconeMiddleware'

const headers = createHeliconeHeaders('openai', 'gpt-4o-mini', 'request-123', {
  endpoint: '/api/analyze-ticket'
})
```

## 📈 Dashboard and Analytics

### Accessing Your Dashboard

1. Visit [https://helicone.ai/dashboard](https://helicone.ai/dashboard)
2. Log in with your account
3. View real-time metrics and analytics

### Key Metrics to Monitor

- **Request Volume**: Total API calls per day/hour
- **Cost Analysis**: Spending by provider and model
- **Response Times**: Average latency and performance
- **Error Rates**: Success vs failure rates
- **Provider Distribution**: Usage across OpenAI and Anthropic
- **Failover Events**: When and why failovers occur

### Filtering and Analysis

Use Helicone's filtering capabilities to analyze:

- Requests by environment (dev/staging/prod)
- Performance by model type
- Cost breakdown by feature/endpoint
- Error patterns and troubleshooting

## 🚨 Troubleshooting

### Common Issues

1. **Helicone Not Tracking Requests**
   - Check `HELICONE_ENABLED=true` in .env
   - Verify API key is correct
   - Ensure application restarted after configuration

2. **Missing Custom Properties**
   - Verify `HELICONE_PROPERTY_TAG` is set
   - Check that middleware is properly imported

3. **Rate Limiting Issues**
   - Review rate limit policy configuration
   - Check Helicone dashboard for policy status

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
```

This will show Helicone events in console output.

## 🔒 Security Considerations

- **API Key Protection**: Never commit API keys to version control
- **Environment Separation**: Use different API keys for dev/staging/prod
- **Rate Limiting**: Configure appropriate rate limits for your usage
- **Data Privacy**: Review Helicone's data handling policies

## 📚 Additional Resources

- [Helicone Documentation](https://docs.helicone.ai)
- [Helicone Dashboard](https://helicone.ai/dashboard)
- [API Reference](https://docs.helicone.ai/api-reference)
- [Rate Limiting Guide](https://docs.helicone.ai/features/rate-limiting)

## 🔄 Integration Status

Current integration includes:

- ✅ Environment variable configuration
- ✅ Middleware for request tracking
- ✅ Custom event logging
- ✅ Provider failover monitoring
- ✅ Error tracking and analytics
- ✅ Setup script for easy configuration
- ✅ Dashboard access and monitoring

## 🚀 Next Steps

1. Set up your Helicone account and API key
2. Run the setup script or configure manually
3. Restart your application
4. Monitor your dashboard for incoming data
5. Set up alerts and rate limiting policies as needed

For questions or issues, refer to the [Helicone documentation](https://docs.helicone.ai) or contact support.
