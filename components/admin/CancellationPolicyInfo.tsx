// Read-only cancellation policy block — used in instructor Settings page.
// Values are DriveBook platform defaults. Admin can change via /admin/pricing.
export default function CancellationPolicyInfo() {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
      <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-foreground">
        <span className="text-base">📋</span>
        Platform Cancellation Policy
      </h2>
      <p className="text-xs text-muted-foreground/60 mb-4">
        DriveBook&apos;s standard policy — applied automatically on all bookings.
      </p>
      <div className="space-y-2.5">
        {[
          { icon: '✅', label: '48+ hours notice', value: 'Full refund (100%)' },
          { icon: '⚠️', label: '24–48 hours notice', value: '50% refund' },
          { icon: '❌', label: 'Under 24 hours', value: 'No refund' },
        ].map(({ icon, label, value }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
            <span className="text-sm font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/60 mt-4">
        Students see this under &ldquo;Before You Book&rdquo; on your booking page.
      </p>
    </div>
  );
}
