import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Handles Stock Transfer status transitions with validation, stock movement,
// and audit logging. Best-effort compensating rollback on failure.

const ALLOWED_TRANSITIONS = {
  pending: ['approved', 'cancelled'],
  approved: ['in_transit', 'cancelled'],
  in_transit: ['received'],
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const rollbackOps = [];

  const runRollback = async () => {
    for (let i = rollbackOps.length - 1; i >= 0; i--) {
      try { await rollbackOps[i].undo(); } catch (_e) { /* best effort */ }
    }
  };

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { transfer_id, new_status } = body || {};

    if (!transfer_id) return Response.json({ error: 'transfer_id is required' }, { status: 400 });
    if (!new_status) return Response.json({ error: 'new_status is required' }, { status: 400 });

    const db = base44.asServiceRole;

    const transfer = await db.entities.StockTransfer.get(transfer_id);
    if (!transfer) return Response.json({ error: 'Transfer not found' }, { status: 404 });

    const allowedNext = ALLOWED_TRANSITIONS[transfer.status] || [];
    if (!allowedNext.includes(new_status)) {
      return Response.json({
        error: `Cannot move transfer from "${transfer.status}" to "${new_status}". Allowed next steps: ${allowedNext.join(', ') || 'none'}.`
      }, { status: 422 });
    }

    const items = transfer.items || [];

    // ---------- Validate stock availability before moving to in_transit ----------
    if (new_status === 'in_transit') {
      for (const item of items) {
        const sourceLevels = await db.entities.StockLevel.filter({ product_id: item.product_id, location_id: transfer.from_location_id });
        const available = sourceLevels[0] ? (sourceLevels[0].quantity || 0) - (sourceLevels[0].reserved_quantity || 0) : 0;
        if (available < item.quantity) {
          return Response.json({
            error: `Insufficient stock for ${item.product_name || item.product_id} at source location — only ${available} available, ${item.quantity} requested.`
          }, { status: 422 });
        }
      }
    }

    // ---------- Move stock on receipt ----------
    if (new_status === 'received') {
      for (const item of items) {
        // Deduct from source
        const sourceLevels = await db.entities.StockLevel.filter({ product_id: item.product_id, location_id: transfer.from_location_id });
        const sourceLevel = sourceLevels[0];
        const sourceBefore = sourceLevel ? (sourceLevel.quantity || 0) : 0;
        if (sourceBefore < item.quantity) {
          await runRollback();
          return Response.json({
            error: `Insufficient stock for ${item.product_name || item.product_id} at source location — only ${sourceBefore} available, ${item.quantity} requested.`
          }, { status: 422 });
        }
        const sourceAfter = sourceBefore - item.quantity;
        await db.entities.StockLevel.update(sourceLevel.id, { quantity: sourceAfter });
        rollbackOps.push({ undo: async () => db.entities.StockLevel.update(sourceLevel.id, { quantity: sourceBefore }) });

        const outLog = await db.entities.InventoryLog.create({
          product_id: item.product_id, product_name: item.product_name,
          location_id: transfer.from_location_id, type: 'transfer_out',
          quantity_change: -item.quantity, quantity_before: sourceBefore, quantity_after: sourceAfter,
          reference_id: transfer.id, reference_type: 'transfer',
          notes: `Transfer ${transfer.transfer_number} to destination`,
        });
        rollbackOps.push({ undo: async () => db.entities.InventoryLog.delete(outLog.id) });

        // Add to destination
        const destLevels = await db.entities.StockLevel.filter({ product_id: item.product_id, location_id: transfer.to_location_id });
        let destLevel = destLevels[0];
        const destBefore = destLevel ? (destLevel.quantity || 0) : 0;
        const destAfter = destBefore + item.quantity;

        if (destLevel) {
          await db.entities.StockLevel.update(destLevel.id, { quantity: destAfter });
          rollbackOps.push({ undo: async () => db.entities.StockLevel.update(destLevel.id, { quantity: destBefore }) });
        } else {
          destLevel = await db.entities.StockLevel.create({ product_id: item.product_id, location_id: transfer.to_location_id, quantity: destAfter });
          rollbackOps.push({ undo: async () => db.entities.StockLevel.delete(destLevel.id) });
        }

        const inLog = await db.entities.InventoryLog.create({
          product_id: item.product_id, product_name: item.product_name,
          location_id: transfer.to_location_id, type: 'transfer_in',
          quantity_change: item.quantity, quantity_before: destBefore, quantity_after: destAfter,
          reference_id: transfer.id, reference_type: 'transfer',
          notes: `Transfer ${transfer.transfer_number} from source`,
        });
        rollbackOps.push({ undo: async () => db.entities.InventoryLog.delete(inLog.id) });
      }
    }

    // ---------- Update transfer status ----------
    const updateData = { status: new_status };
    if (new_status === 'approved') updateData.approved_by = user.full_name || user.email;

    const prevTransferData = { status: transfer.status, approved_by: transfer.approved_by };
    await db.entities.StockTransfer.update(transfer.id, updateData);
    rollbackOps.push({ undo: async () => db.entities.StockTransfer.update(transfer.id, prevTransferData) });

    // ---------- Audit event ----------
    await db.entities.AuditEvent.create({
      event_type: `transfer.${new_status}`,
      entity_type: 'StockTransfer',
      entity_id: transfer.id,
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      action: 'update',
      old_value: transfer.status,
      new_value: new_status,
    });

    return Response.json({ success: true, status: new_status });
  } catch (error) {
    await runRollback();
    return Response.json({ error: error.message || 'Transfer update failed and all changes were rolled back' }, { status: 500 });
  }
});