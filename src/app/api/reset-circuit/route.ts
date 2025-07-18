import { NextRequest, NextResponse } from 'next/server';

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

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
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    console.error('❌ Error resetting circuit breakers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset circuit breakers',
        details: error instanceof Error ? error.message : String(error)
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
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
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get provider status',
        details: error instanceof Error ? error.message : String(error)
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}
