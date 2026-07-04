# WMS Pro — Frontend Developer Guide

Welcome to the WMS Pro frontend. This document is the single source of truth for how the
application is structured, which conventions to follow, and how to ship a new module that
already matches the rest of the product on day one.

Read this end-to-end before writing your first feature. The "Building a New Module" section at
the bottom is a step-by-step checklist — every page in the app today follows it.

---

## 1. Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 (Vite) |
| Styling | Tailwind CSS + design tokens (`src/index.css` + `tailwind.config.js`) |
| UI primitives | shadcn/ui (Radix-based) in `src/components/ui/` |
| Icons | `lucide-react` (only icons that actually exist) |
| Routing | `react-router-dom` v6 |
| Data fetching / cache | `@tanstack/react-query` v5 |
| Backend | Base44 BaaS (entities, auth, functions, integrations) via `@/api/base44Client` |
| Forms | `react-hook-form` + `zod` (available; most pages use controlled state + `Field`) |
| Charts | `recharts` wrapped by `src/components/charts/` |
| Animations | `framer-motion` |
| Dates | `date-fns` |
| Maps | `react-leaflet` · 3D: `three` · DnD: `@hello-pangea/dnd` |

Only the packages listed in `package.json` are available. Do **not** install or import any
other library — it will break the build. If you need something new, request it through the
normal channel.

---

## 2. Folder Structure

```
src/
  api/
    base44Client.js        # Pre-initialized Base44 SDK (entities, auth, functions, integrations)
  components/
    ui/                    # shadcn/ui primitives (Button, Card, Dialog, Select, …) — low level
    shared/                # App-level shared building blocks (StatCard, Field, ErrorState, …)
    layout/                # AppLayout (app shell) + EnterprisePageLayout (per-page shell)
    data-table/            # AdvancedDataTable + toolbar/filter/view components
    charts/                # ChartCard + StandardCharts (recharts wrappers)
    dialogs/               # FormDialog, wizard dialogs, confirm dialogs
    forms/                 # Higher-level form patterns
    enterprise/            # Advanced enterprise widgets (Kanban, Gantt, Pivot, QueryBuilder…)
    widgets/               # Domain widgets grouped by module (inventory, sales, finance…)
    animations/            # framer-motion building blocks
    ux/                    # Breadcrumbs, GlobalSearch, QuickActions, SplitScreen, TabbedWorkspace
    workflow/              # Guided workflow screens
    labels/                # Barcode label printing components
    pos/                   # Point-of-sale components
    products/, purchases/, transfers/   # Module-specific sub-components
  hooks/                   # useToastMutation, useLocalStorage, useFavorites, useRecentItems, …
  lib/                     # utils, query-client, AuthContext, route-access, PageNotFound
  pages/                   # One file per route (default export)
    workflows/             # Guided workflow pages (receiving, shipping, picking, …)
  constants/               # navigation, status maps
  contexts/, providers/    # App-wide context + provider composition
  services/                # entityService (entity abstraction helpers)
  theme/                   # token definitions
  utils/                   # misc utils
  App.jsx                  # Router + providers (the wiring)
  main.jsx                 # Vite entry
  index.css                # Design tokens (@layer base) + global styles
base44/
  entities/                # Entity JSON schemas (the data model)
  functions/               # Backend functions (Deno)
  agents/                  # In-app AI agent configs
```

**Rules**
- One component per file. Keep files focused (aim ≤ ~150 lines; split when larger).
- Every page/component is a **default export** named exactly like its file.
- Imports use the `@/` alias (`@/components/...`, `@/api/base44Client`). **Never** use relative
  `src/...` paths — they break when files move.
- Do not create a root `src/Layout.jsx`. Shared chrome lives in `src/components/layout/`.

---

## 3. Routing (`src/App.jsx`)

`App.jsx` is the single source of truth for routes. A page with no `<Route>` here is
unreachable. Routes are code-split with `React.lazy` + `<Suspense>`.

```jsx
<Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
  <Route element={<RoleGuard />}>
    <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<Dashboard />} />
      …
    </Route>
  </Route>
</Route>
```

**Layering (outside → in):**
1. **`AuthProvider` / `QueryClientProvider` / `Router` / `Toaster`** — top-level providers.
2. **`AuthenticatedApp`** — resolves auth; renders a fullscreen loader or `UserNotRegisteredError`.
3. **`ProtectedRoute`** — gate; redirects unauthenticated users to `/login`.
4. **`RoleGuard`** — RBAC check against `src/lib/route-access.js`.
5. **`AppLayout`** — the app shell (sidebar + topbar + `<Outlet/>`). Every authenticated page
   renders inside it (POS is intentionally rendered outside the shell).
