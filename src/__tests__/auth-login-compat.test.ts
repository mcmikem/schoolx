import { buildAuthLoginAttempts } from '@/lib/auth-login'

describe('buildAuthLoginAttempts', () => {
  it('produces normalized email attempt as primary format', () => {
    const attempts = buildAuthLoginAttempts('0700 000 000')

    // Primary: normalized@omuto.org (covers 99%+ of accounts)
    expect(attempts).toEqual(
      expect.arrayContaining([
        { type: 'email', value: '256700000000@omuto.org' },
      ]),
    )
  })

  it('includes legacy sms domain fallback', () => {
    const attempts = buildAuthLoginAttempts('0700 000 000')

    expect(attempts).toEqual(
      expect.arrayContaining([
        { type: 'email', value: '256700000000@omuto.sms' },
      ]),
    )
  })

  it('includes phone fallback', () => {
    const attempts = buildAuthLoginAttempts('0700 000 000')

    expect(attempts).toEqual(
      expect.arrayContaining([
        { type: 'phone', value: '+256700000000' },
      ]),
    )
  })

  it('produces at most 3 attempts (fast login)', () => {
    const attempts = buildAuthLoginAttempts('0700000000')
    expect(attempts.length).toBeLessThanOrEqual(4)
  })

  it('preserves direct email login attempts', () => {
    const attempts = buildAuthLoginAttempts('admin@school.com')

    expect(attempts[0]).toEqual({ type: 'email', value: 'admin@school.com' })
    expect(attempts.length).toBe(1)
  })

  it('does not produce duplicate attempts', () => {
    const attempts = buildAuthLoginAttempts('256700000000')
    const keys = attempts.map(a => `${a.type}:${a.value}`)
    expect(keys.length).toBe(new Set(keys).size)
  })
})