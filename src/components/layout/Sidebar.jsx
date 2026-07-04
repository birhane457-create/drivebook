import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, Warehouse, ShoppingCart, Users, 
  Truck, ArrowLeftRight, ClipboardList, BarChart3, Bell, Boxes,
  Settings, LogOut, ChevronLeft, ChevronRight, Store,
  Brain, ClipboardCheck, Star, Award, Building2, PieChart,
  Grid3x3, Factory, DollarSign, CheckSquare, Smartphone,
  Route, Globe2, Server, Crown, Layers, Zap, Database,
  Tag, TrendingUp, Shield, Webhook, FileText, Wrench,
  GitBranch, Clock, Activity, Lock, ShieldCheck,
  Bot, BookOpen, Eye, Code2, Key, UserCheck, Puzzle,
  CreditCard, Palette, Lightbulb, Rocket, Heart, FlaskConical, PlayCircle,
  Target, TestTube, Briefcase, ChevronDown, QrCode, Search
} from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { canAccess } from '@/lib/route-access';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Role-based menu groups — only the relevant section is shown per role
const ROLE_MENUS = {
  // CEO / super admin sees everything, organised by domain
  super_admin: [
    {
      label: 'Executive',
      items: [
        { path: '/executive', icon: Crown, label: 'Exec Dashboard' },
        { path: '/insights', icon: Lightbulb, label: 'AI Insights' },
        { path: '/benchmarking', icon: PieChart, label: 'Benchmarking' },
        { path: '/customer-success', icon: Heart, label: 'Customer Success' },
        { path: '/investor-metrics', icon: BarChart3, label: 'Investor Metrics' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/pos', icon: ShoppingCart, label: 'Point of Sale' },
        { path: '/products', icon: Package, label: 'Products' },
        { path: '/inventory', icon: Warehouse, label: 'Inventory' },
        { path: '/purchases', icon: Truck, label: 'Purchases' },
        { path: '/transfers', icon: ArrowLeftRight, label: 'Transfers' },
        { path: '/approvals', icon: CheckSquare, label: 'Approvals' },
        { path: '/barcode-labels', icon: QrCode, label: 'Barcode Labels' },
      ]
    },
    {
      label: 'Warehouse',
      items: [
        { path: '/warehouse', icon: Warehouse, label: 'Warehouse' },
        { path: '/warehouse-execution', icon: Grid3x3, label: 'WH Execution' },
        { path: '/mobile-warehouse', icon: Smartphone, label: 'Mobile WH' },
        { path: '/cycle-counting', icon: ClipboardCheck, label: 'Cycle Counting' },
        { path: '/optimization', icon: TrendingUp, label: 'Optimization' },
      ]
    },
    {
      label: 'Finance',
      items: [
        { path: '/financials', icon: DollarSign, label: 'Financials' },
        { path: '/sales', icon: ClipboardList, label: 'Sales History' },
        { path: '/reports', icon: BarChart3, label: 'Reports' },
        { path: '/billing', icon: CreditCard, label: 'Billing Platform' },
      ]
    },
    {
      label: 'Relationships',
      items: [
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/loyalty', icon: Star, label: 'Loyalty' },
        { path: '/suppliers', icon: Store, label: 'Suppliers' },
        { path: '/supplier-portal', icon: Shield, label: 'Supplier Portal' },
        { path: '/supplier-scorecard', icon: Award, label: 'Supplier Scores' },
        { path: '/customer-portal', icon: UserCheck, label: 'Customer Portal' },
      ]
    },
    {
      label: 'Commerce & Logistics',
      items: [
        { path: '/multi-channel', icon: Globe2, label: 'Multi-Channel' },
        { path: '/transportation', icon: Route, label: 'Transportation' },
        { path: '/3pl', icon: Server, label: '3PL' },
        { path: '/manufacturing', icon: Factory, label: 'Manufacturing' },
      ]
    },
    {
      label: 'AI & Intelligence',
      items: [
        { path: '/ai-copilot', icon: Bot, label: 'AI Copilot' },
        { path: '/forecasting', icon: Brain, label: 'AI Forecasting' },
        { path: '/aiops', icon: Zap, label: 'AIOps' },
        { path: '/analytics', icon: PieChart, label: 'Analytics' },
        { path: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
      ]
    },
    {
      label: 'Platform',
      items: [
        { path: '/platform-admin', icon: Building2, label: 'Platform Admin' },
        { path: '/iam', icon: Lock, label: 'IAM & Roles' },
        { path: '/audit-compliance', icon: ShieldCheck, label: 'Compliance' },
        { path: '/monitoring', icon: Activity, label: 'Monitoring' },
        { path: '/security', icon: Key, label: 'Security' },
        { path: '/devops', icon: GitBranch, label: 'DevOps' },
        { path: '/event-bus', icon: Webhook, label: 'Event Bus' },
        { path: '/observability', icon: Eye, label: 'Observability' },
        { path: '/scheduler', icon: Clock, label: 'Scheduler' },
      ]
    },
    {
      label: 'SaaS & GTM',
      items: [
        { path: '/white-label', icon: Palette, label: 'White Label' },
        { path: '/marketplace', icon: Puzzle, label: 'Marketplace' },
        { path: '/developer-portal', icon: Code2, label: 'Dev Portal' },
        { path: '/releases', icon: Rocket, label: 'Releases' },
        { path: '/onboarding', icon: CheckSquare, label: 'Onboarding' },
        { path: '/data-migration', icon: Database, label: 'Data Migration' },
        { path: '/demo-environment', icon: FlaskConical, label: 'Demo Env' },
        { path: '/demo-script', icon: PlayCircle, label: 'Demo Script' },
      ]
    },
    {
      label: 'Launch',
      items: [
        { path: '/launch-readiness', icon: Target, label: 'Launch Readiness' },
        { path: '/test-automation', icon: TestTube, label: 'Test Automation' },
        { path: '/documentation', icon: BookOpen, label: 'Documentation' },
        { path: '/implementation-toolkit', icon: Briefcase, label: 'Impl. Toolkit' },
        { path: '/data-seeder', icon: Database, label: 'Data Seeder' },
      ]
    },
    {
      label: 'System',
      items: [
        { path: '/workflow', icon: Zap, label: 'Workflow Engine' },
        { path: '/business-rules', icon: GitBranch, label: 'Rules Engine' },
        { path: '/pricing', icon: Tag, label: 'Pricing Engine' },
        { path: '/master-data', icon: Database, label: 'Master Data' },
        { path: '/documents', icon: FileText, label: 'Documents' },
        { path: '/assets', icon: Wrench, label: 'Assets' },
        { path: '/quality', icon: CheckSquare, label: 'Quality (QMS)' },
        { path: '/api-hub', icon: Webhook, label: 'API Hub' },
        { path: '/data-warehouse', icon: Shield, label: 'Data Warehouse' },
        { path: '/comms-hub', icon: Bell, label: 'Comms Hub' },
        { path: '/settings', icon: Settings, label: 'Settings' },
        { path: '/enterprise-settings', icon: Building2, label: 'Enterprise' },
        { path: '/alerts', icon: Bell, label: 'Alerts' },
        { path: '/design-system', icon: Palette, label: 'Design System' },
      ]
    },
  ],

  // Warehouse Manager
  warehouse_manager: [
    {
      label: 'Overview',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/alerts', icon: Bell, label: 'Alerts' },
      ]
    },
    {
      label: 'Warehouse',
      items: [
        { path: '/warehouse', icon: Warehouse, label: 'Warehouse' },
        { path: '/inventory', icon: Boxes, label: 'Inventory' },
        { path: '/warehouse-execution', icon: Grid3x3, label: 'WH Execution' },
        { path: '/mobile-warehouse', icon: Smartphone, label: 'Mobile WH' },
        { path: '/cycle-counting', icon: ClipboardCheck, label: 'Cycle Counting' },
        { path: '/transfers', icon: ArrowLeftRight, label: 'Transfers' },
        { path: '/optimization', icon: TrendingUp, label: 'Optimization' },
        { path: '/barcode-labels', icon: QrCode, label: 'Barcode Labels' },
      ]
    },
    {
      label: 'Procurement',
      items: [
        { path: '/purchases', icon: Truck, label: 'Purchases' },
        { path: '/suppliers', icon: Store, label: 'Suppliers' },
        { path: '/supplier-scorecard', icon: Award, label: 'Supplier Scores' },
        { path: '/approvals', icon: CheckSquare, label: 'Approvals' },
      ]
    },
    {
      label: 'Intelligence',
      items: [
        { path: '/analytics', icon: PieChart, label: 'Analytics' },
        { path: '/forecasting', icon: Brain, label: 'AI Forecasting' },
        { path: '/ai-copilot', icon: Bot, label: 'AI Copilot' },
        { path: '/insights', icon: Lightbulb, label: 'AI Insights' },
      ]
    },
    {
      label: 'Products',
      items: [
        { path: '/products', icon: Package, label: 'Products' },
        { path: '/manufacturing', icon: Factory, label: 'Manufacturing' },
        { path: '/reports', icon: BarChart3, label: 'Reports' },
      ]
    },
  ],

  // Store Manager
  store_manager: [
    {
      label: 'Overview',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/alerts', icon: Bell, label: 'Alerts' },
      ]
    },
    {
      label: 'Sales',
      items: [
        { path: '/pos', icon: ShoppingCart, label: 'Point of Sale' },
        { path: '/sales', icon: ClipboardList, label: 'Sales History' },
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/loyalty', icon: Star, label: 'Loyalty' },
        { path: '/customer-portal', icon: UserCheck, label: 'Customer Portal' },
      ]
    },
    {
      label: 'Inventory',
      items: [
        { path: '/inventory', icon: Warehouse, label: 'Inventory' },
        { path: '/products', icon: Package, label: 'Products' },
        { path: '/transfers', icon: ArrowLeftRight, label: 'Transfers' },
        { path: '/barcode-labels', icon: QrCode, label: 'Barcode Labels' },
      ]
    },
    {
      label: 'Reports',
      items: [
        { path: '/reports', icon: BarChart3, label: 'Reports' },
        { path: '/approvals', icon: CheckSquare, label: 'Approvals' },
      ]
    },
  ],

  // Cashier
  cashier: [
    {
      label: 'Sales',
      items: [
        { path: '/pos', icon: ShoppingCart, label: 'Point of Sale' },
        { path: '/sales', icon: ClipboardList, label: 'Sales History' },
        { path: '/customers', icon: Users, label: 'Customers' },
      ]
    },
    {
      label: 'Info',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/alerts', icon: Bell, label: 'Alerts' },
      ]
    },
  ],

  // Inventory Staff
  inventory_staff: [
    {
      label: 'Warehouse',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/inventory', icon: Warehouse, label: 'Inventory' },
        { path: '/warehouse-execution', icon: Grid3x3, label: 'WH Execution' },
        { path: '/mobile-warehouse', icon: Smartphone, label: 'Mobile WH' },
        { path: '/cycle-counting', icon: ClipboardCheck, label: 'Cycle Counting' },
        { path: '/transfers', icon: ArrowLeftRight, label: 'Transfers' },
        { path: '/alerts', icon: Bell, label: 'Alerts' },
        { path: '/barcode-labels', icon: QrCode, label: 'Barcode Labels' },
      ]
    },
  ],
};

