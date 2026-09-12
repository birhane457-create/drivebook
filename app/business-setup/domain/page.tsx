'use client'

import { useState, useEffect } from 'react'
import { Globe, CheckCircle, AlertCircle, Loader2, Copy, ExternalLink } from 'lucide-react'

type Domain = {
  id?: string
  host: string
  type: 'custom' | 'subdomain'
  isPrimary: boolean
  verified: boolean
  verifiedAt?: string
}

const INPUT = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500'

export default function DomainPage() {
  const [domains, setDomains]   = useState<Domain[]>([])
  const [slug, setSlug]         = useState('')
  const [customHost, setCustomHost] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [tier, setTier]         = useState('BASIC')

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'platform.com'

  useEffect(() => {
    Promise.all([
      fetch('/api/business').then(r => r.json()),
    ]).then(([biz]) => {
      setTier(biz.subscriptionTier ?? 'BASIC')
      // Derive current slug from branding
      fetch('/api/business/branding').then(r => r.json()).then(b => {
        setSlug(b.customSlug ?? '')
        setLoading(false)
      })
    })
  }, [])

  const isStudio = ['STUDIO', 'PREMIUM'].includes(tier)

  const saveSlug = async () => {
    if (!slug.trim()) return
    setSaving(true); setMsg(null)
    const r = await fetch('/api/business/branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customSlug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') }),
    })
    const d = await r.json()
    setSaving(false)
    setMsg(r.ok ? { type: 'ok', text: `Subdomain set to ${slug}.${rootDomain}` } : { type: 'err', text: d.error ?? 'Failed.' })
  }

  const connectCustomDomain = async () => {
    if (!customHost.trim()) return
    setSaving(true); setMsg(null)

    // Step 1: Save the domain to the business record
    await fetch('/api/business/branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customDomain: customHost.trim().toLowerCase() }),
    })

    // Step 2: Attempt DNS verification via the existing verify endpoint
    const r = await fetch('/api/instructor/domain/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: customHost.trim().toLowerCase() }),
    })
    const d = await r.json()
    setSaving(false)

    if (r.ok && d.verified) {
      setMsg({ type: 'ok', text: `✓ ${d.message}` })
    } else if (r.ok && !d.verified) {
      setMsg({ type: 'ok', text: `Domain saved. ${d.message ?? 'DNS not yet verified — check back after propagation.'}` })
    } else {
      setMsg({ type: 'err', text: d.error ?? 'Failed to connect domain.' })
    }
  }

  const copy = (text: string) => navigator.clipboard.writeText(text)

  if (loading) return <div className="text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Domain</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up your public URL — a platform subdomain or your own custom domain.</p>
      </div>

      {/* Subdomain */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Platform Subdomain</h2>
          <p className="text-xs text-muted-foreground/60">Available on all plans. Your booking page lives at this URL.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Your subdomain</label>
          <div className="flex items-center rounded-lg bg-gray-800 border border-gray-700 overflow-hidden focus-within:border-blue-500">
            <span className="px-3 py-2 text-sm text-muted-foreground/60 border-r border-gray-700 shrink-0">{rootDomain}/</span>
            <input className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="your-business" />
          </div>
          <p className="mt-1 text-xs text-gray-600">Lowercase letters, numbers and hyphens. 3–40 characters.</p>
        </div>

        {slug && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <span className="text-muted-foreground">{slug}.{rootDomain}</span>
            <button onClick={() => copy(`https://${slug}.${rootDomain}`)}
              className="p-1 text-gray-600 hover:text-muted-foreground transition-colors">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a href={`https://${slug}.${rootDomain}`} target="_blank" rel="noopener noreferrer"
              className="p-1 text-gray-600 hover:text-muted-foreground transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <button onClick={saveSlug} disabled={saving || !slug.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Save Subdomain
        </button>
      </div>

      {/* Custom domain */}
      <div className={`rounded-xl border p-6 space-y-4 ${isStudio ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/40 border-gray-800/60 opacity-60'}`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Custom Domain</h2>
            <p className="text-xs text-muted-foreground/60">Connect your own domain — e.g. smithtax.com.au</p>
          </div>
          {!isStudio && (
            <a href="/dashboard/subscription"
              className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-primary border border-blue-500/30 hover:bg-blue-500/25 transition-colors whitespace-nowrap">
              Studio+ required
            </a>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Domain name</label>
          <input className={INPUT} value={customHost}
            onChange={e => setCustomHost(e.target.value)}
            placeholder="smithtax.com.au"
            disabled={!isStudio} />
        </div>

        <button onClick={connectCustomDomain} disabled={!isStudio || saving || !customHost.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          Connect &amp; Verify DNS
        </button>

        {isStudio && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 space-y-3">
            <p className="text-xs font-medium text-foreground">DNS Instructions</p>
            <p className="text-xs text-muted-foreground/60">Add these records to your domain's DNS settings:</p>
            <div className="space-y-2">
              {[
                { type: 'CNAME', name: '@', value: `cname.${rootDomain}` },
                { type: 'CNAME', name: 'www', value: `cname.${rootDomain}` },
              ].map((r: any) => (
                <div key={r.name} className="flex items-center gap-2 font-mono text-xs bg-gray-900 rounded px-3 py-2">
                  <span className="text-primary w-12 shrink-0">{r.type}</span>
                  <span className="text-muted-foreground w-8 shrink-0">{r.name}</span>
                  <span className="text-foreground flex-1">{r.value}</span>
                  <button onClick={() => copy(r.value)} className="text-gray-600 hover:text-muted-foreground transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">DNS changes can take up to 24 hours to propagate.</p>
          </div>
        )}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-destructive'}`}>
          {msg.type === 'ok' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}
    </div>
  )
}
