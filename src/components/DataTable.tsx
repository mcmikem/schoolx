'use client'
import { useState, useMemo, useCallback } from 'react'

interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (row: T) => React.ReactNode
  width?: string | number
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  pageSize?: number
  showSearch?: boolean
  searchPlaceholder?: string
  idField?: string
}

type SortDirection = 'asc' | 'desc' | null

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  pageSize = 20,
  showSearch = true,
  searchPlaceholder = 'Search...',
  idField = 'id',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Filter and search
  const filteredData = useMemo(() => {
    let result = [...data]

    // Apply search
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key]
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(searchLower)
        })
      )
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) {
        result = result.filter(row => {
          const cellValue = row[key]
          if (cellValue === null || cellValue === undefined) return false
          return String(cellValue).toLowerCase().includes(value.toLowerCase())
        })
      }
    })

    return result
  }, [data, search, filters, columns])

  // Sort
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime()
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const handleSort = useCallback((columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') setSortDirection('desc')
      else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }, [sortColumn, sortDirection])

  const handleFilter = useCallback((columnKey: string, value: string) => {
    setFilters(prev => ({ ...prev, [columnKey]: value }))
    setCurrentPage(1)
  }, [])

  // Reset to page 1 when data changes
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  if (loading) {
    return (
      <div className="animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
            {columns.map((_, j) => (
              <div key={j} style={{ height: 16, background: 'var(--bg)', borderRadius: 4, flex: 1 }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Search and Controls */}
      {showSearch && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            background: 'var(--bg)', 
            borderRadius: 8, 
            padding: '8px 12px',
            flex: 1,
            minWidth: 200
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--t4)' }}>search</span>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder={searchPlaceholder}
              style={{ 
                border: 'none', 
                background: 'transparent', 
                fontSize: 14, 
                color: 'var(--t1)',
                outline: 'none',
                width: '100%'
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setCurrentPage(1) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--t4)' }}>close</span>
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>
            {filteredData.length} {filteredData.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {columns.map(col => (
                <th 
                  key={col.key}
                  style={{ 
                    padding: '12px 16px', 
                    textAlign: col.align || 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--t3)',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                    width: col.width,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {col.sortable && (
                      <span style={{ 
                        fontSize: 14,
                        color: sortColumn === col.key ? 'var(--navy)' : 'var(--t4)',
                        opacity: sortColumn === col.key ? 1 : 0.5
                      }}>
                        {sortColumn === col.key 
                          ? (sortDirection === 'asc' ? '↑' : '↓')
                          : '↕'
                        }
                      </span>
                    )}
                  </div>
                  {col.filterable && (
                    <input
                      type="text"
                      value={filters[col.key] || ''}
                      onChange={e => handleFilter(col.key, e.target.value)}
                      placeholder={`Filter ${col.label.toLowerCase()}...`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        marginTop: 8,
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        fontSize: 12,
                        background: 'var(--surface)',
                        color: 'var(--t1)',
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.5 }}>
                    inbox
                  </span>
                  {search ? `No results for "${search}"` : emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr 
                  key={row[idField] || index}
                  onClick={() => onRowClick?.(row)}
                  style={{ 
                    borderBottom: '1px solid var(--border)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                  }}
                >
                  {columns.map(col => (
                    <td 
                      key={col.key}
                      style={{ 
                        padding: '12px 16px',
                        fontSize: 14,
                        color: 'var(--t2)',
                        textAlign: col.align || 'left',
                      }}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ 
          padding: '12px 16px', 
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
                fontSize: 13,
                minHeight: 36,
              }}
            >
              ‹‹
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
                fontSize: 13,
                minHeight: 36,
              }}
            >
              ‹
            </button>
            <span style={{ 
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--t1)',
            }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
                fontSize: 13,
                minHeight: 36,
              }}
            >
              ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
                fontSize: 13,
                minHeight: 36,
              }}
            >
              ››
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
