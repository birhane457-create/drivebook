/**
 * App-level configuration — route metadata, feature flags, and app constants.
 * Centralizes app configuration that doesn't belong to a single feature.
 */

export const appConfig = {
  name: 'WMS Pro',
  version: '1.0.0',
  timezone: 'Australia/Perth',
  currency: 'AUD',
  locale: 'en-AU',
};

/** Feature flags — toggle modules on/off without code changes. */
export const featureFlags = {
  aiForecasting: true,
  multiChannel: true,
  threePL: true,
  manufacturing: true,
  qualityManagement: true,
  transportation: true,
  loyaltyProgram: true,
  supplierPortal: true,
  customerPortal: true,
  appMarketplace: true,
};

/** Page metadata for the sidebar and route guards. */
export const pageMeta = {
  dashboard: { title: 'Dashboard', icon: 'LayoutDashboard', role: ['super_admin', 'warehouse_manager', 'store_manager'] },
  products: { title: 'Products', icon: 'Package', role: ['super_admin', 'warehouse_manager', 'inventory_staff'] },
  inventory: { title: 'Inventory', icon: 'Warehouse', role: ['super_admin', 'warehouse_manager', 'inventory_staff'] },
  pos: { title: 'POS', icon: 'ScanLine', role: ['super_admin', 'cashier'] },
  purchases: { title: 'Purchases', icon: 'ShoppingCart', role: ['super_admin', 'warehouse_manager'] },
  transfers: { title: 'Transfers', icon: 'ArrowLeftRight', role: ['super_admin', 'warehouse_manager'] },
};

export { routes, routeGroups } from '@/constants/navigation';
export { default as AppProviders } from '@/providers/AppProviders';