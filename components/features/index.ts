export { default as FeatureHero } from './FeatureHero'

// Common gradient presets for feature pages
export const heroPresets = {
  pink: {
    gradient: 'from-pink-900 via-violet-900 to-slate-950',
    badgeColors: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
    ctaGradient: 'from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500',
    ctaShadow: 'shadow-pink-500/20',
    blobColor: 'bg-pink-500/20',
  },
  violet: {
    gradient: 'from-violet-900 via-indigo-900 to-slate-950',
    badgeColors: 'bg-violet-500/20 border-violet-500/30 text-violet-300',
    ctaGradient: 'from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500',
    ctaShadow: 'shadow-violet-500/20',
    blobColor: 'bg-violet-500/20',
  },
  blue: {
    gradient: 'from-indigo-900 via-blue-900 to-slate-950',
    badgeColors: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
    ctaGradient: 'from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500',
    ctaShadow: 'shadow-indigo-500/20',
    blobColor: 'bg-indigo-500/20',
  },
  emerald: {
    gradient: 'from-emerald-900 via-teal-900 to-slate-950',
    badgeColors: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    ctaGradient: 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500',
    ctaShadow: 'shadow-emerald-500/20',
    blobColor: 'bg-emerald-500/20',
  },
}
