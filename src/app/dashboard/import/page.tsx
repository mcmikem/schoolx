'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

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
    XLSX.writeFile(wb, 'SchoolX_Student_Template.xlsx')
    toast.success('Template downloaded')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Import Students</h1>
        <p className="text-[#5c6670] mt-1">Upload a spreadsheet to add students in bulk</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[#191c1d]">Download Template</h2>
            <p className="text-sm text-[#5c6670] mt-1">Use our template for best results when importing students</p>
          </div>
          <button onClick={downloadTemplate} className="btn btn-secondary">
            <MaterialIcon icon="download" className="text-lg" />
            Download Template
          </button>
        </div>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="bg-white rounded-2xl border-2 border-dashed border-[#e8eaed] hover:border-[#002045] cursor-pointer transition-all mb-6 p-8 text-center"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="w-16 h-16 bg-[#e3f2fd] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MaterialIcon icon="upload_file" className="text-3xl text-[#002045]" />
        </div>
        <p className="text-[#191c1d] font-medium mb-2">
          {file ? file.name : 'Click to upload or drag and drop'}
        </p>
        <p className="text-sm text-[#5c6670]">Excel or CSV file</p>
      </div>

      {preview.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
          <h2 className="font-semibold text-[#191c1d] mb-4">Preview</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafb]">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Name</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Gender</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Parent</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Phone</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Class</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row: any, i) => (
                  <tr key={i} className="border-t border-[#e8eaed]">
                    <td className="p-3 font-medium text-[#191c1d]">{row['First Name'] || row['first_name'] || ''} {row['Last Name'] || row['last_name'] || ''}</td>
                    <td className="p-3 text-[#5c6670]">{row['Gender'] || row['gender'] || ''}</td>
                    <td className="p-3 text-[#5c6670]">{row['Parent Name'] || row['parent_name'] || ''}</td>
                    <td className="p-3 text-[#5c6670]">{row['Parent Phone'] || row['parent_phone'] || ''}</td>
                    <td className="p-3 text-[#5c6670]">{row['Class'] || row['class_name'] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#5c6670] mt-4">
            Showing first {preview.length} rows
          </p>
        </div>
      )}

      {file && (
        <button 
          onClick={handleImport} 
          disabled={importing}
          className="btn btn-primary w-full mb-6"
        >
          <MaterialIcon icon="upload" className="text-lg" />
          {importing ? 'Importing...' : 'Import Students'}
        </button>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <h2 className="font-semibold text-[#191c1d] mb-4">Import Results</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-[#e8f5e9] rounded-xl">
              <div className="text-2xl font-bold text-[#006e1c]">{result.success}</div>
              <div className="text-sm text-[#5c6670]">Successful</div>
            </div>
            <div className="text-center p-4 bg-[#fef2f2] rounded-xl">
              <div className="text-2xl font-bold text-[#ba1a1a]">{result.failed}</div>
              <div className="text-sm text-[#5c6670]">Failed</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="p-4 bg-[#fef2f2] rounded-xl">
              <p className="text-sm font-medium text-[#ba1a1a] mb-2">Errors:</p>
              <ul className="text-sm text-[#5c6670] space-y-1">
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