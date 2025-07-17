import { NextRequest, NextResponse } from 'next/server';

// Import the reset function - we'll use dynamic import to handle TypeScript
export async function POST(request: NextRequest) {
  try {
    // Dynamic import to handle the TypeScript module
    const { resetAllCircuitBreakers, getProviderHealthStatus } = await import('@/lib/ai/providerFailover');
    
    console.log('🔄 Resetting all circuit breakers...');
    
    // Reset all circuit breakers
    resetAllCircuitBreakers();
    
    // Get updated status
    const status = getProviderHealthStatus();
    
    console.log('✅ All circuit breakers have been reset successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'All circuit breakers have been reset successfully',
      providerStatus: status
    });
  } catch (error) {
    console.error('❌ Error resetting circuit breakers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset circuit breakers',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getProviderHealthStatus } = await import('@/lib/ai/providerFailover');
    const status = getProviderHealthStatus();
    
    return NextResponse.json({
      success: true,
      providerStatus: status
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get provider status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
