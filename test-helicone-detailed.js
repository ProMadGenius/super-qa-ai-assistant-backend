#!/usr/bin/env node

/**
 * Test detallado para verificar si Helicone está funcionando
 */

// Cargar variables de entorno
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Test detallado de Helicone...\n');

// Verificar configuración
console.log('📋 Configuración actual:');
console.log(`   • HELICONE_API_KEY: ${process.env.HELICONE_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
console.log(`   • HELICONE_ENABLED: ${process.env.HELICONE_ENABLED}`);
console.log(`   • HELICONE_PROPERTY_TAG: ${process.env.HELICONE_PROPERTY_TAG}`);
console.log(`   • PRIMARY_PROVIDER: ${process.env.PRIMARY_PROVIDER}`);
console.log(`   • OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);

const testData = {
  "qaProfile": {
    "autoRefresh": true,
    "includeComments": true,
    "includeImages": true,
    "operationMode": "offline",
    "showNotifications": true,
    "testCaseFormat": "gherkin",
    "qaCategories": {
      "functional": true,
      "ux": true,
      "ui": true,
      "negative": true,
      "api": false,
      "database": false,
      "performance": false,
      "security": false,
      "mobile": false,
      "accessibility": false
    }
  },
  "ticketJson": {
    "issueKey": "TEST-HELICONE",
    "summary": "Test Helicone Integration",
    "description": "Testing if Helicone is capturing AI requests correctly",
    "issueType": "Bug",
    "reporter": "Test User",
    "priority": "High",
    "status": "Open",
    "assignee": "QA Team",
    "components": ["AI Integration"],
    "customFields": {
      "Labels": ["test", "helicone"],
      "Affected Versions": ["v1.0.0"],
      "Environment": "Development",
      "Reproduction Steps": "Test Helicone integration",
      "Expected Behavior": "Helicone should capture AI requests",
      "Actual Behavior": "Testing in progress"
    },
    "scrapedAt": "2024-07-20T10:00:00.000Z"
  }
};

async function testHeliconeIntegration() {
  console.log('\n🚀 Enviando request a /api/analyze-ticket...');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3001/api/analyze-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Tiempo de respuesta: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ ¡Request exitosa!');
      console.log(`   • Modelo AI usado: ${result.metadata?.aiModel || 'No especificado'}`);
      console.log(`   • Tiempo de generación: ${result.metadata?.processingTime || 'No especificado'}ms`);
      
      console.log('\n📊 Verificación de Helicone:');
      console.log('   1. Revisa los logs del servidor para mensajes [Helicone]');
      console.log('   2. Visita https://helicone.ai/dashboard');
      console.log('   3. Busca requests recientes con:');
      console.log(`      • Tag: ${process.env.HELICONE_PROPERTY_TAG}`);
      console.log(`      • Provider: ${process.env.PRIMARY_PROVIDER}`);
      console.log(`      • Timestamp: ${new Date().toISOString()}`);
      
    } else {
      console.log('❌ Error en la request');
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error al hacer la request:');
    console.error(error.message);
  }
}

// Ejecutar test
testHeliconeIntegration();