6. The page component.

When you add a page:
1. Create `src/pages/MyPage.jsx` (default export `MyPage`).
2. In `App.jsx`: add `const MyPage = lazy(() => import('@/pages/MyPage'));` near the other
   imports, and a `<Route path="/my-page" element={<MyPage />} />` inside the `<AppLayout>`
   group.
3. Add the nav entry in `src/constants/navigation.js` (and `route-access.js` if role-restricted).

**Main/home page** is the `/` route. Changing it = edit the `/` `<Route>` in `App.jsx`.

---

## 4. Authentication

The platform owns the auth backend (tokens, sessions, email verification). **Never**
reimplement auth logic. The SDK lives on the pre-initialized client:

```js
import { base44 } from '@/api/base44Client';
base44.auth.me()                  // current user (throws if not logged in)
base44.auth.isAuthenticated()     // Promise<boolean>
base44.auth.updateMe(data)        // persist extra profile fields
base44.auth.logout(redirectUrl?)  // then redirect
base44.auth.redirectToLogin(nextUrl?)
```

Boilerplate auth pages already exist and are fully functional — **do not recreate them**:
- `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`
- Register flow is multi-step: `register → OTP → verifyOtp → setToken → hard redirect`.
- Hard redirects use `window.location.href = '/'`, never `navigate()` (the auth provider must
  re-initialize).
- `ProtectedRoute` is at `src/components/ProtectedRoute.jsx` and renders `<Outlet/>` when authed.

Customize auth pages only on explicit request; edit in place and preserve every flow step.

The built-in **User** entity is read-only (`id, email, full_name, role`). You cannot create
User records — invite users with `base44.users.inviteUser(email, role)`.

---

## 5. Layout System

### App shell — `src/components/layout/AppLayout.jsx`
Renders the sidebar (`src/components/layout/Sidebar.jsx`), top bar (global search, command
palette, notifications, user menu), and `<Outlet/>` for the page. Sidebar collapse state is
managed here and the content area reclaims space responsively.

### Page shell — `src/components/layout/EnterprisePageLayout.jsx`
**Every page must wrap its content in `EnterprisePageLayout`.** It gives every screen the same
breadcrumbs, header, action bar, KPI row, filter bar, content area, and optional right-side
activity panel. It is the backbone of the design system.

```jsx
<EnterprisePageLayout
  title="Purchase Orders"
  description="Manage supplier orders and goods receiving"
  primaryAction={{ label: 'New PO', icon: Plus, onClick: openForm }}
  secondaryActions={[{ label: 'Export', icon: Download, onClick: exportCsv, variant: 'outline' }]}
  kpis={[
    { label: 'Open POs', value: openCount, icon: ShoppingCart, trend: '+3 this week', trendUp: true },
    { label: 'Awaiting', value: partial, icon: Clock },
  ]}
  filters={<FilterBar … />}        // ReactNode, rendered below the action bar
  toolbar={<Toolbar … />}          // ReactNode, below filters
  activityFeed={<ActivityFeed …/>} // optional right-side panel
  isLoading={isLoading}            // shows skeleton KPIs + skeleton content
>
  {/* main content: AdvancedDataTable, charts, cards, etc. */}
</EnterprisePageLayout>
```

Key props:
- `primaryAction` / `secondaryActions` — `{ label, icon, onClick, variant? }`. Pass `undefined`
  for no primary action.
- `kpis` — array of `{ label, value, icon, trend?, trendUp? }` → rendered as `StatCard`s.
- `isLoading` — when `true`, renders 4 skeleton KPI cards **and** a skeleton content block
  **instead of** `children`. Pass this for the page's initial load so every page gets free
  skeleton loading with one prop. Children render normally once `isLoading` is false.
- Breadcrumbs are auto-generated from the current URL (via `src/components/ux/Breadcrumbs.jsx`
  + `src/constants/navigation.js`); you usually don't pass them manually.

**Do not** render your own `PageHeader` + KPI grid. That pattern is legacy; use the layout.

---

## 6. Design System

