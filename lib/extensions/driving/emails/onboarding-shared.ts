/**
 * Shared HTML snippets reused across onboarding email templates.
 * All strings use HTML entities — no raw Unicode.
 */

/**
 * "See it before you build it" demo profile block.
 * Intentionally minimal — let the demo explain itself.
 * Included in: welcome, setup, bookings, profile-tips, approved.
 */
export function demoProfileBlock(baseUrl: string): string {
  return `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 5px;font-size:14px;font-weight:700;color:#1e40af;">
        See it before you build it
      </p>
      <p style="margin:0 0 10px;font-size:13px;color:#374151;">
        This is an example of what your instructor profile can look like to students on DriveBook.
      </p>
      <a href="${baseUrl}/instructors/demo"
        style="font-size:13px;font-weight:700;color:#2563eb;text-decoration:none;">
        See the example profile &#8594;
      </a>
    </div>`
}

/**
 * Standard email footer used in all onboarding templates.
 */
export function emailFooter(): string {
  return `
    <div style="border-top:1px solid #e5e7eb;padding-top:20px;text-align:center;font-size:12px;color:#9ca3af;">
      <p style="margin:0;"><strong style="color:#6b7280;">DriveBook</strong> &#8212; Your Driving Instructor Platform</p>
      <p style="margin:6px 0 0;">You&#8217;re receiving this because you registered as an instructor on DriveBook.</p>
    </div>`
}
