'use client';

export default function CancellationPolicy() {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1.5">Cancellation Policy</p>
      <ul className="text-xs text-slate-400 space-y-0.5">
        <li>• 48+ hours notice — full refund to wallet</li>
        <li>• 24–48 hours notice — 50% refund to wallet</li>
        <li>• Under 24 hours — no refund</li>
      </ul>
    </div>
  );
}
