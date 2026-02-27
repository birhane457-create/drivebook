'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Palette, Upload, Eye, Save, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function BrandingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [instructor, setInstructor] = useState<any>(null);
  const [brandLogo, setBrandLogo] = useState('');
  const [brandColorPrimary, setBrandColorPrimary] = useState('#3B82F6'); // Blue
  const [brandColorSecondary, setBrandColorSecondary] = useState('#10B981'); // Green
  const [showBrandingOnBookingPage, setShowBrandingOnBookingPage] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  useEffect(() => {
    fetchInstructorData();
  }, []);

  const fetchInstructorData = async () => {
    try {
      const res = await fetch('/api/instructor/profile');
      if (res.ok) {
        const data = await res.json();
        setInstructor(data);
        
        // Load existing branding settings
        setBrandLogo(data.brandLogo || '');
        setBrandColorPrimary(data.brandColorPrimary || '#3B82F6');
        setBrandColorSecondary(data.brandColorSecondary || '#10B981');
        setShowBrandingOnBookingPage(data.showBrandingOnBookingPage || false);
        setLogoPreview(data.brandLogo || '');
        setSubdomain(data.customDomain || '');
      }
    } catch (err) {
      console.error('Failed to fetch instructor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo must be less than 2MB');
        return;
      }

      setLogoFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkSubdomainAvailability = async (value: string) => {
    if (!value || value.length < 3) {
      setSubdomainAvailable(null);
      return;
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(value)) {
      setSubdomainAvailable(false);
      return;
    }

    setCheckingSubdomain(true);
    try {
      const res = await fetch(`/api/instructor/subdomain/check?subdomain=${value}`);
      const data = await res.json();
      setSubdomainAvailable(data.available);
    } catch (err) {
      console.error('Failed to check subdomain:', err);
      setSubdomainAvailable(null);
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const handleSubdomainChange = (value: string) => {
    // Convert to lowercase and remove invalid characters
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
    
    // Debounce check
    if (cleaned !== instructor?.customSubdomain) {
      setTimeout(() => checkSubdomainAvailability(cleaned), 500);
    } else {
      setSubdomainAvailable(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      let logoUrl = brandLogo;

      // Upload logo if new file selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        formData.append('folder', 'brand-logos');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload logo');
        }

        const uploadData = await uploadRes.json();
        logoUrl = uploadData.url;
      }

      // Save branding settings
      const res = await fetch('/api/instructor/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandLogo: logoUrl,
          brandColorPrimary,
          brandColorSecondary,
          showBrandingOnBookingPage,
          customDomain: subdomain || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save branding');
      }

      setMessage('Branding settings saved successfully!');
      setBrandLogo(logoUrl);
      setLogoFile(null);
      
      // Refresh instructor data
      await fetchInstructorData();
    } catch (err: any) {
      setError(err.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p>Loading branding settings...</p>
      </div>
    );
  }

  // Check if PRO or BUSINESS tier (regardless of subscription status - TRIAL, ACTIVE, etc.)
  const isPro = instructor?.subscriptionTier === 'PRO' || instructor?.subscriptionTier === 'BUSINESS';
  const isBasic = instructor?.subscriptionTier === 'BASIC';

  if (isBasic) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Sparkles className="h-16 w-16 text-purple-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade to PRO</h2>
            <p className="text-gray-600 mb-6">
              Custom branding is available for PRO and BUSINESS tier subscribers.
            </p>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Palette className="h-8 w-8 text-purple-600" />
            Brand Settings
          </h1>
          <p className="text-gray-600 mt-1">
            Customize your booking page with your logo and brand colors
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="space-y-6">
            {/* Logo Upload */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-600" />
                Logo Upload
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Your Logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-purple-50 file:text-purple-700
                      hover:file:bg-purple-100
                      cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG or SVG. Max 2MB. Recommended: 200x200px
                  </p>
                </div>

                {logoPreview && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      width={120}
                      height={120}
                      className="mx-auto object-contain"
                    />
                    <p className="text-xs text-gray-500 mt-2">Logo Preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Brand Colors */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-600" />
                Brand Colors
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandColorPrimary}
                      onChange={(e) => setBrandColorPrimary(e.target.value)}
                      className="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandColorPrimary}
                      onChange={(e) => setBrandColorPrimary(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="#3B82F6"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Used for buttons and primary elements
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandColorSecondary}
                      onChange={(e) => setBrandColorSecondary(e.target.value)}
                      className="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandColorSecondary}
                      onChange={(e) => setBrandColorSecondary(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="#10B981"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Used for accents and highlights
                  </p>
                </div>
              </div>
            </div>

            {/* Display Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Custom Subdomain
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Booking URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => handleSubdomainChange(e.target.value)}
                      placeholder="john"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={30}
                    />
                    <span className="text-gray-600 whitespace-nowrap">.drivebook.com</span>
                  </div>
                  
                  {checkingSubdomain && (
                    <p className="text-sm text-gray-500 mt-1">Checking availability...</p>
                  )}
                  
                  {subdomainAvailable === true && subdomain && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <span>✓</span> {subdomain}.drivebook.com is available!
                    </p>
                  )}
                  
                  {subdomainAvailable === false && subdomain && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <span>✗</span> {subdomain}.drivebook.com is already taken
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    Use lowercase letters, numbers, and hyphens only. Min 3 characters.
                  </p>
                </div>

                {subdomain && subdomainAvailable === true && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Your booking page will be:</span><br />
                      <a 
                        href={`https://${subdomain}.drivebook.com`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {subdomain}.drivebook.com
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Display Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Display Settings
              </h2>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="showBranding"
                  checked={showBrandingOnBookingPage}
                  onChange={(e) => setShowBrandingOnBookingPage(e.target.checked)}
                  className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="showBranding" className="text-sm text-gray-700">
                  <span className="font-medium">Show branding on booking page</span>
                  <p className="text-gray-500 mt-1">
                    Display your logo and brand colors on your public booking page
                  </p>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Branding Settings'}
            </button>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-purple-600" />
                Preview
              </h2>

              <div className="border-2 border-gray-200 rounded-lg p-6 space-y-6">
                {/* Logo Preview */}
                {logoPreview && (
                  <div className="text-center">
                    <Image
                      src={logoPreview}
                      alt="Logo"
                      width={100}
                      height={100}
                      className="mx-auto object-contain"
                    />
                  </div>
                )}

                {/* Sample Booking Card */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {instructor?.name || 'Your Name'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Professional driving instructor
                  </p>

                  {/* Primary Color Button */}
                  <button
                    style={{ backgroundColor: brandColorPrimary }}
                    className="w-full py-2 px-4 rounded-lg text-white font-semibold mb-2"
                  >
                    Book Now
                  </button>

                  {/* Secondary Color Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: brandColorSecondary }}
                      className="px-3 py-1 rounded-full text-white text-xs font-medium"
                    >
                      Available Today
                    </span>
                    <span
                      style={{ color: brandColorSecondary }}
                      className="text-sm font-semibold"
                    >
                      ${instructor?.hourlyRate || '65'}/hour
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    💡 This is how your branding will appear on your booking page
                  </p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">
                🎨 Branding Tips
              </h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• Use a square logo (200x200px) for best results</li>
                <li>• Choose colors that match your business identity</li>
                <li>• Ensure good contrast for readability</li>
                <li>• Test on mobile devices after saving</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
