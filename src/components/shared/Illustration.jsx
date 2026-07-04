import { cn } from '@/lib/utils';

const presets = {
  'empty-box': (
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 42 L60 28 L90 42 L60 56 Z" />
      <path d="M30 42 V78 L60 92 L60 56" opacity="0.7" />
      <path d="M90 42 V78 L60 92" opacity="0.7" />
      <path d="M48 36 L78 50" opacity="0.4" strokeDasharray="3 4" />
    </g>
  ),
  'no-results': (
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="56" cy="52" r="22" />
      <path d="M72 68 L92 88" />
      <path d="M50 52 H62" opacity="0.5" />
    </g>
  ),
  'success': (
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="60" cy="60" r="28" />
      <path d="M46 60 L56 70 L76 48" />
    </g>
  ),
  'inbox': (
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 64 L42 64 L48 74 H72 L78 64 H92 V88 H28 Z" />
      <path d="M40 40 V58 M60 34 V58 M80 40 V58" opacity="0.6" />
      <path d="M40 40 L60 34 L80 40" opacity="0.6" />
    </g>
  ),
};

export default function Illustration({ name = 'empty-box', className }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("text-primary", className)} role="img" aria-hidden="true">
      {presets[name] || presets['empty-box']}
    </svg>
  );
}