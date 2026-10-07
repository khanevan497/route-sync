import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const DEPOT_ADDRESS = {
  street: '1 Industrial Way',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  country: 'US',
}

async function main() {
  console.log('Seeding database...')

  // Wipe existing data (order matters for FK constraints)
  await db.notification.deleteMany()
  await db.auditLog.deleteMany()
  await db.proofOfDelivery.deleteMany()
  await db.routeStop.deleteMany()
  await db.delivery.deleteMany()
  await db.route.deleteMany()
  await db.maintenanceRecord.deleteMany()
  await db.customerAddress.deleteMany()
  await db.customer.deleteMany()
  await db.vehicle.deleteMany()
  await db.driver.deleteMany()
  await db.membership.deleteMany()
  await db.session.deleteMany()
  await db.account.deleteMany()
  await db.user.deleteMany()
  await db.organization.deleteMany()

  // ─── Organization ────────────────────────────────────────────────────────────
  const org = await db.organization.create({
    data: { name: 'Apex Logistics', slug: 'apex-logistics' },
  })
  console.log('  ✓ Organization created')

  // ─── Users ───────────────────────────────────────────────────────────────────
  const pw = await hash('password123', 12)

  const owner = await db.user.create({
    data: { name: 'Sarah Mitchell', email: 'owner@apexlogistics.com', passwordHash: pw },
  })
  const admin = await db.user.create({
    data: { name: 'James Okafor', email: 'admin@apexlogistics.com', passwordHash: pw },
  })
  const dispatcher = await db.user.create({
    data: { name: 'Maria Santos', email: 'dispatch@apexlogistics.com', passwordHash: pw },
  })
  const fleetManager = await db.user.create({
    data: { name: 'Derek Huang', email: 'fleet@apexlogistics.com', passwordHash: pw },
  })

  // Driver user accounts
  const driverUsers = await Promise.all([
    db.user.create({ data: { name: 'Carlos Rivera', email: 'carlos@apexlogistics.com', passwordHash: pw } }),
    db.user.create({ data: { name: 'Amara Nwosu', email: 'amara@apexlogistics.com', passwordHash: pw } }),
    db.user.create({ data: { name: 'Tom Kowalski', email: 'tom@apexlogistics.com', passwordHash: pw } }),
    db.user.create({ data: { name: 'Priya Patel', email: 'priya@apexlogistics.com', passwordHash: pw } }),
    db.user.create({ data: { name: 'Jake Thornton', email: 'jake@apexlogistics.com', passwordHash: pw } }),
  ])

  // ─── Memberships ─────────────────────────────────────────────────────────────
  await db.membership.createMany({
    data: [
      { userId: owner.id, organizationId: org.id, role: 'OWNER' },
      { userId: admin.id, organizationId: org.id, role: 'ADMIN' },
      { userId: dispatcher.id, organizationId: org.id, role: 'DISPATCHER' },
      { userId: fleetManager.id, organizationId: org.id, role: 'FLEET_MANAGER' },
      { userId: driverUsers[0].id, organizationId: org.id, role: 'DRIVER' },
      { userId: driverUsers[1].id, organizationId: org.id, role: 'DRIVER' },
      { userId: driverUsers[2].id, organizationId: org.id, role: 'DRIVER' },
      { userId: driverUsers[3].id, organizationId: org.id, role: 'DRIVER' },
      { userId: driverUsers[4].id, organizationId: org.id, role: 'DRIVER' },
    ],
  })
  console.log('  ✓ Users & memberships created')

  // ─── Drivers ─────────────────────────────────────────────────────────────────
  const expiry2027 = new Date('2027-06-30')
  const expiry2026 = new Date('2026-12-31')

  const drivers = await Promise.all([
    db.driver.create({ data: { organizationId: org.id, userId: driverUsers[0].id, name: 'Carlos Rivera', email: 'carlos@apexlogistics.com', phone: '+1 512 555 0101', licenseNumber: 'TX-DL-448821', licenseExpiry: expiry2027, status: 'ACTIVE' } }),
    db.driver.create({ data: { organizationId: org.id, userId: driverUsers[1].id, name: 'Amara Nwosu', email: 'amara@apexlogistics.com', phone: '+1 512 555 0102', licenseNumber: 'TX-DL-330247', licenseExpiry: expiry2027, status: 'ACTIVE' } }),
    db.driver.create({ data: { organizationId: org.id, userId: driverUsers[2].id, name: 'Tom Kowalski', email: 'tom@apexlogistics.com', phone: '+1 512 555 0103', licenseNumber: 'TX-DL-519033', licenseExpiry: expiry2026, status: 'ACTIVE' } }),
    db.driver.create({ data: { organizationId: org.id, userId: driverUsers[3].id, name: 'Priya Patel', email: 'priya@apexlogistics.com', phone: '+1 512 555 0104', licenseNumber: 'TX-DL-601178', licenseExpiry: expiry2027, status: 'ACTIVE' } }),
    db.driver.create({ data: { organizationId: org.id, userId: driverUsers[4].id, name: 'Jake Thornton', email: 'jake@apexlogistics.com', phone: '+1 512 555 0105', licenseNumber: 'TX-DL-287654', licenseExpiry: expiry2026, status: 'ACTIVE' } }),
    db.driver.create({ data: { organizationId: org.id, name: 'Linda Osei', email: 'linda@apexlogistics.com', phone: '+1 512 555 0106', licenseNumber: 'TX-DL-744320', licenseExpiry: expiry2026, status: 'INACTIVE' } }),
  ])
  console.log('  ✓ Drivers created')

  // ─── Vehicles ────────────────────────────────────────────────────────────────
  const vehicles = await Promise.all([
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-001', make: 'Ford', model: 'Transit', year: 2022, type: 'VAN', status: 'AVAILABLE', mileage: 34210 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-002', make: 'Ford', model: 'Transit', year: 2022, type: 'VAN', status: 'AVAILABLE', mileage: 41050 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-003', make: 'Mercedes', model: 'Sprinter', year: 2023, type: 'VAN', status: 'AVAILABLE', mileage: 18300 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-004', make: 'Isuzu', model: 'NPR', year: 2021, type: 'TRUCK', status: 'AVAILABLE', mileage: 67800 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-005', make: 'Isuzu', model: 'NQR', year: 2020, type: 'TRUCK', status: 'AVAILABLE', mileage: 92100 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-006', make: 'Toyota', model: 'Camry', year: 2023, type: 'CAR', status: 'AVAILABLE', mileage: 12400 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-007', make: 'Ford', model: 'E-350', year: 2019, type: 'VAN', status: 'IN_MAINTENANCE', mileage: 118500 } }),
    db.vehicle.create({ data: { organizationId: org.id, registrationNumber: 'TX-APX-008', make: 'Chevrolet', model: 'Express', year: 2018, type: 'VAN', status: 'OUT_OF_SERVICE', mileage: 145000 } }),
  ])
  console.log('  ✓ Vehicles created')

  // ─── Customers ───────────────────────────────────────────────────────────────
  const customerData = [
    { name: 'Whole Earth Market', email: 'receiving@wholeearth.com', phone: '+1 512 555 1001', addresses: [{ label: 'Main Store', street: '2100 N Lamar Blvd', city: 'Austin', state: 'TX', postalCode: '78705', isDefault: true }] },
    { name: 'Driftwood Medical Group', email: 'supply@driftwoodmed.com', phone: '+1 512 555 1002', addresses: [{ label: 'Clinic', street: '3801 S Lamar Blvd', city: 'Austin', state: 'TX', postalCode: '78704', isDefault: true }] },
    { name: 'TexStyle Manufacturing', email: 'ops@texstyle.com', phone: '+1 512 555 1003', addresses: [{ label: 'Factory', street: '7901 E Ben White Blvd', city: 'Austin', state: 'TX', postalCode: '78741', isDefault: true }, { label: 'Warehouse', street: '500 Industrial Dr', city: 'Round Rock', state: 'TX', postalCode: '78664', isDefault: false }] },
    { name: 'Summit Coffee Roasters', email: 'orders@summitcoffee.com', phone: '+1 512 555 1004', addresses: [{ label: 'Roastery', street: '1206 W 38th St', city: 'Austin', state: 'TX', postalCode: '78705', isDefault: true }] },
    { name: 'Pecan Valley Farms', email: 'shipping@pecanvalley.com', phone: '+1 512 555 1005', addresses: [{ label: 'Farm HQ', street: '4501 FM 812', city: 'Del Valle', state: 'TX', postalCode: '78617', isDefault: true }] },
    { name: 'Horizon Electronics', email: 'logistics@horizonelec.com', phone: '+1 512 555 1006', addresses: [{ label: 'Office', street: '11500 Research Blvd', city: 'Austin', state: 'TX', postalCode: '78759', isDefault: true }] },
    { name: 'Cedar Park Brewing', email: 'supplies@cpbrewing.com', phone: '+1 512 555 1007', addresses: [{ label: 'Brewery', street: '701 E Whitestone Blvd', city: 'Cedar Park', state: 'TX', postalCode: '78613', isDefault: true }] },
    { name: 'BlueStar Pharmaceuticals', email: 'receiving@bluestar.com', phone: '+1 512 555 1008', addresses: [{ label: 'Distribution Centre', street: '600 Congress Ave', city: 'Austin', state: 'TX', postalCode: '78701', isDefault: true }] },
  ]

  const customers = await Promise.all(
    customerData.map(({ addresses, ...c }) =>
      db.customer.create({
        data: {
          ...c,
          organizationId: org.id,
          addresses: { create: addresses },
        },
        include: { addresses: true },
      })
    )
  )
  console.log('  ✓ Customers created')

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = (offsetDays: number) => {
    const dt = new Date(today)
    dt.setDate(dt.getDate() + offsetDays)
    return dt
  }
  const tw = (offsetDays: number, hour: number) => {
    const dt = d(offsetDays)
    dt.setHours(hour, 0, 0, 0)
    return dt
  }
  const addrSnap = (c: typeof customers[0]) => ({
    street: c.addresses[0].street,
    city: c.addresses[0].city,
    state: c.addresses[0].state,
    postalCode: c.addresses[0].postalCode,
    country: 'US',
  })

  // ─── Deliveries ──────────────────────────────────────────────────────────────

  // 1. DELIVERED – completed yesterday
  const del1 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      driverId: drivers[0].id,
      vehicleId: vehicles[0].id,
      status: 'DELIVERED',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[0]),
      scheduledDate: d(-1),
      timeWindowStart: tw(-1, 9),
      timeWindowEnd: tw(-1, 12),
      notes: 'Leave at loading bay',
    },
  })
  await db.proofOfDelivery.create({
    data: {
      organizationId: org.id,
      deliveryId: del1.id,
      recipientName: 'Marcus Webb',
      deliveredAt: tw(-1, 10),
      driverNotes: 'Signed at loading bay, confirmed with shift manager',
    },
  })

  // 2. DELIVERED
  const del2 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[1].id,
      driverId: drivers[1].id,
      vehicleId: vehicles[1].id,
      status: 'DELIVERED',
      priority: 'HIGH',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[1]),
      scheduledDate: d(-1),
      timeWindowStart: tw(-1, 8),
      timeWindowEnd: tw(-1, 10),
    },
  })
  await db.proofOfDelivery.create({
    data: {
      organizationId: org.id,
      deliveryId: del2.id,
      recipientName: 'Dr. Ingrid Larsson',
      deliveredAt: tw(-1, 9),
      driverNotes: 'Delivered to reception, ID checked',
    },
  })

  // 3. DELIVERED – from 2 days ago
  const del3 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[2].id,
      driverId: drivers[2].id,
      vehicleId: vehicles[3].id,
      status: 'DELIVERED',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[2]),
      scheduledDate: d(-2),
      timeWindowStart: tw(-2, 13),
      timeWindowEnd: tw(-2, 17),
      notes: 'Heavy load – two pallets',
    },
  })
  await db.proofOfDelivery.create({
    data: {
      organizationId: org.id,
      deliveryId: del3.id,
      recipientName: 'Factory Dock B',
      deliveredAt: tw(-2, 14),
      driverNotes: 'Forklift unloaded, all items accounted for',
    },
  })

  // 4. FAILED – yesterday
  const del4 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[3].id,
      driverId: drivers[3].id,
      vehicleId: vehicles[2].id,
      status: 'FAILED',
      priority: 'URGENT',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[3]),
      scheduledDate: d(-1),
      timeWindowStart: tw(-1, 7),
      timeWindowEnd: tw(-1, 9),
      failureReason: 'CUSTOMER_UNAVAILABLE',
      failureNote: 'Called twice, no answer. Premises were locked.',
    },
  })

  // 5. FAILED – 3 days ago, wrong address
  const del5 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[5].id,
      driverId: drivers[0].id,
      vehicleId: vehicles[5].id,
      status: 'FAILED',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: { street: '11500 Research Blvd', city: 'Austin', state: 'TX', postalCode: '78759', country: 'US' },
      scheduledDate: d(-3),
      failureReason: 'WRONG_ADDRESS',
      failureNote: 'GPS led to construction site. Customer confirmed address has changed.',
    },
  })

  // 6. IN_TRANSIT – today, driver currently on the road
  const del6 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[6].id,
      driverId: drivers[4].id,
      vehicleId: vehicles[0].id,
      status: 'IN_TRANSIT',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[6]),
      scheduledDate: d(0),
      timeWindowStart: tw(0, 10),
      timeWindowEnd: tw(0, 14),
    },
  })

  // 7. IN_TRANSIT – today, high priority
  const del7 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[7].id,
      driverId: drivers[1].id,
      vehicleId: vehicles[1].id,
      status: 'IN_TRANSIT',
      priority: 'HIGH',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[7]),
      scheduledDate: d(0),
      timeWindowStart: tw(0, 8),
      timeWindowEnd: tw(0, 11),
      notes: 'Temperature-sensitive pharmaceuticals. Keep upright.',
    },
  })

  // 8. ASSIGNED – today, driver hasn't started yet
  const del8 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      driverId: drivers[2].id,
      vehicleId: vehicles[2].id,
      status: 'ASSIGNED',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[0]),
      scheduledDate: d(0),
      timeWindowStart: tw(0, 14),
      timeWindowEnd: tw(0, 17),
    },
  })

  // 9. ASSIGNED – today
  const del9 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[4].id,
      driverId: drivers[3].id,
      vehicleId: vehicles[3].id,
      status: 'ASSIGNED',
      priority: 'HIGH',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[4]),
      scheduledDate: d(0),
      timeWindowStart: tw(0, 12),
      timeWindowEnd: tw(0, 15),
      notes: 'Large crates – back entrance only',
    },
  })

  // 10. PENDING_DISPATCH – tomorrow
  const del10 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[1].id,
      status: 'PENDING_DISPATCH',
      priority: 'URGENT',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[1]),
      scheduledDate: d(1),
      timeWindowStart: tw(1, 8),
      timeWindowEnd: tw(1, 10),
      notes: 'Medical supplies – clinic opens at 8am sharp',
    },
  })

  // 11. PENDING_DISPATCH – tomorrow
  const del11 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[2].id,
      status: 'PENDING_DISPATCH',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: { ...addrSnap(customers[2]), street: '500 Industrial Dr', city: 'Round Rock', postalCode: '78664' },
      scheduledDate: d(1),
      timeWindowStart: tw(1, 13),
      timeWindowEnd: tw(1, 17),
    },
  })

  // 12. PENDING_DISPATCH – tomorrow, re-scheduled after failure (del4)
  const del12 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[3].id,
      status: 'PENDING_DISPATCH',
      priority: 'URGENT',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[3]),
      scheduledDate: d(1),
      timeWindowStart: tw(1, 9),
      timeWindowEnd: tw(1, 11),
      notes: 'Retry after CUSTOMER_UNAVAILABLE on previous attempt. Customer confirmed 9–11 window.',
    },
  })

  // 13. PENDING_DISPATCH – day after tomorrow
  const del13 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[5].id,
      status: 'PENDING_DISPATCH',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: { street: '11501 Research Blvd', city: 'Austin', state: 'TX', postalCode: '78759', country: 'US' },
      scheduledDate: d(2),
      notes: 'Updated address after wrong-address failure. Customer confirmed new suite number.',
    },
  })

  // 14. PENDING_DISPATCH – next week
  const del14 = await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[6].id,
      status: 'PENDING_DISPATCH',
      priority: 'LOW',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[6]),
      scheduledDate: d(5),
      timeWindowStart: tw(5, 10),
      timeWindowEnd: tw(5, 16),
    },
  })

  // 15. DRAFT – not yet submitted for dispatch
  await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[7].id,
      status: 'DRAFT',
      priority: 'HIGH',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[7]),
      scheduledDate: d(3),
      notes: 'Draft created by dispatcher – awaiting weight/volume confirmation from warehouse',
    },
  })

  // 16. DRAFT
  await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      status: 'DRAFT',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[0]),
      scheduledDate: d(4),
    },
  })

  // 17. CANCELLED
  await db.delivery.create({
    data: {
      organizationId: org.id,
      customerId: customers[4].id,
      status: 'CANCELLED',
      priority: 'NORMAL',
      pickupAddress: DEPOT_ADDRESS,
      deliveryAddress: addrSnap(customers[4]),
      scheduledDate: d(-4),
      notes: 'Customer cancelled order',
    },
  })

  console.log('  ✓ Deliveries created')

  // ─── Routes ──────────────────────────────────────────────────────────────────
  const route1 = await db.route.create({
    data: {
      organizationId: org.id,
      driverId: drivers[4].id,
      vehicleId: vehicles[0].id,
      name: 'North Austin AM Run',
      date: d(0),
      status: 'ACTIVE',
      stops: {
        create: [
          { stopOrder: 1, deliveryId: del6.id, address: addrSnap(customers[6]), notes: 'Ring doorbell' },
          { stopOrder: 2, address: DEPOT_ADDRESS, notes: 'Return to depot after last stop' },
        ],
      },
    },
  })

  const route2 = await db.route.create({
    data: {
      organizationId: org.id,
      driverId: drivers[1].id,
      vehicleId: vehicles[1].id,
      name: 'Medical Priority Run',
      date: d(0),
      status: 'ACTIVE',
      stops: {
        create: [
          { stopOrder: 1, deliveryId: del7.id, address: addrSnap(customers[7]), notes: 'Check refrigeration unit on arrival' },
        ],
      },
    },
  })

  await db.route.create({
    data: {
      organizationId: org.id,
      name: 'Tomorrow North Loop',
      date: d(1),
      status: 'PLANNED',
      stops: {
        create: [
          { stopOrder: 1, deliveryId: del10.id, address: addrSnap(customers[1]) },
          { stopOrder: 2, deliveryId: del12.id, address: addrSnap(customers[3]) },
        ],
      },
    },
  })

  // Link active deliveries to their routes
  await db.delivery.update({ where: { id: del6.id }, data: { routeId: route1.id } })
  await db.delivery.update({ where: { id: del7.id }, data: { routeId: route2.id } })

  console.log('  ✓ Routes created')

  // ─── Maintenance Records ─────────────────────────────────────────────────────
  await db.maintenanceRecord.createMany({
    data: [
      {
        organizationId: org.id,
        vehicleId: vehicles[0].id,
        type: 'OIL_SERVICE',
        description: 'Full oil & filter change at 30,000mi',
        mileage: 30000,
        cost: 149.99,
        performedAt: d(-45),
        nextDueAt: d(135),
      },
      {
        organizationId: org.id,
        vehicleId: vehicles[1].id,
        type: 'INSPECTION',
        description: 'Annual DOT roadworthy inspection',
        mileage: 40000,
        cost: 225.00,
        performedAt: d(-30),
        nextDueAt: d(335),
      },
      {
        organizationId: org.id,
        vehicleId: vehicles[3].id,
        type: 'TIRE_REPLACEMENT',
        description: 'Front axle tyres replaced – tread below 3mm',
        mileage: 65000,
        cost: 890.00,
        performedAt: d(-15),
        nextDueAt: d(350),
      },
      {
        organizationId: org.id,
        vehicleId: vehicles[6].id,
        type: 'REPAIR',
        description: 'Transmission fluid leak. Gasket replaced. Vehicle in maintenance until repair is verified.',
        mileage: 118500,
        cost: 1200.00,
        performedAt: d(-3),
        nextDueAt: null,
      },
      {
        organizationId: org.id,
        vehicleId: vehicles[4].id,
        type: 'OIL_SERVICE',
        description: 'Oil service at 90,000mi',
        mileage: 90000,
        cost: 175.00,
        performedAt: d(-60),
        nextDueAt: d(120),
      },
      {
        organizationId: org.id,
        vehicleId: vehicles[2].id,
        type: 'INSPECTION',
        description: 'Pre-purchase inspection on delivery of new Sprinter',
        mileage: 500,
        cost: 195.00,
        performedAt: d(-180),
        nextDueAt: d(185),
      },
    ],
  })
  console.log('  ✓ Maintenance records created')

  // ─── Audit Logs ──────────────────────────────────────────────────────────────
  const auditRows = [
    // Delivered yesterday
    { actorUserId: dispatcher.id, action: 'delivery.created', resourceType: 'Delivery', resourceId: del1.id, metadata: { customerId: customers[0].id, priority: 'NORMAL' }, createdAt: d(-2) },
    { actorUserId: dispatcher.id, action: 'delivery.assigned', resourceType: 'Delivery', resourceId: del1.id, metadata: { driverId: drivers[0].id, vehicleId: vehicles[0].id, previousDriverId: null }, createdAt: d(-1) },
    { actorUserId: driverUsers[0].id, action: 'delivery.status_changed', resourceType: 'Delivery', resourceId: del1.id, metadata: { from: 'ASSIGNED', to: 'IN_TRANSIT' }, createdAt: tw(-1, 9) },
    { actorUserId: driverUsers[0].id, action: 'delivery.proof_submitted', resourceType: 'Delivery', resourceId: del1.id, metadata: { recipientName: 'Marcus Webb', deliveredAt: tw(-1, 10).toISOString() }, createdAt: tw(-1, 10) },

    // Failed yesterday
    { actorUserId: dispatcher.id, action: 'delivery.created', resourceType: 'Delivery', resourceId: del4.id, metadata: { customerId: customers[3].id, priority: 'URGENT' }, createdAt: d(-2) },
    { actorUserId: dispatcher.id, action: 'delivery.assigned', resourceType: 'Delivery', resourceId: del4.id, metadata: { driverId: drivers[3].id, vehicleId: vehicles[2].id }, createdAt: d(-1) },
    { actorUserId: driverUsers[3].id, action: 'delivery.status_changed', resourceType: 'Delivery', resourceId: del4.id, metadata: { from: 'ASSIGNED', to: 'IN_TRANSIT' }, createdAt: tw(-1, 7) },
    { actorUserId: driverUsers[3].id, action: 'delivery.status_changed', resourceType: 'Delivery', resourceId: del4.id, metadata: { from: 'IN_TRANSIT', to: 'FAILED', failureReason: 'CUSTOMER_UNAVAILABLE' }, createdAt: tw(-1, 8) },

    // Retry created
    { actorUserId: dispatcher.id, action: 'delivery.created', resourceType: 'Delivery', resourceId: del12.id, metadata: { customerId: customers[3].id, priority: 'URGENT', note: 'Retry after failure' }, createdAt: d(-1) },

    // Today's in-transit
    { actorUserId: dispatcher.id, action: 'delivery.assigned', resourceType: 'Delivery', resourceId: del6.id, metadata: { driverId: drivers[4].id, vehicleId: vehicles[0].id }, createdAt: tw(0, 7) },
    { actorUserId: driverUsers[4].id, action: 'delivery.status_changed', resourceType: 'Delivery', resourceId: del6.id, metadata: { from: 'ASSIGNED', to: 'IN_TRANSIT' }, createdAt: tw(0, 8) },
    { actorUserId: dispatcher.id, action: 'delivery.assigned', resourceType: 'Delivery', resourceId: del7.id, metadata: { driverId: drivers[1].id, vehicleId: vehicles[1].id }, createdAt: tw(0, 7) },
    { actorUserId: driverUsers[1].id, action: 'delivery.status_changed', resourceType: 'Delivery', resourceId: del7.id, metadata: { from: 'ASSIGNED', to: 'IN_TRANSIT' }, createdAt: tw(0, 8) },

    // Vehicle maintenance
    { actorUserId: fleetManager.id, action: 'maintenance.created', resourceType: 'Vehicle', resourceId: vehicles[6].id, metadata: { type: 'REPAIR', vehicleId: vehicles[6].id }, createdAt: d(-3) },
    { actorUserId: fleetManager.id, action: 'vehicle.status_changed', resourceType: 'Vehicle', resourceId: vehicles[6].id, metadata: { from: 'AVAILABLE', to: 'IN_MAINTENANCE' }, createdAt: d(-3) },

    // Drivers created
    { actorUserId: owner.id, action: 'driver.created', resourceType: 'Driver', resourceId: drivers[0].id, metadata: { name: 'Carlos Rivera' }, createdAt: d(-90) },
    { actorUserId: owner.id, action: 'driver.created', resourceType: 'Driver', resourceId: drivers[1].id, metadata: { name: 'Amara Nwosu' }, createdAt: d(-90) },
    { actorUserId: owner.id, action: 'driver.created', resourceType: 'Driver', resourceId: drivers[2].id, metadata: { name: 'Tom Kowalski' }, createdAt: d(-85) },
  ]

  for (const row of auditRows) {
    await db.auditLog.create({ data: { organizationId: org.id, ...row } })
  }
  console.log('  ✓ Audit logs created')

  // ─── Notifications ───────────────────────────────────────────────────────────
  await db.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: driverUsers[4].id,
        type: 'DELIVERY_ASSIGNED',
        title: 'New Delivery Assigned',
        body: `You have been assigned delivery for Cedar Park Brewing today. Window: 10:00–14:00.`,
        resourceType: 'Delivery',
        resourceId: del6.id,
        read: false,
      },
      {
        organizationId: org.id,
        userId: driverUsers[1].id,
        type: 'DELIVERY_ASSIGNED',
        title: 'New Delivery Assigned',
        body: `Priority delivery to BlueStar Pharmaceuticals assigned. Window: 08:00–11:00.`,
        resourceType: 'Delivery',
        resourceId: del7.id,
        read: true,
      },
      {
        organizationId: org.id,
        userId: dispatcher.id,
        type: 'DELIVERY_FAILED',
        title: 'Delivery Failed',
        body: 'Delivery to Summit Coffee Roasters failed: Customer unavailable. Retry has been created for tomorrow.',
        resourceType: 'Delivery',
        resourceId: del4.id,
        read: false,
      },
      {
        organizationId: org.id,
        userId: owner.id,
        type: 'DELIVERY_FAILED',
        title: 'Delivery Failed',
        body: 'Delivery to Summit Coffee Roasters failed: Customer unavailable.',
        resourceType: 'Delivery',
        resourceId: del4.id,
        read: true,
      },
      {
        organizationId: org.id,
        userId: fleetManager.id,
        type: 'MAINTENANCE_DUE',
        title: 'Maintenance Due Soon',
        body: 'Ford Transit TX-APX-001 is due for oil service in 135 days.',
        resourceType: 'Vehicle',
        resourceId: vehicles[0].id,
        read: false,
      },
    ],
  })
  console.log('  ✓ Notifications created')

  console.log('\nSeed complete!\n')
  console.log('Login credentials (all share the same password: password123):')
  console.log('  OWNER       owner@apexlogistics.com')
  console.log('  ADMIN       admin@apexlogistics.com')
  console.log('  DISPATCHER  dispatch@apexlogistics.com')
  console.log('  FLEET MGR   fleet@apexlogistics.com')
  console.log('  DRIVER      carlos@apexlogistics.com  (today: 1 in-transit on del route)')
  console.log('  DRIVER      amara@apexlogistics.com   (today: 1 in-transit, medical priority)')
  console.log('  DRIVER      tom@apexlogistics.com     (today: 1 assigned)')
  console.log('  DRIVER      priya@apexlogistics.com   (today: 1 assigned, urgent)')
  console.log('  DRIVER      jake@apexlogistics.com    (today: driving North Austin AM Run)')
  console.log('\n  Org slug: apex-logistics')
  console.log('  App URL:  http://localhost:3000')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
