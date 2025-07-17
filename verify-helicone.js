#!/usr/bin/env node

/**
 * Verificación final de Helicone
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Verificación final de Helicone...\n');

// Verificar configuración
const config = {
  apiKey: process.env.HELICONE_API_KEY,
  enabled: process.env.HELICONE_ENABLED === 'true',
  tag: process.env.HELICONE_PROPERTY_TAG,
  provider: process.env.PRIMARY_PROVIDER
};

console.log('📋 Configuración verificada:');
console.log(`   • API Key: ${config.apiKey ? '✅ Configurada' : '❌ No configurada'}`);
console.log(`   • Habilitado: ${config.enabled ? '✅ Sí' : '❌ No'}`);
console.log(`   • Tag: ${config.tag || 'No configurado'}`);
console.log(`   • Provider primario: ${config.provider || 'No configurado'}`);

const isWorking = config.apiKey && config.enabled;
console.log(`\n🎯 Estado final: ${isWorking ? '✅ Helicone está funcionando' : '❌ Helicone no está funcionando'}`);

if (isWorking) {
  console.log('\n📊 Para verificar que las requests aparecen en Helicone:');
  console.log('   1. Visita: https://helicone.ai/dashboard');
  console.log('   2. Haz algunas requests a tu API');
  console.log('   3. Busca requests con:');
  console.log(`      • Tag: ${config.tag}`);
  console.log(`      • Provider: ${config.provider}`);
  console.log(`      • Environment: ${process.env.NODE_ENV || 'development'}`);
  
  console.log('\n🔗 URLs útiles:');
  console.log('   • Dashboard: https://helicone.ai/dashboard');
  console.log('   • Requests: https://helicone.ai/requests');
  console.log('   • Analytics: https://helicone.ai/analytics');
  
  console.log('\n🚀 Próximos pasos:');
  console.log('   1. Haz requests a tu API');
  console.log('   2. Verifica que aparezcan en el dashboard');
  console.log('   3. Configura alertas si es necesario');
  console.log('   4. Revisa métricas de costo y rendimiento');
  
} else {
  console.log('\n❌ Problemas encontrados:');
  if (!config.apiKey) {
    console.log('   • API Key no configurada');
  }
  if (!config.enabled) {
    console.log('   • Helicone no está habilitado');
  }
  
  console.log('\n🔧 Para arreglar:');
  console.log('   1. Ejecuta: node scripts/setup-helicone.js');
  console.log('   2. O configura manualmente en .env');
  console.log('   3. Reinicia el servidor');
}

console.log('\n✨ ¡Configuración de Helicone completada!');
