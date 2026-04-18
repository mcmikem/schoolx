import {
  parseSettingValue,
  serializeSettingValue,
} from '../lib/school-settings'

describe('school-settings helpers', () => {
  test('serializes primitives predictably', () => {
    expect(serializeSettingValue('hello')).toBe('hello')
    expect(serializeSettingValue(true)).toBe('true')
    expect(serializeSettingValue(42)).toBe('42')
  })

  test('round-trips structured JSON values', () => {
    const weights = [
      { id: 'bot', name: 'BOT', weight: 10, isActive: true },
      { id: 'eot', name: 'EOT', weight: 90, isActive: true },
    ]

    const serialized = serializeSettingValue(weights)
    expect(parseSettingValue(serialized, [])).toEqual(weights)
  })

  test('falls back safely for missing values', () => {
    expect(parseSettingValue(undefined, '2026')).toBe('2026')
    expect(parseSettingValue('', 80)).toBe(80)
    expect(parseSettingValue(null, false)).toBe(false)
  })

  test('returns plain strings when value is not JSON', () => {
    expect(parseSettingValue('true', false as string | boolean)).toBe(true)
    expect(parseSettingValue('80', 0 as string | number)).toBe(80)
    expect(parseSettingValue('Term 1', 'fallback')).toBe('Term 1')
  })
})
