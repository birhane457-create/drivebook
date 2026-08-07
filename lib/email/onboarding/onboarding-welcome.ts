/**
 * Email 1 — Welcome (immediate, sent at registration)
 * Goal: Explain the opportunity. Tone: partner, not customer.
 */
export function buildOnboardingWelcome(data: {
  instructorName: string
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, baseUrl, supportEmail } = data

  const subject = "Welcome to DriveBook &#8212; your independent driving business platform"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Welcome to DriveBook</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:700;">Welcome to DriveBook</h1>
      <p style="margin:10px 0 0;opacity:0.9;font-size:15px;">Your independent driving business platform</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#f9fafb;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">Hi ${instructorName},</p>

      <p style="margin:0 0 20px;">
        You have just joined a platform built specifically for independent driving instructors.
        DriveBook gives you the tools to run your own business &#8212; on your terms.
      </p>

      <!-- Value props -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tbody>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">Your pricing, your rules</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Set your own hourly rate. DriveBook never dictates what you charge.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">You choose your availability</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Open and close your calendar whenever you want. No minimum hours required.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">Students book directly with you</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                No middleman. Students find your profile, view your rates, and book instantly.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">Payments handled securely</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                DriveBook processes payments and pays you automatically. No chasing invoices.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;">
              <strong style="color:#2563eb;">Never miss an enquiry while teaching</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Your AI receptionist handles calls and enquiries when you are with a student.
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <p style="margin:0 0 8px;font-size:14px;color:#374151;">
        <strong>Your next step:</strong> complete your profile so we can review and approve your account.
        It takes about 5 minutes.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${baseUrl}/dashboard/profile"
          style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;
            border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          Complete my profile &#8594;
        </a>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
        Questions? Reply to this email or contact us at
        <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
      </p>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb;padding-top:20px;text-align:center;font-size:12px;color:#9ca3af;">
        <p style="margin:0;"><strong style="color:#6b7280;">DriveBook</strong> &#8212; Your Driving Instructor Platform</p>
        <p style="margin:6px 0 0;">You&#8217;re receiving this because you registered as an instructor on DriveBook.</p>
      </div>

    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, html }
}