### Tokens — `src/index.css`
All colors, fonts, shadows, and radius live as CSS variables under `:root` and `.dark` in
`src/index.css`, then mapped to Tailwind classes in `tailwind.config.js`. **Never hardcode
hex values, inline styles, or `bg-white`/`font-[Inter]` in JSX.** Use the mapped token classes.

```css
:root {
  --primary: 244 68% 60%;
  --background: 210 20% 98.5%;
  --card: 0 0% 100%;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --shadow-soft: …;  /* mapped to shadow-soft */
}
```
```js
// tailwind.config.js maps them:
colors: { primary: 'hsl(var(--primary))', card: { DEFAULT: 'hsl(var(--card))' }, … },
fontFamily: { body: ['var(--font-body)'], heading: ['var(--font-heading)'], … },
boxShadow: { soft: 'var(--shadow-sm)', elevated: 'var(--shadow-md)', floating: 'var(--shadow-lg)' },
```

Use in JSX: `bg-primary text-primary-foreground`, `font-heading`, `shadow-soft`, `shadow-elevated`.

**To change the theme** (colors, fonts): edit values in `src/index.css` (`:root` **and** `.dark`),
optionally add tokens to `tailwind.config.js`. Add a new custom token only when a semantic
token isn't enough and the value is reused.

### Tailwind class names
Write Tailwind classes as **literal strings** only. The build purges anything not found as a
literal substring in source, so dynamic names (`bg-${color}-500`, `"bg-" + shade`) silently
disappear. Use `safelist` in `tailwind.config.js` **only** for runtime-sourced values (entity
records, API responses, user input) — never for classes present in source.

### Shadows / motion
- Shadows: `shadow-2xs`, `shadow-xs`, `shadow-soft`, `shadow-elevated`, `shadow-floating`.
- Card hover: use the `card-hover` utility class (lifts 1px + shadow on hover).
- Page transitions / lists: use `src/components/animations/` (`AnimatedPage`, `StaggerContainer`,
  `AnimatedCard`, `AnimatedTableRows`).

---

## 7. Reusable Components

### 7.1 UI primitives — `src/components/ui/`
shadcn/ui. Use these directly: `Button`, `Card`, `Input`, `Textarea`, `Select`, `Badge`,
`Dialog`, `Tabs`, `Switch`, `Checkbox`, `Progress`, `Skeleton`, `Tooltip`, `Popover`,
`DropdownMenu`, `Alert`, `Separator`, `ScrollArea`, `Sheet`, `Avatar`, etc. Don't reinvent
these.

### 7.2 App shared — `src/components/shared/`
Higher-level building blocks used across pages:

- **`StatCard`** — KPI card (`title, value, icon, trend, trendUp`). Always via `EnterprisePageLayout.kpis`, rarely direct.
- **`PageHeader`** — legacy; prefer `EnterprisePageLayout`. (A few old pages may still use it.)
- **`SectionCard`** — titled card with icon + optional actions; for grouped content/lists.
- **`Field`** — form field wrapper. Decorates its child with `id`, error/help messaging, and
  a label. **This is the standard form field wrapper.**
  ```jsx
  <Field label="Name" required error={err} help="…" htmlFor="x">
    <Input id="x" … />   // Field clones the child and injects id=htmlFor
  </Field>
  ```
- **`FormSection`** — titled, icon-led bordered panel that groups `Field`s. `columns={2|3}`.
  ```jsx
  <FormSection title="Details" icon={User} columns={2}>…fields…</FormSection>
  ```
- **`FormDialog`** — the standard create/edit modal. `open, onOpenChange, title, description,
  submitLabel, onSubmit, isPending, submitDisabled, children`. Renders its own Cancel/Submit
  footer. **Use this for every create/edit form.**
- **`StatusBadge`** — maps a status string to a consistent colored badge (`statusStyles` map).
  Use it for all status pills; don't hand-roll badge colors per page.
- **`EmptyState`** — `illustration, title, description, className`. Use for empty lists/grids.
- **`ErrorState`** — `title, message, onRetry`. Use for failed query/error UI with a retry.
- **`FilterBar`** — standardized filter row.
- **`PageLoader`** / `PageFooter` — full-screen loader and the global footer.

### 7.3 Data table — `src/components/data-table/AdvancedDataTable.jsx`
The single table component for all lists. Built-in: search, sortable columns, column
visibility/resize, saved views, density, pagination, CSV export, row selection, skeleton
loading, and integrated `ErrorState` + manual retry.

