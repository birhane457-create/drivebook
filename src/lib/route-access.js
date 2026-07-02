// Central source of truth for route-level access control.
// Used by RoleGuard (router), Sidebar (navigation hiding), and CommandPalette (search).
// super_admin implicitly has access to every route — no need to list it in roles[].

export const ROUTE_ACCESS = {
  '/dashboard':         { label: 'Dashboard',           roles: ['warehouse_manager', 'store_manager', 'cashier', 'inventory_staff'], keywords: ['home', 'overview', 'main', 'stats'] },
  '/pos':               { label: 'Point of Sale',       roles: ['store_manager', 'cashier'], keywords: ['checkout', 'register', 'sale', 'terminal', 'cart'] },
  '/products':          { label: 'Products',            roles: ['warehouse_manager', 'store_manager', 'inventory_staff'], keywords: ['catalog', 'sku', 'items', 'goods'] },
  '/inventory':         { label: 'Inventory',           roles: ['warehouse_manager', 'store_manager', 'inventory_staff'], keywords: ['stock', 'levels', 'warehouse', 'quantity'] },
  '/purchases':         { label: 'Purchase Orders',     roles: ['warehouse_manager'], keywords: ['po', 'procurement', 'orders', 'suppliers', 'receiving'] },
  '/transfers':         { label: 'Stock Transfers',     roles: ['warehouse_manager', 'store_manager', 'inventory_staff'], keywords: ['move', 'transfer', 'relocate', 'dispatch'] },
  '/approvals':         { label: 'Approvals',           roles: ['warehouse_manager', 'store_manager'], keywords: ['workflow', 'approve', 'reject', 'pending'] },
  '/barcode-labels':    { label: 'Barcode Labels',      roles: ['warehouse_manager', 'store_manager', 'inventory_staff'], keywords: ['print', 'labels', 'shelf', 'qr', 'code'] },
  '/warehouse-execution': { label: 'Warehouse Execution', roles: ['warehouse_manager', 'inventory_staff'], keywords: ['wms', 'picking', 'putaway', 'receiving', 'waves'] },
  '/mobile-warehouse':  { label: 'Mobile Warehouse',    roles: ['warehouse_manager', 'inventory_staff'], keywords: ['scanner', ' handheld', 'mobile', 'scan'] },
  '/cycle-counting':    { label: 'Cycle Counting',      roles: ['warehouse_manager', 'inventory_staff'], keywords: ['count', 'audit', 'stocktake', 'reconciliation'] },
  '/optimization':      { label: 'Inventory Optimization', roles: ['warehouse_manager'], keywords: ['replenish', 'abc', 'demand', 'safety stock'] },
  '/financials':        { label: 'Financials',          roles: [], keywords: ['accounting', 'gl', 'ap', 'ar', 'ledger', 'cost'] },
  '/sales':             { label: 'Sales History',       roles: ['store_manager', 'cashier'], keywords: ['transactions', 'receipts', 'orders'] },
  '/reports':           { label: 'Reports',             roles: ['warehouse_manager', 'store_manager'], keywords: ['analytics', 'export', 'summary'] },
  '/billing':           { label: 'Billing Platform',    roles: [], keywords: ['invoices', 'subscription', 'payments', 'plans'] },
  '/customers':         { label: 'Customers',           roles: ['store_manager', 'cashier'], keywords: ['crm', 'contacts', 'buyers'] },
  '/loyalty':           { label: 'Loyalty Program',     roles: ['store_manager'], keywords: ['rewards', 'points', 'tiers', 'membership'] },
  '/suppliers':         { label: 'Suppliers',           roles: ['warehouse_manager'], keywords: ['vendors', 'contacts', 'procurement'] },
  '/supplier-portal':   { label: 'Supplier Portal',     roles: [], keywords: ['vendor', 'access', 'external'] },
  '/supplier-scorecard':{ label: 'Supplier Scorecard',  roles: ['warehouse_manager'], keywords: ['performance', 'rating', 'kpi', 'evaluation'] },
  '/customer-portal':   { label: 'Customer Portal',     roles: ['store_manager'], keywords: ['self-service', 'orders', 'tracking'] },
  '/multi-channel':     { label: 'Multi-Channel',       roles: [], keywords: ['ecommerce', 'channels', 'marketplace', 'sync'] },
  '/transportation':    { label: 'Transportation',      roles: [], keywords: ['routing', 'delivery', 'fleet', 'shipping'] },
  '/3pl':               { label: '3PL Management',      roles: [], keywords: ['third party', 'logistics', 'fulfillment'] },
  '/manufacturing':     { label: 'Manufacturing',       roles: ['warehouse_manager'], keywords: ['production', 'bom', 'work orders'] },
  '/ai-copilot':        { label: 'AI Copilot',          roles: ['warehouse_manager'], keywords: ['assistant', 'chat', 'ai', 'help'] },
  '/forecasting':       { label: 'AI Forecasting',      roles: ['warehouse_manager'], keywords: ['predict', 'demand', 'planning', 'ml'] },
  '/aiops':             { label: 'AIOps',               roles: [], keywords: ['automation', 'ops', 'anomaly', 'monitoring'] },
  '/analytics':         { label: 'Inventory Analytics', roles: ['warehouse_manager'], keywords: ['charts', 'trends', 'insights', 'data'] },
  '/knowledge-base':    { label: 'Knowledge Base',      roles: [], keywords: ['docs', 'sop', 'articles', 'wiki'] },
  '/platform-admin':    { label: 'Platform Admin',      roles: [], keywords: ['system', 'config', 'administration'] },
  '/iam':               { label: 'IAM & Roles',         roles: [], keywords: ['users', 'permissions', 'rbac', 'security', 'access'] },
  '/audit-compliance':  { label: 'Audit & Compliance',  roles: [], keywords: ['audit', 'trail', 'log', 'regulatory', 'sox'] },
  '/monitoring':        { label: 'Monitoring',          roles: [], keywords: ['health', 'uptime', 'metrics', 'alerts'] },
  '/security':          { label: 'Security Center',     roles: [], keywords: ['threats', 'vulnerabilities', 'scan'] },
  '/devops':            { label: 'DevOps',              roles: [], keywords: ['ci', 'cd', 'pipeline', 'deploy'] },
  '/event-bus':         { label: 'Event Bus',           roles: [], keywords: ['events', 'pubsub', 'webhooks', 'messages'] },
  '/observability':     { label: 'Observability',       roles: [], keywords: ['tracing', 'logs', 'metrics', 'apm'] },
  '/scheduler':         { label: 'Scheduler Engine',    roles: [], keywords: ['cron', 'jobs', 'tasks', 'automation'] },
  '/white-label':       { label: 'White Label',         roles: [], keywords: ['branding', 'theme', 'customization'] },
  '/marketplace':       { label: 'App Marketplace',     roles: [], keywords: ['plugins', 'extensions', 'apps'] },
  '/developer-portal':  { label: 'Developer Portal',    roles: [], keywords: ['api', 'sdk', 'documentation', 'keys'] },
  '/releases':          { label: 'Release Management',  roles: [], keywords: ['versioning', 'changelog', 'deploy'] },
  '/onboarding':        { label: 'Onboarding Center',   roles: [], keywords: ['setup', 'wizard', 'getting started'] },
  '/data-migration':    { label: 'Data Migration',      roles: [], keywords: ['import', 'legacy', 'etl', 'transfer'] },
  '/demo-environment':  { label: 'Demo Environment',    roles: [], keywords: ['sandbox', 'trial', 'preview'] },
  '/demo-script':       { label: 'Demo Script',         roles: [], keywords: ['presentation', 'walkthrough', 'sales'] },
  '/launch-readiness':  { label: 'Launch Readiness',    roles: [], keywords: ['go-live', 'checklist', 'readiness'] },
  '/test-automation':   { label: 'Test Automation',     roles: [], keywords: ['qa', 'testing', 'suites', 'regression'] },
  '/documentation':     { label: 'Documentation Portal',roles: [], keywords: ['guides', 'manuals', 'help'] },
  '/implementation-toolkit': { label: 'Implementation Toolkit', roles: [], keywords: ['templates', 'checklist', 'rollout'] },
  '/data-seeder':       { label: 'Data Seeder',         roles: [], keywords: ['sample', 'seed', 'demo data', 'fixtures'] },
  '/workflow':          { label: 'Workflow Engine',     roles: [], keywords: ['automation', 'rules', 'triggers'] },
  '/business-rules':    { label: 'Business Rules Engine', roles: [], keywords: ['logic', 'conditions', 'policies'] },
  '/pricing':           { label: 'Pricing Engine',      roles: [], keywords: ['price books', 'discounts', 'tariffs'] },
  '/master-data':       { label: 'Master Data',         roles: [], keywords: ['mdm', 'families', 'variants', 'vendor catalog'] },
  '/documents':         { label: 'Document Management', roles: [], keywords: ['files', 'attachments', 'storage'] },
  '/assets':            { label: 'Asset Management',    roles: [], keywords: ['equipment', 'tracking', 'maintenance'] },
  '/quality':           { label: 'Quality Management',  roles: [], keywords: ['qms', 'inspection', 'nonconformance', 'defects'] },
  '/api-hub':           { label: 'API Hub',             roles: [], keywords: ['endpoints', 'integrations', 'webhooks'] },
  '/data-warehouse':    { label: 'Data Warehouse',      roles: [], keywords: ['analytics', 'olap', 'reporting', 'bi'] },
  '/comms-hub':         { label: 'Communication Hub',   roles: [], keywords: ['notifications', 'email', 'sms', 'messages'] },
  '/settings':          { label: 'Settings',            roles: [], keywords: ['configuration', 'preferences', 'system'] },
  '/enterprise-settings': { label: 'Enterprise Settings', roles: [], keywords: ['company', 'organization', 'config'] },
  '/alerts':            { label: 'Alerts',              roles: ['warehouse_manager', 'store_manager', 'cashier', 'inventory_staff'], keywords: ['notifications', 'warnings', 'low stock'] },
  '/executive':         { label: 'Executive Dashboard', roles: [], keywords: ['ceo', 'overview', 'strategic', 'kpi'] },
  '/insights':          { label: 'AI Insights',         roles: ['warehouse_manager'], keywords: ['intelligence', 'recommendations', 'analysis'] },
  '/benchmarking':      { label: 'Benchmarking',        roles: [], keywords: ['comparison', 'performance', 'industry'] },
  '/customer-success':  { label: 'Customer Success',    roles: [], keywords: ['retention', 'satisfaction', 'accounts'] },
  '/investor-metrics':  { label: 'Investor Metrics',    roles: [], keywords: ['investors', 'financials', 'growth', 'valuation'] },
  '/data-seeder':       { label: 'Data Seeder',          roles: [], keywords: ['sample', 'seed', 'demo data', 'fixtures'] },
  '/app-documentation': { label: 'App Documentation',    roles: [], keywords: ['docs', 'api', 'reference'] },
};

// super_admin implicitly accesses everything; otherwise check the roles list.
export function canAccess(path, role) {
  if (role === 'super_admin') return true;
  const route = ROUTE_ACCESS[path];
  if (!route) return false;
  return route.roles.includes(role);
}

// Flat list of routes the given role can access — used by the Command Palette.
export function getAccessibleRoutes(role) {
  return Object.entries(ROUTE_ACCESS)
    .filter(([path]) => canAccess(path, role))
    .map(([path, config]) => ({ path, label: config.label, keywords: config.keywords || [] }));
}