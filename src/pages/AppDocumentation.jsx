import ReactMarkdown from 'react-markdown';

const DOC = `
# WMS Pro — App Documentation (Current State)

_Last generated snapshot of the app as built. Items marked **TODO** are gaps or things that still need real implementation._

## 1. Stack
- React + Vite, Tailwind CSS, shadcn/ui, lucide-react icons
- Base44 backend-as-a-service: entities (DB), auth, integrations
- Routing: react-router-dom (see \`src/App.jsx\`)
- Data fetching: @tanstack/react-query

## 2. Routing & Auth (as-is)
- \`/\` → **Home.jsx** — public marketing landing page (requires app visibility set to "Public" in dashboard settings, otherwise the platform forces login before any route renders — **TODO: confirm app visibility is set to Public in Overview settings**).
- \`/login\`, \`/register\`, \`/forgot-password\`, \`/reset-password\` — standard auth flows, fully wired to the platform auth SDK.
- \`/pos\` — protected, but outside the main \`AppLayout\` (full-screen POS, no sidebar).
- All other app routes (\`/dashboard\`, \`/products\`, \`/inventory\`, etc.) are nested under \`ProtectedRoute\` + \`AppLayout\` (sidebar + topbar), and redirect to \`/login\` if unauthenticated.
- Sidebar navigation (\`Sidebar.jsx\`) shows role-based menus (admin vs staff roles) — **TODO: verify every role's menu only shows pages that role should access; there is currently no route-level role guard, only sidebar hiding.**

## 3. Core Modules (functional CRUD against real entities)
- **Dashboard** — KPI overview
- **Products / Inventory / Purchases / Transfers** — core WMS data entry, backed by \`Product\`, \`StockLevel\`, \`PurchaseOrder\`, \`StockTransfer\` entities
- **POS** — point of sale with offline cart sync (\`OfflinePOSManager\`), cart, payment, receipt
- **Customers / Suppliers / Sales History** — CRM-style CRUD
- **Alerts** — low stock / reorder / expiry notifications, backed by \`Alert\` entity
- **Reports / Inventory Analytics** — charts over real entity data

## 4. Extended Enterprise Modules (UI + entity-backed, but shallow business logic)
These pages have real entities and CRUD wired up, but most **do not perform real backend automation** — actions mostly just write records rather than triggering actual downstream processes:
- Manufacturing (BOM, Production Orders)
- Financials (GL, AP, AR, Cost Centers)
- Approval Workflow, Business Rules Engine, Workflow Automation
- Warehouse Execution, Mobile Warehouse, Transportation Management, 3PL
- Multi-Channel, Pricing Engine, Inventory Optimization
- Quality Management, Asset Management
- Cycle Counting, Supplier Scorecard, Loyalty Program
- Supplier Portal, Customer Portal
- **TODO:** none of these trigger real external side-effects (no real carrier APIs, no real accounting sync, no real ecommerce channel sync) — they are data-entry/reporting shells only.

## 5. Platform / Admin Demo Modules (mostly illustrative, low real-world function)
These simulate a multi-tenant SaaS control plane. They read/write real entities but represent **fictional/simulated platform operations**:
- Platform Admin, IAM, Audit & Compliance, Security Center
- API Hub, Developer Portal, Document Management, Data Warehouse
- Event Bus, Observability, Monitoring Dashboard, DevOps, AI Ops
- App Marketplace, Billing Platform, White Label, Onboarding Center
- Data Migration, Customer Success, Release Management, Benchmarking
- Investor Metrics, Demo Environment, Demo Script, Launch Readiness
- Test Automation, Documentation Portal, Implementation Toolkit
- AI Copilot, AI Insight Hub, Knowledge Base, Communication Hub, Scheduler Engine
- **TODO:** these are demo/pitch-style screens. If this app is meant to actually run as a SaaS platform (not just showcase one), each of these needs real backend wiring (webhooks, billing provider, real test runners, real deployment pipeline, etc.) — currently all "actions" only affect entity records, no real infrastructure is touched.

## 6. Integrations currently used
- \`InvokeLLM\` — used for AI draft generation (Documentation Portal), forecasting-style features
- **TODO:** No payment provider connected yet (Stripe is available for this app's region — set up when real payments are needed)
- **TODO:** No email/SMS provider connected for real customer notifications (Alerts are in-app only)
- **TODO:** No real external connectors (Shipping/carrier, Accounting, E-commerce channels) are authorized — "integration" pages are UI shells only

## 7. Known Gaps Summary (TODO)
1. **TODO** — Confirm app visibility setting (Public vs Private) matches intended behavior for landing page vs protected app.
2. **TODO** — Add server-side role checks (currently role-based access is UI-only via sidebar, not enforced per-route).
3. **TODO** — Connect real payment provider before enabling billing/checkout flows.
4. **TODO** — Wire real notification delivery (email/SMS) for Alerts instead of in-app only.
5. **TODO** — Decide which "Platform / Admin Demo Modules" (section 5) should become real functionality vs remain illustrative; scope real backend work accordingly.
6. **TODO** — Add automated tests / QA coverage (Test Automation page currently just records test run data, does not execute real tests).
`;

export default function AppDocumentation() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <article className="prose prose-sm max-w-none">
        <ReactMarkdown>{DOC}</ReactMarkdown>
      </article>
    </div>
  );
}