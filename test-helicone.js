#!/usr/bin/env node

/**
 * Script para probar específicamente la integración de Helicone
 */

// Simular variables de entorno
process.env.HELICONE_API_KEY = 'pk-helicone-holfjgi-dgkenja-xcm2ogi-wrwrysi';
process.env.HELICONE_ENABLED = 'true';
process.env.HELICONE_PROPERTY_TAG = 'super-qa-ai';
process.env.PRIMARY_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = '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';

async function testHeliconeIntegration() {
  console.log('🔍 Probando integración de Helicone...\n');
  
  try {
    // Importar las funciones de Helicone (usando require para TypeScript)
    const { isHeliconeEnabled } = require('./src/lib/ai/heliconeMiddleware.ts');
    const { createModelWithHelicone } = require('./src/lib/ai/heliconeWrapper.ts');
    
    console.log('✅ Módulos de Helicone importados correctamente');
    
    // Verificar configuración
    console.log('📋 Configuración de Helicone:');
    console.log(`   • API Key: ${process.env.HELICONE_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   • Enabled: ${process.env.HELICONE_ENABLED}`);
    console.log(`   • Property Tag: ${process.env.HELICONE_PROPERTY_TAG}`);
    console.log(`   • Primary Provider: ${process.env.PRIMARY_PROVIDER}`);
    
    // Verificar si Helicone está habilitado
    const enabled = isHeliconeEnabled();
    console.log(`\n🔧 Helicone habilitado: ${enabled ? '✅ Sí' : '❌ No'}`);
    
    if (!enabled) {
      console.log('❌ Helicone no está habilitado. Verifica la configuración.');
      return;
    }
    
    // Probar creación de modelo con Helicone
    console.log('\n🚀 Probando creación de modelo con Helicone...');
    
    const model = createModelWithHelicone('openai', 'gpt-4o-mini');
    console.log('✅ Modelo creado con Helicone');
    
    // Verificar que el modelo tenga las propiedades esperadas
    console.log(`   • Tipo de modelo: ${typeof model}`);
    console.log(`   • Propiedades del modelo: ${Object.keys(model).slice(0, 5).join(', ')}...`);
    
    console.log('\n🎯 Resultado: La integración de Helicone parece estar funcionando correctamente');
    console.log('📊 Para verificar que las requests aparecen en el dashboard:');
    console.log('   1. Visita: https://helicone.ai/dashboard');
    console.log('   2. Haz algunas requests a la API');
    console.log('   3. Verifica que aparezcan en el dashboard');
    
  } catch (error) {
    console.error('❌ Error al probar la integración de Helicone:');
    console.error(error.message);
    console.error('\n🔧 Posibles soluciones:');
    console.error('   1. Verifica que las dependencias estén instaladas');
    console.error('   2. Revisa la configuración en .env');
    console.error('   3. Asegúrate de que el servidor esté corriendo');
  }
}

testHeliconeIntegration();
