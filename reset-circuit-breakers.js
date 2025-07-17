// Script to reset all circuit breakers
const { resetAllCircuitBreakers } = require('./src/lib/ai/providerFailover.ts');

console.log('🔄 Resetting all circuit breakers...');

try {
  resetAllCircuitBreakers();
  console.log('✅ All circuit breakers have been reset successfully!');
} catch (error) {
  console.error('❌ Error resetting circuit breakers:', error);
}