```jsx
<AdvancedDataTable
  tableId="purchase-orders"            // localStorage persistence key
  columns={columns}
  data={rows}
  isLoading={isLoading}                // skeleton rows
  error={query.error}                  // shows ErrorState
  onRetry={query.refetch}
  emptyMessage="No purchase orders yet"
/>
```

Column definition:
```js
{ key: 'name', label: 'Name', render: r => <span>{r.name}</span>, align?: 'right', cellClassName? }
{ key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> }
{ key: 'actions', label: '', type: 'actions', align: 'right', actions: [
    { label: 'Edit', icon: Edit2, onClick: r => openEdit(r), show: r => r.status !== 'closed', disabled: r => isSaving },
]}
```
- `type: 'actions'` renders a row of icon buttons; each action supports `show(row)` and
  `disabled(row)`. Buttons auto `stopPropagation`.
- For row click, pass `onRowClick`.
- **Do not** use the legacy `DataTable` (`src/components/shared/DataTable.jsx`) in new code —
  it's being phased out. Use `AdvancedDataTable`.

### 7.4 Charts — `src/components/charts/`
- **`ChartCard`** — titled chart container with icon/description. Wrap every chart in it.
- **`StandardCharts`** — `TrendAreaChart`, `BarSeriesChart`, `DonutChart`, and more (Funnel,
  Radar, Heatmap, Treemap, Sankey, Waterfall, Bubble, Pareto, Control, Gauge, CalendarHeatmap,
  Timeline). Use these wrappers; they apply the design tokens and consistent sizing.
- Specialized charts (`ParetoChart`, `SankeyChart`, …) live alongside; reach for them only when
  the standard ones don't fit.

### 7.5 Enterprise widgets — `src/components/enterprise/`
Advanced building blocks: `KanbanBoard`, `GanttChart`, `PivotTable`, `DashboardBuilder`,
`QueryBuilder`, `FilterBuilder`, `RuleBuilder`, `FormulaBuilder`, `OrgChart`, `Scheduler`,
`TreeView`, `Heatmap`, `MapWidget`, `WidgetLibrary`, `MasterDetail`, `EntityCard`,
`AnalyticsCard`, `ApprovalTimeline`, `Timeline`, `DynamicFormBuilder`, `PropertyPanel`,
`SplitView`, `MiniCalendar`, `WorkflowDesigner`. Use these for rich module UIs instead of
hand-rolling.

### 7.6 Dialogs / forms — `src/components/dialogs/`
`FormDialog` (standard), plus `CreateDialog`, `EditDialog`, `ConfirmationDialog`, and wizard
dialogs (`WizardDialog`, `DeleteWizard`, `ImportWizard`, `ExportWizard`, `BulkEditDialog`,
`MergeWizard`, `ArchiveWizard`, `DuplicateWizard`, `ApprovalDialog`). Prefer `FormDialog` for
simple create/edit; use the wizards for multi-step destructive/bulk operations.

### 7.7 Widgets — `src/components/widgets/`
Domain widgets grouped by area (`InventoryWidgets`, `SalesWidgets`, `FinanceWidgets`,
`WarehouseWidgets`, `CustomerWidgets`, `SupplierWidgets`, `ForecastWidgets`, `AIWidgets`,
`RiskWidgets`, `ComplianceWidgets`, …) composed via `WidgetCard` / `WidgetLibrary`.

### 7.8 UX — `src/components/ux/`
`Breadcrumbs`, `GlobalSearchBar`, `QuickActions`, `SplitScreen`, `TabbedWorkspace`,
`ContextMenuWrapper`. Wire these where relevant (e.g., `GlobalSearchBar` in the topbar).

---

## 8. Hooks (`src/hooks/`)

