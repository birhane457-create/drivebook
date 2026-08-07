/**
 * Email 4 — Get more bookings: profile optimisation tips (Day 5)
 * Goal: Activate the behaviours that lead to first bookings.
 * Addresses the biggest activation gap: incomplete profiles that block visibility.
 */
export function buildOnboardingProfileTips(data: {
  instructorName: string
  baseUrl: string
  supportEmail: string
}): { subject: string; html: string } {
  const { instructorName, baseUrl, supportEmail } = data

  const subject = "5 things that help instructors get their first booking"

  const tip = (label: string, desc: string) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;">
        <strong style="font-size:14px;color:#1f2937;">${label}</strong>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${desc}</p>
      </td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>5 things that help instructors get their first booking</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">How to attract your first students</h1>
      <p style="margin:10px 0 0;opacity:0.9;font-size:14px;">Small changes that make a big difference</p>
    </td>
  </tr>

  <tr>
    <td style="background:#f9fafb;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">

      <p style="margin:0 0 20px;font-size:15px;">Hi ${instructorName},</p>

      <p style="margin:0 0 20px;font-size:14px;color:#374151;">
        Students compare profiles before booking. These five things consistently
        make the difference between a profile that gets bookings and one that gets skipped.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tbody>
          ${tip(
            '1. Add a clear profile photo',
            'Profiles with a professional headshot get significantly more clicks. Students want to see who they are booking with.'
          )}
          ${tip(
            '2. Write a specific bio',
            'Instead of "experienced instructor", try "10 years teaching in Perth, specialising in nervous drivers and test preparation." Specific is more convincing.'
          )}
          ${tip(
            '3. Open more availability',
            'Students often search for lessons within the next few days. If your calendar shows no availability for two weeks, they book someone else.'
          )}
          ${tip(
            '4. Add lesson packages',
            'Packages (e.g. 5 or 10 hours) give students a reason to commit early and improve your average booking value.'
          )}
          ${tip(
            '5. Respond to enquiries quickly',
            'Students who send a message and don&#8217;t hear back within a few hours often move on. Fast responses build trust.'
          )}
        </tbody>
      </table>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#166534;">
          <strong>Worth knowing:</strong> DriveBook shows students instructors who are most available and responsive first.
          An open calendar and a complete profile means more visibility.
        </p>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${baseUrl}/dashboard/profile"
          style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;
            border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          Improve my profile &#8594;
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
