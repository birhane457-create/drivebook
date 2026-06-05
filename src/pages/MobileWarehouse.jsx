import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scan, Camera, Package, ArrowLeftRight, ClipboardCheck, Truck, QrCode } from 'lucide-react';
import { toast } from 'sonner';

const TASKS = [
  { id: 'receive', icon: Truck, label: 'Receive', color: 'bg-blue-500', desc: 'Mobile receiving with barcode scan' },
  { id: 'pick', icon: Package, label: 'Pick', color: 'bg-green-500', desc: 'Guided picking with scan confirmation' },
  { id: 'transfer', icon: ArrowLeftRight, label: 'Transfer', color: 'bg-purple-500', desc: 'Bin-to-bin transfers' },
  { id: 'count', icon: ClipboardCheck, label: 'Cycle Count', color: 'bg-orange-500', desc: 'On-the-floor counting' },
];

export default function MobileWarehouse() {
  const [activeTask, setActiveTask] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [cameraMode, setCameraMode] = useState(false);
  const videoRef = useRef(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const handleScan = (value) => {
    const barcode = value || scanInput;
    if (!barcode) return;
    const product = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (product) {
      const existing = scannedItems.find(i => i.product_id === product.id);
      if (existing) {
        setScannedItems(scannedItems.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
        setScannedItems([...scannedItems, { product_id: product.id, name: product.name, sku: product.sku, qty: 1 }]);
      }
      toast.success(`Scanned: ${product.name}`);
    } else {
      toast.error(`No product found for: ${barcode}`);
    }
    setScanInput('');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraMode(true);
        toast.info('Camera active — use barcode input to confirm scan');
      }
    } catch {
      toast.error('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setCameraMode(false);
  };

  if (!activeTask) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PageHeader title="Mobile Warehouse" subtitle="Barcode scanning, mobile receiving, picking & cycle counting" />
        <div className="grid grid-cols-2 gap-4">
          {TASKS.map(task => (
            <button
              key={task.id}
              onClick={() => { setActiveTask(task); setScannedItems([]); }}
              className="rounded-xl border bg-card p-6 text-left hover:shadow-lg transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl ${task.color} flex items-center justify-center mb-3`}>
                <task.icon className="w-6 h-6 text-white" />
              </div>
              <p className="font-semibold">{task.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{task.desc}</p>
            </button>
          ))}
        </div>
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><QrCode className="w-4 h-4" /> Supported Scan Types</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {['EAN-13', 'UPC-A', 'Code 128', 'Code 39', 'QR Code', 'Data Matrix', 'GS1-128'].map(t => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setActiveTask(null); stopCamera(); }} className="text-muted-foreground hover:text-foreground">← Back</button>
        <div className={`w-8 h-8 rounded-lg ${activeTask.color} flex items-center justify-center`}>
          <activeTask.icon className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-bold text-lg">{activeTask.label}</h2>
        <Badge variant="outline" className="ml-auto">{scannedItems.length} items</Badge>
      </div>

      {/* Camera View */}
      {cameraMode && (
        <div className="relative mb-4 rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-primary w-48 h-24 rounded-lg opacity-70" />
          </div>
          <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">✕ Close Camera</button>
        </div>
      )}

      {/* Scan Input */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Scan barcode / QR or type SKU..."
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              className="flex-1 font-mono"
              autoFocus
            />
            <Button onClick={() => handleScan()} size="sm">
              <Scan className="w-4 h-4 mr-1" /> Scan
            </Button>
            <Button onClick={startCamera} size="sm" variant="outline">
              <Camera className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanned Items */}
      <div className="space-y-2">
        {scannedItems.map((item, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setScannedItems(scannedItems.map((s, idx) => idx === i ? { ...s, qty: Math.max(1, s.qty - 1) } : s))} className="w-6 h-6 rounded border flex items-center justify-center text-sm">−</button>
                <span className="w-8 text-center font-bold">{item.qty}</span>
                <button onClick={() => setScannedItems(scannedItems.map((s, idx) => idx === i ? { ...s, qty: s.qty + 1 } : s))} className="w-6 h-6 rounded border flex items-center justify-center text-sm">+</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {scannedItems.length > 0 && (
        <Button className="w-full mt-4" onClick={() => { toast.success(`${activeTask.label} completed for ${scannedItems.length} items`); setScannedItems([]); setActiveTask(null); }}>
          Confirm {activeTask.label} ({scannedItems.reduce((a, b) => a + b.qty, 0)} units)
        </Button>
      )}
    </div>
  );
}