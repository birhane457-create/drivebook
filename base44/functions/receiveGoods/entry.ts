import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Executes the full Receiving Goods workflow as a single logical transaction.
// Since the platform has no native multi-entity transaction, every mutation is
// tracked so it can be reversed (best-effort compensating rollback) if a later
// step fails.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const rollbackOps = []; // { undo: async () => {} }

  const runRollback = async () => {
    for (let i = rollbackOps.length - 1; i >= 0; i--) {
      try { await rollbackOps[i].undo(); } catch (_e) { /* best effort */ }
    }
  };

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { po_id, receipts } = body || {};

    if (!po_id) return Response.json({ error: 'po_id is required' }, { status: 400 });
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return Response.json({ error: 'receipts must be a non-empty array of { product_id, quantity, unit_cost }' }, { status: 400 });
    }

    const db = base44.asServiceRole;

    // ---------- 1. Validate PO ----------
    const po = await db.entities.PurchaseOrder.get(po_id);
    if (!po) return Response.json({ error: 'Purchase order not found' }, { status: 404 });
    if (!['submitted', 'partial'].includes(po.status)) {
      return Response.json({
        error: `Purchase order cannot receive goods while status is "${po.status}". Only Approved (submitted) or Partially Received POs can be received.`
      }, { status: 422 });
    }

    const items = [...(po.items || [])];
    const locationId = po.destination_location_id;

    // ---------- 2. Validate receipt lines ----------
    const linesToApply = [];
    for (const r of receipts) {
      const idx = items.findIndex(i => i.product_id === r.product_id);
      if (idx === -1) {
        return Response.json({ error: `Product ${r.product_id} is not on this purchase order` }, { status: 422 });
      }
      const qty = Number(r.quantity);
      if (!qty || qty <= 0) {
        return Response.json({ error: `Quantity for ${items[idx].product_name || r.product_id} must be greater than zero` }, { status: 422 });
      }
      const alreadyReceived = items[idx].quantity_received || 0;
      const remaining = items[idx].quantity_ordered - alreadyReceived;
      if (qty > remaining) {
        return Response.json({
          error: `Cannot receive ${qty} of ${items[idx].product_name || r.product_id} — only ${remaining} remaining on this PO line`
        }, { status: 422 });
      }
      linesToApply.push({ idx, qty, unit_cost: r.unit_cost != null ? Number(r.unit_cost) : items[idx].unit_cost });
    }

    const receiptNumber = `GRN-${Date.now().toString(36).toUpperCase()}`;
    const receivedItemsSummary = [];
    let totalValue = 0;

    // ---------- 3-6. Inventory update + audit log + costing per line ----------
    for (const line of linesToApply) {
      const item = items[line.idx];
      const product = await db.entities.Product.get(item.product_id);
      if (!product) {
        await runRollback();
        return Response.json({ error: `Product ${item.product_id} no longer exists` }, { status: 422 });
      }

      // StockLevel: find or create
      const existingLevels = await db.entities.StockLevel.filter({ product_id: item.product_id, location_id: locationId });
      let stockLevel = existingLevels[0];
      const qtyBefore = stockLevel ? (stockLevel.quantity || 0) : 0;
      const qtyAfter = qtyBefore + line.qty;

      if (stockLevel) {
        const prevQty = stockLevel.quantity;
        await db.entities.StockLevel.update(stockLevel.id, { quantity: qtyAfter });
        rollbackOps.push({ undo: async () => db.entities.StockLevel.update(stockLevel.id, { quantity: prevQty }) });
      } else {
        stockLevel = await db.entities.StockLevel.create({ product_id: item.product_id, location_id: locationId, quantity: qtyAfter });
        rollbackOps.push({ undo: async () => db.entities.StockLevel.delete(stockLevel.id) });
      }

      // InventoryLog
      const log = await db.entities.InventoryLog.create({
        product_id: item.product_id,
        product_name: item.product_name,
        location_id: locationId,
        type: 'purchase_receive',
        quantity_change: line.qty,
        quantity_before: qtyBefore,
        quantity_after: qtyAfter,
        reference_id: po.id,
        reference_type: 'purchase_order',
        notes: `Received via ${receiptNumber} by ${user.full_name || user.email}`,
      });
      rollbackOps.push({ undo: async () => db.entities.InventoryLog.delete(log.id) });

      // Costing: weighted average cost
      const prevOnHand = product.total_on_hand || 0;
      const prevAvgCost = product.average_cost != null ? product.average_cost : (product.unit_cost || 0);
      const newOnHand = prevOnHand + line.qty;
      const newAvgCost = newOnHand > 0
        ? ((prevOnHand * prevAvgCost) + (line.qty * line.unit_cost)) / newOnHand
        : line.unit_cost;

      const prevProductData = { average_cost: product.average_cost, total_on_hand: product.total_on_hand, unit_cost: product.unit_cost };
      await db.entities.Product.update(product.id, {
        average_cost: Number(newAvgCost.toFixed(4)),
        total_on_hand: newOnHand,
        unit_cost: line.unit_cost,
      });
      rollbackOps.push({ undo: async () => db.entities.Product.update(product.id, prevProductData) });

      // Update PO line
      const newReceivedQty = (item.quantity_received || 0) + line.qty;
      const lineStatus = newReceivedQty >= item.quantity_ordered ? 'complete' : (newReceivedQty > 0 ? 'partial' : 'pending');
      items[line.idx] = { ...item, quantity_received: newReceivedQty, line_status: lineStatus };

      const lineValue = line.qty * line.unit_cost;
      totalValue += lineValue;
      receivedItemsSummary.push({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_received: line.qty,
        line_status: lineStatus,
        previous_cost: prevAvgCost,
        new_average_cost: Number(newAvgCost.toFixed(4)),
      });

      // ---------- 8. Low-stock alert recalculation ----------
      const existingAlerts = await db.entities.Alert.filter({ reference_id: product.id, reference_type: 'product', type: 'low_stock', is_read: false });
      const stillLow = newOnHand <= (product.reorder_level ?? 10);
      if (!stillLow) {
        for (const a of existingAlerts) {
          await db.entities.Alert.update(a.id, { is_read: true });
        }
      } else if (existingAlerts.length === 0) {
        await db.entities.Alert.create({
          type: 'low_stock',
          title: `Low stock: ${product.name}`,
          message: `${product.name} is at ${newOnHand} units, at or below reorder level of ${product.reorder_level ?? 10}.`,
          severity: newOnHand === 0 ? 'critical' : 'warning',
          reference_id: product.id,
          reference_type: 'product',
        });
      }
    }

    // ---------- 5. Update PO header status ----------
    const allComplete = items.every(i => (i.quantity_received || 0) >= i.quantity_ordered);
    const anyReceived = items.some(i => (i.quantity_received || 0) > 0);
    const newPoStatus = allComplete ? 'closed' : (anyReceived ? 'partial' : po.status);

    const prevPoData = { items: po.items, status: po.status, last_received_date: po.last_received_date, total_received_value: po.total_received_value, receipts: po.receipts };
    await db.entities.PurchaseOrder.update(po.id, {
      items,
      status: newPoStatus,
      last_received_date: new Date().toISOString(),
      total_received_value: (po.total_received_value || 0) + totalValue,
      receipts: [...(po.receipts || []), {
        receipt_number: receiptNumber,
        received_by: user.full_name || user.email,
        received_at: new Date().toISOString(),
        total_value: totalValue,
        line_count: linesToApply.length,
      }],
    });
    rollbackOps.push({ undo: async () => db.entities.PurchaseOrder.update(po.id, prevPoData) });

    // ---------- 7. Supplier performance metrics ----------
    if (po.supplier_id) {
      const period = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
      const scores = await db.entities.SupplierScore.filter({ supplier_id: po.supplier_id, period });
      const totalOrderedQty = items.reduce((s, i) => s + (i.quantity_ordered || 0), 0);
      const totalReceivedQty = items.reduce((s, i) => s + (i.quantity_received || 0), 0);
      const fillRate = totalOrderedQty > 0 ? (totalReceivedQty / totalOrderedQty) * 100 : 100;
      const onTime = po.expected_date ? (new Date() <= new Date(po.expected_date)) : true;

      if (scores[0]) {
        const s = scores[0];
        const newTotalOrders = (s.total_orders || 0) + 1;
        const prevOnTimeRate = s.on_time_delivery_rate || 100;
        const newOnTimeRate = ((prevOnTimeRate * (s.total_orders || 0)) + (onTime ? 100 : 0)) / newTotalOrders;
        await db.entities.SupplierScore.update(s.id, {
          total_orders: newTotalOrders,
          fill_rate: Number(fillRate.toFixed(2)),
          on_time_delivery_rate: Number(newOnTimeRate.toFixed(2)),
        });
      } else {
        await db.entities.SupplierScore.create({
          supplier_id: po.supplier_id,
          period,
          total_orders: 1,
          fill_rate: Number(fillRate.toFixed(2)),
          on_time_delivery_rate: onTime ? 100 : 0,
        });
      }
    }

    // ---------- 9. Audit event ----------
    await db.entities.AuditEvent.create({
      event_type: 'po.received',
      entity_type: 'PurchaseOrder',
      entity_id: po.id,
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      action: 'update',
      new_value: JSON.stringify({ receipt_number: receiptNumber, total_value: totalValue, items: receivedItemsSummary, po_status: newPoStatus }),
    });

    return Response.json({
      success: true,
      receipt_number: receiptNumber,
      po_status: newPoStatus,
      total_value: Number(totalValue.toFixed(2)),
      items_received: receivedItemsSummary,
    });
  } catch (error) {
    await runRollback();
    return Response.json({ error: error.message || 'Receiving failed and all changes were rolled back' }, { status: 500 });
  }
});