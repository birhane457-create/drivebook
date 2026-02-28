'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { User, Mail, Phone, Edit2, Save, X } from 'lucide-react';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
}

export default function ClientProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });

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
        setFormData({ name: data.user.name, phone: data.user.phone || '' });
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
        body: JSON.stringify(formData),
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setFormData({ name: profile?.name || '', phone: profile?.phone || '' });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <User className="w-4 h-4" />
            Full Name
          </label>
          {editing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="text-lg text-gray-900">{profile?.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Mail className="w-4 h-4" />
            Email Address
          </label>
          <p className="text-lg text-gray-900">{profile?.email}</p>
          <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
        </div>

        {/* Phone */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Phone className="w-4 h-4" />
            Phone Number
          </label>
          {editing ? (
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter phone number"
            />
          ) : (
            <p className="text-lg text-gray-900">{profile?.phone || 'Not provided'}</p>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-semibold">Account Type:</span> Client</p>
          <p><span className="font-semibold">Email:</span> {session?.user?.email}</p>
        </div>
      </div>

      {/* Important Notice */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-amber-900 mb-2">📝 Important Notice</h2>
        <p className="text-sm text-amber-800">
          Updating your profile will change your name and phone number across all instructors you've booked with. 
          This ensures consistency in your account information.
        </p>
      </div>
    </div>
  );
}
