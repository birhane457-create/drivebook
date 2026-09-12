import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Palette, Type, Zap, Briefcase, Bot,
  Globe, ChevronRight
} from 'lucide-react'

const NAV = [
  { href: '/business-setup',              label: 'Overview',       icon: Building2  },
  { href: '/business-setup/identity',     label: 'Identity',       icon: Building2  },
  { href: '/business-setup/branding',     label: 'Branding',       icon: Palette    },
  { href: '/business-setup/terminology',  label: 'Terminology',    icon: Type       },
  { href: '/business-setup/services',     label: 'Services',       icon: Briefcase  },
  { href: '/business-setup/capabilities', label: 'Capabilities',   icon: Zap        },
  { href: '/business-setup/ai-config',    label: 'AI Receptionist',icon: Bot        },
  { href: '/business-setup/domain',       label: 'Domain',         icon: Globe      },
]

export default async function BusinessSetupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.providerId) redirect('/login')

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm text-foreground">Business Setup</span>
          </div>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar nav */}
        <aside className="w-52 shrink-0">
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all group"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </Link>
            ))}
          </nav>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
