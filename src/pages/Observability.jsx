import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, TrendingUp, Zap, Eye, Server } from 'lucide-react';

const SERVICES = [
  { name: 'API Gateway', latency: 45, errorRate: 0.1, uptime: 99.98, requests: 12450, status: 'healthy' },
  { name: 'Inventory Service', latency: 120, errorRate: 0.05, uptime: 99.95, requests: 8200, status: 'healthy' },
  { name: 'Order Service', latency: 89, errorRate: 0.3, uptime: 99.9, requests: 5600, status: 'healthy' },
  { name: 'Finance Service', latency: 210, errorRate: 0.8, uptime: 99.7, requests: 2100, status: 'degraded' },
  { name: 'Notification Service', latency: 340, errorRate: 2.1, uptime: 98.5, requests: 890, status: 'degraded' },
  { name: 'Report Service', latency: 1200, errorRate: 0.0, uptime: 100, requests: 340, status: 'healthy' },
];

const LATENCY_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  p50: Math.floor(50 + Math.random() * 80),
  p95: Math.floor(150 + Math.random() * 200),
  p99: Math.floor(350 + Math.random() * 400),
}));

const ERROR_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `Jun ${i + 1}`,
  errors: Math.floor(Math.random() * 50),
  warnings: Math.floor(Math.random() * 120),
}));

const SLA_TARGETS = [
  { metric: 'Availability', target: 99.9, actual: 99.95, status: 'met' },
  { metric: 'Response Time P95', target: 500, actual: 387, unit: 'ms', status: 'met' },
  { metric: 'Error Rate', target: 1.0, actual: 0.43, unit: '%', status: 'met' },
  { metric: 'MTTR', target: 30, actual: 18, unit: 'min', status: 'met' },
  { metric: 'Throughput', target: 5000, actual: 4820, unit: 'req/s', status: 'at_risk' },
];

const RECENT_ERRORS = [
  { id: 'ERR-001', service: 'Finance Service', message: 'Database connection timeout after 30s', count: 45, last_seen: '2 min ago', severity: 'error' },
  { id: 'ERR-002', service: 'Notification Service', message: 'SMTP relay connection refused', count: 230, last_seen: '5 min ago', severity: 'error' },
  { id: 'ERR-003', service: 'Order Service', message: 'Inventory reservation race condition', count: 12, last_seen: '18 min ago', severity: 'warning' },
  { id: 'ERR-004', service: 'API Gateway', message: 'Rate limit exceeded for tenant T-042', count: 88, last_seen: '1 hr ago', severity: 'warning' },
];

const USAGE_DATA = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  api_calls: Math.floor(100000 + i * 15000 + Math.random() * 20000),
  active_users: Math.floor(120 + i * 8 + Math.random() * 20),
  storage_gb: Math.floor(50 + i * 12),
}));

export default function Observability() {
  const [timeRange, setTimeRange] = useState('24h');

  const overallHealth = SERVICES.filter(s => s.status === 'healthy').length / SERVICES.length * 100;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Observability" subtitle="Distributed tracing · Error tracking · SLA monitoring · Usage analytics">
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['1h','6h','24h','7d','30d'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-2"><RefreshCw className="w-4 h-4" /> Refresh</Button>
        </div>
      </PageHeader>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Overall Health', value: `${overallHealth.toFixed(0)}%`, icon: Activity, color: 'text-green-600' },
          { label: 'Avg Latency', value: '89ms', icon: Zap, color: 'text-blue-600' },
          { label: 'Error Rate', value: '0.43%', icon: AlertCircle, color: 'text-orange-600' },
          { label: 'Uptime (30d)', value: '99.95%', icon: CheckCircle, color: 'text-green-600' },
          { label: 'Active Traces', value: '1,247', icon: Eye, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Service Health</TabsTrigger>
          <TabsTrigger value="tracing">Latency & Tracing</TabsTrigger>
          <TabsTrigger value="errors">Error Tracking</TabsTrigger>
          <TabsTrigger value="sla">SLA Monitoring</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-3">
          {SERVICES.map(s => (
            <Card key={s.name}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-48">
                    <span className={`w-2 h-2 rounded-full ${s.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Latency</p>
                      <p className="font-medium">{s.latency}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Error Rate</p>
                      <p className={`font-medium ${s.errorRate > 1 ? 'text-red-600' : 'text-green-600'}`}>{s.errorRate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-medium">{s.uptime}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Requests/hr</p>
                      <p className="font-medium">{s.requests.toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge variant={s.status === 'healthy' ? 'outline' : 'secondary'} className={s.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' : ''}>
                    {s.status}
                  </Badge>
                </div>
                <div className="mt-2">
                  <Progress value={s.uptime} className="h-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="tracing">
          <Card>
            <CardHeader><CardTitle className="text-sm">Latency Percentiles (24h)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={LATENCY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="ms" />
                  <Tooltip />
                  <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} name="P50" dot={false} />
                  <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} name="P95" dot={false} />
                  <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} name="P99" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Errors & Warnings (14 days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ERROR_DATA}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="errors" fill="#ef4444" name="Errors" />
                  <Bar dataKey="warnings" fill="#f59e0b" name="Warnings" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {RECENT_ERRORS.map(err => (
              <Card key={err.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <AlertCircle className={`w-4 h-4 mt-0.5 ${err.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{err.id}</span>
                      <Badge variant="outline" className="text-[10px]">{err.service}</Badge>
                    </div>
                    <p className="text-sm mt-0.5">{err.message}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-medium text-red-600">{err.count}×</p>
                    <p>{err.last_seen}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sla" className="space-y-3">
          {SLA_TARGETS.map(sla => (
            <Card key={sla.metric}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-40">
                    <p className="text-sm font-medium">{sla.metric}</p>
                    <p className="text-xs text-muted-foreground">Target: {sla.target}{sla.unit || '%'}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Actual: <strong>{sla.actual}{sla.unit || '%'}</strong></span>
                      <span className={sla.status === 'met' ? 'text-green-600' : 'text-orange-600'}>
                        {sla.status === 'met' ? '✓ Met' : '⚠ At Risk'}
                      </span>
                    </div>
                    <Progress
                      value={sla.unit === 'ms' || sla.unit === 'min'
                        ? (1 - sla.actual / sla.target) * 100
                        : (sla.actual / sla.target) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">API Calls (Monthly)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={USAGE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="api_calls" stroke="#6366f1" fill="#6366f120" name="API Calls" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Active Users & Storage</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={USAGE_DATA.slice(-6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="active_users" fill="#22c55e" name="Users" />
                    <Bar dataKey="storage_gb" fill="#6366f1" name="Storage (GB)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}