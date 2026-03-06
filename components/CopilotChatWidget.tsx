'use client';

import { useEffect } from 'react';

export default function CopilotChatWidget() {
  useEffect(() => {
    // Load Microsoft Copilot Studio Web Chat script
    const script = document.createElement('script');
    script.src = 'https://cdn.botframework.com/botframework-webchat/latest/webchat.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      // Initialize the chat widget
      // You'll need to replace these with your actual Copilot Studio credentials
      const directLineToken = process.env.NEXT_PUBLIC_COPILOT_DIRECT_LINE_TOKEN;
      
      if (!directLineToken) {
        console.warn('Copilot Direct Line token not configured');
        return;
      }

      // @ts-ignore
      window.WebChat.renderWebChat(
        {
          directLine: window.WebChat.createDirectLine({
            token: directLineToken
          }),
          styleOptions: {
            botAvatarInitials: 'DB',
            userAvatarInitials: 'You',
            bubbleBackground: '#7c3aed',
            bubbleFromUserBackground: '#e5e7eb',
            bubbleTextColor: 'white',
            bubbleFromUserTextColor: '#1f2937',
            sendBoxBackground: 'white',
            sendBoxTextColor: '#1f2937',
            hideUploadButton: true
          }
        },
        document.getElementById('webchat')
      );
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        id="webchat" 
        className="bg-white rounded-lg shadow-2xl border border-gray-200"
        style={{ 
          width: '350px', 
          height: '500px',
          maxHeight: 'calc(100vh - 100px)'
        }}
      />
    </div>
  );
}
