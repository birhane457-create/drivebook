import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBusinessConfig } from '@/lib/core/business-config'
import Link from 'next/link'
import {
  Building2, Palette, Type, Zap, Briefcase, Bot, Globe,
  CheckCircle, ChevronRight, AlertCircle
} from 'lucide-react'

const SECTIONS = [
  {
    href:  '/business-setup/identity',
    icon:  Building2,
    title: 'Identity',
    desc:  'Business name, ABN, contact details and timezone.',
    fields: ['name', 'supportEmail'],
  },
  {
    href:  '/business-setup/branding',
    icon:  Palette,
    title: 'Branding',
    desc:  'Logo, colours, theme and your public URL slug.',
    fields: ['primaryColour'],
  },
  {
    href:  '/business-setup/terminology',
    icon:  Type,
    title: 'Terminology',
    desc:  'Rename provider, customer and booking labels to match your industry.',
    fields: ['provider', 'customer'],
  },
  {
    href:  '/business-setup/services',
    icon:  Briefcase,
    title: 'Services',
    desc:  'Define what you offer — pricing, duration and booking mode.',
    fields: [],
  },
  {
    href:  '/business-setup/capabilities',
    icon:  Zap,
    title: 'Capabilities',
    desc:  'Enable or disable platform features for your business.',
    fields: [],
  },
  {
    href:  '/business-setup/ai-config',
    icon:  Bot,
    title: 'AI Receptionist',
    desc:  'Configure your AI receptionist — FAQ, hours and allowed actions.',
    fields: ['businessDescription'],
  },
  {
    href:  '/business-setup/domain',
    icon:  Globe,
    title: 'Domain',
    desc:  'Connect a custom domain or set your platform subdomain.',
    fields: [],
  },
]

export default async function BusinessSetupOverviewPage() {
  const session = await getServerSession(authOptions)
  const config = await getBusinessConfig({ providerId: session?.user?.providerId })

  const completionItems = [
    { label: 'Business name set',       done: !!config.name },
    { label: 'Support email set',       done: !!config.supportEmail },
    { label: 'At least one service',    done: config.services.length > 0 },
    { label: 'Primary colour set',      done: !!config.branding.primaryColour },
    { label: 'AI description written',  done: config.aiConfig.businessDescription.length > 20 },
  ]
  const completedCount = completionItems.filter(i => i.done).length
  const pct = Math.round((completedCount / completionItems.length) * 100)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Business Setup</h1>
        <p className="mt-1 text-gray-300 text-sm">
          Configure how your business operates on the platform.
        </p>
      </div>

      {/* Cross-link to Dashboard Branding */}
      <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-4 flex items-start gap-3">
        <Palette className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-purple-200 font-medium">Need quick access to branding with live preview?</p>
          <p className="text-xs text-purple-300 mt-0.5">
            Go to{' '}
            <Link href="/dashboard/branding" className="underline hover:text-purple-100 font-semibold text-purple-200">
              Dashboard Branding
            </Link>
            {' '}for full branding control, live booking page preview, and URL management.
          </p>
        </div>
      </div>

      {/* Completion indicator */}
      <div className="rounded-xl bg-gray-900 border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-100">Setup progress</span>
          <span className="text-sm text-gray-300">{completedCount}/{completionItems.length} complete</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {completionItems.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.done
                ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                : <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              }
              <span className={item.done ? 'text-gray-100' : 'text-gray-300'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl bg-gray-900 border border-gray-700 p-5 hover:border-blue-500/50 hover:bg-gray-800/60 transition-all"
          >
            <div className="rounded-lg bg-blue-500/10 p-2.5 shrink-0">
              <Icon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-100 text-sm">{title}</span>
                <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="mt-0.5 text-xs text-gray-300 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Current config preview */}
      <div className="rounded-xl bg-gray-900 border border-gray-700 p-5">
        <h2 className="text-sm font-medium text-gray-100 mb-3">Current configuration</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Business name', value: config.name },
            { label: `${config.terminology.provider} label`, value: config.terminology.provider },
            { label: `${config.terminology.customer} label`, value: config.terminology.customer },
            { label: `${config.terminology.booking} label`, value: config.terminology.booking },
            { label: 'Services', value: `${config.services.length} configured` },
            { label: 'Subscription', value: config.subscriptionTier },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400">{label}</dt>
              <dd className="mt-0.5 font-medium text-gray-100 truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>

  )
}
