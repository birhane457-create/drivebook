import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';

export default function DetailLayout({ title, subtitle, onBack, tabs, activeTab, onTabChange, actions, sidebar, children, className }) {
  return (
    <div className={className}>
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
      )}
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      {tabs?.length > 0 && (
        <Tabs value={activeTab} onValueChange={onTabChange} className="mb-4">
          <TabsList>{tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
        </Tabs>
      )}
      <div className={sidebar ? 'grid lg:grid-cols-3 gap-6' : ''}>
        <div className={sidebar ? 'lg:col-span-2 space-y-6' : 'space-y-6'}>{children}</div>
        {sidebar && <div className="lg:col-span-1">{sidebar}</div>}
      </div>
    </div>
  );
}