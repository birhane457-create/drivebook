import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Loader2, ArrowRight, Database, Plus, RotateCcw, Eye, Table
} from 'lucide-react';

const ENTITIES = ['Product', 'Customer', 'Supplier', 'StockLevel', 'PurchaseOrder', 'Sale', 'Location', 'Asset', 'BillOfMaterials'];

const SOURCE_ICONS = {
  csv: '📄', excel: '📊', json: '📋', legacy_erp: '🏭', legacy_wms: '📦', api: '🔌',
};

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'bg-gray-100 text-gray-700',   icon: RefreshCw },
  mapping:     { label: 'Mapping',     cls: 'bg-blue-100 text-blue-700',   icon: Table },
  validating:  { label: 'Validating',  cls: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  running:     { label: 'Running',     cls: 'bg-purple-100 text-purple-700', icon: Loader2 },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed:      { label: 'Failed',      cls: 'bg-red-100 text-red-700',     icon: XCircle },
  rolled_back: { label: 'Rolled Back', cls: 'bg-orange-100 text-orange-700', icon: RotateCcw },
};

const SAMPLE_JOBS = [
  {
    id: 'j1', name: 'Products Import Q1', source_type: 'excel', target_entity: 'Product',
    status: 'completed', total_rows: 1240, processed_rows: 1240, success_rows: 1238, error_rows: 2,
    started_at: '2026-05-20T09:00:00Z', completed_at: '2026-05-20T09:04:12Z', rollback_available: true,
    errors: [{ row: 412, field: 'selling_price', message: 'Value is not a valid number' }, { row: 890, field: 'sku', message: 'Duplicate SKU found: SKU-9981' }]
  },
  {
    id: 'j2', name: 'Customer Data Migration', source_type: 'csv', target_entity: 'Customer',
    status: 'completed', total_rows: 3420, processed_rows: 3420, success_rows: 3420, error_rows: 0,
    started_at: '2026-05-18T14:00:00Z', completed_at: '2026-05-18T14:08:22Z', rollback_available: true,
    errors: []
  },
  {
    id: 'j3', name: 'Legacy WMS Inventory', source_type: 'legacy_wms', target_entity: 'StockLevel',
    status: 'failed', total_rows: 5800, processed_rows: 1240, success_rows: 980, error_rows: 260,
    started_at: '2026-06-01T08:00:00Z', completed_at: '2026-06-01T08:12:00Z', rollback_available: false,
    errors: [{ row: 128, field: 'location_id', message: 'Location not found: WH-OLD-03' }]
  },
  {
    id: 'j4', name: 'Supplier List Import', source_type: 'csv', target_entity: 'Supplier',
    status: 'running', total_rows: 340, processed_rows: 180, success_rows: 178, error_rows: 2,
    started_at: '2026-06-07T10:00:00Z', rollback_available: false,
    errors: []
  },
];

