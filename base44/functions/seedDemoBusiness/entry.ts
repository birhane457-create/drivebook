import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Industry configurations with realistic, linked business data ───────────
const INDUSTRIES = {
  retail: {
    label: 'ShopSmart Retail Co.',
    tagline: 'Omnichannel retail — apparel, electronics, home goods',
    locations: [
      { name: 'ShopSmart Flagship Store', type: 'store', address: '1 Market St, Sydney NSW 2000', phone: '+61 2 9000 1000', manager_name: 'Sarah Mitchell', is_active: true },
      { name: 'ShopSmart Westfield Branch', type: 'store', address: '188 Pitt St, Sydney NSW 2000', phone: '+61 2 9000 1001', manager_name: 'James Cook', is_active: true },
      { name: 'ShopSmart Distribution Centre', type: 'warehouse', address: '50 Logistics Dr, Mascot NSW 2020', phone: '+61 2 9000 1002', manager_name: 'Linh Tran', is_active: true },
    ],
    productBases: [
      "Men's Cotton Crew Tee", "Men's Slim Fit Jeans", "Men's Oxford Shirt", "Men's Hooded Jacket", "Men's Running Shorts",
      "Women's Summer Dress", "Women's Skinny Jeans", "Women's Blazer", "Women's Yoga Leggings", "Women's Knit Sweater",
      "Wireless Earbuds Pro", "Bluetooth Speaker Mini", "USB-C Fast Charger 65W", "Smart Watch Series 6", "Phone Case Premium",
      "Ceramic Coffee Mug Set", "Bamboo Cutting Board", "LED Desk Lamp", "Cotton Bath Towel Set", "Non-Stick Fry Pan 28cm",
      "Children's Graphic Tee", "Kids Sneakers Size 13", "Baby Onesie 3-Pack", "Plush Toy Bear", "Building Blocks 200pc",
      "Aviator Sunglasses", "Leather Wallet Brown", "Canvas Tote Bag", "Stainless Water Bottle", "Yoga Mat Pro",
    ],
    categories: ['Apparel', 'Electronics', 'Home', 'Kids', 'Accessories'],
    brands: ['NovaWear', 'TechPulse', 'HomeCraft', 'LittleSteps', 'UrbanLine'],
    suppliers: ['Asian Textile Group', 'Shenzhen Electronics Ltd', 'HomeGoods Manufacturing', 'Pacific Import Co', 'Global Freight Logistics', 'Sydney Apparel Supply'],
    customers: ['Walk-in Retail', 'Online Storefront', 'Corporate Uniforms Pty', 'School Uniform Shop', 'Boutique on George', 'Fashion Outlet Perth', 'Marketplace Seller AU', 'Gift Shop Circular Quay', 'Tourist Shop Bondi', 'Resale Boutique'],
  },

  manufacturing: {
    label: 'PrecisionMfg Industries',
    tagline: 'Precision machining — raw materials to finished components',
    locations: [
      { name: 'Main Production Plant', type: 'warehouse', address: '12 Industry Blvd, Melbourne VIC 3000', phone: '+61 3 8000 2000', manager_name: 'Robert Chen', is_active: true },
      { name: 'Raw Materials Store', type: 'warehouse', address: '14 Industry Blvd, Melbourne VIC 3000', phone: '+61 3 8000 2001', manager_name: 'Maria Garcia', is_active: true },
      { name: 'Finished Goods Warehouse', type: 'warehouse', address: '16 Industry Blvd, Melbourne VIC 3000', phone: '+61 3 8000 2002', manager_name: 'David Kim', is_active: true },
    ],
    productBases: [
      'Steel Round Bar 25mm', 'Aluminium Sheet 2mm', 'Stainless Steel Plate 3mm', 'Copper Rod 10mm', 'Brass Bar Stock 20mm',
      'Hex Bolt M12 Grade 8.8', 'Hex Nut M12 Galvanised', 'Flat Washer M12', 'Spring Washer M10', 'Threaded Rod M10',
      'Hydraulic Cylinder 50mm Bore', 'Pneumatic Valve 1/2"', 'Ball Bearing 6204', 'Linear Guide Rail 400mm', 'Coupling Jaw Type',
      'CNC End Mill 6mm', 'Drill Bit HSS 8mm', 'Taps M8 Set', 'Grinding Wheel 150mm', 'Welding Wire 1.2mm',
      'Electric Motor 3kW', 'Gearbox Assembly NEMA23', 'Control Panel Enclosure', 'PLC Module 16IO', 'Sensor Proximity M12',
      'Paint Primer Grey 5L', 'Lubricant Oil 20L', 'Cutting Fluid 10L', 'Adhesive Industrial 1kg', 'Safety Gloves Box 12',
    ],
    categories: ['Raw Material', 'Fastener', 'Component', 'Tooling', 'Consumable'],
    brands: ['MachPro', 'FastLock', 'HydroForce', 'CutMaster', 'SafeWork'],
    suppliers: ['BHP Steel Supplies', 'Bo Metals Distributor', 'Fastener World Pty', 'Hydraulic Systems Co', 'Cutting Tools Direct', 'Industrial Consumables Group'],
    customers: ['Aussie Motors Assembly', 'Defence Systems Pty', 'Mining Equipment Co', 'Elevator Manufacturers AU', 'HVAC Engineering Group', 'Food Processing Machines', 'Conveyor Systems Ltd', 'Automation Integrators', 'OEM Pump Manufacturers', 'Steel Fabricators Perth'],
  },

  wholesale: {
    label: 'BulkWholesale Distribution',
    tagline: 'B2B wholesale distribution — industrial & commercial supplies',
    locations: [
      { name: 'Brisbane Distribution Centre', type: 'warehouse', address: '100 Trade Dr, Brisbane QLD 4000', phone: '+61 7 8000 3000', manager_name: 'Peter Walsh', is_active: true },
      { name: 'Perth Distribution Centre', type: 'warehouse', address: '200 Commerce Way, Perth WA 6000', phone: '+61 8 8000 3001', manager_name: 'Emily Wright', is_active: true },
      { name: 'Trade Counter Brisbane', type: 'store', address: '102 Trade Dr, Brisbane QLD 4000', phone: '+61 7 8000 3002', manager_name: 'Tony Nguyen', is_active: true },
    ],
    productBases: [
      'Industrial Cleaner 20L', 'Degreaser Concentrate 5L', 'Disinfectant Surface 15L', 'Hand Sanitiser Gel 5L', 'Glass Cleaner 5L',
      'Safety Helmet White', 'Safety Goggles Clear', 'Hi-Vis Vest XL', 'Steel Cap Boots Size 10', 'Cut-Resistant Gloves L',
      'PVC Pipe 50mm 6m', 'Copper Pipe 22mm 3m', 'Galvanised Conduit 20mm', 'Electrical Wire 2.5mm 100m', 'Cable Ties 300mm Bag 100',
      'LED Tube Light 1200mm', 'Power Strip 6 Outlet', 'Circuit Breaker 20A', 'Switch Socket Double', 'Wall Plate White',
      'Garden Hose 18m', 'Sprinkler Head Pop-Up', 'Fertiliser 10kg', 'Potting Mix 25L', 'Mulch Bark Bag 50L',
      'Plumbing PTFE Tape', 'Silicone Sealant White', 'Expanding Foam 750ml', 'Thread Seal Compound', 'Pipe Wrench 300mm',
    ],
    categories: ['Cleaning', 'Safety', 'Plumbing', 'Electrical', 'Garden'],
    brands: ['CleanPro', 'SafeGuard', 'PipeRight', 'VoltLine', 'GreenThumb'],
    suppliers: ['Chemical Manufacturing Co', 'Safety Gear Imports', 'Plumbing Supplies Direct', 'Electrical Wholesalers AU', 'Garden Trade Supply', 'Packaging Solutions Ltd'],
    customers: ['Contractors Supplies Brisbane', 'Building Maintenance Co', 'Facility Services Group', 'Council Works Depot', 'Mining Site Stores', 'School Maintenance Dept', 'Hotel Group Procurement', 'Restaurant Chain HQ', 'Hospital Facilities', 'Strata Management Co', 'Landscaping Services', 'Electricians Wholesale', 'Plumbers Trade Co', 'Cleaners Supply House', 'Hardware Store Chain'],
  },

  threpl: {
    label: 'RapidLogistics 3PL',
    tagline: 'Third-party logistics — multi-client warehousing & fulfilment',
    locations: [
      { name: '3PL Hub East', type: 'warehouse', address: '1 Freight Terminal, Port Botany NSW 2036', phone: '+61 2 8000 4000', manager_name: 'Anna Kowalski', is_active: true },
      { name: '3PL Hub West', type: 'warehouse', address: '2 Port Access Rd, Fremantle WA 6160', phone: '+61 8 8000 4001', manager_name: 'Carlos Mendez', is_active: true },
      { name: 'Cold Storage Facility', type: 'warehouse', address: '3 Cold Chain Dr, Sydney NSW 2000', phone: '+61 2 8000 4002', manager_name: 'Beth Olsen', is_active: true },
    ],
    productBases: [
      'Laptop 15" Pro - Client A', 'Wireless Mouse - Client A', 'USB-C Hub 7-in-1 - Client A', 'Monitor Stand - Client A', 'Keyboard Mechanical - Client A',
      'Skincare Serum 30ml - Client B', 'Face Cream 50ml - Client B', 'Shampoo Bottle 300ml - Client B', 'Body Wash 500ml - Client B', 'Cosmetic Brush Set - Client B',
      'Vitamin C Tablets 200s - Client C', 'Pain Relief 24s - Client C', 'First Aid Kit - Client C', 'Thermometer Digital - Client C', 'Bandage Roll - Client C',
      'Brake Pad Front - Client D', 'Oil Filter PH16 - Client D', 'Air Filter AF20 - Client D', 'Spark Plug Iridium - Client D', 'Wiper Blade 22" - Client D',
      'T-Shirt Black M - Client E', 'Hoodie Grey L - Client E', 'Leggings Black S - Client E', 'Cap Black - Client E', 'Socks 5-Pack - Client E',
      'Energy Drink 500ml - Client F', 'Protein Bar 12-Pack - Client F', 'Sports Drink 600ml - Client F', 'Water Bottle 1.5L - Client F', 'Snack Pack - Client F',
    ],
    categories: ['Electronics', 'Beauty', 'Pharma', 'Automotive', 'Apparel', 'Beverage'],
    brands: ['ClientStock', '3PLGoods', 'StoredItem', 'FulfilItem'],
    suppliers: ['Shipping Container Services', 'Packaging Materials Co', 'Pallet Supplies Pty', 'Forklift Parts Direct', 'Warehouse Consumables', 'Freight Forwarder AU'],
    customers: ['Client A Electronics Co', 'Client B Beauty Brand', 'Client C Pharma Pty', 'Client D AutoParts', 'Client E Apparel Co', 'Client F Beverage Group', 'Online Retailer X', 'Subscription Box Co', 'E-commerce Brand Y', 'Direct-to-Consumer Z'],
  },

  pharmacy: {
    label: 'MediCare Pharmacy Group',
    tagline: 'Community pharmacy chain — OTC, prescriptions, supplements',
    locations: [
      { name: 'MediCare Flagship Pharmacy', type: 'store', address: '1 Health St, Adelaide SA 5000', phone: '+61 8 8000 5000', manager_name: 'Dr. Priya Sharma', is_active: true },
      { name: 'MediCare Suburb Pharmacy', type: 'store', address: '50 Medical Dr, Adelaide SA 5067', phone: '+61 8 8000 5001', manager_name: 'Mark Davies', is_active: true },
      { name: 'MediCare Cold Chain Store', type: 'warehouse', address: '8 Pharma Way, Adelaide SA 5000', phone: '+61 8 8000 5002', manager_name: 'Jenny Liu', is_active: true },
    ],
    productBases: [
      'Paracetamol 500mg 100 Tablets', 'Ibuprofen 200mg 48 Tablets', 'Aspirin 300mg 100 Tablets', 'Cetirizine 10mg 30 Tablets', 'Loratadine 10mg 30 Tablets',
      'Vitamin D3 1000IU 90 Capsules', 'Vitamin C 1000mg 100 Tablets', 'Multivitamin Daily 60 Tablets', 'Fish Oil 1000mg 200 Capsules', 'Magnesium 350mg 90 Tablets',
      'First Aid Dressing Large', 'Bandage Elastic 7.5cm', 'Antiseptic Cream 30g', 'Hand Sanitiser 500ml', 'Digital Thermometer',
      'Blood Pressure Monitor', 'Glucometer Kit', 'Nasal Spray Saline', 'Cough Syrup 200ml', 'Throat Lozenges 16 Pack',
      'Sunscreen SPF50+ 200ml', 'Moisturiser Fragrance-Free 100ml', 'Hand Cream 75ml', 'Baby Wipes 80 Pack', 'Nappy Cream 100g',
      'Insulin Vial Refill Service', 'Syringe 1ml Box 30', 'Face Mask Surgical Box 50', 'Oximeter Fingertip', 'Pregnancy Test 2-Pack',
    ],
    categories: ['OTC', 'Supplements', 'First Aid', 'Personal Care', 'Medical Device'],
    brands: ['MediCare', 'HealthGuard', 'VitaPlus', 'PureCare', 'PharmaLife'],
    suppliers: ['Pharmaceutical Wholesalers AU', 'Vitamin Manufacturers Co', 'Medical Supplies Direct', 'Personal Care Distributors', 'Health Products Import', 'Cold Chain Logistics Pty'],
    customers: ['Walk-in Patients', 'Aged Care Facility North', 'Aged Care Facility South', 'Hospital Outpatient', 'Clinic Health Co', 'Corporate Health Program', 'Gym Wellness Centre', 'School Health Office', 'Childcare Centre Group', 'Home Health Service'],
  },

  automotive: {
    label: 'AutoParts Pro Distribution',
    tagline: 'Automotive parts distributor — OEM & aftermarket',
    locations: [
      { name: 'AutoParts Main Warehouse', type: 'warehouse', address: '1 Auto Lane, Campbellfield VIC 3649', phone: '+61 3 8000 6000', manager_name: 'Steve Patterson', is_active: true },
      { name: 'AutoParts Trade Counter', type: 'store', address: '2 Auto Lane, Campbellfield VIC 3649', phone: '+61 3 8000 6001', manager_name: 'Kelly Brooks', is_active: true },
      { name: 'AutoParts South Store', type: 'store', address: '50 Car Dr, Dandenong VIC 3175', phone: '+61 3 8000 6002', manager_name: 'Frank Russo', is_active: true },
    ],
    productBases: [
      'Brake Pad Set Front - Sedan', 'Brake Pad Set Rear - SUV', 'Brake Rotor 280mm', 'Brake Caliper LH', 'Brake Fluid 1L',
      'Oil Filter PH-16', 'Air Filter AF-20', 'Fuel Filter FG-10', 'Cabin Filter CF-15', 'Transmission Filter TF-5',
      'Spark Plug Iridium NGK', 'Ignition Coil Pack', 'Battery 12V 60Ah', 'Alternator 120A', 'Starter Motor 12V',
      'Shock Absorber Front Pair', 'Coil Spring Front', 'Control Arm Lower LH', 'Ball Joint Lower', 'Sway Bar Link',
      'Engine Mount LH', 'Transmission Mount', 'Exhaust Muffler', 'Catalytic Converter', 'O2 Sensor Upstream',
      'Timing Belt Kit', 'Water Pump Aluminium', 'Radiator 3-Row', 'Thermostat 88C', 'Coolant 5L Red',
      'Wiper Blade 22" Pair', 'Headlight Globe H7', 'Tail Light Assembly LH', 'Indicator Lens Front RH', 'Mirror Glass LH',
    ],
    categories: ['Brake System', 'Filters', 'Electrical', 'Suspension', 'Engine', 'Body'],
    brands: ['Bosch', 'NGK', 'Denso', 'Monroe', 'Gates', 'Trico'],
    suppliers: ['Bosch Automotive AU', 'NGK Spark Plugs Direct', 'AutoParts Import Co', 'Aftermarket Distributors', 'Performance Parts Pty', 'Japanese Import Parts'],
    customers: ['City Mechanics Workshop', 'Highway Auto Service', 'Tyre & Auto Centre', 'Mobile Mechanic Co', 'Fleet Maintenance Group', 'Car Dealership Service', 'Panel Beaters Supply', 'DIY Auto Enthusiast', 'Racing Team Parts', 'Truck Repair Workshop', 'Motorbike Service', '4x4 Accessories Shop', 'Classic Car Restorers', 'Taxi Fleet Maintenance', 'Rental Car Depot'],
  },

  food: {
    label: 'FreshFoods Distribution',
    tagline: 'Food & beverage distributor — chilled, frozen, ambient',
    locations: [
      { name: 'FreshFoods Cold Storage Hub', type: 'warehouse', address: '1 Fresh Way, Cairns QLD 4870', phone: '+61 7 8000 7000', manager_name: 'Grace Wilson', is_active: true },
      { name: 'FreshFoods Ambient Warehouse', type: 'warehouse', address: '2 Fresh Way, Cairns QLD 4870', phone: '+61 7 8000 7001', manager_name: 'Omar Hassan', is_active: true },
      { name: 'FreshFoods Market Store', type: 'store', address: '50 Market St, Cairns QLD 4870', phone: '+61 7 8000 7002', manager_name: 'Lucy Park', is_active: true },
    ],
    productBases: [
      'Whole Milk 2L', 'Skim Milk 2L', 'Greek Yoghurt 1kg', 'Cheddar Cheese 500g', 'Butter Salted 500g',
      'Fresh Bread Loaf White', 'Wholemeal Bread Loaf', 'Sourdough Round', 'Croissant 6-Pack', 'Bagel 4-Pack',
      'Frozen Pizza Margherita', 'Frozen Vegetables 1kg', 'Ice Cream Vanilla 2L', 'Frozen Berries 500g', 'Frozen Fish Fillet 1kg',
      'Orange Juice 2L', 'Sparkling Water 1.5L', 'Energy Drink 4-Pack', 'Coffee Beans 1kg', 'Tea Bags 100 Pack',
      'Potato Chips 200g', 'Chocolate Bar 100g', 'Biscuits Assorted 500g', 'Nuts Mixed 750g', 'Crackers Box 250g',
      'Chicken Breast 1kg', 'Beef Mince 1kg', 'Pork Loin Chops 4-Pack', 'Fresh Salmon Fillet 500g', 'Prawns Frozen 1kg',
      'Bananas 1kg Bag', 'Apples 1kg Bag', 'Tomatoes 500g', 'Lettuce Iceberg Each', 'Avocado Bag 4-Pack',
    ],
    categories: ['Dairy', 'Bakery', 'Frozen', 'Beverage', 'Snacks', 'Meat', 'Produce'],
    brands: ['FreshDaily', 'BakeHouse', 'ArcticFrost', 'PureBeverage', 'SnackCo', 'PrimeMeat', 'FarmDirect'],
    suppliers: ['Dairy Farmers Co-op', 'Artisan Bakery Supplies', 'Frozen Foods Import Co', 'Beverage Distributors AU', 'Snack Manufacturers', 'Meat Wholesalers', 'Produce Market Co', 'Coffee Roasters Direct'],
    customers: ['Corner Store Chain', 'Cafe Group Brisbane', 'Restaurant Supplies Co', 'School Canteen Services', 'Aged Care Meals Provider', 'Hotel Kitchen Supply', 'Food Truck Operators', 'Catering Services Pty', 'Supermarket Independent', 'Convenience Store Group', 'Bakery Wholesale', 'Pizzeria Chain', 'Corporate Catering', 'Event Venues Food', 'Hospital Kitchen Supply'],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function money(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }
function daysAgoISO(days) { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildProducts(config) {
  const units = ['piece', 'kg', 'liter', 'box', 'pack'];
  return config.productBases.map((name, i) => {
    const category = config.categories[i % config.categories.length];
    const brand = config.brands[i % config.brands.length];
    const unitCost = money(2, 120);
    const markup = 1.4 + (Math.random() * 0.6);
    return {
      name,
      sku: `SKU-${String(i + 1).padStart(5, '0')}`,
      barcode: `93${String(rand(100000000000, 999999999999))}`,
      category,
      brand,
      unit_cost: unitCost,
      selling_price: parseFloat((unitCost * markup).toFixed(2)),
      tax_rate: 10,
      reorder_level: rand(5, 30),
      unit: pick(units),
      is_active: true,
      description: `${category} product: ${name} by ${brand}`,
    };
  });
}

function buildSuppliers(config) {
  return config.suppliers.map((name, i) => ({
    name,
    contact_person: `${pick(['John', 'Mary', 'Alex', 'Sam', 'Lee', 'Pat'])} ${pick(['Smith', 'Brown', 'Nguyen', 'Lee', 'Wilson', 'Taylor'])}`,
    email: name.toLowerCase().replace(/\s+/g, '.') + '@supplier.au',
    phone: `+61 ${pick(['2', '3', '7', '8'])} ${String(rand(10000000, 99999999))}`,
    address: `${rand(1, 200)} ${pick(['Industrial', 'Commerce', 'Trade', 'Supply', 'Business'])} Dr, Australia`,
    balance: money(0, 50000),
    is_active: true,
  }));
}

function buildCustomers(config) {
  return config.customers.map((name, i) => ({
    name,
    email: name.toLowerCase().replace(/\s+/g, '.') + '@customer.au',
    phone: `+61 ${pick(['2', '3', '4', '7', '8'])} ${String(rand(10000000, 99999999))}`,
    address: `${rand(1, 500)} ${pick(['Main', 'King', 'Queen', 'George', 'Pitt'])} St, Australia`,
    loyalty_points: rand(0, 8000),
    credit_balance: money(0, 3000),
    total_purchases: money(0, 800000),
    is_active: true,
  }));
}

function buildStockLevels(products, locations) {
  const levels = [];
  for (const p of products) {
    for (const l of locations) {
      levels.push({
        product_id: p.id,
        location_id: l.id,
        quantity: rand(0, 250),
        reserved_quantity: rand(0, 10),
        damaged_quantity: Math.random() > 0.85 ? rand(1, 5) : 0,
        batch_number: `BATCH-${rand(1000, 9999)}`,
        expiry_date: Math.random() > 0.6 ? daysAgoISO(-rand(30, 365)) : undefined,
      });
    }
  }
  return levels;
}

function buildPurchaseOrders(config, suppliers, locations, products) {
  const pos = [];
  const statuses = ['submitted', 'partial', 'received', 'received', 'closed'];
  for (let i = 0; i < 20; i++) {
    const supplier = pick(suppliers);
    const loc = pick(locations);
    const itemCount = rand(3, 8);
    const items = [];
    let total = 0;
    for (let j = 0; j < itemCount; j++) {
      const prod = pick(products);
      const qty = rand(10, 100);
      const cost = prod.unit_cost || money(5, 50);
      const lineTotal = qty * cost;
      total += lineTotal;
      items.push({
        product_id: prod.id,
        product_name: prod.name,
        quantity_ordered: qty,
        quantity_received: Math.random() > 0.4 ? qty : Math.floor(qty * 0.6),
        unit_cost: cost,
        line_status: Math.random() > 0.5 ? 'complete' : 'partial',
      });
    }
    pos.push({
      po_number: `PO-${String(10000 + i).padStart(6, '0')}`,
      supplier_id: supplier.id,
      destination_location_id: loc.id,
      status: pick(statuses),
      items,
      total_amount: parseFloat(total.toFixed(2)),
      expected_date: daysAgoISO(-rand(1, 30)),
      notes: `${config.label} purchase order`,
    });
  }
  return pos;
}

function buildSales(config, customers, locations, products) {
  const sales = [];
  const statuses = ['completed', 'completed', 'completed', 'completed', 'refunded'];
  const payMethods = ['cash', 'credit_card', 'credit_card', 'bank_transfer'];
  for (let i = 0; i < 30; i++) {
    const cust = pick(customers);
    const loc = pick(locations);
    const itemCount = rand(1, 5);
    const items = [];
    let subtotal = 0;
    for (let j = 0; j < itemCount; j++) {
      const prod = pick(products);
      const qty = rand(1, 10);
      const price = prod.selling_price || money(10, 100);
      const lineTotal = qty * price;
      subtotal += lineTotal;
      items.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        quantity: qty,
        unit_price: price,
        discount: 0,
        tax: parseFloat((lineTotal * 0.1).toFixed(2)),
        total: lineTotal,
      });
    }
    const taxTotal = parseFloat((subtotal * 0.1).toFixed(2));
    const grand = parseFloat((subtotal + taxTotal).toFixed(2));
    sales.push({
      sale_number: `SO-${String(20000 + i).padStart(6, '0')}`,
      location_id: loc.id,
      customer_id: cust.id,
      customer_name: cust.name,
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_total: taxTotal,
      grand_total: grand,
      payments: [{ method: pick(payMethods), amount: grand }],
      status: pick(statuses),
      notes: '',
    });
  }
  return sales;
}

function buildPayables(suppliers, purchaseOrders) {
  return purchaseOrders.slice(0, 10).map((po, i) => {
    const total = po.total_amount;
    const paid = Math.random() > 0.5 ? total : parseFloat((total * 0.5).toFixed(2));
    return {
      bill_number: `BILL-${String(30000 + i).padStart(6, '0')}`,
      supplier_id: po.supplier_id,
      supplier_name: suppliers.find(s => s.id === po.supplier_id)?.name || '',
      po_id: po.id,
      status: paid >= total ? 'paid' : pick(['received', 'partial', 'overdue']),
      bill_date: daysAgoISO(rand(1, 60)),
      due_date: daysAgoISO(-rand(1, 30)),
      subtotal: parseFloat((total / 1.1).toFixed(2)),
      tax_amount: parseFloat((total - total / 1.1).toFixed(2)),
      total_amount: total,
      amount_paid: paid,
      balance_due: parseFloat((total - paid).toFixed(2)),
      currency_code: 'AUD',
      payment_terms: pick(['net_7', 'net_15', 'net_30', 'net_60']),
    };
  });
}

function buildReceivables(customers, sales) {
  return sales.slice(0, 10).map((sale, i) => {
    const total = sale.grand_total;
    const paid = Math.random() > 0.4 ? total : parseFloat((total * 0.5).toFixed(2));
    return {
      invoice_number: `INV-${String(40000 + i).padStart(6, '0')}`,
      customer_id: sale.customer_id,
      customer_name: sale.customer_name,
      sale_id: sale.id,
      status: paid >= total ? 'paid' : pick(['sent', 'partial', 'overdue']),
      invoice_date: daysAgoISO(rand(1, 45)),
      due_date: daysAgoISO(-rand(1, 30)),
      subtotal: sale.subtotal,
      tax_amount: sale.tax_total,
      total_amount: total,
      amount_paid: paid,
      balance_due: parseFloat((total - paid).toFixed(2)),
      currency_code: 'AUD',
      payment_terms: pick(['immediate', 'net_7', 'net_15', 'net_30']),
    };
  });
}

// ─── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const industry = body?.industry;
    const config = INDUSTRIES[industry];
    if (!config) return Response.json({ error: 'Invalid industry. Options: ' + Object.keys(INDUSTRIES).join(', ') }, { status: 400 });

    const sr = base44.asServiceRole;
    const summary = { industry, label: config.label, locations: 0, products: 0, suppliers: 0, customers: 0, stockLevels: 0, purchaseOrders: 0, sales: 0, payables: 0, receivables: 0 };

    // 1. Locations
    const locations = await sr.entities.Location.bulkCreate(config.locations);
    summary.locations = locations.length;

    // 2. Products
    const products = await sr.entities.Product.bulkCreate(buildProducts(config));
    summary.products = products.length;

    // 3. Suppliers
    const suppliers = await sr.entities.Supplier.bulkCreate(buildSuppliers(config));
    summary.suppliers = suppliers.length;

    // 4. Customers
    const customers = await sr.entities.Customer.bulkCreate(buildCustomers(config));
    summary.customers = customers.length;

    // 5. Stock levels
    const stockLevels = buildStockLevels(products, locations);
    await sr.entities.StockLevel.bulkCreate(stockLevels);
    summary.stockLevels = stockLevels.length;

    // 6. Purchase orders
    const purchaseOrders = buildPurchaseOrders(config, suppliers, locations, products);
    const createdPOs = await sr.entities.PurchaseOrder.bulkCreate(purchaseOrders);
    summary.purchaseOrders = createdPOs.length;

    // 7. Sales
    const sales = buildSales(config, customers, locations, products);
    const createdSales = await sr.entities.Sale.bulkCreate(sales);
    summary.sales = createdSales.length;

    // 8. Financials
    const payables = buildPayables(suppliers, createdPOs);
    await sr.entities.AccountsPayable.bulkCreate(payables);
    summary.payables = payables.length;

    const receivables = buildReceivables(customers, createdSales);
    await sr.entities.AccountsReceivable.bulkCreate(receivables);
    summary.receivables = receivables.length;

    return Response.json({ success: true, summary });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});