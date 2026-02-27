'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Package, TrendingUp, AlertCircle, Save } from 'lucide-react';

interface PricingSettings {
  platformFeePercentage: number;
  package6Discount: number;
  package10Discount: number;
  package15Discount: number;
  basicCommissionRate: number;
  proCommissionRate: number;
  businessCommissionRate: number;
  basicNewStudentBonus: number;
  proNewStudentBonus: number;
  businessNewStudentBonus: number;
  drivingTestPackagePrice: number;
  discountPaidBy: 'platform' | 'shared' | 'instructor';
}

interface PricingSettingsFormProps {
  platform: {
    id: string;
    settings?: any;
  };
}

export default function PricingSettingsForm({ platform }: PricingSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Parse existing settings or use defaults
  const existingSettings = platform.settings?.pricing || {};
  
  const [settings, setSettings] = useState<PricingSettings>({
    platformFeePercentage: existingSettings.platformFeePercentage || 3.6,
    package6Discount: existingSettings.package6Discount || 5,
    package10Discount: existingSettings.package10Discount || 10,
    package15Discount: existingSettings.package15Discount || 12,
    basicCommissionRate: existingSettings.basicCommissionRate || 15,
    proCommissionRate: existingSettings.proCommissionRate || 12,
    businessCommissionRate: existingSettings.businessCommissionRate || 10,
    basicNewStudentBonus: existingSettings.basicNewStudentBonus || 8,
    proNewStudentBonus: existingSettings.proNewStudentBonus || 10,
    businessNewStudentBonus: existingSettings.businessNewStudentBonus || 12,
    drivingTestPackagePrice: existingSettings.drivingTestPackagePrice || 225,
    discountPaidBy: existingSettings.discountPaidBy || 'shared'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        alert('Pricing settings updated successfully!');
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  // Calculate revenue impact preview
  const calculatePreview = () => {
    const hourlyRate = 75; // Example rate
    const hours = 10;
    const subtotal = hourlyRate * hours; // $750
    const discount = (subtotal * settings.package10Discount) / 100;
    const afterDiscount = subtotal - discount;
    const platformFee = (afterDiscount * settings.platformFeePercentage) / 100;
    const total = afterDiscount + platformFee;
    
    // Commission calculation
    const instructorAmount = afterDiscount;
    const commission = (instructorAmount * settings.proCommissionRate) / 100;
    const newStudentBonus = (instructorAmount * settings.proNewStudentBonus) / 100;
    const totalPlatformRevenue = platformFee + commission + newStudentBonus;
    const instructorPayout = instructorAmount - commission - newStudentBonus;

    return {
      subtotal,
      discount,
      afterDiscount,
      platformFee,
      total,
      commission,
      newStudentBonus,
      totalPlatformRevenue,
      instructorPayout
    };
  };

  const preview = calculatePreview();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Platform Fee Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-blue-600" />
          Platform Fee
        </h2>
        
        <div className="max-w-md">
          <label className="block text-sm font-medium mb-2">
            Platform Processing Fee (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={settings.platformFeePercentage}
            onChange={(e) => setSettings({ ...settings, platformFeePercentage: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-sm text-gray-600 mt-1">
            Fee charged to clients on top of booking amount. Current: {settings.platformFeePercentage}%
          </p>
        </div>
      </div>

      {/* Package Discounts */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Package className="h-6 w-6 text-green-600" />
          Package Discounts
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              6 Hour Package Discount (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="20"
              value={settings.package6Discount}
              onChange={(e) => setSettings({ ...settings, package6Discount: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              10 Hour Package Discount (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="20"
              value={settings.package10Discount}
              onChange={(e) => setSettings({ ...settings, package10Discount: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              15 Hour Package Discount (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="20"
              value={settings.package15Discount}
              onChange={(e) => setSettings({ ...settings, package15Discount: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">
            Who Pays for Discounts?
          </label>
          <select
            value={settings.discountPaidBy}
            onChange={(e) => setSettings({ ...settings, discountPaidBy: e.target.value as any })}
            className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          >
            <option value="platform">Platform absorbs discount (marketing investment)</option>
            <option value="shared">Shared between client savings and instructor revenue</option>
            <option value="instructor">Instructor absorbs discount (lower payout)</option>
          </select>
          <p className="text-sm text-gray-600 mt-1">
            {settings.discountPaidBy === 'platform' && 'Platform takes lower commission to cover discount'}
            {settings.discountPaidBy === 'shared' && 'Client saves money, instructor gets slightly less'}
            {settings.discountPaidBy === 'instructor' && 'Client saves full amount, instructor revenue reduced'}
          </p>
        </div>
      </div>

      {/* Commission Rates by Tier */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-purple-600" />
          Commission Rates by Subscription Tier
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Basic Tier */}
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3 text-gray-900">BASIC Tier</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={settings.basicCommissionRate}
                  onChange={(e) => setSettings({ ...settings, basicCommissionRate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Student Bonus (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={settings.basicNewStudentBonus}
                  onChange={(e) => setSettings({ ...settings, basicNewStudentBonus: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <h3 className="font-bold text-lg mb-3 text-blue-900">PRO Tier</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={settings.proCommissionRate}
                  onChange={(e) => setSettings({ ...settings, proCommissionRate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Student Bonus (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={settings.proNewStudentBonus}
                  onChange={(e) => setSettings({ ...settings, proNewStudentBonus: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Business Tier */}
          <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <h3 className="font-bold text-lg mb-3 text-purple-900">BUSINESS Tier</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={settings.businessCommissionRate}
                  onChange={(e) => setSettings({ ...settings, businessCommissionRate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Student Bonus (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={settings.businessNewStudentBonus}
                  onChange={(e) => setSettings({ ...settings, businessNewStudentBonus: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Driving Test Package */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Driving Test Package Price</h2>
        
        <div className="max-w-md">
          <label className="block text-sm font-medium mb-2">
            Test Package Price ($)
          </label>
          <input
            type="number"
            step="5"
            min="0"
            max="500"
            value={settings.drivingTestPackagePrice}
            onChange={(e) => setSettings({ ...settings, drivingTestPackagePrice: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-sm text-gray-600 mt-1">
            Includes: vehicle, pickup/dropoff, 45min warm-up lesson
          </p>
        </div>
      </div>

      {/* Revenue Impact Preview */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-blue-600" />
            Revenue Impact Preview
          </h2>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
        </div>

        {showPreview && (
          <div className="bg-white rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-600 mb-3">
              Example: 10-hour package at $75/hr with PRO tier instructor (first booking)
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-gray-900">Client Pays:</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal (10hrs × $75):</span>
                    <span className="font-medium">${preview.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({settings.package10Discount}%):</span>
                    <span className="font-medium">-${preview.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>After discount:</span>
                    <span className="font-medium">${preview.afterDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Platform fee ({settings.platformFeePercentage}%):</span>
                    <span className="font-medium">${preview.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-blue-600">${preview.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-gray-900">Revenue Split:</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Platform fee (from client):</span>
                    <span className="font-medium">${preview.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission ({settings.proCommissionRate}%):</span>
                    <span className="font-medium">${preview.commission.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New student bonus ({settings.proNewStudentBonus}%):</span>
                    <span className="font-medium">${preview.newStudentBonus.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold text-green-600">
                    <span>Platform Revenue:</span>
                    <span>${preview.totalPlatformRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold text-purple-600">
                    <span>Instructor Payout:</span>
                    <span>${preview.instructorPayout.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Platform makes ${preview.totalPlatformRevenue.toFixed(2)} per booking 
                ({((preview.totalPlatformRevenue / preview.total) * 100).toFixed(1)}% of total). 
                Instructor receives ${preview.instructorPayout.toFixed(2)} 
                ({((preview.instructorPayout / preview.afterDiscount) * 100).toFixed(1)}% of discounted amount).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="h-5 w-5" />
          {loading ? 'Saving...' : 'Save Pricing Settings'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Warning:</strong> Changes will affect all new bookings immediately. Existing bookings will not be affected.
        </p>
      </div>
    </form>
  );
}