function JobCard({ job, onView, onRollback }) {
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const pct = job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;
  const successRate = job.processed_rows > 0 ? Math.round((job.success_rows / job.processed_rows) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{SOURCE_ICONS[job.source_type]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{job.name}</span>
              <Badge className={`text-[10px] gap-1 ${cfg.cls}`}>
                <Icon className={`w-2.5 h-2.5 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                {cfg.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{job.target_entity}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-muted-foreground">Total: </span><strong>{job.total_rows?.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Success: </span><strong className="text-green-600">{job.success_rows?.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Errors: </span><strong className={job.error_rows > 0 ? 'text-red-600' : ''}>{job.error_rows}</strong></div>
            </div>
            {job.status === 'running' && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Processing…</span><span>{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            )}
            {job.status === 'completed' && (
              <div className="mt-1">
                <Progress value={successRate} className="h-1.5" />
                <span className="text-[10px] text-muted-foreground">{successRate}% success rate</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onView(job)}>
              <Eye className="w-3 h-3" /> Details
            </Button>
            {job.rollback_available && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-orange-600" onClick={() => onRollback(job)}>
                <RotateCcw className="w-3 h-3" /> Rollback
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DataMigration() {
  const [showNew, setShowNew] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ name: '', source_type: 'csv', target_entity: 'Product' });
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const qc = useQueryClient();

  const { data: dbJobs = [] } = useQuery({
    queryKey: ['migration-jobs'],
    queryFn: () => base44.entities.DataMigrationJob.list('-created_date', 50),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.DataMigrationJob.create({ ...d, status: 'pending' }),
    onSuccess: () => { qc.invalidateQueries(['migration-jobs']); setShowNew(false); setUploadedFile(null); setPreview(null); },
  });

  const rollbackMut = useMutation({
    mutationFn: (job) => base44.entities.DataMigrationJob.update(job.id, { status: 'rolled_back', rollback_available: false }),
    onSuccess: () => qc.invalidateQueries(['migration-jobs']),
  });

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadedFile({ name: file.name, url: file_url });

    // Try to extract a preview
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: { type: 'object', properties: { rows: { type: 'array', items: { type: 'object', additionalProperties: true } } } }
    });
    if (result.status === 'success') {
      setPreview(result.output?.rows?.slice(0, 3) || []);
    }
    setUploading(false);
  }

  const allJobs = [...SAMPLE_JOBS, ...dbJobs];

  const stats = {
    total: allJobs.length,
    completed: allJobs.filter(j => j.status === 'completed').length,
    running: allJobs.filter(j => j.status === 'running').length,
    failed: allJobs.filter(j => j.status === 'failed').length,
    totalRows: allJobs.reduce((s, j) => s + (j.success_rows || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Data Migration Center" subtitle="CSV · Excel · Legacy ERP/WMS · Field mapping · Validation · Rollback">
        <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" /> New Migration Job
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Jobs', value: stats.total, color: 'text-foreground' },
          { label: 'Completed', value: stats.completed, color: 'text-green-600' },
          { label: 'Running', value: stats.running, color: 'text-purple-600' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600' },
          { label: 'Records Migrated', value: stats.totalRows.toLocaleString(), color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Migration Jobs</TabsTrigger>
          <TabsTrigger value="templates">Import Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-3">
          {allJobs.map((job, i) => (
            <JobCard
              key={job.id || i}
              job={job}
              onView={setViewing}
              onRollback={(j) => j.id && !j.id.startsWith('j') && rollbackMut.mutate(j)}
            />
          ))}
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { entity: 'Product', fields: ['name','sku','selling_price','unit_cost','category','reorder_level'], description: 'Import your product catalog' },
              { entity: 'Customer', fields: ['name','email','phone','address','loyalty_points'], description: 'Migrate customer records' },
              { entity: 'Supplier', fields: ['name','contact_person','email','phone','address'], description: 'Import supplier list' },
              { entity: 'StockLevel', fields: ['product_id (or sku)','location_id','quantity'], description: 'Set opening stock levels' },
              { entity: 'Asset', fields: ['name','asset_type','serial_number','location_id','value'], description: 'Import fixed assets' },
              { entity: 'BillOfMaterials', fields: ['finished_product_id','component_product_id','quantity'], description: 'Import BOM structure' },
            ].map(t => (
              <Card key={t.entity}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Database className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{t.entity}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                    {t.fields.map(f => (
                      <div key={f} className="flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                        <code className="font-mono">{f}</code>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1">
                    <FileText className="w-3 h-3" /> Download Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Job Detail Dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {SOURCE_ICONS[viewing.source_type]} {viewing.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Status:</span> {viewing.status}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Target:</span> {viewing.target_entity}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Total:</span> {viewing.total_rows?.toLocaleString()}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Errors:</span> <span className={viewing.error_rows > 0 ? 'text-red-600 font-bold' : ''}>{viewing.error_rows}</span></div>
                </div>
                {viewing.errors?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Error Log ({viewing.errors.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {viewing.errors.map((err, i) => (
                        <div key={i} className="bg-red-50 border border-red-100 rounded p-2 text-xs">
                          <span className="font-medium">Row {err.row}, {err.field}:</span> {err.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Job Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Migration Job</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Job Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Products Import May 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source Type</Label>
                <Select value={form.source_type} onValueChange={v => setForm(p => ({ ...p, source_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['csv','excel','json','legacy_erp','legacy_wms','api'].map(s => (
                      <SelectItem key={s} value={s}>{SOURCE_ICONS[s]} {s.replace('_',' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Entity</Label>
                <Select value={form.target_entity} onValueChange={v => setForm(p => ({ ...p, target_entity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label>Upload File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors mt-1"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.json" onChange={handleFileUpload} />
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                ) : uploadedFile ? (
                  <div>
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                    <p className="text-sm font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">File uploaded successfully</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm">Click to upload CSV, Excel, or JSON</p>
                    <p className="text-xs text-muted-foreground">Max 50MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {preview && preview.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Data Preview (first 3 rows)</p>
                <div className="overflow-x-auto border rounded text-xs">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>{Object.keys(preview[0]).slice(0, 5).map(k => <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(row).slice(0, 5).map((v, j) => <td key={j} className="px-2 py-1 truncate max-w-24">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button
                onClick={() => createMut.mutate({ ...form, file_url: uploadedFile?.url })}
                disabled={!form.name || !uploadedFile || createMut.isPending}
                className="gap-2"
              >
                <ArrowRight className="w-4 h-4" /> Start Migration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}