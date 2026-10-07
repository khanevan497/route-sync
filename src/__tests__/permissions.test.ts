import { hasPermission, getPermissions } from '@/lib/permissions'
import { MemberRole } from '@prisma/client'

describe('RBAC Permissions', () => {
  describe('OWNER', () => {
    it('can do everything', () => {
      expect(hasPermission('OWNER', 'deliveries.dispatch')).toBe(true)
      expect(hasPermission('OWNER', 'drivers.manage')).toBe(true)
      expect(hasPermission('OWNER', 'vehicles.manage')).toBe(true)
      expect(hasPermission('OWNER', 'audit.read')).toBe(true)
      expect(hasPermission('OWNER', 'users.manage')).toBe(true)
      expect(hasPermission('OWNER', 'org.manage')).toBe(true)
    })
  })

  describe('DISPATCHER', () => {
    it('can dispatch deliveries', () => {
      expect(hasPermission('DISPATCHER', 'deliveries.dispatch')).toBe(true)
      expect(hasPermission('DISPATCHER', 'deliveries.create')).toBe(true)
      expect(hasPermission('DISPATCHER', 'deliveries.read')).toBe(true)
    })

    it('cannot manage drivers or vehicles', () => {
      expect(hasPermission('DISPATCHER', 'drivers.manage')).toBe(false)
      expect(hasPermission('DISPATCHER', 'vehicles.manage')).toBe(false)
    })

    it('cannot access audit logs', () => {
      expect(hasPermission('DISPATCHER', 'audit.read')).toBe(false)
    })

    it('cannot manage users', () => {
      expect(hasPermission('DISPATCHER', 'users.manage')).toBe(false)
    })
  })

  describe('DRIVER', () => {
    it('can read and update deliveries only', () => {
      expect(hasPermission('DRIVER', 'deliveries.read')).toBe(true)
      expect(hasPermission('DRIVER', 'deliveries.update')).toBe(true)
    })

    it('cannot create deliveries', () => {
      expect(hasPermission('DRIVER', 'deliveries.create')).toBe(false)
    })

    it('cannot dispatch', () => {
      expect(hasPermission('DRIVER', 'deliveries.dispatch')).toBe(false)
    })

    it('cannot read or manage drivers', () => {
      expect(hasPermission('DRIVER', 'drivers.read')).toBe(false)
      expect(hasPermission('DRIVER', 'drivers.manage')).toBe(false)
    })
  })

  describe('FLEET_MANAGER', () => {
    it('can manage vehicles and maintenance', () => {
      expect(hasPermission('FLEET_MANAGER', 'vehicles.manage')).toBe(true)
      expect(hasPermission('FLEET_MANAGER', 'maintenance.manage')).toBe(true)
      expect(hasPermission('FLEET_MANAGER', 'drivers.read')).toBe(true)
    })

    it('cannot dispatch deliveries', () => {
      expect(hasPermission('FLEET_MANAGER', 'deliveries.dispatch')).toBe(false)
    })

    it('cannot manage customers', () => {
      expect(hasPermission('FLEET_MANAGER', 'customers.manage')).toBe(false)
    })
  })

  describe('getPermissions', () => {
    it('returns a non-empty list for OWNER', () => {
      expect(getPermissions('OWNER').length).toBeGreaterThan(0)
    })

    it('DRIVER has fewer permissions than DISPATCHER', () => {
      expect(getPermissions('DRIVER').length).toBeLessThan(getPermissions('DISPATCHER').length)
    })

    it('OWNER has most permissions', () => {
      const roles: MemberRole[] = ['ADMIN', 'DISPATCHER', 'FLEET_MANAGER', 'DRIVER']
      for (const role of roles) {
        expect(getPermissions('OWNER').length).toBeGreaterThanOrEqual(getPermissions(role).length)
      }
    })
  })
})
