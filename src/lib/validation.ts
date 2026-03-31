// Input sanitization and validation utilities

export function sanitizeString(input: string): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 500)
}

export function sanitizePhone(input: string): string {
  if (!input) return ''
  return input.replace(/[^0-9+]/g, '')
}

export function sanitizeNumber(input: string): string {
  if (!input) return ''
  return input.replace(/[^0-9.-]/g, '')
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidDate(date: string): boolean {
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

export function isValidScore(score: number, maxScore = 100): boolean {
  return score >= 0 && score <= maxScore
}