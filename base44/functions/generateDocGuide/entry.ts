import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GUIDES = {
  user: {
    title: 'User Guide',
    prompt: `Write a comprehensive User Guide for an enterprise inventory management platform (WMS Pro). Cover: Getting Started (login, navigation, dashboard), Inventory Management (viewing stock, adjusting quantities, transfers), Sales & POS (creating sales, processing payments, refunds), Purchasing (creating purchase orders, receiving goods), Reports (viewing and exporting), and Alerts (responding to low-stock and expiry alerts). Include step-by-step instructions and tips. Use markdown headings (##), bullet points, and numbered steps. Write for end-users (store staff, warehouse workers, managers). Target 1500 words.`,
  },
  admin: {
    title: 'Administrator Guide',
    prompt: `Write a comprehensive Administrator Guide for an enterprise inventory management platform (WMS Pro). Cover: System Configuration (company settings, currency, tax rules, locations), User & Role Management (inviting users, roles, permissions), Tenant Management, Billing & Plans, White-Label Setup (branding, custom domain), Audit & Compliance (audit logs, compliance tags), and Integrations (connecting external services). Include step-by-step instructions. Use markdown headings (##), bullet points. Write for system administrators. Target 1500 words.`,
  },
  warehouse: {
    title: 'Warehouse Guide',
    prompt: `Write a comprehensive Warehouse Operations Guide for an enterprise WMS (WMS Pro). Cover: Receiving (dock-to-stock workflow, purchase order receipts, putaway), Picking (pick waves, batch picking, license plates), Packing, Shipping (carrier integration, labels), Transfers (inter-warehouse stock transfers), Cycle Counting, Bin Management, and Cross-Docking. Include workflow steps and best practices. Use markdown headings (##), bullet points. Write for warehouse managers and floor staff. Target 1500 words.`,
  },
  pos: {
    title: 'POS Guide',
    prompt: `Write a comprehensive POS (Point of Sale) Guide for an inventory management platform (WMS Pro). Cover: Starting a Sale (scanning barcodes, manual entry), Cart Management (quantities, discounts, removing items), Payment Processing (cash, card, store credit), Receipts & Printing, Returns & Refunds, Offline Mode, End-of-Day Reconciliation, and Loyalty Programs. Include step-by-step instructions. Use markdown headings (##), bullet points. Write for retail cashiers and store managers. Target 1200 words.`,
  },
  api: {
    title: 'API Integration Guide',
    prompt: `Write a comprehensive API Integration Guide for an enterprise inventory platform (WMS Pro). Cover: Authentication (API keys, OAuth tokens), Entities API (CRUD for Products, Sales, Purchase Orders, Stock Levels with JSON examples), Webhooks (event types, payload structure, signature verification), Rate Limits, Error Codes, and SDKs. Include JSON request/response examples. Use markdown headings (##), code blocks (json), bullet points. Write for developers integrating external systems. Target 1500 words.`,
  },
  components: {
    title: 'UI Component Guide',
    prompt: `Write a comprehensive UI Component Guide for an enterprise inventory platform (WMS Pro). Cover: Design Tokens (colors, typography, spacing), Core Components (Button, Card, Input, Select, Badge, Table), Shared Components (PageHeader, StatCard, SectionCard, FilterBar, EmptyState, DataTable), Enterprise Components (KanbanBoard, PivotTable, GanttChart, WorkflowDesigner), Charts (area, bar, donut, sankey), and UX Patterns (global search, command palette, breadcrumbs, split screen, quick actions). Include usage examples and prop tables. Use markdown headings (##), bullet points. Write for frontend developers building pages. Target 1500 words.`,
  },
  developer: {
    title: 'Developer Guide',
    prompt: `Write a comprehensive Developer Guide for an enterprise inventory platform (WMS Pro). Cover: Architecture Overview (React + Vite frontend, Deno backend functions, entity data model), Creating Entities, Backend Functions (Deno.serve pattern, SDK usage, secrets), Automations (scheduled, entity-triggered, connector webhooks), Integrations (InvokeLLM, file uploads, emails), Agents (config, tool permissions, channels), and Frontend SDK (entity operations, auth, real-time subscriptions). Include code examples. Use markdown headings (##), code blocks (javascript), bullet points. Target 1500 words.`,
  },
  theme: {
    title: 'Theme Guide',
    prompt: `Write a comprehensive Theme & Styling Guide for an enterprise inventory platform (WMS Pro). Cover: Design Token System (CSS variables in index.css, mapping to Tailwind), Color Palette (primary, accent, destructive, sidebar - light & dark), Typography (font roles: heading, body, display, mono), Component Styling (using token classes vs hardcoded values), Dark Mode (toggling, .dark class), Custom Themes (adding new tokens), and White-Label Branding (company-specific theming). Include code examples for each. Use markdown headings (##), code blocks (css/javascript), bullet points. Target 1200 words.`,
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const guideId = body?.guideId;
    const guide = GUIDES[guideId];
    if (!guide) return Response.json({ error: 'Invalid guide. Options: ' + Object.keys(GUIDES).join(', ') }, { status: 400 });

    const sr = base44.asServiceRole;
    const result = await sr.integrations.Core.InvokeLLM({
      prompt: guide.prompt,
    });

    const content = typeof result === 'string' ? result : (result?.content || JSON.stringify(result));

    const article = await sr.entities.KnowledgeArticle.create({
      title: guide.title,
      type: 'guide',
      content,
      tags: [guideId, 'documentation', 'generated'],
      module: guide.title,
      version: '1.0',
      status: 'published',
      author: user.full_name || 'Base44 Docs',
      view_count: 0,
    });

    return Response.json({ success: true, guideId, title: guide.title, articleId: article.id, content });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});