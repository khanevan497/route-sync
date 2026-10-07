import { MemberRole } from '@prisma/client'

export type Permission =
  | 'drivers.read' | 'drivers.manage'
  | 'vehicles.read' | 'vehicles.manage'
  | 'deliveries.read' | 'deliveries.create' | 'deliveries.dispatch' | 'deliveries.update'
  | 'routes.read' | 'routes.manage'
  | 'maintenance.read' | 'maintenance.manage'
  | 'customers.read' | 'customers.manage'
  | 'audit.read'
  | 'users.manage'
  | 'org.manage'

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    'drivers.read', 'drivers.manage',
    'vehicles.read', 'vehicles.manage',
    'deliveries.read', 'deliveries.create', 'deliveries.dispatch', 'deliveries.update',
    'routes.read', 'routes.manage',
    'maintenance.read', 'maintenance.manage',
    'customers.read', 'customers.manage',
    'audit.read', 'users.manage', 'org.manage',
  ],
  ADMIN: [
    'drivers.read', 'drivers.manage',
    'vehicles.read', 'vehicles.manage',
    'deliveries.read', 'deliveries.create', 'deliveries.dispatch', 'deliveries.update',
    'routes.read', 'routes.manage',
    'maintenance.read', 'maintenance.manage',
    'customers.read', 'customers.manage',
    'audit.read', 'users.manage',
  ],
  DISPATCHER: [
    'deliveries.read', 'deliveries.create', 'deliveries.dispatch', 'deliveries.update',
    'drivers.read', 'vehicles.read',
    'routes.read', 'routes.manage',
    'customers.read',
  ],
  FLEET_MANAGER: [
    'vehicles.read', 'vehicles.manage',
    'maintenance.read', 'maintenance.manage',
    'drivers.read',
  ],
  DRIVER: [
    'deliveries.read', 'deliveries.update',
  ],
}

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: MemberRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
