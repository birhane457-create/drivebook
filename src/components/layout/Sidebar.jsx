import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, Warehouse, ShoppingCart, Users, 
  Truck, ArrowLeftRight, ClipboardList, BarChart3, Bell,
  Settings, LogOut, ChevronLeft, ChevronRight, Store,
  Brain, ClipboardCheck, Star, Award, Building2, PieChart,
  Grid3x3, Factory, DollarSign, CheckSquare, Smartphone,
  Route, Globe2, Server, Crown, Layers, Zap, Database,
  Tag, TrendingUp, Shield, Webhook, FileText, Wrench,
  GitBranch, Clock, Activity, Lock, ShieldCheck,
  Bot, BookOpen, Bus, Eye, Code2, Key, UserCheck, Puzzle
} from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const menuGroups = [
  {
    label: 'Executive',
    items: [
      { path: '/executive', icon: Crown, label: 'Exec Dashboard', roles: ['super_admin'] },
    ]
  },
  {
    label: 'Operations',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin', 'warehouse_manager', 'store_manager', 'cashier', 'inventory_staff'] },
      { path: '/pos', icon: ShoppingCart, label: 'Point of Sale', roles: ['super_admin', 'store_manager', 'cashier'] },
      { path: '/products', icon: Package, label: 'Products', roles: ['super_admin', 'warehouse_manager', 'store_manager', 'inventory_staff'] },
      { path: '/inventory', icon: Warehouse, label: 'Inventory', roles: ['super_admin', 'warehouse_manager', 'store_manager', 'inventory_staff'] },
      { path: '/purchases', icon: Truck, label: 'Purchases', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/transfers', icon: ArrowLeftRight, label: 'Transfers', roles: ['super_admin', 'warehouse_manager', 'store_manager'] },
    ]
  },
  {
    label: 'Warehouse',
    items: [
      { path: '/warehouse-execution', icon: Grid3x3, label: 'WH Execution', roles: ['super_admin', 'warehouse_manager', 'inventory_staff'] },
      { path: '/mobile-warehouse', icon: Smartphone, label: 'Mobile WH', roles: ['super_admin', 'warehouse_manager', 'inventory_staff'] },
      { path: '/cycle-counting', icon: ClipboardCheck, label: 'Cycle Counting', roles: ['super_admin', 'warehouse_manager', 'inventory_staff'] },
    ]
  },
  {
    label: 'Manufacturing',
    items: [
      { path: '/manufacturing', icon: Factory, label: 'Manufacturing', roles: ['super_admin', 'warehouse_manager'] },
    ]
  },
  {
    label: 'Intelligence',
    items: [
      { path: '/analytics', icon: PieChart, label: 'Inv. Analytics', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/forecasting', icon: Brain, label: 'AI Forecasting', roles: ['super_admin', 'warehouse_manager'] },
    ]
  },
  {
    label: 'Relationships',
    items: [
      { path: '/customers', icon: Users, label: 'Customers', roles: ['super_admin', 'store_manager', 'cashier'] },
      { path: '/loyalty', icon: Star, label: 'Loyalty Program', roles: ['super_admin', 'store_manager'] },
      { path: '/suppliers', icon: Store, label: 'Suppliers', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/supplier-scorecard', icon: Award, label: 'Supplier Scores', roles: ['super_admin', 'warehouse_manager'] },
    ]
  },
  {
    label: 'Finance',
    items: [
      { path: '/financials', icon: DollarSign, label: 'Financials', roles: ['super_admin'] },
      { path: '/approvals', icon: CheckSquare, label: 'Approvals', roles: ['super_admin', 'warehouse_manager', 'store_manager'] },
      { path: '/sales', icon: ClipboardList, label: 'Sales History', roles: ['super_admin', 'store_manager', 'cashier'] },
      { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['super_admin', 'warehouse_manager', 'store_manager'] },
      { path: '/alerts', icon: Bell, label: 'Alerts', roles: ['super_admin', 'warehouse_manager', 'store_manager', 'inventory_staff'] },
    ]
  },
  {
    label: 'Commerce & Logistics',
    items: [
      { path: '/multi-channel', icon: Globe2, label: 'Multi-Channel', roles: ['super_admin', 'store_manager'] },
      { path: '/transportation', icon: Route, label: 'Transportation', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/3pl', icon: Server, label: '3PL Management', roles: ['super_admin'] },
    ]
  },
  {
    label: 'Automation & Data',
    items: [
      { path: '/workflow', icon: Zap, label: 'Workflow Engine', roles: ['super_admin'] },
      { path: '/master-data', icon: Database, label: 'Master Data', roles: ['super_admin'] },
      { path: '/pricing', icon: Tag, label: 'Pricing Engine', roles: ['super_admin', 'store_manager'] },
      { path: '/optimization', icon: TrendingUp, label: 'Inv. Optimization', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/data-warehouse', icon: Shield, label: 'Data Warehouse', roles: ['super_admin'] },
    ]
  },
  {
    label: 'Quality & Assets',
    items: [
      { path: '/quality', icon: CheckSquare, label: 'Quality (QMS)', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/assets', icon: Wrench, label: 'Asset Management', roles: ['super_admin'] },
      { path: '/documents', icon: FileText, label: 'Documents', roles: ['super_admin', 'warehouse_manager'] },
      { path: '/api-hub', icon: Webhook, label: 'API Hub', roles: ['super_admin'] },
    ]
  },
  {
    label: 'Platform Layer',
    items: [
      { path: '/platform-admin', icon: Building2, label: 'Platform Admin', roles: ['super_admin'] },
      { path: '/iam', icon: Lock, label: 'IAM & Roles', roles: ['super_admin'] },
      { path: '/audit-compliance', icon: ShieldCheck, label: 'Audit & Compliance', roles: ['super_admin'] },
      { path: '/business-rules', icon: GitBranch, label: 'Rules Engine', roles: ['super_admin'] },
      { path: '/scheduler', icon: Clock, label: 'Scheduler', roles: ['super_admin'] },
      { path: '/comms-hub', icon: Bell, label: 'Comms Hub', roles: ['super_admin'] },
      { path: '/monitoring', icon: Activity, label: 'Monitoring', roles: ['super_admin'] },
      { path: '/supplier-portal', icon: Shield, label: 'Supplier Portal', roles: ['super_admin'] },
    ]
  },
  {
    label: 'AI & Intelligence',
    items: [
      { path: '/ai-copilot', icon: Bot, label: 'AI Copilot', roles: ['super_admin', 'warehouse_manager', 'store_manager'] },
      { path: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base', roles: ['super_admin', 'warehouse_manager'] },
    ]
  },
  {
    label: 'Architecture',
    items: [
      { path: '/event-bus', icon: Zap, label: 'Event Bus', roles: ['super_admin'] },
      { path: '/observability', icon: Eye, label: 'Observability', roles: ['super_admin'] },
      { path: '/devops', icon: GitBranch, label: 'DevOps', roles: ['super_admin'] },
      { path: '/security', icon: Key, label: 'Security Center', roles: ['super_admin'] },
    ]
  },
  {
    label: 'Customer & Commerce',
    items: [
      { path: '/customer-portal', icon: UserCheck, label: 'Customer Portal', roles: ['super_admin', 'store_manager'] },
      { path: '/marketplace', icon: Puzzle, label: 'App Marketplace', roles: ['super_admin'] },
    ]
  },
  {
    label: 'System',
    items: [
      { path: '/settings', icon: Settings, label: 'Settings', roles: ['super_admin'] },
      { path: '/enterprise-settings', icon: Building2, label: 'Enterprise', roles: ['super_admin'] },
    ]
  },
];

export default function Sidebar({ user, alertCount = 0 }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const userRole = user?.role || 'cashier';

  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0);

  return (
    <aside className={cn(
      "h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 fixed left-0 top-0 z-40",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Warehouse className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">WMS Pro</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <Warehouse className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30 px-3 pt-2 pb-1">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.path === '/alerts' && alertCount > 0 && (
                    <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0">
                      {alertCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => base44.auth.logout()}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}