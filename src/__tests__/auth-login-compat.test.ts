import { buildAuthLoginAttempts } from '@/lib/auth-login'

describe('buildAuthLoginAttempts', () => {
  it('includes legacy and normalized Uganda phone formats', () => {
    const attempts = buildAuthLoginAttempts('0700 000 000')

    expect(attempts).toEqual(
      expect.arrayContaining([
        { type: 'phone', value: '0700000000' },
        { type: 'phone', value: '256700000000' },
        { type: 'phone', value: '+256700000000' },
        { type: 'email', value: '0700000000@omuto.org' },
        { type: 'email', value: '256700000000@omuto.org' },
      ]),
    )
  })

  it('preserves direct email login attempts', () => {
    const attempts = buildAuthLoginAttempts('admin@school.com')

    expect(attempts[0]).toEqual({ type: 'email', value: 'admin@school.com' })
  })
})
