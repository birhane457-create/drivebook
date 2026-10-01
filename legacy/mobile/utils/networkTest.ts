import { API_URL } from '../constants/config';

export const testConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('[Network Test] Testing connection to:', API_URL);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return {
        success: true,
        message: 'Connection successful!',
        details: {
          status: response.status,
          url: API_URL,
        },
      };
    } else {
      return {
        success: false,
        message: `Server responded with status ${response.status}`,
        details: {
          status: response.status,
          url: API_URL,
        },
      };
    }
  } catch (error: any) {
    console.error('[Network Test] Error:', error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: 'Connection timeout - check if server is running and IP is correct',
        details: {
          error: 'Timeout after 5 seconds',
          url: API_URL,
        },
      };
    }
    
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      details: {
        error: error.message,
        url: API_URL,
        hint: 'Make sure:\n1. Server is running (npm run dev)\n2. Phone is connected to computer hotspot\n3. IP address is correct\n4. Firewall allows connections',
      },
    };
  }
};

export const getCurrentIP = (): string => {
  return API_URL.replace('http://', '').replace(':3000', '');
};

export const getConnectionInstructions = (): string => {
  return `
Current Configuration:
API URL: ${API_URL}

Troubleshooting Steps:
1. Make sure Next.js server is running:
   npm run dev

2. Check your computer's IP on phone hotspot:
   Windows: ipconfig (look for "Wireless LAN adapter")
   Mac/Linux: ifconfig (look for en0 or wlan0)

3. Update mobile/constants/config.ts if IP changed

4. Make sure phone is connected to computer's hotspot

5. Check Windows Firewall:
   - Allow Node.js through firewall
   - Allow port 3000

6. Try accessing in phone browser:
   ${API_URL}
   
If you see the Next.js page, the connection works!
`;
};
