#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

function count(pattern, filesGlob = 'src') {
  try {
    const output = run(`rg -n "${pattern}" ${filesGlob}`)
    if (!output) return { count: 0, lines: [] }
    const lines = output.split('\n')
    return { count: lines.length, lines }
  } catch {
    return { count: 0, lines: [] }
  }
}

const checks = [
  { label: 'console.log usage', pattern: 'console\\.log\\(' },
  { label: 'dangerouslySetInnerHTML usage', pattern: 'dangerouslySetInnerHTML' },
  { label: 'any-type casts (as any)', pattern: 'as any' },
]

const results = checks.map(c => ({ ...c, ...count(c.pattern) }))
const strict = process.argv.includes('--strict')

console.log('=== UI/UX + Debug Audit Snapshot ===')
for (const r of results) {
  console.log(`- ${r.label}: ${r.count}`)
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const hasTests = !!packageJson?.scripts?.test
const hasLint = !!packageJson?.scripts?.lint
console.log(`- test script present: ${hasTests}`)
console.log(`- lint script present: ${hasLint}`)

const failures = results.filter(r => r.label === 'console.log usage' && r.count > 0)
if (failures.length > 0) {
  console.log('\nTop console.log occurrences:')
  failures[0].lines.slice(0, 20).forEach(l => console.log(`  ${l}`))
}

// ── Design-system drift ───────────────────────────────────────────────
// Off-brand surfaces and unreadable type are the two most visible UI
// defects, and both are easy to reintroduce without noticing. Count them so
// the trend is visible, and let --strict gate new work.
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

const uiFiles = walk('src').filter(f => !f.includes('globals-dark-hex.css'))

const hardcodedColour = /(text|bg|border)-\[#[0-9a-fA-F]{3,8}\]/g
const tinyType = /text-\[(9|10|11)px\]/g

const colourHits = []
const tinyHits = []
for (const file of uiFiles) {
  const body = readFileSync(file, 'utf8')
  const colours = body.match(hardcodedColour)
  if (colours) colourHits.push({ file, count: colours.length })
  const tiny = body.match(tinyType)
  if (tiny) tinyHits.push({ file, count: tiny.length })
}

const totalColours = colourHits.reduce((n, h) => n + h.count, 0)
const totalTiny = tinyHits.reduce((n, h) => n + h.count, 0)

console.log('\n=== Design-system drift ===')
console.log(`- hardcoded hex colours (should be design tokens): ${totalColours} in ${colourHits.length} files`)
console.log(`- sub-12px type (floored to 12px under 400px wide): ${totalTiny} in ${tinyHits.length} files`)

const worst = [...colourHits].sort((a, b) => b.count - a.count).slice(0, 5)
if (worst.length) {
  console.log('\nWorst offenders for hardcoded colours:')
  for (const w of worst) console.log(`  ${w.count}  ${w.file}`)
}

if (strict) {
  const problems = []
  if (totalColours > 0) problems.push(`${totalColours} hardcoded hex colours`)
  if (consoleLogs > 0) problems.push(`${consoleLogs} console.log entries`)
  if (problems.length) {
    console.error(`\nStrict audit failed: ${problems.join(', ')}.`)
    console.error('Use design tokens (var(--primary), var(--surface), var(--t1) ...) instead of literal hex.')
    process.exit(1)
  }
}
