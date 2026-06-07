import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import { Palette, Globe, Mail, Shield, Eye, Plus, Upload, Loader2, Building2 } from 'lucide-react';

const DEFAULT_PROFILE = {
  brand_name: 'WMS Pro',
  primary_color: '#6366f1',
  secondary_color: '#8b5cf6',
  accent_color: '#22c55e',
  font_heading: 'Inter',
  font_body: 'Inter',
  hide_powered_by: false,
  custom_email_from_name: 'WMS Pro',
};

function ColorSwatch({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg border-2 border-white shadow cursor-pointer"
        style={{ background: value }}
      />
      <div className="flex-1">
        <Label className="text-xs">{label}</Label>
        <div className="flex gap-2 mt-1">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
          />
          <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="#000000"
          />
        </div>
      </div>
    </div>
  );
}

function BrandPreview({ profile }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Mock nav */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: profile.primary_color }}>
        <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
          <Building2 className="w-3 h-3 text-white" />
        </div>
        <span className="text-white font-bold text-sm">{profile.brand_name || 'Your Brand'}</span>
        <div className="ml-auto flex gap-2">
          {['Dashboard','Orders','Reports'].map(l => (
            <span key={l} className="text-white/70 text-xs hover:text-white cursor-pointer">{l}</span>
          ))}
        </div>
      </div>
      {/* Mock content */}
      <div className="p-4 bg-gray-50 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {['Revenue','Orders','Stock'].map((m, i) => (
            <div key={m} className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">{m}</p>
              <p className="text-lg font-bold" style={{ color: i === 0 ? profile.accent_color : profile.primary_color }}>
                {['$48K','1,240','892'][i]}
              </p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="h-2 rounded mb-2" style={{ background: profile.primary_color, width: '60%' }} />
          <div className="h-2 rounded bg-gray-100 mb-2 w-full" />
          <div className="h-2 rounded bg-gray-100 w-4/5" />
        </div>
        {!profile.hide_powered_by && (
          <p className="text-[10px] text-gray-400 text-center">Powered by WMS Pro</p>
        )}
      </div>
    </div>
  );
}

