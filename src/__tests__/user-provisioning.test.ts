import {
  buildProvisioningEmail,
  normalizeProvisioningPhone,
  sanitizeProvisioningName,
} from '@/lib/server/user-provisioning'

describe('user provisioning helpers', () => {
  test('builds auth alias email from normalized phone', () => {
    expect(buildProvisioningEmail('256700000000')).toBe('256700000000@omuto.org')
  })

  test('normalizes Uganda phone numbers consistently', () => {
    expect(normalizeProvisioningPhone('0700 000 000')).toBe('256700000000')
    expect(normalizeProvisioningPhone('+256700000000')).toBe('256700000000')
  })

  test('rejects invalid provisioning values', () => {
    expect(() => sanitizeProvisioningName(' ')).toThrow('Name must be at least 2 characters')
    expect(() => normalizeProvisioningPhone('123')).toThrow('Invalid phone number')
  })
})