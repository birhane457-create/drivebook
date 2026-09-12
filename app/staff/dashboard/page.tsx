'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, AlertCircle, Clock, CheckCircle,
  Filter, Search, Plus, TrendingUp, Users,
} from 'lucide-react';
import { StatCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import { 
  TASK_PRIORITY_STYLES, 
  TASK_STATUS_STYLES,
  taskPriorityToSeverity,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/staff/task-signal-mapping';

interface Task {
  id: string; type: string; category: string; priority: string; status: string;
  title: string; description: string; createdAt: string; dueDate: string;
  assignedTo?: { id: string; name: string; email: string; department: string; };
  notes: any[];
}

interface Stats {
  total: number; open: number; inProgress: number; urgent: number; high: number;
}

// Removed: Local PRIORITY_CLASS and STATUS_CLASS — now imported from task-signal-mapping

const CATEGORY_ICON: Record<string, string> = {
  FINANCIAL: '💰', TECHNICAL: '🔧', SUPPORT: '💬',
};

export default function StaffDashboard() {
  const router = useRouter();
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [stats, setStats]   = useState<Stats>({ total: 0, open: 0, inProgress: 0, urgent: 0, high: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter]     = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignedToMe, setAssignedToMe]     = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');

  useEffect(() => { fetchTasks(); }, [statusFilter, priorityFilter, categoryFilter, assignedToMe]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all')  params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (assignedToMe) params.append('assignedToMe', 'true');
      const res = await fetch(`/api/staff/tasks?${params}`);
      if (res.ok) { const d = await res.json(); setTasks(d.tasks); setStats(d.stats); }
    } catch (e) { console.error('Failed to fetch tasks:', e); }
    finally { setLoading(false); }
  };

  function formatDue(dateStr: string) {
    const d = new Date(dateStr), now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffH  = Math.floor(diffMs / 3600000);
    if (diffH < 0)  return <span className="text-destructive font-semibold">Overdue</span>;
    if (diffH < 1)  return <span className="text-destructive">Due in {Math.floor(diffMs / 60000)}m</span>;
    if (diffH < 24) return <span className="text-amber-400">Due in {diffH}h</span>;
    return <span className="text-muted-foreground">Due {d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>;
  }

  const filtered = tasks.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  const selectCls = 'px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none';

  return (
    <div className="dark min-h-screen bg-background text-foreground">

      {/* Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Staff Dashboard</h1>
            <p className="text-xs text-muted-foreground">Task queue · Support requests</p>
          </div>
          <button
            onClick={() => router.push('/staff/tasks/new')}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Total Tasks"   value={stats.total}      icon={ClipboardList} />
          <StatCard title="Open"          value={stats.open}       icon={AlertCircle}   color="text-primary" />
          <StatCard title="In Progress"   value={stats.inProgress} icon={Clock}         color="text-violet-400" />
          <StatCard title="Urgent"        value={stats.urgent}     icon={AlertCircle}   color={stats.urgent > 0 ? 'text-destructive' : undefined} />
          <StatCard title="High Priority" value={stats.high}       icon={TrendingUp}    color={stats.high > 0 ? 'text-amber-400' : undefined} />
        </div>

        {/* Filter bar */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <select value={statusFilter}   onChange={e => setStatusFilter(e.target.value)}   className={selectCls}>
              <option value="all">All Status</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_RESPONSE">Waiting Response</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selectCls}>
              <option value="all">All Priority</option>
              <option value="URGENT">🔴 Urgent</option>
              <option value="HIGH">🟠 High</option>
              <option value="NORMAL">🟡 Normal</option>
              <option value="LOW">🟢 Low</option>
            </select>

            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={selectCls}>
              <option value="all">All Categories</option>
              <option value="FINANCIAL">💰 Financial</option>
              <option value="TECHNICAL">🔧 Technical</option>
              <option value="SUPPORT">💬 Support</option>
            </select>

            <label className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={e => setAssignedToMe(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground">My Tasks Only</span>
            </label>
          </div>
        </div>

        {/* Task list */}
        {loading ? (
          <div className="bg-card rounded-xl border border-border p-10 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading tasks…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <CheckCircle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">No tasks found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(task => (
              <div
                key={task.id}
                onClick={() => router.push(`/staff/tasks/${task.id}`)}
                className="bg-card rounded-xl border border-border hover:border-border/70 hover:bg-secondary/30 transition-all cursor-pointer group"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICON[task.category] ?? '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{task.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', TASK_PRIORITY_STYLES[task.priority as TaskPriority]?.badge ?? 'bg-secondary text-muted-foreground')}>
                        {task.priority}
                      </span>
                      <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', TASK_STATUS_STYLES[task.status as TaskStatus] ?? 'bg-secondary text-muted-foreground')}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDue(task.dueDate)}
                      </span>
                      {task.assignedTo && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />{task.assignedTo.name}
                        </span>
                      )}
                      {task.notes.length > 0 && (
                        <span>💬 {task.notes.length} note{task.notes.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground/50">
                      {new Date(task.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {tasks.length} tasks
        </p>
      </div>
    </div>
  );
}
