/**
 * Voice Service Authentication Middleware
 * 
 * Authenticates requests from the drivebook-hybrid voice service
 * using API key authentication.
 */

import { NextRequest, NextResponse } from 'next/server';

const VOICE_SERVICE_API_KEY = process.env.VOICE_SERVICE_API_KEY || 'dev-voice-key-change-in-production';

export interface VoiceServiceRequest extends NextRequest {
  voiceService?: {
    authenticated: boolean;
    source: 'voice-service';
  };
}

export function authenticateVoiceService(req: NextRequest): { 
  authenticated: boolean; 
  error?: string;
  response?: NextResponse;
} {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return {
      authenticated: false,
      error: 'Missing API key',
      response: NextResponse.json(
        { error: 'Missing API key. Include X-API-Key header.' },
        { status: 401 }
      )
    };
  }

  if (apiKey !== VOICE_SERVICE_API_KEY) {
    return {
      authenticated: false,
      error: 'Invalid API key',
      response: NextResponse.json(
        { error: 'Invalid API key' },
        { status: 403 }
      )
    };
  }

  return { authenticated: true };
}

/**
 * Middleware wrapper for voice service endpoints
 */
export function withVoiceServiceAuth(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any) => {
    const auth = authenticateVoiceService(req);
    
    if (!auth.authenticated) {
      return auth.response!;
    }

    // Add voice service context to request
    (req as VoiceServiceRequest).voiceService = {
      authenticated: true,
      source: 'voice-service'
    };

    return handler(req, context);
  };
}
