import { base44 } from '@/api/base44Client';

/**
 * Generic entity service — wraps the Base44 SDK entity operations behind
 * a clean service interface. Import from services instead of calling
 * base44.entities.X directly in components, so the data layer is swappable.
 *
 * Usage:
 *   const productService = createEntityService('Product');
 *   const items = await productService.list({ limit: 50 });
 */
export function createEntityService(entityName) {
  const entity = base44.entities[entityName];

  if (!entity) {
    throw new Error(`Entity "${entityName}" not found on base44 client`);
  }

  return {
    name: entityName,

    list: (sort, limit) => entity.list(sort, limit),

    filter: (query, sort, limit) => entity.filter(query, sort, limit),

    get: (id) => entity.get(id),

    create: (data) => entity.create(data),

    update: (id, data) => entity.update(id, data),

    delete: (id) => entity.delete(id),

    bulkCreate: (records) => entity.bulkCreate(records),

    bulkUpdate: (records) => entity.bulkUpdate(records),

    updateMany: (query, update) => entity.updateMany(query, update),

    deleteMany: (query) => entity.deleteMany(query),

    subscribe: (callback) => entity.subscribe(callback),

    schema: () => entity.schema(),
  };
}

// Pre-instantiated services for core entities
export const productService = createEntityService('Product');
export const inventoryService = createEntityService('StockLevel');
export const customerService = createEntityService('Customer');
export const supplierService = createEntityService('Supplier');
export const orderService = createEntityService('Sale');
export const purchaseOrderService = createEntityService('PurchaseOrder');
export const transferService = createEntityService('StockTransfer');
export const alertService = createEntityService('Alert');