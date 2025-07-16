const fetch = require('node-fetch');

// URL del endpoint (ajusta según tu entorno)
const API_URL = 'http://localhost:3000/api/generate-suggestions';

// Payload válido basado en las pruebas
const validPayload = {
  currentDocument: {
    ticketSummary: {
      problem: 'El botón de inicio de sesión no funciona en dispositivos móviles',
      solution: 'Arreglar el controlador de clics del botón y mejorar el manejo de errores',
      context: 'Aplicación móvil con sistema de autenticación'
    },
    configurationWarnings: [
      {
        type: 'category_mismatch',
        title: 'Pruebas móviles recomendadas',
        message: 'Este ticket afecta la funcionalidad móvil',
        recommendation: 'Habilitar categoría de pruebas móviles',
        severity: 'medium'
      }
    ],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'El botón de inicio de sesión funciona en móviles',
        description: 'El usuario puede hacer clic con éxito en el botón de inicio de sesión en dispositivos móviles',
        priority: 'must',
        category: 'functional',
        testable: true
      },
      {
        id: 'ac-2',
        title: 'El manejo de errores funciona',
        description: 'El sistema muestra mensajes de error apropiados',
        priority: 'must',
        category: 'functional',
        testable: true
      }
    ],
    testCases: [
      {
        format: 'gherkin',
        id: 'tc-1',
        category: 'functional',
        priority: 'high',
        testCase: {
          scenario: 'El usuario inicia sesión con éxito en móvil',
          given: ['El usuario está en la página de inicio de sesión móvil'],
          when: ['El usuario toca el botón de inicio de sesión'],
          then: ['El usuario inicia sesión con éxito'],
          tags: ['@mobile', '@authentication']
        }
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      qaProfile: {
        testCaseFormat: 'gherkin',
        qaCategories: {
          functional: true,
          mobile: true,
          security: false
        }
      },
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  },
  maxSuggestions: 3,
  focusAreas: ['edge_case', 'ui_verification'],
  excludeTypes: ['performance_test'],
  requestId: 'req-' + Date.now()
};

async function testGenerateSuggestions() {
  try {
    console.log('Enviando solicitud al endpoint generate-suggestions...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validPayload),
    });

    if (response.ok) {
      console.log('Respuesta exitosa (código de estado:', response.status, ')');
      const data = await response.json();
      console.log('Respuesta:', JSON.stringify(data, null, 2));
    } else {
      console.error('Error en la solicitud:', response.status);
      const errorData = await response.json();
      console.error('Detalles del error:', JSON.stringify(errorData, null, 2));
    }
  } catch (error) {
    console.error('Error al realizar la solicitud:', error);
  }
}

testGenerateSuggestions();