'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { User, Mail, Phone, MapPin, Edit2, Save, X } from 'lucide-react';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  address?: string;
}

export default function ClientProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setFormData({ name: data.user.name, phone: data.user.phone || '', address: data.user.address || '' });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        }),
      });

      if (res.ok) {
        await loadProfile();
        setEditing(false);
        alert('Profile updated successfully! This will update your information across all instructors.');
      } else {
        alert('Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('An error occurred while saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-1/3"></div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="h-5 bg-slate-800 rounded w-3/4"></div>
            <div className="h-5 bg-slate-800 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100">My Profile</h1>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setFormData({ name: profile?.name || '', phone: profile?.phone || '', address: profile?.address || '' });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Profile Fields */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6">

          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              Full Name
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
              />
            ) : (
              <p className="text-slate-100">{profile?.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
              <Mail className="w-4 h-4 text-slate-400" />
              Email Address
            </label>
            <p className="text-slate-100">{profile?.email}</p>
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
              <Phone className="w-4 h-4 text-slate-400" />
              Phone Number
            </label>
            {editing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                placeholder="Enter phone number"
              />
            ) : (
              <p className="text-slate-100">{profile?.phone || <span className="text-slate-500 italic">Not provided</span>}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              Default Pickup Address
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                placeholder="Enter your default pickup address"
              />
            ) : (
              <p className="text-slate-100">{profile?.address || <span className="text-slate-500 italic">Not provided</span>}</p>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Account Information</h2>
          <div className="space-y-1.5 text-sm text-slate-400">
            <p><span className="text-slate-300 font-medium">Account Type:</span> Client</p>
            <p><span className="text-slate-300 font-medium">Email:</span> {session?.user?.email}</p>
          </div>
        </div>

        {/* Important Notice */}
        <div className="mt-4 bg-amber-900/20 border border-amber-700/50 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-amber-300 mb-2">📝 Important Notice</h2>
          <p className="text-sm text-amber-300/80">
            Updating your profile will change your name and phone number across all instructors you&apos;ve booked with.
            This ensures consistency in your account information.
          </p>
        </div>

      </div>
    </div>
  );
}
