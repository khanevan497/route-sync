import { assertValidTransition, getAvailableTransitions } from '@/lib/delivery-state-machine'
import { DeliveryStatus } from '@prisma/client'

describe('Delivery State Machine', () => {
  describe('assertValidTransition', () => {
    it('allows DRAFT → PENDING_DISPATCH', () => {
      expect(() => assertValidTransition('DRAFT', 'PENDING_DISPATCH')).not.toThrow()
    })

    it('allows PENDING_DISPATCH → ASSIGNED', () => {
      expect(() => assertValidTransition('PENDING_DISPATCH', 'ASSIGNED')).not.toThrow()
    })

    it('allows ASSIGNED → IN_TRANSIT', () => {
      expect(() => assertValidTransition('ASSIGNED', 'IN_TRANSIT')).not.toThrow()
    })

    it('allows IN_TRANSIT → DELIVERED', () => {
      expect(() => assertValidTransition('IN_TRANSIT', 'DELIVERED')).not.toThrow()
    })

    it('allows IN_TRANSIT → FAILED', () => {
      expect(() => assertValidTransition('IN_TRANSIT', 'FAILED')).not.toThrow()
    })

    it('allows PENDING_DISPATCH → CANCELLED', () => {
      expect(() => assertValidTransition('PENDING_DISPATCH', 'CANCELLED')).not.toThrow()
    })

    it('allows FAILED → PENDING_DISPATCH (re-dispatch)', () => {
      expect(() => assertValidTransition('FAILED', 'PENDING_DISPATCH')).not.toThrow()
    })

    it('rejects DRAFT → IN_TRANSIT (skipping steps)', () => {
      expect(() => assertValidTransition('DRAFT', 'IN_TRANSIT')).toThrow(/invalid status transition/i)
    })

    it('rejects DELIVERED → PENDING_DISPATCH (terminal state)', () => {
      expect(() => assertValidTransition('DELIVERED', 'PENDING_DISPATCH')).toThrow(/invalid status transition/i)
    })

    it('rejects DRAFT → ASSIGNED (skipping PENDING_DISPATCH)', () => {
      expect(() => assertValidTransition('DRAFT', 'ASSIGNED')).toThrow(/invalid status transition/i)
    })

    it('rejects CANCELLED → ASSIGNED', () => {
      expect(() => assertValidTransition('CANCELLED', 'ASSIGNED')).toThrow(/invalid status transition/i)
    })

    it('rejects IN_TRANSIT → DRAFT (backwards)', () => {
      expect(() => assertValidTransition('IN_TRANSIT', 'DRAFT')).toThrow(/invalid status transition/i)
    })

    it('rejects same-state transition', () => {
      expect(() => assertValidTransition('ASSIGNED', 'ASSIGNED')).toThrow(/invalid status transition/i)
    })
  })

  describe('getAvailableTransitions', () => {
    it('returns correct transitions for DRAFT', () => {
      expect(getAvailableTransitions('DRAFT')).toEqual(['PENDING_DISPATCH'])
    })

    it('returns correct transitions for IN_TRANSIT', () => {
      const transitions = getAvailableTransitions('IN_TRANSIT')
      expect(transitions).toContain('DELIVERED')
      expect(transitions).toContain('FAILED')
      expect(transitions).not.toContain('DRAFT')
    })

    it('returns empty array for DELIVERED (terminal)', () => {
      expect(getAvailableTransitions('DELIVERED')).toHaveLength(0)
    })

    it('returns empty array for CANCELLED (terminal)', () => {
      expect(getAvailableTransitions('CANCELLED')).toHaveLength(0)
    })

    it('returns PENDING_DISPATCH for FAILED (re-dispatch)', () => {
      expect(getAvailableTransitions('FAILED')).toContain('PENDING_DISPATCH')
    })
  })
})
