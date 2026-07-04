/** All application routes — single source of truth for navigation and routing. */
export const routes = {
  // Core
  home: '/',
  dashboard: '/dashboard',
  // Operations
  products: '/products',
  barcodeLabels: '/barcode-labels',
  inventory: '/inventory',
  pos: '/pos',
  purchases: '/purchases',
  transfers: '/transfers',
  sales: '/sales',
  customers: '/customers',
  suppliers: '/suppliers',
  // Workflows
  receiving: '/workflows/receiving',
  shipping: '/workflows/shipping',
  returns: '/workflows/returns',
  picking: '/workflows/picking',
  packing: '/workflows/packing',
  manufacturing: '/workflows/manufacturing',
  inspection: '/workflows/inspection',
  // Analytics
  analytics: '/analytics',
  forecasting: '/forecasting',
  reports: '/reports',
  alerts: '/alerts',
  // Admin
  settings: '/settings',
  enterpriseSettings: '/enterprise-settings',
  // Dev tools
  dataSeeder: '/data-seeder',
  appDocumentation: '/app-documentation',
  designSystem: '/design-system',
};

export const routeGroups = {
  Operations: ['dashboard', 'products', 'inventory', 'purchases', 'transfers', 'pos'],
  Workflows: ['receiving', 'shipping', 'returns', 'picking', 'packing', 'manufacturing', 'inspection'],
  Analytics: ['analytics', 'forecasting', 'reports', 'alerts'],
  Administration: ['settings', 'enterpriseSettings'],
  DevTools: ['dataSeeder', 'appDocumentation', 'designSystem'],
};