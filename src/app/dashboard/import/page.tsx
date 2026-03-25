'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export default function ImportPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    try {
      const XLSX = await import('xlsx')
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)
      setPreview(jsonData.slice(0, 10))
    } catch (err) {
      toast.error('Failed to read file')
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const allStudents = XLSX.utils.sheet_to_json(sheet)

      const mappedStudents = allStudents.map((row: any) => ({
        first_name: row['First Name'] || row['first_name'] || '',
        last_name: row['Last Name'] || row['last_name'] || '',
        gender: row['Gender'] || row['gender'] || '',
        date_of_birth: row['Date of Birth'] || row['date_of_birth'] || row['DOB'] || '',
        parent_name: row['Parent Name'] || row['parent_name'] || row['Parent/Guardian Name'] || '',
        parent_phone: row['Parent Phone'] || row['parent_phone'] || row['Phone'] || '',
        parent_phone2: row['Parent Phone 2'] || row['parent_phone2'] || row['Phone 2'] || '',
        class_name: row['Class'] || row['class_name'] || '',
        student_number: row['Student Number'] || row['student_number'] || row['ID'] || '',
        ple_index_number: row['PLE Index'] || row['ple_index_number'] || row['PLE'] || '',
      }))

      if (!user?.school_id) {
        throw new Error('No school associated with your account')
      }

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: mappedStudents,
          schoolId: user.school_id,
        }),
      })

      const importResult = await response.json()
      setResult(importResult)
      
      if (importResult.success > 0) {
        toast.success(`Imported ${importResult.success} students`)
      }
    } catch (error: any) {
      setResult({ success: 0, failed: 0, errors: [error.message] })
      toast.error(error.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const templateData = [
      {
        'First Name': 'Sarah',
        'Last Name': 'Nakato',
        'Gender': 'F',
        'Date of Birth': '2015-03-15',
        'Parent Name': 'James Nakato',
        'Parent Phone': '0701234567',
        'Parent Phone 2': '0702345678',
        'Class': 'P.5A',
        'Student Number': '',
        'PLE Index': '',
      },
      {
        'First Name': 'Peter',
        'Last Name': 'Okello',
        'Gender': 'M',
        'Date of Birth': '2014-06-20',
        'Parent Name': 'Joseph Okello',
        'Parent Phone': '0703456789',
        'Parent Phone 2': '',
        'Class': 'P.5A',
        'Student Number': '',
        'PLE Index': '',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'Omuto_SMS_Student_Template.xlsx')
    toast.success('Template downloaded')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Students</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Upload a spreadsheet to add students in bulk</p>
      </div>

      {/* Download Template */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Download Template</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use our template for best results when importing students</p>
          </div>
          <button onClick={downloadTemplate} className="btn btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="card border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer transition-colors mb-6"
      >
        <div className="text-center py-8">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-gray-900 dark:text-white font-medium mb-2">
            {file ? file.name : 'Click to upload or drag and drop'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Excel or CSV file</p>
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Preview</h2>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Parent</th>
                  <th>Phone</th>
                  <th>Class</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row: any, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row['First Name'] || row['first_name'] || ''} {row['Last Name'] || row['last_name'] || ''}</td>
                    <td>{row['Gender'] || row['gender'] || ''}</td>
                    <td>{row['Parent Name'] || row['parent_name'] || ''}</td>
                    <td>{row['Parent Phone'] || row['parent_phone'] || ''}</td>
                    <td>{row['Class'] || row['class_name'] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Showing first {preview.length} rows
          </p>
        </div>
      )}

      {/* Import Button */}
      {file && (
        <button 
          onClick={handleImport} 
          disabled={importing}
          className="btn btn-primary w-full mb-6"
        >
          {importing ? 'Importing...' : 'Import Students'}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Import Results</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{result.success}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Successful</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{result.failed}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Errors:</p>
              <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
