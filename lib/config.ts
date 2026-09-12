/**
 * Environment Configuration Validation
 * 
 * This module validates that all required environment variables are present
 * at application startup. Fails fast with descriptive errors if credentials
 * are missing.
 */

interface EnvironmentConfig {
  database: {
    url: string;
    directUrl: string;
  };
  supabase: {
    url: string;
    publishableKey: string;
  };
  auth: {
    url: string;
    secret: string;
  };
  google: {
    mapsApiKey: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  email: {
    host: string;
    port: string;
    user: string;
    pass: string;
    from: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  openai: {
    apiKey: string;
  };
  platform: {
    name: string;
    adminEmail: string;
  };
}

const REQUIRED_ENV_VARS = [
  // Database
  'DATABASE_URL',
  'DIRECT_URL',
  
  // Supabase (if using)
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  
  // NextAuth
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  
  // Google Services
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  
  // Email
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  
  // Twilio
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  
  // Stripe
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  
  // OpenAI
  'OPENAI_API_KEY',
] as const;

/**
 * Validates that all required environment variables are present.
 * Throws an error with a list of missing variables if any are not set.
 * 
 * @throws {Error} If one or more required environment variables are missing
 * @returns {EnvironmentConfig} Typed configuration object with all required values
 */
export function validateEnvironment(): EnvironmentConfig {
  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const errorMessage = [
      '❌ Missing required environment variables:',
      '',
      ...missing.map(name => `  - ${name}`),
      '',
      'Please check your .env file and ensure all required variables are set.',
      'See .env.example for the complete list of required variables.',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Return typed configuration object
  return {
    database: {
      url: process.env.DATABASE_URL!,
      directUrl: process.env.DIRECT_URL!,
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    },
    auth: {
      url: process.env.NEXTAUTH_URL!,
      secret: process.env.NEXTAUTH_SECRET!,
    },
    google: {
      mapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback',
    },
    email: {
      host: process.env.SMTP_HOST!,
      port: process.env.SMTP_PORT || '587',
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
      from: process.env.EMAIL_FROM || process.env.SMTP_USER!,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    },
    stripe: {
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
    platform: {
      name: process.env.PLATFORM_NAME || 'Driving Instructor Platform',
      adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
    },
  };
}

/**
 * Gets the validated environment configuration.
 * Call validateEnvironment() first during app initialization.
 */
export function getConfig(): EnvironmentConfig {
  return validateEnvironment();
}

// Validate environment on module load (server-side only)
if (typeof window === 'undefined') {
  try {
    validateEnvironment();
    console.log('✅ Environment validation passed');
  } catch (error) {
    console.error(error);
    // Allow the app to start but log the error
    // Actual validation will happen when routes try to use the config
  }
}
