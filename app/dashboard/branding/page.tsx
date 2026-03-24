'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Upload, Eye, Save, Sparkles, Link2, Copy, Check, MessageCircle, Instagram, Facebook, Globe } from 'lucide-react';
import Image from 'next/image';

export default function BrandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [instructor, setInstructor] = useState<any>(null);
  const [brandLogo, setBrandLogo] = useState('');
  const [brandColorPrimary, setBrandColorPrimary] = useState('#3B82F6');
  const [brandColorSecondary, setBrandColorSecondary] = useState('#10B981');
  const [showBrandingOnBookingPage, setShowBrandingOnBookingPage] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Subdomain
  const [subdomain, setSubdomain] = useState('');
  const [savedSubdomain, setSavedSubdomain] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  // Social links
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');

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
        setSubdomain(d.customDomain || '');
        setSavedSubdomain(d.customDomain || '');
        setInstructor((prev: any) => ({ ...prev, subscriptionTier: d.subscriptionTier }));
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
    setShowBrandingOnBookingPage(true); // auto-enable when logo is uploaded
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const checkSubdomainAvailability = async (value: string) => {
    if (!value || value.length < 3) { setSubdomainAvailable(null); return; }
    if (!/^[a-z0-9-]+$/.test(value)) { setSubdomainAvailable(false); return; }
    setCheckingSubdomain(true);
    try {
      const res = await fetch(`/api/instructor/subdomain/check?subdomain=${value}`);
      const data = await res.json();
      setSubdomainAvailable(data.available);
    } catch { setSubdomainAvailable(null); }
    finally { setCheckingSubdomain(false); }
  };

  const handleSubdomainChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
    if (cleaned !== savedSubdomain) {
      setTimeout(() => checkSubdomainAvailability(cleaned), 500);
    } else {
      setSubdomainAvailable(null);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${savedSubdomain}.drivebook.com.au`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      // Save branding + subdomain
      const brandRes = await fetch('/api/instructor/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandLogo: logoUrl, brandColorPrimary, brandColorSecondary, showBrandingOnBookingPage, customDomain: subdomain || null }),
      });
      if (!brandRes.ok) throw new Error((await brandRes.json()).error || 'Failed to save branding');

      // Save social links via profile API
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
      setSavedSubdomain(subdomain);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 p-6"><p>Loading...</p></div>;

  const isPro = instructor?.subscriptionTier === 'PRO' || instructor?.subscriptionTier === 'BUSINESS';
  const isBasic = instructor?.subscriptionTier === 'BASIC';

  if (isBasic) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Sparkles className="h-16 w-16 text-purple-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade to PRO</h2>
            <p className="text-gray-600 mb-6">Custom branding is available for PRO and BUSINESS subscribers.</p>
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
          <p className="text-gray-600 mt-1">Manage your booking page, subdomain, and social links</p>
        </div>

        {message && <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"><p className="text-green-800">{message}</p></div>}
        {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">{error}</p></div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">

            {/* Subdomain — top of the list */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-purple-600" />
                Your Booking URL
              </h2>
              <p className="text-sm text-gray-500 mb-4">Share this link with students to book directly with you</p>

              {/* Live URL display if already saved */}
              {savedSubdomain && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <a
                    href={`https://${savedSubdomain}.drivebook.com.au`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-700 font-semibold text-sm hover:underline truncate"
                  >
                    {savedSubdomain}.drivebook.com.au
                  </a>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  placeholder="yourname"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  maxLength={30}
                />
                <span className="text-gray-500 text-sm whitespace-nowrap">.drivebook.com.au</span>
              </div>

              {checkingSubdomain && <p className="text-xs text-gray-500 mt-1">Checking...</p>}
              {subdomainAvailable === true && subdomain && subdomain !== savedSubdomain && (
                <p className="text-xs text-green-600 mt-1">✓ {subdomain}.drivebook.com.au is available</p>
              )}
              {subdomainAvailable === false && subdomain && (
                <p className="text-xs text-red-600 mt-1">✗ Already taken — try another</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens. Min 3 characters.</p>
            </div>

            {/* Social Links */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-600" />
                Social Links
              </h2>
              <p className="text-sm text-gray-500 mb-4">Shown on your public booking page</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp Number
                  </label>
                  <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="61412345678 (with country code, no spaces)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Instagram className="h-3.5 w-3.5 text-pink-600" /> Instagram Handle
                  </label>
                  <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)}
                    placeholder="yourhandle (without @)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Facebook className="h-3.5 w-3.5 text-blue-600" /> Facebook
                  </label>
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
              <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG. Max 2MB. Recommended: 200x200px</p>
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
                  <p className="text-gray-500 mt-0.5 text-xs">PRO/BUSINESS feature — white-labels your page</p>
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

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">Tips</h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• Square logo (200×200px) works best</li>
                <li>• Share your booking URL on social media</li>
                <li>• Add WhatsApp so students can message you directly</li>
                <li>• Your subdomain is live immediately after saving</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
