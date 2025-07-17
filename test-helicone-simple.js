#!/usr/bin/env node

/**
 * Test simple para verificar configuración de Helicone
 */

console.log('🔍 Verificando configuración de Helicone...\n');

// Verificar variables de entorno
console.log('📋 Variables de entorno:');
console.log(`   • HELICONE_API_KEY: ${process.env.HELICONE_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
console.log(`   • HELICONE_ENABLED: ${process.env.HELICONE_ENABLED || 'No configurada'}`);
console.log(`   • HELICONE_PROPERTY_TAG: ${process.env.HELICONE_PROPERTY_TAG || 'No configurada'}`);
console.log(`   • PRIMARY_PROVIDER: ${process.env.PRIMARY_PROVIDER || 'No configurada'}`);

// Verificar si Helicone está habilitado
const heliconeEnabled = process.env.HELICONE_ENABLED === 'true';
const hasApiKey = !!process.env.HELICONE_API_KEY;

console.log(`\n🔧 Estado de Helicone:`);
console.log(`   • Habilitado: ${heliconeEnabled ? '✅ Sí' : '❌ No'}`);
console.log(`   • API Key presente: ${hasApiKey ? '✅ Sí' : '❌ No'}`);
console.log(`   • Funcionando: ${heliconeEnabled && hasApiKey ? '✅ Debería funcionar' : '❌ No funcionará'}`);

if (!heliconeEnabled) {
  console.log('\n⚠️  Helicone está deshabilitado. Para habilitarlo:');
  console.log('   1. Asegúrate de que HELICONE_ENABLED=true en .env');
  console.log('   2. Reinicia el servidor');
}

if (!hasApiKey) {
  console.log('\n⚠️  API Key de Helicone no configurada. Para configurarla:');
  console.log('   1. Obtén tu API key de https://helicone.ai');
  console.log('   2. Agrégala a .env como HELICONE_API_KEY=tu_key_aqui');
  console.log('   3. Reinicia el servidor');
}

if (heliconeEnabled && hasApiKey) {
  console.log('\n✅ Helicone está configurado correctamente');
  console.log('📊 Para verificar que funciona:');
  console.log('   1. Haz requests a tu API');
  console.log('   2. Revisa los logs del servidor para mensajes [Helicone]');
  console.log('   3. Visita https://helicone.ai/dashboard');
  console.log('   4. Verifica que aparezcan las requests');
}

console.log('\n🔗 Enlaces útiles:');
console.log('   • Dashboard: https://helicone.ai/dashboard');
console.log('   • Documentación: https://docs.helicone.ai');
console.log('   • Setup script: node scripts/setup-helicone.js');