- **`useToastMutation`** — **the standard mutation wrapper for all CRUD.** Wraps
  `useMutation` with: success/error toast, optimistic updates via `optimisticUpdater`, and
  automatic cache invalidation of `queryKeys` on success.
  ```js
  const mu = useToastMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    queryKeys: [['products']],
    successMessage: 'Product created',
    optimisticUpdater: (qc, vars) => { /* update cache; return rollback fn */ },
    onSuccess: () => closeForm(),
  });
  mu.mutate(payload);  // use mu.isPending, mu.mutate, etc.
  ```
  Always use this instead of raw `useMutation` + `sonner` toasts. (The shadcn `Toaster` is what's
  mounted in `App.jsx` — sonner toasts won't render.)
- **`useLocalStorage`** — persisted state.
- **`useFavorites`** / **`useRecentItems`** — the "favorites" and "recently viewed" features
  used by the shell and `EnterprisePageLayout`.
- **`useKeyboardShortcuts`** — global hotkeys / command palette wiring.
- **`useMediaQuery`** / **`use-mobile`** — responsive breakpoints.
- **`useDebounce`** — debounced values for search inputs.

---

## 9. Providers & State Management

### Providers (`App.jsx` + `src/providers/AppProviders.jsx`)
Top-level composition: `AuthProvider` → `QueryClientProvider` → `Router` → `Toaster`.
Additional app context is composed in `src/contexts/` and `src/providers/`.

### State strategy (in priority order)
1. **Server state → React Query.** All entity data comes from `base44.entities.*` via `useQuery`.
   Cache keys are string arrays: `['products']`, `['sales']`, `['cycle-counts']`,
   `['supplier-scores']`, `['stock-levels']`… Keep key conventions consistent so mutations can
   invalidate the right cache.
   ```js
   const { data: products = [], isLoading, error, refetch } = useQuery({
     queryKey: ['products'],
     queryFn: () => base44.entities.Product.list(),
   });
   ```
2. **Mutations → `useToastMutation`** (see above). Always pass the `queryKeys` you want
   invalidated.
3. **Local UI state → `useState`** (form open/closed, selected row, form values).
4. **Cross-cutting UI → Context** (`AuthContext`, plus `src/contexts/`). Don't reach for Redux —
   the app doesn't use it.

### Loading / error / empty contract
Every data view implements all three:
- **Loading** → pass `isLoading` to `AdvancedDataTable` (skeleton) and/or
  `EnterprisePageLayout.isLoading` (skeleton KPIs + content).
- **Error** → pass `error` + `onRetry` to `AdvancedDataTable`, or render `<ErrorState>` with a
  retry. Never silently swallow.
- **Empty** → pass `emptyMessage` to `AdvancedDataTable`, or render `<EmptyState>`.

### Realtime
Entities support subscriptions; update state from the event in the callback (no heavy work):
```js
useEffect(() => {
  const unsubscribe = base44.entities.Todo.subscribe(event => { /* update state */ });
  return unsubscribe;
}, []);
```

---

## 10. Services & the Base44 SDK

### `src/api/base44Client.js`
The pre-initialized SDK. Import and use directly — never call `createClient()` or re-init.

```js
import { base44 } from '@/api/base44Client';
// Entities (user-scoped by default)
base44.entities.Product.list();                       // list()
base44.entities.Product.list('-created_date', 20);    // sort, limit
base44.entities.Product.filter({ status: 'active' }, '-created_date', 10);
base44.entities.Product.create({ … });
base44.entities.Product.update(id, { … });
base44.entities.Product.delete(id);
base44.entities.Product.bulkCreate([ … ]);            // up to 500
base44.entities.Product.updateMany({ status: 'draft' }, { $set: { status: 'archived' } });
base44.entities.Product.schema();                     // JSON schema (good for forms)
// Service role (admin) — only when business logic requires elevation
base44.asServiceRole.entities.Product.list();
// Functions (backend)
const res = await base44.functions.invoke('processTransfer', { transfer_id, new_status });
res.data;  // your function's payload
// Integrations
const { file_url } = await base44.integrations.Core.UploadFile({ file });
base44.integrations.Core.InvokeLLM({ prompt, … });
// Analytics
base44.analytics.track({ eventName: 'pos_checkout', properties: { total } });
```

Prefer **user-scoped** calls (`base44.entities…`). Use `base44.asServiceRole` only for admin
operations, after verifying auth and that the logic permits the elevation.

### `src/services/entityService.js`
Thin abstraction helpers over the SDK for repeated entity patterns — reach for it before
duplicating query/mutation wiring across a module.

### Backend functions (`base44/functions/*/entry.ts`)
Deno HTTP handlers for external APIs without a built-in integration. Frontend calls them only
via `base44.functions.invoke(name, payload)`; the response is an Axios-like object — your data
is in `response.data`. Reuse existing functions (e.g. `processTransfer`, `receiveGoods`,
`checkLowStockAlerts`) before creating new ones.

### Integrations
`base44.integrations.Core` provides `InvokeLLM`, `UploadFile`, `SendEmail`, `GenerateImage`,
`GenerateSpeech`, `GenerateVideo`, `TranscribeAudio`, `ExtractDataFromUploadedFile`,
`CreateFileSignedUrl`, `UploadPrivateFile`. For OAuth connectors (Slack, Google, Notion, …) use
the connector tooling rather than hand-rolled OAuth.

---

## 11. Entities (Data Model)

Schemas live in `base44/entities/<Name>.jsonc` as full JSON schema objects. Built-in fields on
every record (never declare them): `id`, `created_date`, `updated_date`, `created_by_id`.

When you need a new stored field: edit the entity JSON schema (full object, no
comments/placeholders), then use it in the UI via the SDK. Never store large content (base64,
PDFs, blobs) in a field — upload via `UploadFile` and store the `file_url`.

The **User** entity is built-in and read-only on the client; invite users via
`base44.users.inviteUser(email, role)`.

---

## 12. Coding Standards & Naming Conventions

**Naming**
- Files: `PascalCase.jsx` for components/pages, matching the default export name exactly
  (`PurchaseOrderForm.jsx` → `export default function PurchaseOrderForm`).
- Functions/variables: `camelCase`. Constants: `UPPER_SNAKE`.
- Hooks: `useXxx`. Entities: `PascalCase` (`PurchaseOrder`). Query keys: `['kebab-or-camel']`,
  consistent per entity.
- Routes: `kebab-case` (`/purchase-orders`).

**Code style**
- Default export every page/component, named like the file.
- Use `@/` alias imports only; no relative `src/` paths.
- shadcn/ui from `@/components/ui`; Tailwind for styling; `lucide-react` for icons (only icons
  that exist — a missing icon breaks the whole app).
- Every import must resolve to a real file or installed package.
- Read route params with `new URLSearchParams(window.location.search)`.
- Let errors bubble (no try/catch) except **user-facing forms/auth flows**, which catch and
  show inline errors (that error display *is* the feature).
- For forms, prefer controlled state + `Field`/`FormSection`/`FormDialog`. `react-hook-form` +
  `zod` is available for complex validation.
- Component files ≤ ~150 lines; split larger ones into `src/components/<module>/` subfolders.

**Styling**
- Token classes only (`bg-primary`, `font-heading`, `shadow-elevated`); no hardcoded hex,
  inline color styles, or `bg-white`.
- Literal Tailwind class strings only (the purge step drops dynamic names).
- Responsive by default (mobile → desktop); the app also ships to iOS/Android from this code.

**Behavior**
- Preserve all existing functionality and routing when refactoring. UI changes must not alter
  business logic unless asked.
- Make the minimum change needed; don't add speculative error handling, extra sections, or
  features nobody asked for.
- Every button works, every flow finishes, content actually renders — no stubs.

---

## 13. Building a New Module — Step by Step

Use this checklist; it's exactly how the existing pages (Purchases, Inventory, Settings, …)
are built.

### 1. Model the data
If new storage is needed, create/edit `base44/entities/<Entity>.jsonc` (full JSON schema).

### 2. Create the page
`src/pages/MyModule.jsx` with a default export `MyModule`.

### 3. Wire the route + nav
- `src/App.jsx`: lazy import + `<Route path="/my-module" element={<MyModule />} />` inside the
  `<AppLayout>` group.
- `src/constants/navigation.js`: add the sidebar entry.
- `src/lib/route-access.js`: add role restriction if needed.

### 4. Fetch data with React Query
```js
const itemsQ = useQuery({ queryKey: ['my-items'], queryFn: () => base44.entities.MyItem.list('-created_date') });
const items = itemsQ.data || [];
```

### 5. Wrap in `EnterprisePageLayout`
```jsx
<EnterprisePageLayout
  title="My Module"
  description="What this module does"
  primaryAction={{ label: 'New Item', icon: Plus, onClick: openForm }}
  kpis={[
    { label: 'Total', value: items.length, icon: List },
    { label: 'Active', value: items.filter(i => i.is_active).length, icon: Activity, trendUp: true },
  ]}
  isLoading={itemsQ.isLoading}
>
  {/* content */}
</EnterprisePageLayout>
```

### 6. List with `AdvancedDataTable`
Define columns; use `StatusBadge` for statuses, `type: 'actions'` for row actions
(`show`/`disabled` for conditional buttons). Pass `isLoading`, `error`, `onRetry`,
`emptyMessage`.

### 7. Create/edit with `FormDialog` + `FormSection` + `Field`
Keep form state in the page (`useState`); open with a reset; disable submit until valid.
```jsx
const [showForm, setShowForm] = useState(false);
const [form, setForm] = useState(EMPTY);
const createMutation = useToastMutation({
  mutationFn: (data) => base44.entities.MyItem.create(data),
  queryKeys: [['my-items']],
  successMessage: 'Item created',
  onSuccess: () => { setShowForm(false); setForm(EMPTY); },
});
…
<FormDialog open={showForm} onOpenChange={setShowForm} title="New Item" submitLabel="Create"
  isPending={createMutation.isPending} submitDisabled={!form.name}
  onSubmit={() => createMutation.mutate(form)}>
  <FormSection title="Details" icon={List} columns={2}>
    <Field label="Name" required htmlFor="mi-name"><Input id="mi-name" …/></Field>
    …
  </FormSection>
</FormDialog>
```

### 8. Mutations → `useToastMutation`
Use it for create/update/delete. Pass the `queryKeys` to invalidate. Use `optimisticUpdater`
when you want instant UI feedback with rollback.

### 9. Charts (if needed)
Wrap every chart in `ChartCard`; use `StandardCharts` helpers. Show `EmptyState` for no data.

### 10. Loading / error / empty
- Pass `isLoading` to the layout and/or table.
- Pass `error` + `onRetry` to the table, or render `<ErrorState>`.
- Pass `emptyMessage` to the table, or render `<EmptyState>`.

### 11. Optional right panel
Pass `activityFeed={<ActivityFeed items={…} />}` to `EnterprisePageLayout` for a recent-activity
rail (see `Purchases.jsx` for a reference implementation).

### 12. Analytics
Track key actions: `base44.analytics.track({ eventName: 'my_module_action', properties: {} })`.

### 13. Verify
- Page renders inside the shell with breadcrumbs, KPIs, and standard spacing.
- Create/edit flows close the dialog, toast, and refresh the list.
- Error → retry works; empty → friendly message; loading → skeleton.
- Responsive on mobile and desktop.

**Reference pages to copy from:**
- Full CRUD + receiving workflow + activity feed: `src/pages/Purchases.jsx`
- Simple list + refund action: `src/pages/SalesHistory.jsx`
- Tabs + multiple forms + seed defaults: `src/pages/EnterpriseSettings.jsx`
- Cards grid + history + form: `src/pages/SupplierScorecard.jsx`
- Dashboard with charts + skeleton + retry: `src/pages/Dashboard.jsx`, `ExecutiveDashboard.jsx`

---

## 14. Quick Reference

| You want to… | Use |
|---|---|
| Page shell / breadcrumbs / KPIs | `EnterprisePageLayout` |
| List table | `AdvancedDataTable` |
| Create/edit modal form | `FormDialog` + `FormSection` + `Field` |
| CRUD mutation + toast | `useToastMutation` |
| Status pill | `StatusBadge` |
| KPI card | `kpis` prop on `EnterprisePageLayout` (→ `StatCard`) |
| Chart | `ChartCard` + `StandardCharts` |
| Empty state | `EmptyState` |
| Error + retry | `ErrorState` |
| Loading | `isLoading` prop (layout/table) or `Skeleton` |
| Fetch data | `useQuery` + `base44.entities.*` |
| Call backend function | `base44.functions.invoke(name, payload)` → `res.data` |
| Upload file | `base44.integrations.Core.UploadFile` |
| Toast (ad-hoc) | `import { toast } from '@/components/ui/use-toast'` |
| Icons | `lucide-react` (existing icons only) |
| Colors/fonts/shadows | token classes in `src/index.css` / `tailwind.config.js` |

---

## 15. Do / Don't

**Do**
- Wrap every page in `EnterprisePageLayout`.
- Use `AdvancedDataTable` for lists; `FormDialog`+`Field` for forms; `useToastMutation` for writes.
- Implement loading + error + empty for every data view.
- Keep files small and focused; one default export per file.
- Reuse shared components before writing new ones.

**Don't**
- Don't recreate auth pages or auth backend logic.
- Don't use legacy `PageHeader`/`DataTable` in new code.
- Don't hardcode colors/fonts/shadows; don't build dynamic Tailwind class names.
- Don't install unlisted packages.
- Don't store large blobs in entity fields.
- Don't add features, sections, or speculative error handling the task didn't ask for.

Welcome aboard — when in doubt, find the closest reference page and match it.