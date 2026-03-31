'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export default function ImportPage() {
  const { user } = useAuth()
  const toast = useToast()
  
  const [activeTab, setActiveTab] = useState<'upload' | 'ai_paste'>('ai_paste')
  
  // File state
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // AI Paste state
  const [rawText, setRawText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  
  // Shared state
  const [preview, setPreview] = useState<any[]>([])
  const [mappedData, setMappedData] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)
    setRawText('')

    try {
      const XLSX = await import('xlsx')
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const allStudents = XLSX.utils.sheet_to_json(sheet)
      
      const mapped = allStudents.map((row: any) => ({
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

      setMappedData(mapped)
      setPreview(mapped.slice(0, 10))
    } catch (err) {
      toast.error('Failed to read file')
    }
  }

  const handleAIAnalysis = async () => {
    if (!rawText.trim()) {
      toast.error('Please paste some text first')
      return
    }

    setAnalyzing(true)
    setResult(null)
    setFile(null)

    try {
      const response = await fetch('/api/parse-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse text')
      }

      const students = data.data?.students || []
      setMappedData(students)
      setPreview(students.slice(0, 10))
      toast.success(`Successfully extracted \${students.length} students`)
    } catch (error: any) {
      toast.error(error.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleImport = async () => {
    if (mappedData.length === 0) return

    setImporting(true)
    try {
      if (!user?.school_id) {
        throw new Error('No school associated with your account')
      }

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: mappedData,
          schoolId: user.school_id,
        }),
      })

      const importResult = await response.json()
      setResult(importResult)
      
      if (importResult.success > 0) {
        toast.success(`Imported \${importResult.success} students`)
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
        'Class': 'P.5',
        'Student Number': '',
        'PLE Index': '',
      }
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'SchoolX_Student_Template.xlsx')
    toast.success('Template downloaded')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Import Students</h1>
        <p className="text-[#5c6670] mt-1">Add students using AI smart paste or file upload</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-2 mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => { setActiveTab('ai_paste'); setPreview([]); setMappedData([]); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all \${
              activeTab === 'ai_paste' 
                ? 'bg-[#002045] text-white shadow-md' 
                : 'text-[#5c6670] hover:bg-[#f8fafb]'
            }`}
          >
            <MaterialIcon icon="smart_toy" className="text-lg" />
            AI Smart Paste
          </button>
          <button
            onClick={() => { setActiveTab('upload'); setPreview([]); setMappedData([]); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all \${
              activeTab === 'upload' 
                ? 'bg-[#002045] text-white shadow-md' 
                : 'text-[#5c6670] hover:bg-[#f8fafb]'
            }`}
          >
            <MaterialIcon icon="upload_file" className="text-lg" />
            File Upload
          </button>
        </div>
      </div>

      {activeTab === 'ai_paste' ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
          <div className="mb-4">
            <h2 className="font-semibold text-[#191c1d] flex items-center gap-2">
              <MaterialIcon icon="auto_awesome" className="text-primary" />
              Paste Data Automatically
            </h2>
            <p className="text-sm text-[#5c6670] mt-1">
              Copied a messy table from Excel, Word, or an email? Paste it here and our AI will automatically structure it into valid student records.
            </p>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full h-48 p-4 bg-[#f8fafb] border border-[#e8eaed] rounded-xl focus:ring-2 focus:ring-[#002045] focus:border-[#002045] outline-none resize-none mb-4"
            placeholder="John Doe M P.3 0701234567\nJane Smith Female S.4 0771234567..."
          />
          <button 
            onClick={handleAIAnalysis} 
            disabled={analyzing || !rawText.trim()}
            className="btn btn-primary"
          >
            <MaterialIcon icon="psychology" className="text-lg" />
            {analyzing ? 'Analyzing with AI...' : 'Analyze Data'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[#191c1d]">Download Template</h2>
                <p className="text-sm text-[#5c6670] mt-1">Use our template for best results when importing students</p>
              </div>
              <button onClick={downloadTemplate} className="btn btn-secondary">
                <MaterialIcon icon="download" className="text-lg" />
                Template
              </button>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-white rounded-2xl border-2 border-dashed border-[#e8eaed] hover:border-[#002045] cursor-pointer transition-all p-8 text-center"
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
        </div>
      )}

      {preview.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#191c1d]">Review Data Preview</h2>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg">
              {mappedData.length} records ready
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafb]">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">First Name</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Last Name</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Gender</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Class</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Parent Phone</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row: any, i) => (
                  <tr key={i} className="border-t border-[#e8eaed]">
                    <td className="p-3 font-medium text-[#191c1d]">{row.first_name || ''}</td>
                    <td className="p-3 font-medium text-[#191c1d]">{row.last_name || ''}</td>
                    <td className="p-3 text-[#5c6670]">{row.gender || ''}</td>
                    <td className="p-3 text-[#5c6670] font-medium">{row.class_name || ''}</td>
                    <td className="p-3 text-[#5c6670]">{row.parent_phone || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#5c6670] mt-4">
            Showing first {preview.length} of {mappedData.length} rows to import.
          </p>
        </div>
      )}

      {mappedData.length > 0 && (
        <button 
          onClick={handleImport} 
          disabled={importing}
          className="btn btn-primary w-full mb-6 py-4 text-lg"
        >
          <MaterialIcon icon="database" className="text-xl" />
          {importing ? 'Saving to Database...' : `Confirm & Import \${mappedData.length} Students`}
        </button>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <h2 className="font-semibold text-[#191c1d] mb-4">Import Results</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-[#e8f5e9] rounded-xl">
              <div className="text-2xl font-bold text-[#006e1c]">{result.success}</div>
              <div className="text-sm text-[#5c6670]">Successful Inserts</div>
            </div>
            <div className="text-center p-4 bg-[#fef2f2] rounded-xl">
              <div className="text-2xl font-bold text-[#ba1a1a]">{result.failed}</div>
              <div className="text-sm text-[#5c6670]">Failed Inserts</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="p-4 bg-[#fef2f2] rounded-xl">
              <p className="text-sm font-medium text-[#ba1a1a] mb-2">Errors details (check class names exist):</p>
              <ul className="text-sm text-[#5c6670] space-y-1 max-h-40 overflow-y-auto">
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