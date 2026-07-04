/**
 * Design Tokens — the single source of truth for the WMS Pro design system.
 * These JS constants mirror the CSS custom properties in src/index.css.
 * Use them in JS logic (charts, inline styles, dynamic values); use the
 * mapped Tailwind classes (bg-primary, font-heading, etc.) in JSX.
 */

export const colors = {
  primary: { token: 'primary', hsl: '243 75% 59%', semantic: 'Actions, links, active nav' },
  accent: { token: 'accent', hsl: '262 83% 58%', semantic: 'Secondary highlight, AI features' },
  destructive: { token: 'destructive', hsl: '0 84% 60%', semantic: 'Errors, delete, danger zones' },
  success: { token: 'success', hsl: '142 71% 45%', semantic: 'Completed, approved, positive' },
  warning: { token: 'warning', hsl: '38 92% 50%', semantic: 'Pending, caution, low stock' },
  background: { token: 'background', hsl: '220 20% 97%', semantic: 'Page canvas' },
  card: { token: 'card', hsl: '0 0% 100%', semantic: 'Card surfaces' },
  muted: { token: 'muted', hsl: '220 14% 96%', semantic: 'Hover backgrounds, subtle fills' },
  border: { token: 'border', hsl: '220 13% 91%', semantic: 'Dividers, outlines' },
  foreground: { token: 'foreground', hsl: '224 71% 4%', semantic: 'Body text' },
  mutedForeground: { token: 'muted-foreground', hsl: '220 9% 46%', semantic: 'Labels, hints' },
};

export const chartColors = ['#4f46e5', '#7c3aed', '#0d9488', '#f59e0b', '#ef4444'];

export const typography = {
  fontFamily: {
    heading: 'Inter, ui-sans-serif, system-ui, sans-serif',
    body: 'Inter, ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  scale: [
    { name: 'Display', class: 'text-3xl font-bold tracking-tight', size: '30px', usage: 'Hero numbers' },
    { name: 'Page Title', class: 'text-2xl font-bold tracking-tight', size: '24px', usage: 'PageHeader title' },
    { name: 'Section', class: 'text-lg font-semibold', size: '18px', usage: 'SectionCard title' },
    { name: 'Body', class: 'text-base font-medium', size: '16px', usage: 'Default text' },
    { name: 'Small', class: 'text-sm text-muted-foreground', size: '14px', usage: 'Labels, hints' },
    { name: 'Micro', class: 'text-xs text-muted-foreground', size: '12px', usage: 'Badges, metadata' },
  ],
};

export const spacing = {
  scale: [
    { token: '0', px: '0px', class: 'p-0', usage: 'No spacing' },
    { token: '1', px: '4px', class: 'p-1', usage: 'Tight icon gaps' },
    { token: '2', px: '8px', class: 'p-2', usage: 'Dense controls' },
    { token: '3', px: '12px', class: 'p-3', usage: 'Compact cards' },
    { token: '4', px: '16px', class: 'p-4', usage: 'Standard card padding' },
    { token: '6', px: '24px', class: 'p-6', usage: 'Page padding' },
    { token: '8', px: '32px', class: 'p-8', usage: 'Section gaps' },
    { token: '12', px: '48px', class: 'p-12', usage: 'Hero spacing' },
  ],
  gaps: { sm: 'gap-2', md: 'gap-3', lg: 'gap-4', xl: 'gap-6', section: 'space-y-8' },
};

export const elevation = {
  levels: [
    { name: 'None', class: 'shadow-none', css: 'box-shadow: none', usage: 'Flat surfaces' },
    { name: 'SM', class: 'shadow-sm', css: '0 1px 2px rgba(0,0,0,0.05)', usage: 'Inputs, subtle' },
    { name: 'Default', class: 'shadow', css: '0 1px 3px rgba(0,0,0,0.1)', usage: 'Buttons, cards' },
    { name: 'MD', class: 'shadow-md', css: '0 4px 6px rgba(0,0,0,0.1)', usage: 'Hover cards, popovers' },
    { name: 'LG', class: 'shadow-lg', css: '0 10px 15px rgba(0,0,0,0.1)', usage: 'Dropdowns, modals' },
    { name: 'XL', class: 'shadow-xl', css: '0 20px 25px rgba(0,0,0,0.1)', usage: 'Floating panels' },
    { name: '2XL', class: 'shadow-2xl', css: '0 25px 50px rgba(0,0,0,0.25)', usage: 'Overlays' },
  ],
};

export const radii = {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  full: '9999px',
};

export const iconRules = {
  library: 'lucide-react',
  sizes: { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' },
  stroke: 'stroke-width: 2 (default)',
  guidelines: [
    'Always import from lucide-react — never inline SVGs',
    'Use w-4 h-4 inside buttons, w-5 h-5 for standalone nav icons',
    'Pair every icon with a text label in buttons — icon-only needs size="icon"',
    'Decorative icons get aria-hidden; interactive icons need a label',
    'Never use an icon that does not exist in lucide-react — it breaks the build',
  ],
};

export const animationRules = {
  durations: { instant: 0, fast: 150, base: 200, normal: 300, slow: 500, slower: 700 },
  easings: { ease: 'ease', easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out', spring: 'spring' },
  presets: [
    { name: 'Page Transition', description: 'Fade + slide on route change', trigger: 'AnimatedPage wrapper' },
    { name: 'Card Hover Lift', description: 'translateY(-2px) + shadow-md', trigger: 'whileHover' },
    { name: 'Drawer Slide', description: 'Slide from edge + backdrop fade', trigger: 'AnimatedDrawer' },
    { name: 'Table Row Stagger', description: 'Sequential fade-up on mount', trigger: 'StaggerContainer' },
    { name: 'Success Checkmark', description: 'Scale + path draw', trigger: 'SuccessCheckmark' },
    { name: 'Toast Pop-in', description: 'Spring slide from top', trigger: 'AnimatedToast' },
  ],
};

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};