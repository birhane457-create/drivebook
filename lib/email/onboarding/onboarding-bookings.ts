/**
 * Email 3 — How bookings work (Day 3)
 * Goal: Remove uncertainty about what happens after approval.
 */
export function buildOnboardingBookings(data: {
  instructorName: string
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, baseUrl, supportEmail } = data

  const subject = "How students will find and book you on DriveBook"

  const flowStep = (label: string, desc: string, isLast = false) => `
    <tr>
      <td style="padding:0 0 ${isLast ? '0' : '16px'} 0;">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:32px;vertical-align:top;text-align:center;">
            <div style="width:10px;height:10px;border-radius:50%;background:#2563eb;margin:5px auto 0;"></div>
            ${!isLast ? `<div style="width:2px;height:100%;background:#bfdbfe;margin:0 auto;min-height:32px;"></div>` : ''}
          </td>
          <td style="padding-left:12px;vertical-align:top;">
            <strong style="font-size:14px;">${label}</strong>
            <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${desc}</p>
          </td>
        </tr></table>
      </td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>How students book you</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">How students find and book you</h1>
      <p style="margin:10px 0 0;opacity:0.9;font-size:14px;">From search to lesson &#8212; here&#8217;s what happens</p>
    </td>
  </tr>

  <tr>
    <td style="background:#f9fafb;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">Hi ${instructorName},</p>

      <p style="margin:0 0 24px;font-size:14px;color:#374151;">
        Once your profile is approved, students can find and book you directly.
        Here&#8217;s exactly how that works.
      </p>

      <!-- Student journey -->
      <div style="background:white;border-radius:8px;border:1px solid #e5e7eb;padding:20px 20px 20px 16px;margin-bottom:24px;">
        <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">
          The student journey
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${flowStep('Student searches for an instructor', 'They enter their suburb and lesson type.')}
          ${flowStep('They view your profile', 'They see your photo, bio, rate, reviews, and availability.')}
          ${flowStep('They choose a lesson or package', 'Single lesson or a multi-lesson package at a discount.')}
          ${flowStep('They pay securely online', 'Payment is processed by Stripe &#8212; you don&#8217;t handle the money.')}
          ${flowStep('You receive a booking notification', 'Email and in-app notification with all lesson details.')}
          ${flowStep('You teach the lesson', 'Check in on the app when you start, check out when you finish.', true)}
        </table>
      </div>

      <!-- What you control -->
      <div style="background:white;border-radius:8px;border:1px solid #e5e7eb;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">
          What you control
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:14px;">
              <span style="color:#16a34a;font-weight:700;margin-right:8px;">&#10003;</span>
              Your schedule &#8212; open and close availability anytime
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;">
              <span style="color:#16a34a;font-weight:700;margin-right:8px;">&#10003;</span>
              Your rate &#8212; set it once, change it whenever
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;">
              <span style="color:#16a34a;font-weight:700;margin-right:8px;">&#10003;</span>
              No manual invoicing &#8212; payment and receipts are automatic
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;">
              <span style="color:#16a34a;font-weight:700;margin-right:8px;">&#10003;</span>
              Your earnings &#8212; paid directly to your bank account weekly
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${baseUrl}/dashboard"
          style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;
            border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          View your instructor dashboard &#8594;
        </a>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
        Questions? Reply to this email or contact us at
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
