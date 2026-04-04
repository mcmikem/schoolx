#!/usr/bin/env node
import { readFileSync } from 'node:fs'
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

