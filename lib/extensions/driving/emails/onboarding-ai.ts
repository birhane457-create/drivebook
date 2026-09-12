/**
 * Email 5 — AI receptionist (Day 7)
 * Goal: Show the value of the AI voice line feature. 
 * Only sent when instructor has voiceLineStatus !== 'NONE'.
 */
export function buildOnboardingAI(data: {
  instructorName: string
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, baseUrl, supportEmail } = data

  const subject = "Never miss a student enquiry while you&#8217;re teaching"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your AI receptionist on DriveBook</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Your AI receptionist</h1>
      <p style="margin:10px 0 0;opacity:0.9;font-size:14px;">Answers enquiries when you can&#8217;t</p>
    </td>
  </tr>

  <tr>
    <td style="background:#f9fafb;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">Hi ${instructorName},</p>

      <p style="margin:0 0 20px;font-size:14px;color:#374151;">
        When you&#8217;re in the middle of a lesson, you can&#8217;t take calls.
        But potential students don&#8217;t know that &#8212; they just know no one answered.
      </p>

      <p style="margin:0 0 24px;font-size:14px;color:#374151;">
        Your DriveBook AI receptionist handles calls on your behalf, so you never lose a
        student simply because you were busy teaching.
      </p>

      <!-- What the AI does -->
      <div style="background:white;border-radius:8px;border:1px solid #e5e7eb;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">
          When you are unavailable, your AI can:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:14px;">
            <span style="color:#7c3aed;font-weight:700;margin-right:8px;">&#9679;</span>
            Answer common questions about your rates, availability, and location
          </td></tr>
          <tr><td style="padding:6px 0;font-size:14px;">
            <span style="color:#7c3aed;font-weight:700;margin-right:8px;">&#9679;</span>
            Collect the student&#8217;s name and contact details
          </td></tr>
          <tr><td style="padding:6px 0;font-size:14px;">
            <span style="color:#7c3aed;font-weight:700;margin-right:8px;">&#9679;</span>
            Help students start the booking process
          </td></tr>
          <tr><td style="padding:6px 0;font-size:14px;">
            <span style="color:#7c3aed;font-weight:700;margin-right:8px;">&#9679;</span>
            Notify you of the enquiry so you can follow up when free
          </td></tr>
        </table>
      </div>

      <!-- How it works -->
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#6d28d9;">How it works</p>
        <p style="margin:0;font-size:13px;color:#5b21b6;">
          Your DriveBook voice line is a dedicated phone number assigned to your account.
          Share it with students or add it to your profile. Calls are handled by the AI,
          recorded with the student&#8217;s consent, and summarised for you in your dashboard.
        </p>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${baseUrl}/dashboard/settings"
          style="display:inline-block;background:#7c3aed;color:white;padding:13px 28px;
            border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          Set up my AI receptionist &#8594;
        </a>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
        Questions? Reply to this email or contact us at
        <a href="mailto:${supportEmail}" style="color:#7c3aed;">${supportEmail}</a>
      </p>

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
