/**
 * Environment Variable Validation
 * 
 * This file validates that all required environment variables are set
 * and provides helpful error messages if they're missing.
 */

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
  example?: string;
}

const envVars: EnvConfig[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'MongoDB connection string',
    example: 'mongodb+srv://user:pass@cluster.mongodb.net/dbname'
  },
  
  // Authentication
  {
    name: 'NEXTAUTH_URL',
    required: true,
    description: 'Base URL of your application',
    example: 'http://localhost:3000'
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    description: 'Secret for NextAuth.js (generate with: openssl rand -base64 32)',
    example: 'your-secret-key-here'
  },
  
  // Google Maps
  {
    name: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    required: true,
    description: 'Google Maps API key for location features',
    example: 'AIza...'
  },
  
  // Stripe Payment
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    required: true,
    description: 'Stripe publishable key',
    example: 'pk_test_...'
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe secret key',
    example: 'sk_test_...'
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook secret (required for production)',
    example: 'whsec_...'
  },
  
  // Email (SMTP)
  {
    name: 'SMTP_HOST',
    required: false,
    description: 'SMTP server host',
    example: 'smtp.gmail.com'
  },
  {
    name: 'SMTP_PORT',
    required: false,
    description: 'SMTP server port',
    example: '587'
  },
  {
    name: 'SMTP_USER',
    required: false,
    description: 'SMTP username/email',
    example: 'your-email@gmail.com'
  },
  {
    name: 'SMTP_PASS',
    required: false,
    description: 'SMTP password (use App Password for Gmail)',
    example: 'your-app-password'
  },
  {
    name: 'SMTP_FROM',
    required: false,
    description: 'From email address',
    example: 'noreply@yourdomain.com'
  },
  
  // Platform Settings
  {
    name: 'PLATFORM_NAME',
    required: false,
    description: 'Your platform name',
    example: 'DriveBook'
  },
  {
    name: 'ADMIN_EMAIL',
    required: false,
    description: 'Admin email for notifications',
    example: 'admin@yourdomain.com'
  },
  {
    name: 'PLATFORM_COMMISSION_RATE',
    required: false,
    description: 'Default commission rate (%)',
    example: '15'
  },
  
  // SMS (Optional)
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio Account SID for SMS',
    example: 'AC...'
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio Auth Token',
    example: 'your-auth-token'
  },
  {
    name: 'TWILIO_PHONE_NUMBER',
    required: false,
    description: 'Twilio phone number',
    example: '+1234567890'
  },
  
  // Google Calendar (Optional)
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    description: 'Google OAuth Client ID',
    example: 'your-client-id.apps.googleusercontent.com'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    description: 'Google OAuth Client Secret',
    example: 'your-client-secret'
  },
  {
    name: 'GOOGLE_REDIRECT_URI',
    required: false,
    description: 'Google OAuth redirect URI',
    example: 'http://localhost:3000/api/calendar/callback'
  }
];

export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  envVars.forEach(({ name, required, description, example }) => {
    const value = process.env[name];
    
    if (!value) {
      if (required) {
        errors.push(
          `❌ Missing required environment variable: ${name}\n` +
          `   Description: ${description}\n` +
          (example ? `   Example: ${example}\n` : '')
        );
      } else {
        warnings.push(
          `⚠️  Optional environment variable not set: ${name}\n` +
          `   Description: ${description}\n` +
          (example ? `   Example: ${example}\n` : '')
        );
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function printEnvStatus(): void {
  console.log('\n🔍 Checking Environment Variables...\n');
  
  const { valid, errors, warnings } = validateEnv();
  
  if (errors.length > 0) {
    console.log('❌ ERRORS - Required variables missing:\n');
    errors.forEach(error => console.log(error));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS - Optional variables not set:\n');
    warnings.forEach(warning => console.log(warning));
  }
  
  if (valid && warnings.length === 0) {
    console.log('✅ All environment variables are configured!\n');
  } else if (valid) {
    console.log('\n✅ All required environment variables are configured!');
    console.log('   (Optional variables can be configured later)\n');
  } else {
    console.log('\n❌ Please configure the missing required variables in your .env file\n');
    process.exit(1);
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  printEnvStatus();
}
