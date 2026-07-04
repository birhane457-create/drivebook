import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const [products, stockLevels, existingAlerts] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ is_active: true }),
      base44.asServiceRole.entities.StockLevel.list(),
      base44.asServiceRole.entities.Alert.filter({ is_read: false, type: 'low_stock' }),
    ]);

    // Aggregate current on-hand quantity per product across all locations
    const qtyByProduct = {};
    for (const sl of stockLevels) {
      qtyByProduct[sl.product_id] = (qtyByProduct[sl.product_id] || 0) + (sl.quantity || 0);
    }

    // Products already have an unread low_stock alert → skip to avoid duplicates
    const alertedProductIds = new Set(existingAlerts.map(a => a.reference_id));

    const lowStock = products
      .map(p => ({ ...p, current_quantity: qtyByProduct[p.id] || 0 }))
      .filter(p => p.current_quantity <= (p.reorder_level ?? 10));

    const created = [];
    for (const p of lowStock) {
      if (alertedProductIds.has(p.id)) continue;
      const severity = p.current_quantity === 0 ? 'critical' : 'warning';
      const alert = await base44.asServiceRole.entities.Alert.create({
        type: 'low_stock',
        title: `Low Stock: ${p.name}`,
        message: `${p.name} (SKU: ${p.sku || 'N/A'}) is at ${p.current_quantity} unit(s), at or below the reorder level of ${p.reorder_level ?? 10}.`,
        severity,
        is_read: false,
        reference_id: p.id,
        reference_type: 'product',
      });
      created.push(alert.id);
    }

    return Response.json({
      checked: products.length,
      low_stock_count: lowStock.length,
      new_alerts: created.length,
      skipped_duplicates: lowStock.length - created.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});