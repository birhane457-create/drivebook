import { demoProfileBlock, emailFooter } from './shared'

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

  const subject =
    "Welcome to DriveBook — your independent driving business platform"

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Welcome to DriveBook</title>
</head>

<body style="margin:0;padding:0;background:#f3f4f6;
font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">

<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#f3f4f6;padding:24px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);
      color:white;padding:36px 32px;border-radius:10px 10px 0 0;
      text-align:center;">

      <h1 style="margin:0;font-size:22px;font-weight:700;">
        Welcome to DriveBook
      </h1>

      <p style="margin:10px 0 0;opacity:0.9;font-size:14px;">
        Your independent driving business platform
      </p>

    </td>
  </tr>

  <!-- Content -->
  <tr>
    <td style="background:#f9fafb;padding:32px;
      border-radius:0 0 10px 10px;
      border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">
        Hi ${instructorName},
      </p>

      <p style="margin:0 0 20px;font-size:14px;color:#374151;">
        You have just joined DriveBook, a platform built to help
        independent driving instructors run their business on their own terms.
      </p>

      <!-- Value props -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:8px;
        border:1px solid #e5e7eb;margin-bottom:24px;">
        <tbody>

          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">
                Your pricing, your rules
              </strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Set your own hourly rates and packages.
                DriveBook never controls what you charge.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">
                Your schedule, your availability
              </strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Open and manage your calendar whenever you want.
                No minimum hours required.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">
                Get discovered by learners
              </strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Students can find your profile, view your services,
                and book lessons online.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">
                Secure payments made simple
              </strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                DriveBook handles payments, receipts, and automatic payouts
                so you can focus on teaching.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
              <strong style="color:#2563eb;">
                Run your business in one place
              </strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Manage bookings, students, schedules, earnings,
                and lesson history from your dashboard.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;">
              <strong style="color:#2563eb;">
                Never miss an enquiry
              </strong>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Your AI receptionist can answer calls and capture
                enquiries while you are teaching.
              </p>
            </td>
          </tr>

        </tbody>
      </table>

      ${demoProfileBlock(baseUrl)}

      <div style="text-align:center;margin:24px 0;">
        <a href="${baseUrl}/dashboard/profile"
          style="display:inline-block;background:#2563eb;color:white;
          padding:13px 28px;border-radius:8px;font-weight:700;
          font-size:15px;text-decoration:none;">
          Complete my profile &#8594;
        </a>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
        Questions? Reply to this email or contact us at
        <a href="mailto:${supportEmail}" style="color:#2563eb;">
          ${supportEmail}
        </a>
      </p>

      ${emailFooter()}

    </td>
  </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`

return { subject, html }

}