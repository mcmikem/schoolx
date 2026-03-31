'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'

interface StudentRow {
  student_number?: string
  first_name: string
  last_name: string
  gender: 'M' | 'F'
  date_of_birth?: string
  parent_name?: string
  parent_phone?: string
  class_id?: string
  status?: string
}

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export default function BulkImport({ onComplete }: { onComplete: () => void }) {
  const { school } = useAuth()
  const { classes } = useClasses(school?.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [result, setResult] = useState<ImportResult>({ success: 0, failed: 0, errors: [] })
  const [error, setError] = useState('')

  const parseCSV = (text: string): StudentRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) throw new Error('CSV file must have at least a header row and one data row')
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/['"]/g, ''))
    const requiredFields = ['first_name', 'last_name', 'gender']
    
    for (const field of requiredFields) {
      if (!headers.includes(field)) {
        throw new Error(`Missing required column: ${field}`)
      }
    }
    
    const students: StudentRow[] = []
    const errors: string[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''))
      if (values.length === 0 || values.every(v => !v)) continue
      
      const student: any = {}
      headers.forEach((header, idx) => {
        student[header] = values[idx] || ''
      })
      
      // Validate required fields
      if (!student.first_name || !student.last_name || !student.gender) {
        errors.push(`Row ${i + 1}: Missing required fields`)
        continue
      }
      
      // Normalize gender
      const gender = student.gender?.toUpperCase()
      if (gender !== 'M' && gender !== 'F' && gender !== 'MALE' && gender !== 'FEMALE') {
        errors.push(`Row ${i + 1}: Invalid gender (use M or F)`)
        continue
      }
      
      students.push({
        student_number: student.student_number || '',
        first_name: student.first_name,
        last_name: student.last_name,
        gender: gender === 'MALE' ? 'M' : gender === 'FEMALE' ? 'F' : gender as 'M' | 'F',
        date_of_birth: student.date_of_birth || student.dob || '',
        parent_name: student.parent_name || student.guardian_name || '',
        parent_phone: student.parent_phone || student.guardian_phone || student.phone || '',
      })
    }
    
    if (students.length === 0) {
      throw new Error('No valid student records found in file')
    }
    
    return students
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setError('')
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = parseCSV(text)
        setStudents(parsed)
        setStep('preview')
      } catch (err: any) {
        setError(err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!school?.id || !supabase) {
      setError('Cannot import - no school or database connection')
      return
    }
    
    setStep('importing')
    setError('')
    
    const results: ImportResult = { success: 0, failed: 0, errors: [] }
    const batchSize = 50
    
    // Process in batches
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize).map(s => ({
        school_id: school.id,
        student_number: s.student_number || `STD-${Date.now()}-${i}`,
        first_name: s.first_name,
        last_name: s.last_name,
        gender: s.gender,
        date_of_birth: s.date_of_birth || null,
        parent_name: s.parent_name || null,
        parent_phone: s.parent_phone || null,
        class_id: selectedClass || null,
        status: 'active',
        admission_date: new Date().toISOString().split('T')[0],
      }))
      
      try {
        const { data, error: insertError } = await supabase
          .from('students')
          .insert(batch)
          .select()
        
        if (insertError) {
          results.failed += batch.length
          results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`)
        } else {
          results.success += data?.length || batch.length
        }
      } catch (err: any) {
        results.failed += batch.length
        results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${err.message}`)
      }
    }
    
    setResult(results)
    setStep('complete')
  }

  const downloadTemplate = () => {
    const template = `student_number,first_name,last_name,gender,date_of_birth,parent_name,parent_phone
001,John,Doe,M,2015-01-15,Jane Doe,0700000001
002,Mary,Smith,F,2015-03-20,John Smith,0700000002
003,Peter,Jones,M,2014-07-10,Sarah Jones,0700000003`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'student_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--t1)' }}>
        Bulk Import Students
      </h2>
      
      {error && (
        <div style={{ 
          padding: 12, 
          background: 'var(--red-soft)', 
          color: 'var(--red)', 
          borderRadius: 8, 
          marginBottom: 16,
          fontSize: 14 
        }}>
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--t2)', display: 'block', marginBottom: 8 }}>
              Assign to Class (optional)
            </label>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--bg)',
              transition: 'border-color 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--t4)', display: 'block', marginBottom: 16 }}>
              upload_file
            </span>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>
              Click to upload CSV file
            </p>
            <p style={{ fontSize: 13, color: 'var(--t3)' }}>
              Or drag and drop your file here
            </p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
          
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button 
              onClick={downloadTemplate}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--navy)',
                cursor: 'pointer',
                fontSize: 14,
                textDecoration: 'underline',
              }}
            >
              Download CSV template
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--t2)' }}>
              Found {students.length} students to import
            </span>
            <button 
              onClick={() => { setStep('upload'); setStudents([]) }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--t3)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ← Back
            </button>
          </div>
          
          <div style={{ 
            maxHeight: 300, 
            overflow: 'auto', 
            border: '1px solid var(--border)', 
            borderRadius: 8,
            marginBottom: 16
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Name</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Gender</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Parent Phone</th>
                </tr>
              </thead>
              <tbody>
                {students.slice(0, 20).map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{i + 1}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.first_name} {s.last_name}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.gender}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.parent_phone || '-'}</td>
                  </tr>
                ))}
                {students.length > 20 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '8px 12px', fontSize: 13, color: 'var(--t3)', textAlign: 'center' }}>
                      ... and {students.length - 20} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <button 
            onClick={handleImport}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--navy)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Import {students.length} Students
          </button>
        </div>
      )}

      {step === 'importing' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="animate-spin" style={{ 
            width: 48, 
            height: 48, 
            border: '3px solid var(--border)',
            borderTopColor: 'var(--navy)',
            borderRadius: '50%',
            margin: '0 auto 16px'
          }} />
          <p style={{ fontSize: 16, color: 'var(--t1)' }}>Importing students...</p>
        </div>
      )}

      {step === 'complete' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: result.failed === 0 ? 'var(--green-soft)' : 'var(--amber-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <span className="material-symbols-outlined" style={{ 
              fontSize: 32, 
              color: result.failed === 0 ? 'var(--green)' : 'var(--amber)' 
            }}>
              {result.failed === 0 ? 'check_circle' : 'warning'}
            </span>
          </div>
          
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>
            Import Complete
          </h3>
          
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16 }}>
            {result.success} students imported successfully
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>
          
          {result.errors.length > 0 && (
            <div style={{ 
              maxHeight: 150, 
              overflow: 'auto', 
              background: 'var(--red-soft)', 
              borderRadius: 8, 
              padding: 12,
              textAlign: 'left',
              marginBottom: 16
            }}>
              {result.errors.slice(0, 10).map((err, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>{err}</p>
              ))}
            </div>
          )}
          
          <button 
            onClick={onComplete}
            style={{
              padding: '12px 24px',
              background: 'var(--navy)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
