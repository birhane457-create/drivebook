'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { User, Mail, Phone, MapPin, Edit2, Save, X, CheckCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  address?: string;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div role="alert" className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-foreground w-[calc(100%-2rem)] max-w-md ${
      isSuccess ? 'bg-emerald-600' : 'bg-destructive'
    }`}>
      {isSuccess ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 text-foreground">✕</button>
    </div>
  );
}

export default function ClientProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [toast, setToast] = useState<ToastState>(null);

  // Change password state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwShow, setPwShow] = useState({ current: false, next: false, confirm: false });

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

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

  const handlePasswordChange = async () => {
    if (pwForm.next !== pwForm.confirm) { showToast('error', 'New passwords do not match'); return; }
    if (pwForm.next.length < 8) { showToast('error', 'New password must be at least 8 characters'); return; }
    try {
      setPwSaving(true);
      const res = await fetch('/api/client/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwForm({ current: '', next: '', confirm: '' });
        showToast('success', 'Password changed successfully');
      } else {
        showToast('error', data.error || 'Failed to change password');
      }
    } catch { showToast('error', 'An error occurred. Please try again.'); }
    finally { setPwSaving(false); }
  };

  const handleSave = async () => {
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
        showToast('success', 'Profile updated. Your information has been updated across all instructors.');
      } else {
        showToast('error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast('error', 'An error occurred while saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-1/3"></div>
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="h-5 bg-secondary rounded w-3/4"></div>
            <div className="h-5 bg-secondary rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Toast toast={toast} onClose={() => setToast(null)} />      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 transition text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-foreground rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setFormData({ name: profile?.name || '', phone: profile?.phone || '', address: profile?.address || '' });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/70 transition text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Profile Fields */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6">

          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Full Name
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
              />
            ) : (
              <p className="text-foreground">{profile?.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email Address
            </label>
            <p className="text-foreground">{profile?.email}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Phone Number
            </label>
            {editing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                placeholder="Enter phone number"
              />
            ) : (
              <p className="text-foreground">{profile?.phone || <span className="text-muted-foreground/60 italic">Not provided</span>}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Default Pickup Address
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                placeholder="Enter your default pickup address"
              />
            ) : (
              <p className="text-foreground">{profile?.address || <span className="text-muted-foreground/60 italic">Not provided</span>}</p>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="mt-4 bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Account Information</h2>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p><span className="text-foreground font-medium">Account Type:</span> Client</p>
            <p><span className="text-foreground font-medium">Email:</span> {session?.user?.email}</p>
          </div>
        </div>

        {/* Change Password */}
        <div className="mt-4 bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />Change Password
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Current password', key: 'current' as const },
              { label: 'New password', key: 'next' as const },
              { label: 'Confirm new password', key: 'confirm' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <div className="relative">
                  <input
                    type={pwShow[key] ? 'text' : 'password'}
                    value={pwForm[key]}
                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                    placeholder={label}
                  />
                  <button
                    type="button"
                    onClick={() => setPwShow(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {pwShow[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={handlePasswordChange}
              disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
              className="w-full py-2 px-4 bg-primary text-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {pwSaving ? 'Changing…' : 'Change Password'}
            </button>
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
