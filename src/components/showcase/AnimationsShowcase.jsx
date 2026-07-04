import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import {
  AnimatedCard, AnimatedDrawer, LoadingSpinner, SuccessCheckmark,
  AnimatedToast, StaggerContainer, StaggerItem, AnimatedBadge,
  AnimatedTableRows, AnimatedTableRow,
} from '@/components/animations';
import { Sparkles, MousePointerClick, Bell, Check, Plus } from 'lucide-react';

function DemoBlock({ title, description, children }) {
  return (
    <Card className="border p-4">
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {children}
    </Card>
  );
}

export default function AnimationsShowcase() {
  const [drawerSide, setDrawerSide] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [successKey, setSuccessKey] = useState(0);

  const addToast = (kind) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, kind, text: `${kind} notification` }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Page transition preview */}
      <DemoBlock title="Page Transition" description="fade + rise on mount/exit">
        <AnimatePresence mode="wait">
          <motion.div
            key={successKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-lg bg-primary/10 p-4 text-center text-sm font-medium text-primary"
          >
            <Sparkles className="w-4 h-4 inline mr-2" /> Page content animates in
          </motion.div>
        </AnimatePresence>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setSuccessKey((k) => k + 1)}>
          Replay transition
        </Button>
      </DemoBlock>

      {/* Card hover */}
      <DemoBlock title="Card Hover" description="lift + shadow on hover, press on tap">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <AnimatedCard key={i} className="rounded-lg border bg-card p-3 text-center text-xs" onClick={() => {}}>
              <MousePointerClick className="w-4 h-4 mx-auto mb-1 text-primary" /> Hover me
            </AnimatedCard>
          ))}
        </div>
      </DemoBlock>

      {/* Drawer animations */}
      <DemoBlock title="Drawer Animations" description="spring-driven slide from right / left / bottom">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setDrawerSide('right')}>Right</Button>
          <Button size="sm" variant="outline" onClick={() => setDrawerSide('left')}>Left</Button>
          <Button size="sm" variant="outline" onClick={() => setDrawerSide('bottom')}>Bottom</Button>
        </div>
        <AnimatedDrawer open={!!drawerSide} onClose={() => setDrawerSide(null)} side={drawerSide || 'right'}>
          <div className="p-4">
            <p className="font-medium text-sm">Animated Drawer ({drawerSide})</p>
            <p className="text-xs text-muted-foreground mt-1">Slides in with a spring and fades the overlay.</p>
            <Button size="sm" className="mt-3" onClick={() => setDrawerSide(null)}>Close</Button>
          </div>
        </AnimatedDrawer>
      </DemoBlock>

      {/* Table row stagger */}
      <DemoBlock title="Table Row Stagger" description="rows cascade in on mount">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <AnimatedTableRows>
              {[['Pallet A', 12], ['Carton B', 48], ['Bin C', 4], ['Case D', 96]].map(([name, qty]) => (
                <AnimatedTableRow key={name}>
                  <TableCell className="text-sm font-medium">{name}</TableCell>
                  <TableCell className="text-right text-sm">{qty}</TableCell>
                </AnimatedTableRow>
              ))}
            </AnimatedTableRows>
          </Table>
        </div>
      </DemoBlock>

      {/* Loading animations */}
      <DemoBlock title="Loading Animations" description="spinner, skeleton pulse & shimmer">
        <div className="space-y-3">
          <LoadingSpinner size={20} label="Fetching data…" />
          <div className="space-y-2">
            <div className="h-3 rounded bg-muted animate-pulse" />
            <div className="h-3 rounded bg-muted animate-pulse w-3/4" />
            <div className="h-3 rounded bg-muted animate-pulse w-1/2" />
          </div>
        </div>
      </DemoBlock>

      {/* Success animation */}
      <DemoBlock title="Success Animation" description="bounce-in checkmark with expanding ring">
        <div className="flex flex-col items-center gap-2 py-2">
          <SuccessCheckmark size={56} />
          <AnimatePresence>
            <motion.button
              key={successKey}
              onClick={() => setSuccessKey((k) => k + 1)}
              className="text-xs text-primary hover:underline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Replay
            </motion.button>
          </AnimatePresence>
        </div>
      </DemoBlock>

      {/* Toast animations */}
      <DemoBlock title="Toast Animations" description="spring pop-in, auto-dismiss, layout-aware stack">
        <div className="flex gap-2 flex-wrap mb-3">
          <Button size="sm" variant="outline" onClick={() => addToast('success')}><Check className="w-3 h-3 mr-1" />Success</Button>
          <Button size="sm" variant="outline" onClick={() => addToast('warning')}><Bell className="w-3 h-3 mr-1" />Warning</Button>
          <Button size="sm" variant="outline" onClick={() => addToast('error')}>Error</Button>
        </div>
        <div className="space-y-2">
          <AnimatePresence>
            {toasts.map((t) => (
              <AnimatedToast key={t.id} kind={t.kind}>
                <span className="text-sm font-medium capitalize">{t.text}</span>
              </AnimatedToast>
            ))}
          </AnimatePresence>
        </div>
      </DemoBlock>

      {/* Stagger list */}
      <DemoBlock title="Stagger Container" description="children cascade in sequence">
        <StaggerContainer className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <StaggerItem key={i} className="rounded-lg border bg-card p-2 text-center text-xs">
              Item {i + 1}
            </StaggerItem>
          ))}
        </StaggerContainer>
      </DemoBlock>

      {/* Badge pop */}
      <DemoBlock title="Badge Pop" description="count badge bounces in on change">
        <div className="flex items-center gap-3">
          <AnimatedBadge count={toasts.length || 3} />
          <Button size="sm" variant="outline" onClick={() => addToast('info')}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
      </DemoBlock>
    </div>
  );
}