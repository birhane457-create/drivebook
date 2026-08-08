import { demoProfileBlock } from './shared'

/**
 * Email 6 — Post-approval activation (sent immediately on approval)
 * Goal: Activate first-booking behaviours. Tone: congratulatory but action-focused.
 */
export function buildOnboardingApproved(data: {
  instructorName: string
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, baseUrl, supportEmail } = data

  const subject = "You&#8217;re approved &#8212; here&#8217;s how to attract your first students"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>You're approved on DriveBook</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:700;">You&#8217;re approved</h1>
      <p style="margin:10px 0 0;opacity:0.9;font-size:15px;">Your DriveBook profile is now live and visible to students</p>
    </td>
  </tr>

  <tr>
    <td style="background:#f9fafb;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">Hi ${instructorName},</p>

      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#059669;">
        Congratulations &#8212; your instructor account has been approved.
      </p>

      <p style="margin:0 0 24px;font-size:14px;color:#374151;">
        Students in your area can now find and book you on DriveBook.
        Here&#8217;s what to do next to maximise your chances of receiving your first booking quickly.
      </p>

      <!-- Next steps -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <thead>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:12px;
              font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">
              What to do right now
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="font-size:14px;">
                <a href="${baseUrl}/dashboard/profile" style="color:#2563eb;text-decoration:none;">
                  Add a profile photo &#8594;
                </a>
              </strong>
              <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">
                Profiles with a clear, professional photo are trusted more by students.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="font-size:14px;">
                <a href="${baseUrl}/dashboard/schedule" style="color:#2563eb;text-decoration:none;">
                  Open your availability &#8594;
                </a>
              </strong>
              <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">
                Make sure you have slots open for the next 2&#8211;4 weeks so students can book right away.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="font-size:14px;">
                <a href="${baseUrl}/dashboard/packages" style="color:#2563eb;text-decoration:none;">
                  Add a lesson package &#8594;
                </a>
              </strong>
              <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">
                Packages (5 or 10 hours at a small discount) encourage students to commit to you
                rather than booking one lesson and shopping around.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;">
              <strong style="font-size:14px;">
                <a href="${baseUrl}/dashboard/wallet" style="color:#2563eb;text-decoration:none;">
                  Confirm Stripe is connected &#8594;
                </a>
              </strong>
              <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">
                Payments can&#8217;t be released to you until your Stripe account is fully connected.
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Info box -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#166534;">
          <strong>How DriveBook ranks instructors:</strong> availability, response time, and profile completeness.
          The more of these you have, the higher you appear in student searches.
        </p>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${baseUrl}/dashboard"
          style="display:inline-block;background:#059669;color:white;padding:13px 28px;
            border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          Go to my dashboard &#8594;
        </a>
      </div>

      ${demoProfileBlock(baseUrl)}

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
