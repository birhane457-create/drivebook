'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, X, Save, MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

interface TestCentre {
  id: string;
  name: string;
  address: string;
  suburb: string;
  state: string;
  region: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
}

const EMPTY_FORM = { name: '', address: '', suburb: '', state: 'WA', region: '', lat: '', lng: '' };

export default function AdminTestCentresPage() {
  const [centres, setCentres] = useState<TestCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchCentres(); }, []);

  const fetchCentres = async () => {
    try {
      const res = await fetch('/api/admin/test-centres');
      if (res.ok) setCentres(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      address: form.address,
      suburb: form.suburb,
      state: form.state,
      region: form.region || undefined,
      lat: form.lat ? parseFloat(form.lat) : undefined,
      lng: form.lng ? parseFloat(form.lng) : undefined,
    };
    try {
      const res = editingId
        ? await fetch(`/api/admin/test-centres/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/test-centres', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save.'); return; }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
      fetchCentres();
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleEdit = (c: TestCentre) => {
    setEditingId(c.id);
    setForm({ name: c.name, address: c.address, suburb: c.suburb, state: c.state, region: c.region || '', lat: c.lat?.toString() || '', lng: c.lng?.toString() || '' });
    setShowForm(true);
  };

  const handleToggleActive = async (c: TestCentre) => {
    await fetch(`/api/admin/test-centres/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !c.isActive }) });
    fetchCentres();
  };

  const grouped = centres.reduce<Record<string, TestCentre[]>>((acc, c) => {
    const r = c.region || 'Other';
    if (!acc[r]) acc[r] = [];
    acc[r].push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Test Centres</h1>
            <p className="text-sm text-slate-500 mt-1">{centres.filter(c => c.isActive).length} active · {centres.length} total</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Centre'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
            <h2 className="font-semibold text-slate-100 mb-4">{editingId ? 'Edit Centre' : 'Add New Centre'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Midland DVS" className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Region</label>
                  <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                    placeholder="e.g. Perth Metro East" className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                  <input required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. 1 Great Eastern Highway" className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Suburb</label>
                  <input required value={form.suburb} onChange={e => setForm(f => ({ ...f, suburb: e.target.value }))}
                    placeholder="e.g. Midland" className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Latitude (optional)</label>
                  <input type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                    placeholder="-31.8921" className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Longitude (optional)</label>
                  <input type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                    placeholder="116.0053" className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-2.5 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? 'Save Changes' : 'Add Centre'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([region, regionCentres]) => (
              <div key={region}>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">{region}</h2>
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="divide-y divide-slate-800">
                    {regionCentres.map(c => (
                      <div key={c.id} className={`flex items-center justify-between px-5 py-3 ${!c.isActive ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-slate-100 text-sm">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.address}, {c.suburb} {c.state}</p>
                            {c.lat && c.lng && (
                              <p className="text-xs text-slate-500">{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => handleToggleActive(c)}
                            className={`p-1.5 rounded-lg transition ${c.isActive ? 'text-green-600 hover:bg-green-900/20' : 'text-slate-500 hover:bg-slate-800'}`}
                            title={c.isActive ? 'Deactivate' : 'Activate'}>
                            {c.isActive ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </button>
                          <button onClick={() => handleEdit(c)} className="p-1.5 hover:bg-blue-900/20 rounded-lg text-blue-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
