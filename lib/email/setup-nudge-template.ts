/**
 * Instructor setup nudge email template.
 * Uses HTML entities throughout — no raw Unicode or emoji — so it renders
 * correctly in all email clients regardless of charset handling.
 */

export interface SetupNudgeSteps {
  documentsUploaded: boolean
  rateAndAreaSet: boolean
  availabilitySet: boolean
  bioComplete: boolean
  stripeConnected: boolean
}

function stepRow(done: boolean, label: string, url: string, baseUrl: string): string {
  const badge = done
    ? 'background:#d1fae5;color:#065f46;'
    : 'background:#fee2e2;color:#991b1b;'
  const icon = done ? '&#10003;' : '&#10007;'
  const content = done
    ? `<span style="color:#9ca3af;text-decoration:line-through;font-size:14px;">${label}</span>`
    : `<a href="${baseUrl}${url}" style="color:#2563eb;text-decoration:none;font-weight:500;font-size:14px;">${label}</a>`

  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:middle;">
        <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;
          border-radius:50%;font-size:12px;font-weight:bold;margin-right:10px;vertical-align:middle;${badge}">
          ${icon}
        </span>
        ${content}
      </td>
    </tr>`
}

export function buildSetupNudgeEmail(data: {
  instructorName: string
  steps: SetupNudgeSteps
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, steps, baseUrl, supportEmail } = data
  const completedCount = Object.values(steps).filter(Boolean).length
  const allDone = completedCount === 5
  const progressPct = Math.round((completedCount / 5) * 100)

  const subject = allDone
    ? "Your DriveBook profile is ready - you're all set!"
    : `${completedCount}/5 steps done - finish setting up your DriveBook profile`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:32px;border-radius:10px 10px 0 0;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;">
              ${allDone ? 'Profile complete!' : 'Complete your profile'}
            </h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">
              ${allDone ? 'Your DriveBook profile is fully set up.' : `${completedCount} of 5 steps completed`}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#f9fafb;padding:28px 32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

            <p style="margin:0 0 16px;">Hi ${instructorName},</p>

            ${allDone
              ? `<p style="margin:0 0 20px;">Fantastic &#8212; your profile is complete. Your account is under review and we&#8217;ll notify you once approved.</p>`
              : `<p style="margin:0 0 20px;">Here&#8217;s your setup checklist. Completed profiles get approved faster and attract more students.</p>`
            }

            ${!allDone ? `
            <div style="background:#e5e7eb;border-radius:9999px;height:8px;margin:0 0 6px;">
              <div style="background:#2563eb;border-radius:9999px;height:8px;width:${progressPct}%;"></div>
            </div>
            <p style="text-align:center;font-size:12px;color:#6b7280;margin:0 0 20px;">${completedCount} / 5 complete</p>
            ` : ''}

            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px;">
              <tbody>
                ${stepRow(steps.documentsUploaded, 'Upload your licence &amp; insurance documents', '/dashboard/profile',  baseUrl)}
                ${stepRow(steps.rateAndAreaSet,    'Set your hourly rate &amp; service area',        '/dashboard/settings', baseUrl)}
                ${stepRow(steps.availabilitySet,   'Configure your weekly availability',              '/dashboard/schedule', baseUrl)}
                ${stepRow(steps.bioComplete,       'Complete your instructor bio',                    '/dashboard/profile',  baseUrl)}
                ${stepRow(steps.stripeConnected,   'Connect Stripe to receive payments',              '/dashboard/wallet',   baseUrl)}
              </tbody>
            </table>

            <div style="text-align:center;margin:0 0 24px;">
              <a href="${baseUrl}/dashboard"
                style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;
                  border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
                Go to my dashboard &#8594;
              </a>
            </div>

            ${!allDone ? `
            <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
              Need help? Reply to this email or contact us at
              <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
            </p>
            ` : ''}

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
