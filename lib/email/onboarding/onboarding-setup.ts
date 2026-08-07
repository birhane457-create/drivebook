/**
 * Email 2 — Setup guide (Day 1)
 * Goal: Get them approved. Explains the 5 setup steps clearly.
 * Note: This is the generic version. For a personalised checklist with live step state,
 * use sendInstructorSetupEmail() which reads the instructor's actual DB state.
 */
export function buildOnboardingSetup(data: {
  instructorName: string
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, baseUrl, supportEmail } = data

  const subject = "Get your DriveBook profile ready in 5 minutes"

  const step = (num: number, label: string, desc: string) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:28px;height:28px;background:#eff6ff;color:#2563eb;border-radius:50%;
            text-align:center;line-height:28px;font-weight:700;font-size:13px;vertical-align:top;">
            ${num}
          </td>
          <td style="padding-left:12px;vertical-align:top;">
            <strong style="font-size:14px;">${label}</strong>
            <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">${desc}</p>
          </td>
        </tr></table>
      </td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Get your DriveBook profile ready</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">5 steps to get approved</h1>
      <p style="margin:10px 0 0;opacity:0.9;font-size:14px;">Complete these to start receiving bookings</p>
    </td>
  </tr>

  <tr>
    <td style="background:#f9fafb;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">Hi ${instructorName},</p>

      <p style="margin:0 0 20px;font-size:14px;color:#374151;">
        Your account is currently under review. To speed up approval and start appearing to students,
        complete these 5 steps in your dashboard.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tbody>
          ${step(1, 'Upload your licence &amp; insurance', 'These are required for approval. JPG or PDF.')}
          ${step(2, 'Set your hourly rate &amp; service area', 'Tell students what you charge and where you teach.')}
          ${step(3, 'Configure your weekly availability', 'Open slots students can book. You can change these anytime.')}
          ${step(4, 'Complete your instructor bio', 'A short paragraph about your experience and teaching style.')}
          ${step(5, 'Connect Stripe to receive payments', 'Required to receive payouts from DriveBook.')}
        </tbody>
      </table>

      <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#1e40af;">
          <strong>Tip:</strong> Instructors who complete all steps are approved
          significantly faster than those who don&#8217;t.
        </p>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${baseUrl}/dashboard"
          style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;
            border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          Finish setup &#8594;
        </a>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
        Need help? Reply to this email or contact us at
        <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
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
