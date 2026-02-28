import { NextResponse } from 'next/server'
import { emailService } from '@/lib/services/email'

export async function GET() {
  try {
    const result = await emailService.sendTestEmail()
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test email sent successfully! Check your inbox.' 
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: String(error)
    }, { status: 500 })
  }
}
