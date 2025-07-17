#!/usr/bin/env node

/**
 * Helicone Setup Script
 * 
 * This script helps configure Helicone for AI monitoring and analytics.
 * Run: node scripts/setup-helicone.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupHelicone() {
  console.log('🚀 Helicone Setup for Super QA AI Backend\n');
  
  console.log('Helicone provides AI monitoring, analytics, and cost tracking.');
  console.log('Visit https://helicone.ai to create an account and get your API key.\n');
  
  const apiKey = await question('Enter your Helicone API Key (or press Enter to skip): ');
  
  if (!apiKey.trim()) {
    console.log('⚠️  Skipping Helicone setup. You can configure it later in .env file.');
    rl.close();
    return;
  }
  
  const enabled = await question('Enable Helicone monitoring? (y/n): ');
  const userId = await question('Enter User ID for tracking (optional): ');
  const rateLimitPolicy = await question('Enter Rate Limit Policy name (optional): ');
  const propertyTag = await question('Enter Property Tag (default: super-qa-ai): ');
  
  // Read current .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update Helicone configuration
  const heliconeConfig = `
# Helicone Configuration (AI Monitoring & Analytics)
HELICONE_API_KEY=${apiKey}
HELICONE_ENABLED=${enabled.toLowerCase() === 'y' ? 'true' : 'false'}
HELICONE_RATE_LIMIT_POLICY=${rateLimitPolicy || ''}
HELICONE_USER_ID=${userId || ''}
HELICONE_PROPERTY_TAG=${propertyTag || 'super-qa-ai'}
`;
  
  // Replace existing Helicone config or add new one
  const heliconeRegex = /# Helicone Configuration[\s\S]*?(?=\n# [A-Z]|\n[A-Z]|$)/;
  
  if (heliconeRegex.test(envContent)) {
    envContent = envContent.replace(heliconeRegex, heliconeConfig.trim());
  } else {
    envContent += heliconeConfig;
  }
  
  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Helicone configuration updated in .env file!');
  console.log('\n📊 Helicone Features Enabled:');
  console.log('  • AI request monitoring and analytics');
  console.log('  • Cost tracking and optimization');
  console.log('  • Performance metrics and insights');
  console.log('  • Rate limiting and usage controls');
  
  console.log('\n🔗 Access your Helicone dashboard at: https://helicone.ai/dashboard');
  console.log('\n🚀 Restart your application to apply Helicone monitoring.');
  
  rl.close();
}

setupHelicone().catch(console.error);
