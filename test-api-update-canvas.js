// Using ES modules syntax for better compatibility
import fetch from 'node-fetch';

// URL of the endpoint (adjust according to your environment)
const API_URL = 'http://localhost:3000/api/update-canvas';

// Valid payload based on tests
const validPayload = {
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Necesito agregar más casos de prueba para escenarios de error en el proceso de inicio de sesión.',
      createdAt: new Date().toISOString()
    }
  ],
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
  }
};

async function testUpdateCanvas() {
  try {
    console.log('Sending request to update-canvas endpoint...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validPayload),
    });

    if (response.ok) {
      console.log('Successful response (status code:', response.status, ')');
      
      // If it's a streaming response, process the stream
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        console.log('Receiving streaming response:');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          console.log(chunk);
        }
      } else {
        // If not streaming, show the complete response
        const data = await response.text();
        console.log('Response:', data);
      }
    } else {
      console.error('Request error:', response.status);
      const errorData = await response.json();
      console.error('Error details:', JSON.stringify(errorData, null, 2));
    }
  } catch (error) {
    console.error('Error making request:', error);
  }
}

testUpdateCanvas();