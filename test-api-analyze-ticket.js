#!/usr/bin/env node

/**
 * Script para probar el endpoint /api/analyze-ticket con datos reales
 */

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
      "mobile": true,
      "accessibility": true
    }
  },
  "ticketJson": {
    "issueKey": "TEST-123",
    "summary": "Fix login button not working on mobile devices",
    "description": "Users are reporting that the login button on mobile devices is not responding to touch events. This is affecting user authentication and preventing users from accessing their accounts. The issue appears to be related to CSS touch-action properties and JavaScript event handlers.",
    "status": "In Progress",
    "priority": "Priority: High",
    "issueType": "Bug",
    "assignee": "John Developer",
    "reporter": "Jane QA",
    "comments": [
      {
        "author": "Product Manager",
        "body": "This is a critical issue affecting mobile users. We need to fix this ASAP as it's blocking user logins.",
        "date": "January 15, 2024 at 10:30 AM",
        "images": [],
        "links": []
      },
      {
        "author": "UX Designer",
        "body": "I've noticed this issue on iOS Safari and Android Chrome. The button appears to be clickable but doesn't trigger the login process.",
        "date": "January 15, 2024 at 11:00 AM",
        "images": [],
        "links": []
      }
    ],
    "attachments": [
      {
        "data": "base64mockdata...",
        "mime": "image/png",
        "name": "mobile-login-screenshot.png",
        "size": 45678,
        "tooBig": false,
        "url": "blob:https://example.com/screenshot"
      }
    ],
    "components": ["Frontend", "Mobile", "Authentication"],
    "customFields": {
      "acceptance_criteria": "Login button should respond to touch events on all mobile devices",
      "story_points": "5",
      "severity": "High",
      "browser_affected": "iOS Safari, Android Chrome"
    },
    "processingComplete": true,
    "scrapedAt": "2024-01-15T13:00:00Z"
  }
};

const API_URL = 'http://localhost:3000/api/analyze-ticket';

async function testAnalyzeTicket() {
  console.log('🚀 Probando endpoint /api/analyze-ticket...\n');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Tiempo de respuesta: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error en la respuesta:');
      console.error(JSON.stringify(errorData, null, 2));
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ ¡Respuesta exitosa!\n');
    console.log('📋 Resumen del documento generado:');
    console.log(`   • Ticket ID: ${result.metadata.ticketId}`);
    console.log(`   • Modelo AI: ${result.metadata.aiModel}`);
    console.log(`   • Tiempo de generación: ${result.metadata.generationTime}ms`);
    console.log(`   • Conteo de palabras: ${result.metadata.wordCount}`);
    console.log(`   • Criterios de aceptación: ${result.acceptanceCriteria.length}`);
    console.log(`   • Casos de prueba: ${result.testCases.length}`);
    console.log(`   • Advertencias: ${result.configurationWarnings.length}\n`);
    
    console.log('🎯 Resumen del Ticket:');
    console.log(`   Problema: ${result.ticketSummary.problem}`);
    console.log(`   Solución: ${result.ticketSummary.solution}`);
    console.log(`   Contexto: ${result.ticketSummary.context}\n`);
    
    if (result.acceptanceCriteria.length > 0) {
      console.log('✅ Criterios de Aceptación:');
      result.acceptanceCriteria.forEach((criterion, index) => {
        console.log(`   ${index + 1}. ${criterion.title}`);
        console.log(`      ${criterion.description}`);
      });
      console.log('');
    }
    
    if (result.testCases.length > 0) {
      console.log('🧪 Casos de Prueba:');
      result.testCases.forEach((testCase, index) => {
        console.log(`   ${index + 1}. [${testCase.format.toUpperCase()}] ${testCase.testCase.scenario || testCase.testCase.title}`);
        if (testCase.format === 'gherkin') {
          console.log(`      Given: ${testCase.testCase.given.join(', ')}`);
          console.log(`      When: ${testCase.testCase.when.join(', ')}`);
          console.log(`      Then: ${testCase.testCase.then.join(', ')}`);
        }
      });
      console.log('');
    }
    
    if (result.configurationWarnings.length > 0) {
      console.log('⚠️  Advertencias de Configuración:');
      result.configurationWarnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning.title}`);
        console.log(`      ${warning.message}`);
      });
      console.log('');
    }
    
    console.log('💾 Documento completo guardado en: analyze-result.json');
    
    // Guardar el resultado completo en un archivo
    const fs = await import('fs');
    fs.writeFileSync('analyze-result.json', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error al probar el endpoint:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Asegúrate de que el servidor esté corriendo en http://localhost:3000');
      console.error('   Ejecuta: npm run dev');
    }
  }
}

// Ejecutar la prueba
testAnalyzeTicket();