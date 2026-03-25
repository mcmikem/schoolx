'use client'
import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download, ChevronRight, Activity, Zap, Star } from 'lucide-react'
import BackgroundBlobs from '@/components/BackgroundBlobs'
import { useAuth } from '@/lib/auth-context'

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export default function ImportPage() {
  const { user } = useAuth()
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

    // Parse CSV/Excel
    const XLSX = await import('xlsx')
    const data = await selectedFile.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(sheet)

    setPreview(jsonData.slice(0, 10))
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

      // Map column names to our expected format
      const mappedStudents = allStudents.map((row: any) => ({
        first_name: row['First Name'] || row['first_name'] || row['First Name*'] || '',
        last_name: row['Last Name'] || row['last_name'] || row['Last Name*'] || '',
        gender: row['Gender'] || row['gender'] || row['Gender*'] || '',
        date_of_birth: row['Date of Birth'] || row['date_of_birth'] || row['DOB'] || '',
        parent_name: row['Parent Name'] || row['parent_name'] || row['Parent/Guardian Name'] || row['Parent Name*'] || '',
        parent_phone: row['Parent Phone'] || row['parent_phone'] || row['Phone'] || row['Parent Phone*'] || '',
        parent_phone2: row['Parent Phone 2'] || row['parent_phone2'] || row['Phone 2'] || '',
        class_name: row['Class'] || row['class_name'] || row['Class*'] || '',
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
    } catch (error: any) {
      setResult({ success: 0, failed: 0, errors: [error.message] })
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
  }

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      <BackgroundBlobs />
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <Upload className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Bulk Integration</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Scholar Import Hub</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Synchronize entire scholar datasets with the Omuto Cloud via high-speed spreadsheet integration.</p>
        </div>
      </div>

      {/* Extreme Glass Template Download */}
      <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-[48px] p-10 shadow-2xl shadow-gray-200/10 transition-all hover:bg-white/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center shadow-xl shadow-gray-200/5 group-hover:rotate-6 transition-all duration-500 border border-gray-50">
               <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Baseline Protocol Template</h3>
              <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-widest leading-relaxed">
                Utilize our specialized high-fidelity template for optimal cloud ingestion. Required data includes scholarship indices and mobile authority sequences.
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="h-16 px-10 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95 whitespace-nowrap"
          >
            <Download className="w-5 h-5" />
            Download Source Template
          </button>
        </div>
      </div>

      {/* Supreme Glass Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="bg-white/70 backdrop-blur-xl border-4 border-dashed border-gray-100/50 rounded-[64px] p-24 text-center hover:border-primary-100 hover:bg-white transition-all duration-700 cursor-pointer shadow-2xl shadow-gray-200/20 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="relative z-10">
           <div className="w-24 h-24 bg-white border border-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl group-hover:scale-110 group-hover:rotate-[15deg] transition-all duration-700">
              <Upload className="w-12 h-12 text-primary-800" />
           </div>
           <p className="text-3xl font-black text-gray-900 tracking-tight">
             {file ? file.name : 'Initiate File Transmission'}
           </p>
           <p className="text-[11px] font-black text-gray-400 mt-4 uppercase tracking-[4px] italic">
             Supports High-Density .XLSX, .XLS, and .CSV Clusters
           </p>
        </div>
      </div>

      {/* Preview Matrix */}
      {preview.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[48px] shadow-2xl shadow-gray-200/20 overflow-hidden animate-in slide-in-from-bottom-10 duration-700">
          <div className="p-10 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                 <Activity className="w-4 h-4 text-primary-800 animate-pulse" />
                 <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Data Ingestion Preview</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Cluster Snapshot ({preview.length} rows)</h2>
              <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-widest leading-none italic">Review ingestion deltas before commitment</p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="h-16 px-12 bg-emerald-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-emerald-500/30 disabled:opacity-50 active:scale-95"
            >
              <CheckCircle className="w-5 h-5" />
              {importing ? 'Synchronizing...' : 'Commit Global Import'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  {['Scholar Name', 'Legal Sequence', 'Gender Matrix', 'Temporal Delta', 'Authority Parent', 'Contact Sequence', 'Operational Level'].map((h, i) => (
                    <th key={i} className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/50">
                {preview.map((row: any, i) => (
                  <tr key={i} className="hover:bg-white transition-all duration-500 group">
                    <td className="px-8 py-5 text-sm font-black text-gray-900 group-hover:text-primary-800">{row['First Name'] || row['first_name'] || '-'}</td>
                    <td className="px-8 py-5 text-sm font-black text-gray-900 group-hover:text-primary-800">{row['Last Name'] || row['last_name'] || '-'}</td>
                    <td className="px-8 py-5 text-xs font-bold text-gray-500">{row['Gender'] || row['gender'] || '-'}</td>
                    <td className="px-8 py-5 text-xs font-bold font-mono text-gray-400">{row['Date of Birth'] || row['date_of_birth'] || '-'}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700 italic">{row['Parent Name'] || row['parent_name'] || '-'}</td>
                    <td className="px-8 py-5 text-xs font-black text-gray-400 font-mono tracking-widest">{row['Parent Phone'] || row['parent_phone'] || '-'}</td>
                    <td className="px-8 py-5"><span className="text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 group-hover:bg-primary-50 transition-all">{row['Class'] || row['class_name'] || '-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result Protocol Alerts */}
      {result && (
        <div className={`rounded-[40px] p-10 shadow-2xl animate-in zoom-in duration-500 ${
          result.failed === 0 ? 'bg-emerald-50/50 border border-emerald-100/50 shadow-emerald-100/20' : 'bg-amber-50/50 border border-amber-100/50 shadow-amber-100/20'
        }`}>
          <div className="flex items-start gap-8">
            <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-xl ${result.failed === 0 ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-amber-500 shadow-amber-500/20'}`}>
               {result.failed === 0 ? (
                 <CheckCircle className="w-8 h-8 text-white fill-white" />
               ) : (
                 <AlertCircle className="w-8 h-8 text-white fill-white" />
               )}
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${result.failed === 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
                Ingestion Cycle Complete
              </h3>
              <div className="flex items-center gap-6 mt-3">
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-[2px] bg-emerald-100 px-4 py-1.5 rounded-full">{result.success} Scholars Synchronized</span>
                {result.failed > 0 && (
                  <span className="text-[11px] font-black text-red-700 uppercase tracking-[2px] bg-red-100 px-4 py-1.5 rounded-full">{result.failed} Failures Detected</span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[3px]">Protocol Error Log</div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.errors.slice(0, 6).map((err, i) => (
                      <li key={i} className="p-4 bg-white/50 rounded-2xl border border-red-50 text-xs font-bold text-red-600 flex items-center gap-3">
                         <XCircle className="w-4 h-4" /> {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
