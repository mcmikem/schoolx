#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const SCHEMA_PATH = path.join(ROOT, 'supabase', 'schema.sql')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, files)
      continue
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

function collectAppTables() {
  const tableSet = new Set()
  const sourceFiles = walk(SRC_DIR)
  const fromRegex = /\.from\('([a-zA-Z0-9_]+)'\)/g

  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8')
    let match
    while ((match = fromRegex.exec(text)) !== null) {
      tableSet.add(match[1])
    }
  }
  return tableSet
}

function collectSchemaTables() {
  const schemaText = fs.readFileSync(SCHEMA_PATH, 'utf8')
  const createRegex = /CREATE TABLE(?: IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)/gi
  const schemaTables = []
  let match
  while ((match = createRegex.exec(schemaText)) !== null) {
    schemaTables.push(match[1])
  }
  return schemaTables
}

const appTables = collectAppTables()
const schemaTables = collectSchemaTables()
const schemaSet = new Set(schemaTables)

const missingInSchema = [...appTables].filter((table) => !schemaSet.has(table)).sort()

const counts = new Map()
for (const table of schemaTables) {
  counts.set(table, (counts.get(table) || 0) + 1)
}
const duplicateSchemaTables = [...counts.entries()]
  .filter(([, count]) => count > 1)
  .map(([name, count]) => `${name}(${count})`)
  .sort()

if (missingInSchema.length === 0 && duplicateSchemaTables.length === 0) {
  console.log('✅ DB contract check passed: app table references align with schema and no duplicate CREATE TABLE declarations were found.')
  process.exit(0)
}

console.error('❌ DB contract check failed.')
if (missingInSchema.length > 0) {
  console.error(`Missing in schema (${missingInSchema.length}): ${missingInSchema.join(', ')}`)
}
if (duplicateSchemaTables.length > 0) {
  console.error(`Duplicate schema tables (${duplicateSchemaTables.length}): ${duplicateSchemaTables.join(', ')}`)
}
process.exit(1)
