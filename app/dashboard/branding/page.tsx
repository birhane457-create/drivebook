'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette, Upload, Eye, Save, Sparkles, Link2, Copy, Check,
  MessageCircle, Globe, ShieldCheck, AlertCircle, Loader2, ExternalLink,
} from 'lucide-react';
import Image from 'next/image';

export default function BrandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [instructor, setInstructor] = useState<any>(null);
  const [brandLogo, setBrandLogo] = useState('');
  const [brandColorPrimary, setBrandColorPrimary] = useState('#3B82F6');
  const [brandColorSecondary, setBrandColorSecondary] = useState('#10B981');
  const [showBrandingOnBookingPage, setShowBrandingOnBookingPage] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Slug (PRO+)
  const [slug, setSlug] = useState('');
  const [savedSlug, setSavedSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Social links
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');

  // Custom domain (Studio+)
  const [customDomain, setCustomDomain] = useState('');
  const [savedCustomDomain, setSavedCustomDomain] = useState('');
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainVerifiedAt, setDomainVerifiedAt] = useState<string | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [domainVerifyResult, setDomainVerifyResult] = useState<{ verified: boolean; message?: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [profileRes, brandingRes] = await Promise.all([
        fetch('/api/instructor/profile'),
        fetch('/api/instructor/branding'),
      ]);
      if (profileRes.ok) {
        const d = await profileRes.json();
        setInstructor(d);
        setWhatsapp(d.whatsapp || '');
        setInstagram(d.instagram || '');
        setFacebook(d.facebook || '');
        setYearsExperience(d.yearsExperience?.toString() || '');
      }
      if (brandingRes.ok) {
        const d = await brandingRes.json();
        setBrandLogo(d.brandLogo || '');
        setBrandColorPrimary(d.brandColorPrimary || '#3B82F6');
        setBrandColorSecondary(d.brandColorSecondary || '#10B981');
        setShowBrandingOnBookingPage(d.showBrandingOnBookingPage || false);
        setLogoPreview(d.brandLogo || '');
        setDomainVerified(d.domainVerified || false);
        setDomainVerifiedAt(d.domainVerifiedAt || null);
        setInstructor((prev: any) => ({ ...prev, subscriptionTier: d.subscriptionTier }));

        // Slug (separate field)
        setSlug(d.customSlug || '');
        setSavedSlug(d.customSlug || '');

        // Custom domain (Studio+)
        setCustomDomain(d.customDomain || '');
        setSavedCustomDomain(d.customDomain || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be less than 2MB'); return; }
    setLogoFile(file);
    setError('');
    setShowBrandingOnBookingPage(true);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const checkSlugAvailability = async (value: string) => {
    if (!value || value.length < 3) { setSlugAvailable(null); return; }
    if (!/^[a-z0-9-]+$/.test(value)) { setSlugAvailable(false); return; }
    setCheckingSlug(true);
    try {
      const res = await fetch(`/api/instructor/subdomain/check?subdomain=${value}`);
      const data = await res.json();
      setSlugAvailable(data.available);
    } catch { setSlugAvailable(null); }
    finally { setCheckingSlug(false); }
  };

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    if (cleaned !== savedSlug) {
      setTimeout(() => checkSlugAvailability(cleaned), 500);
    } else {
      setSlugAvailable(null);
    }
  };

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleVerifyDomain = async () => {
    if (!customDomain) return;
    setVerifyingDomain(true);
    setDomainVerifyResult(null);
    try {
      const res = await fetch('/api/instructor/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: customDomain }),
      });
      const data = await res.json();
      setDomainVerifyResult(data);
      if (data.verified) {
        setDomainVerified(true);
        setDomainVerifiedAt(new Date().toISOString());
        setSavedCustomDomain(customDomain);
        await fetchData();
      }
    } catch {
      setDomainVerifyResult({ verified: false, message: 'Verification request failed' });
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      let logoUrl = brandLogo;
      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        fd.append('type', 'brand-logo');
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!uploadRes.ok) throw new Error('Failed to upload logo');
        logoUrl = (await uploadRes.json()).url;
      }

      const tier = instructor?.subscriptionTier;
      const isStudio = tier === 'STUDIO' || tier === 'BUSINESS';

      const brandRes = await fetch('/api/instructor/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandLogo: logoUrl,
          brandColorPrimary,
          brandColorSecondary,
          showBrandingOnBookingPage,
          customSlug: slug || null,
          customDomain: isStudio ? (customDomain || null) : null,
        }),
      });
      if (!brandRes.ok) throw new Error((await brandRes.json()).error || 'Failed to save branding');

      const profileRes = await fetch('/api/instructor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: instructor?.name || '',
          phone: instructor?.phone || '',
          whatsapp: whatsapp || null,
          instagram: instagram || null,
          facebook: facebook || null,
          yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
        }),
      });
      if (!profileRes.ok) throw new Error('Failed to save social links');

      setMessage('All settings saved!');
      setBrandLogo(logoUrl);
      setLogoFile(null);
      setSavedSlug(slug);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 p-6"><p>Loading...</p></div>;

  const tier = instructor?.subscriptionTier;
  const isBasic = tier === 'BASIC';
  const isStudio = tier === 'STUDIO' || tier === 'BUSINESS';

  if (isBasic) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Sparkles className="h-16 w-16 text-purple-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade to PRO</h2>
            <p className="text-gray-600 mb-6">Custom branding is available for PRO and above.</p>
            <button onClick={() => router.push('/dashboard/subscription')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold">
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Palette className="h-8 w-8 text-purple-600" />
            Brand & Public Page
          </h1>
          <p className="text-gray-600 mt-1">Manage your booking page, domain, and social links</p>
        </div>

        {message && <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"><p className="text-green-800">{message}</p></div>}
        {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">{error}</p></div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">

            {/* ── Slug section (PRO+, always shown) ── */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-purple-600" />
                Your Booking URL
                <span className="ml-auto text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">PRO+</span>
              </h2>
              <p className="text-sm text-gray-500 mb-4">Share this link with students to book directly with you</p>

              {/* Default URL — shown when no slug set */}
              {instructor?.id && !savedSlug && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Your default booking URL (always active):</p>
                  <div className="flex items-center justify-between gap-2">
                    <a href={`https://${instructor.id}.drivebook.com.au`} target="_blank" rel="noopener noreferrer"
                      className="text-gray-600 text-xs hover:underline truncate font-mono">
                      {instructor.id}.drivebook.com.au
                    </a>
                    <button type="button" onClick={() => copyUrl(`https://${instructor.id}.drivebook.com.au`, 'default')}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300">
                      {copied === 'default' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Set a custom slug below to get a friendlier URL</p>
                </div>
              )}

              {savedSlug && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <a href={`https://${savedSlug}.drivebook.com.au`} target="_blank" rel="noopener noreferrer"
                    className="text-purple-700 font-semibold text-sm hover:underline truncate">
                    {savedSlug}.drivebook.com.au
                  </a>
                  <button type="button" onClick={() => copyUrl(`https://${savedSlug}.drivebook.com.au`, 'slug')}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700">
                    {copied === 'slug' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === 'slug' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Custom slug <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input type="text" value={slug} onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="yourname"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    maxLength={30} />
                  <span className="text-gray-500 text-sm whitespace-nowrap">.drivebook.com.au</span>
                </div>
                {checkingSlug && <p className="text-xs text-gray-500 mt-1">Checking...</p>}
                {slugAvailable === true && slug && slug !== savedSlug && (
                  <p className="text-xs text-green-600 mt-1">✓ {slug}.drivebook.com.au is available</p>
                )}
                {slugAvailable === false && slug && (
                  <p className="text-xs text-red-600 mt-1">✗ Already taken — try another</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens. Min 3 characters.</p>
              </div>

              {!isStudio && (
                <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs text-indigo-800 font-medium">Want your own domain?</p>
                  <p className="text-xs text-indigo-700 mt-0.5">Upgrade to Studio to use <span className="font-semibold">yourdomain.com.au</span></p>
                  <button onClick={() => router.push('/dashboard/subscription')}
                    className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline">
                    See Studio plan →
                  </button>
                </div>
              )}
            </div>

            {/* ── Custom Domain section (Studio+ only) ── */}
            {isStudio && (
              <CustomDomainWizard
                customDomain={customDomain}
                savedCustomDomain={savedCustomDomain}
                domainVerified={domainVerified}
                domainVerifiedAt={domainVerifiedAt}
                verifyingDomain={verifyingDomain}
                domainVerifyResult={domainVerifyResult}
                copied={copied}
                onDomainChange={(v) => { setCustomDomain(v); setDomainVerifyResult(null); }}
                onVerify={handleVerifyDomain}
                onCopy={() => copyUrl(`https://${savedCustomDomain}`, 'domain')}
              />
            )}

            {/* Social Links */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-600" />
                Social Links
              </h2>
              <p className="text-sm text-gray-500 mb-4">Shown on your public booking page</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp Number</span>
                  </label>
                  <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="61412345678 (with country code, no spaces)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instagram Handle</label>
                  <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)}
                    placeholder="yourhandle (without @)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Facebook</label>
                  <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)}
                    placeholder="username or full URL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Years of Experience</label>
                  <input type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="e.g. 5" min="0" max="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-600" />
                Logo Upload
              </h2>
              <input type="file" accept="image/*" onChange={handleLogoChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer" />
              <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG. Max 2MB. Recommended: 200×200px</p>
              {logoPreview && (
                <div className="mt-3 border-2 border-dashed border-gray-200 rounded-lg p-3 text-center">
                  <Image src={logoPreview} alt="Logo preview" width={80} height={80} className="mx-auto object-contain" />
                </div>
              )}
            </div>

            {/* Brand Colors */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-600" />
                Brand Colors
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColorPrimary} onChange={(e) => setBrandColorPrimary(e.target.value)}
                      className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer" />
                    <input type="text" value={brandColorPrimary} onChange={(e) => setBrandColorPrimary(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="#3B82F6" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColorSecondary} onChange={(e) => setBrandColorSecondary(e.target.value)}
                      className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer" />
                    <input type="text" value={brandColorSecondary} onChange={(e) => setBrandColorSecondary(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="#10B981" />
                  </div>
                </div>
              </div>
            </div>

            {/* Display toggle */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start space-x-3">
                <input type="checkbox" id="showBranding" checked={showBrandingOnBookingPage}
                  onChange={(e) => setShowBrandingOnBookingPage(e.target.checked)}
                  className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                <label htmlFor="showBranding" className="text-sm text-gray-700">
                  <span className="font-medium">Show logo & colors on booking page</span>
                  <p className="text-gray-500 mt-0.5 text-xs">White-labels your booking page with your brand</p>
                </label>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2">
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-purple-600" />
                Preview
              </h2>
              <div className="border-2 border-gray-200 rounded-lg p-5 space-y-4">
                {logoPreview && (
                  <div className="text-center">
                    <Image src={logoPreview} alt="Logo" width={80} height={80} className="mx-auto object-contain" />
                  </div>
                )}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{instructor?.name || 'Your Name'}</h3>
                  <p className="text-xs text-gray-500 mb-3">Professional driving instructor</p>
                  <button style={{ backgroundColor: brandColorPrimary }}
                    className="w-full py-2 px-4 rounded-lg text-white font-semibold text-sm mb-2">
                    Book Now
                  </button>
                  <div className="flex items-center gap-2">
                    <span style={{ backgroundColor: brandColorSecondary }}
                      className="px-2 py-0.5 rounded-full text-white text-xs">Available Today</span>
                    <span style={{ color: brandColorSecondary }} className="text-sm font-semibold">
                      ${instructor?.hourlyRate || '65'}/hr
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">Live preview of your booking page</p>
              </div>
            </div>

            {/* Active URLs summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-600" />
                Active URLs
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg p-2">
                  <div>
                    <p className="text-xs text-gray-500">Default</p>
                    <p className="font-mono text-xs text-gray-700 truncate">{instructor?.id}.drivebook.com.au</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Active</span>
                </div>
                {savedSlug && (
                  <div className="flex items-center justify-between gap-2 bg-purple-50 rounded-lg p-2">
                    <div>
                      <p className="text-xs text-gray-500">Slug</p>
                      <p className="font-mono text-xs text-purple-700 truncate">{savedSlug}.drivebook.com.au</p>
                    </div>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0">Active</span>
                  </div>
                )}
                {isStudio && savedCustomDomain && (
                  <div className="flex items-center justify-between gap-2 bg-indigo-50 rounded-lg p-2">
                    <div>
                      <p className="text-xs text-gray-500">Custom Domain</p>
                      <p className="font-mono text-xs text-indigo-700 truncate">{savedCustomDomain}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${domainVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {domainVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">Tips</h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• Square logo (200×200px) works best</li>
                <li>• Share your booking URL on social media</li>
                <li>• Add WhatsApp so students can message you directly</li>
                {isStudio
                  ? <li>• You can use both a slug and a custom domain simultaneously</li>
                  : <li>• Your slug is live immediately after saving</li>
                }
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Custom Domain Wizard (Studio tier) ────────────────────────────────────────
interface DomainWizardProps {
  customDomain: string;
  savedCustomDomain: string;
  domainVerified: boolean;
  domainVerifiedAt: string | null;
  verifyingDomain: boolean;
  domainVerifyResult: { verified: boolean; message?: string } | null;
  copied: string | null;
  onDomainChange: (v: string) => void;
  onVerify: () => void;
  onCopy: () => void;
}

function CustomDomainWizard({
  customDomain, savedCustomDomain, domainVerified, domainVerifiedAt,
  verifyingDomain, domainVerifyResult, copied,
  onDomainChange, onVerify, onCopy,
}: DomainWizardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
        <Globe className="h-5 w-5 text-indigo-600" />
        Custom Domain
        <span className="ml-auto text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Studio</span>
      </h2>
      <p className="text-sm text-gray-500 mb-4">Use your own domain for your booking page — works alongside your slug</p>

      {domainVerified && savedCustomDomain && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
            <a href={`https://${savedCustomDomain}`} target="_blank" rel="noopener noreferrer"
              className="text-green-800 font-semibold text-sm hover:underline truncate flex items-center gap-1">
              {savedCustomDomain}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
          <button type="button" onClick={onCopy}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700">
            {copied === 'domain' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'domain' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Your domain <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={customDomain}
          onChange={(e) => onDomainChange(e.target.value.toLowerCase().trim())}
          placeholder="bookings.yourdrivingschool.com.au"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Enter the full domain or subdomain you want to use</p>
      </div>

      {/* DNS instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-gray-700 mb-3">Step 1 — Add this DNS record at your registrar:</p>

        {customDomain ? (() => {
          const parts = customDomain.split('.');
          const twoPartTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au'];
          const tld2 = parts.slice(-2).join('.');
          const isCompoundTLD = twoPartTLDs.includes(tld2);
          const rootParts = isCompoundTLD ? 3 : 2;
          const isRootDomain = parts.length <= rootParts;
          const cnameLabel = isRootDomain ? '@' : parts.slice(0, parts.length - rootParts).join('.');

          return isRootDomain ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-600">
                <span className="font-mono font-semibold">{customDomain}</span> is a root domain. Root domains can't use a standard CNAME. Pick one option:
              </p>
              <details>
                <summary className="text-xs font-semibold text-indigo-700 cursor-pointer list-none flex items-center gap-1 select-none">
                  <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Option A</span>
                  ALIAS / ANAME record <span className="text-gray-400 font-normal">(if your registrar supports it)</span>
                </summary>
                <div className="mt-2 pl-2 border-l-2 border-indigo-200">
                  <table className="w-full text-xs font-mono mb-1">
                    <thead><tr className="text-gray-500 font-sans"><th className="text-left pr-3 pb-1">Type</th><th className="text-left pr-3 pb-1">Name</th><th className="text-left pb-1">Value</th></tr></thead>
                    <tbody><tr>
                      <td className="pr-3 text-gray-800">ALIAS or ANAME</td>
                      <td className="pr-3 text-gray-800">@ (root)</td>
                      <td className="text-indigo-700">cname.vercel-dns.com</td>
                    </tr></tbody>
                  </table>
                  <p className="text-xs text-gray-500">Supported by VentraIP, Cloudflare, and some others.</p>
                </div>
              </details>
              <details>
                <summary className="text-xs font-semibold text-indigo-700 cursor-pointer list-none flex items-center gap-1 select-none">
                  <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Option B</span>
                  Use Cloudflare DNS <span className="text-gray-400 font-normal">(free, recommended)</span>
                </summary>
                <div className="mt-2 pl-2 border-l-2 border-indigo-200 text-xs text-gray-600 space-y-1">
                  <p>1. Create a free Cloudflare account and add your domain</p>
                  <p>2. Update nameservers at your registrar to Cloudflare's</p>
                  <p>3. In Cloudflare DNS: <span className="font-mono">CNAME @ → cname.vercel-dns.com</span></p>
                </div>
              </details>
              <details>
                <summary className="text-xs font-semibold text-indigo-700 cursor-pointer list-none flex items-center gap-1 select-none">
                  <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Option C</span>
                  Use www instead <span className="text-gray-400 font-normal">(simplest)</span>
                </summary>
                <div className="mt-2 pl-2 border-l-2 border-indigo-200 text-xs text-gray-600 space-y-1">
                  <p>1. Add CNAME: <span className="font-mono">www → cname.vercel-dns.com</span></p>
                  <p>2. Set a URL redirect: <span className="font-mono">{customDomain}</span> → <span className="font-mono">www.{customDomain}</span></p>
                  <p>3. Enter <span className="font-mono">www.{customDomain}</span> in the domain field above</p>
                </div>
              </details>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead><tr className="text-gray-500 font-sans">
                  <th className="text-left pr-3 pb-1">Type</th>
                  <th className="text-left pr-3 pb-1">Name / Host</th>
                  <th className="text-left pb-1">Value / Points to</th>
                </tr></thead>
                <tbody><tr>
                  <td className="pr-3 text-gray-800">CNAME</td>
                  <td className="pr-3 text-indigo-800 font-semibold">{cnameLabel}</td>
                  <td className="text-indigo-700">cname.vercel-dns.com</td>
                </tr></tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">
                The "Name" or "Host" field is just <span className="font-mono font-semibold">{cnameLabel}</span> — not the full domain.
              </p>
            </div>
          );
        })() : (
          <p className="text-xs text-gray-400 italic">Enter your domain above to see the DNS record</p>
        )}

        <p className="text-xs text-gray-500 mt-3">DNS changes can take up to 24 hours to propagate.</p>
      </div>

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-700 mb-2">Step 2 — Verify your domain:</p>
        <button
          type="button"
          onClick={onVerify}
          disabled={verifyingDomain || !customDomain}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg text-sm font-semibold"
        >
          {verifyingDomain
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking DNS...</>
            : <><ShieldCheck className="h-4 w-4" /> Verify Domain</>
          }
        </button>
      </div>

      {domainVerifyResult && (
        <div className={`rounded-lg p-3 flex items-start gap-2 text-sm ${domainVerifyResult.verified ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          {domainVerifyResult.verified
            ? <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          }
          <div>
            {domainVerifyResult.verified
              ? <p className="text-green-800 font-medium">Domain verified! Your booking page is live at {savedCustomDomain}.</p>
              : <p className="text-amber-800">{domainVerifyResult.message || 'CNAME not found yet. Check your DNS settings and try again.'}</p>
            }
          </div>
        </div>
      )}

      {domainVerified && domainVerifiedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Verified {new Date(domainVerifiedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
