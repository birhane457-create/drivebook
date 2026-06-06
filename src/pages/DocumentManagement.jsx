import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, Search, Filter, Eye, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_ICONS = { purchase_order: '🛒', invoice: '💰', delivery_note: '🚚', contract: '📝', product_certificate: '🏆', quality_document: '✅', other: '📄' };
const STATUS_COLORS = { draft: 'secondary', review: 'default', approved: 'secondary', rejected: 'destructive', archived: 'outline' };
const EMPTY = { title: '', type: 'other', version: '1.0', tags: [], notes: '' };

export default function DocumentManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const { data: docs = [], isLoading } = useQuery({ queryKey: ['documents'], queryFn: () => base44.entities.Document.list('-created_date') });

  const createMut = useMutation({
    mutationFn: d => base44.entities.Document.create(d),
    onSuccess: () => { qc.invalidateQueries(['documents']); setOpen(false); setForm(EMPTY); setFile(null); toast.success('Document uploaded'); },
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Document.update(id, { status, approved_by: 'Current User' }),
    onSuccess: () => qc.invalidateQueries(['documents']),
  });

  const handleUpload = async () => {
    if (!form.title) { toast.error('Please add a title'); return; }
    setUploading(true);
    let file_url = '';
    if (file) {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file });
      file_url = url;
    }
    createMut.mutate({ ...form, file_url, file_name: file?.name || '', file_size_kb: file ? Math.round(file.size / 1024) : 0, status: 'draft', uploaded_by: 'Current User' });
    setUploading(false);
  };

  const filtered = docs.filter(d =>
    (filterType === 'all' || d.type === filterType) &&
    (d.title?.toLowerCase().includes(search.toLowerCase()) || d.file_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6">
      <PageHeader title="Document Management" subtitle="Store, version, approve & manage POs, invoices, contracts, certificates & quality docs">
        <Button onClick={() => setOpen(true)}><Upload className="w-4 h-4 mr-2" /> Upload Document</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Documents', value: docs.length },
          { label: 'Approved', value: docs.filter(d => d.status === 'approved').length },
          { label: 'Pending Review', value: docs.filter(d => d.status === 'review').length },
          { label: 'Expiring Soon', value: docs.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_ICONS).map(([k, v]) => <SelectItem key={k} value={k}>{v} {k.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No documents found.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl flex-shrink-0">{TYPE_ICONS[doc.type] || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.file_name || 'No file'} {doc.file_size_kb ? `· ${doc.file_size_kb}KB` : ''}</p>
                    <p className="text-xs text-muted-foreground">v{doc.version} · {doc.type.replace('_', ' ')}</p>
                  </div>
                  <Badge variant={STATUS_COLORS[doc.status] || 'outline'} className="flex-shrink-0">{doc.status}</Badge>
                </div>
                {doc.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">{doc.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                )}
                {doc.expiry_date && <p className="text-xs text-muted-foreground">Expires: {doc.expiry_date}</p>}
                <div className="flex gap-2 mt-3">
                  {doc.file_url && <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(doc.file_url, '_blank')}><Eye className="w-3 h-3 mr-1" /> View</Button>}
                  {doc.status === 'review' && (
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveMut.mutate({ id: doc.id, status: 'approved' })}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  )}
                  {doc.status === 'draft' && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => approveMut.mutate({ id: doc.id, status: 'review' })}>Submit for Review</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_ICONS).map(([k, v]) => <SelectItem key={k} value={k}>{v} {k.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Version</Label><Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" /></div>
            </div>
            <div><Label>File</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/40" onClick={() => document.getElementById('doc-file').click()}>
                {file ? <p className="text-sm font-medium">{file.name} ({Math.round(file.size / 1024)}KB)</p> : <><Upload className="w-8 h-8 mx-auto mb-1 text-muted-foreground" /><p className="text-sm text-muted-foreground">Click to upload PDF, image or document</p></>}
                <input id="doc-file" type="file" className="hidden" onChange={e => setFile(e.target.files[0])} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
              </div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Document'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}