export default function WhiteLabel() {
  const [tab, setTab] = useState('branding');
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ['brand-profiles'],
    queryFn: () => base44.entities.BrandProfile.list(),
  });

  const saveMut = useMutation({
    mutationFn: (d) => selectedTenant
      ? base44.entities.BrandProfile.update(selectedTenant.id, d)
      : base44.entities.BrandProfile.create({ ...d, tenant_id: `tenant-${Date.now()}` }),
    onSuccess: () => { qc.invalidateQueries(['brand-profiles']); setSaving(false); },
  });

  const TENANTS = [
    { id: 'default', name: 'Default (Platform)', domain: 'app.wmspro.io', active: true },
    ...brands.map(b => ({ id: b.id, name: b.brand_name, domain: b.custom_domain || 'Not configured', active: b.is_active })),
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="White Label" subtitle="Brand profiles · Custom domains · Email templates · Theme builder">
        <Button size="sm" className="gap-2" onClick={() => setShowNewTenant(true)}>
          <Plus className="w-4 h-4" /> New Brand Profile
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Tenant List */}
        <div className="md:col-span-1 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand Profiles</p>
          {TENANTS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTenant(t.id === 'default' ? null : t)}
              className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${selectedTenant?.id === t.id || (t.id === 'default' && !selectedTenant) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted'}`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.domain}</p>
                </div>
                {t.active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              </div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="md:col-span-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="branding"><Palette className="w-3.5 h-3.5 mr-1" />Branding</TabsTrigger>
              <TabsTrigger value="domain"><Globe className="w-3.5 h-3.5 mr-1" />Domain</TabsTrigger>
              <TabsTrigger value="email"><Mail className="w-3.5 h-3.5 mr-1" />Email</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="w-3.5 h-3.5 mr-1" />Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="branding" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Brand Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Brand Name</Label>
                      <Input value={profile.brand_name} onChange={e => setProfile(p => ({ ...p, brand_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Logo URL</Label>
                      <Input value={profile.logo_url || ''} onChange={e => setProfile(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Color Palette</p>
                    <ColorSwatch label="Primary Color" value={profile.primary_color} onChange={v => setProfile(p => ({ ...p, primary_color: v }))} />
                    <ColorSwatch label="Secondary Color" value={profile.secondary_color} onChange={v => setProfile(p => ({ ...p, secondary_color: v }))} />
                    <ColorSwatch label="Accent Color" value={profile.accent_color} onChange={v => setProfile(p => ({ ...p, accent_color: v }))} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Heading Font</Label>
                      <Input value={profile.font_heading} onChange={e => setProfile(p => ({ ...p, font_heading: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Body Font</Label>
                      <Input value={profile.font_body} onChange={e => setProfile(p => ({ ...p, font_body: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Hide "Powered by WMS Pro"</p>
                      <p className="text-xs text-muted-foreground">Fully white-labeled — requires Enterprise plan</p>
                    </div>
                    <Switch
                      checked={profile.hide_powered_by}
                      onCheckedChange={v => setProfile(p => ({ ...p, hide_powered_by: v }))}
                    />
                  </div>

                  <div>
                    <Label>Custom CSS</Label>
                    <Textarea
                      value={profile.custom_css || ''}
                      onChange={e => setProfile(p => ({ ...p, custom_css: e.target.value }))}
                      placeholder=".sidebar { background: #1a1a2e; }"
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="domain" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Custom Domain Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Custom Domain</Label>
                    <Input value={profile.custom_domain || ''} onChange={e => setProfile(p => ({ ...p, custom_domain: e.target.value }))} placeholder="app.yourdomain.com" />
                    <p className="text-xs text-muted-foreground mt-1">Point a CNAME record to <code className="bg-muted px-1 rounded">cname.wmspro.io</code></p>
                  </div>
                  <div>
                    <Label>Support URL</Label>
                    <Input value={profile.support_url || ''} onChange={e => setProfile(p => ({ ...p, support_url: e.target.value }))} placeholder="https://support.yourdomain.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Privacy Policy URL</Label>
                      <Input value={profile.privacy_url || ''} onChange={e => setProfile(p => ({ ...p, privacy_url: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Terms of Service URL</Label>
                      <Input value={profile.terms_url || ''} onChange={e => setProfile(p => ({ ...p, terms_url: e.target.value }))} />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-muted/30">
                    <p className="text-xs font-medium mb-2">DNS Configuration</p>
                    <div className="space-y-1 font-mono text-xs">
                      <div className="flex gap-4">
                        <span className="text-muted-foreground w-16">Type</span>
                        <span className="text-muted-foreground w-32">Host</span>
                        <span className="text-muted-foreground">Value</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="w-16">CNAME</span>
                        <span className="w-32">{profile.custom_domain ? profile.custom_domain.split('.').slice(0, 1).join('') : 'app'}</span>
                        <span>cname.wmspro.io</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="w-16">TXT</span>
                        <span className="w-32">_verify</span>
                        <span>wmspro-verify=abc123</span>
                      </div>
                    </div>
                    <Badge className="mt-2 bg-yellow-100 text-yellow-800 text-[10px]">Pending verification</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Email Branding</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>From Email</Label>
                      <Input value={profile.custom_email_from || ''} onChange={e => setProfile(p => ({ ...p, custom_email_from: e.target.value }))} placeholder="no-reply@yourdomain.com" />
                    </div>
                    <div>
                      <Label>From Name</Label>
                      <Input value={profile.custom_email_from_name || ''} onChange={e => setProfile(p => ({ ...p, custom_email_from_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Email Header HTML</Label>
                    <Textarea value={profile.email_header_html || ''} onChange={e => setProfile(p => ({ ...p, email_header_html: e.target.value }))} placeholder='<div style="background:#6366f1;padding:20px;"><img src="..." /></div>' rows={4} className="font-mono text-xs" />
                  </div>
                  <div>
                    <Label>Email Footer HTML</Label>
                    <Textarea value={profile.email_footer_html || ''} onChange={e => setProfile(p => ({ ...p, email_footer_html: e.target.value }))} placeholder='<div style="color:#999;font-size:12px;">© 2026 Your Company</div>' rows={4} className="font-mono text-xs" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Live preview with your current branding settings</p>
                <BrandPreview profile={profile} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setProfile(DEFAULT_PROFILE)}>Reset to Default</Button>
            <Button onClick={() => { setSaving(true); saveMut.mutate(profile); }} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Brand Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}