export default function Sidebar({ user, alertCount = 0, onOpenSearch, mobileOpen = false, onCloseMobile, collapsed = false, onToggleCollapsed }) {
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const userRole = user?.role || 'cashier';

  const menuGroups = ROLE_MENUS[userRole] || ROLE_MENUS.cashier;

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Close the mobile drawer on navigation
  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className={cn(
      "h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border fixed left-0 top-0 z-40 transition-transform duration-300",
      collapsed ? "w-[68px]" : "w-[240px]",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
      "lg:translate-x-0"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Warehouse className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">WMS Pro</span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <Warehouse className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Search trigger */}
      {!collapsed && (
        <button
          onClick={() => onOpenSearch?.()}
          className="mx-3 mb-2 flex items-center gap-2 w-[calc(100%-1.5rem)] px-3 py-2 rounded-lg text-sm text-sidebar-foreground/40 bg-sidebar-accent hover:bg-sidebar-accent/70 hover:text-sidebar-foreground/60 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search pages...</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-foreground/10">⌘K</kbd>
        </button>
      )}
      {collapsed && (
        <button
          onClick={() => onOpenSearch?.()}
          className="mx-auto mb-2 flex items-center justify-center w-10 h-10 rounded-lg text-sidebar-foreground/40 bg-sidebar-accent hover:bg-sidebar-accent/70 hover:text-sidebar-foreground/60 transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => canAccess(item.path, userRole));
          if (accessibleItems.length === 0) return null;
          const isGroupCollapsed = collapsedGroups[group.label];
          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30 px-3 pt-3 pb-1 hover:text-sidebar-foreground/50 transition-colors"
                >
                  {group.label}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isGroupCollapsed && "-rotate-90")} />
                </button>
              )}
              {!isGroupCollapsed && accessibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.path === '/alerts' && alertCount > 0 && (
                      <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0">
                        {alertCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-sidebar-border p-3 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{userRole.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => onToggleCollapsed?.()}
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