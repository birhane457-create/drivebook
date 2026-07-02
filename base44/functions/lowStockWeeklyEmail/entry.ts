import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const [products, stockLevels, admins] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ is_active: true }),
      base44.asServiceRole.entities.StockLevel.list(),
      base44.asServiceRole.entities.User.filter({ role: 'admin' }),
    ]);

    const qtyByProduct = {};
    for (const sl of stockLevels) {
      qtyByProduct[sl.product_id] = (qtyByProduct[sl.product_id] || 0) + (sl.quantity || 0);
    }

    const lowStock = products
      .map(p => ({ ...p, current_quantity: qtyByProduct[p.id] || 0 }))
      .filter(p => p.current_quantity <= (p.reorder_level ?? 10))
      .sort((a, b) => a.current_quantity - b.current_quantity);

    if (admins.length === 0) {
      return Response.json({ message: 'No admin users found to email' });
    }

    const rows = lowStock.length > 0
      ? lowStock.map(p => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${p.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${p.sku || ''}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${p.current_quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${p.reorder_level ?? 10}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="padding:8px;">No low-stock items this week 🎉</td></tr>`;

    const body = `
      <h2>Weekly Low-Stock Summary</h2>
      <p>${lowStock.length} product(s) at or below their reorder level.</p>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
        <thead>
          <tr style="background:#f5f5f5;text-align:left;">
            <th style="padding:8px;">Product</th>
            <th style="padding:8px;">SKU</th>
            <th style="padding:8px;">Current Qty</th>
            <th style="padding:8px;">Reorder Level</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    for (const admin of admins) {
      if (!admin.email) continue;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `Weekly Low-Stock Summary (${lowStock.length} item${lowStock.length === 1 ? '' : 's'})`,
        body,
      });
    }

    return Response.json({ sent_to: admins.map(a => a.email), low_stock_count: lowStock.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});