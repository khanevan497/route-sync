import type {
  Delivery, Driver, Vehicle, Customer, Route, MaintenanceRecord,
  Organization, Membership, MemberRole, DeliveryStatus, VehicleStatus,
  DriverStatus, RouteStatus, MaintenanceType, Priority, FailureReason,
  ProofOfDelivery, AuditLog, Notification,
} from '@prisma/client'

export type {
  Delivery, Driver, Vehicle, Customer, Route, MaintenanceRecord,
  Organization, Membership, MemberRole, DeliveryStatus, VehicleStatus,
  DriverStatus, RouteStatus, MaintenanceType, Priority, FailureReason,
  ProofOfDelivery, AuditLog, Notification,
}

export type DeliveryWithRelations = Delivery & {
  customer: Pick<Customer, 'id' | 'name' | 'email'>
  driver?: Pick<Driver, 'id' | 'name'> | null
  vehicle?: Pick<Vehicle, 'id' | 'registrationNumber' | 'make' | 'model'> | null
  route?: Pick<Route, 'id' | 'name'> | null
}

export type DashboardStats = {
  todayDeliveries: number
  activeDeliveries: number
  completedDeliveries: number
  failedDeliveries: number
  pendingDispatch: number
  availableDrivers: number
  availableVehicles: number
  vehiclesInMaintenance: number
}
