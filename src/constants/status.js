/**
 * Status color mappings — single source of truth for status → Tailwind classes.
 * Consumed by StatusBadge and any status-aware component.
 */

export const statusColors = {
  // Lifecycle states
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Draft' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Submitted' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
  partial: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500', label: 'Partial' },
  received: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Received' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Closed' },
  cancelled: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Cancelled' },
  // Movement
  in_transit: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'In Transit' },
  // Inventory
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
  inactive: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Inactive' },
  critical: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Critical' },
  low: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Low' },
  // Orders
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Confirmed' },
  processing: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Processing' },
  shipped: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Shipped' },
  delivered: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Delivered' },
  returned: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Returned' },
};

export const severityLevels = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'Info' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'AlertTriangle' },
  critical: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'AlertCircle' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'CheckCircle2' },
};

export const entityStatusLists = {
  product: ['active', 'inactive', 'critical', 'low'],
  purchaseOrder: ['draft', 'submitted', 'partial', 'received', 'closed', 'cancelled'],
  transfer: ['pending', 'approved', 'in_transit', 'received', 'cancelled'],
  customerOrder: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
};