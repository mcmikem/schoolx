'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'

export default function IDCardsPage() {
  const { school } = useAuth()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  const filteredStudents = selectedClass 
    ? students.filter(s => s.class_id === selectedClass)
    : students

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedStudents(filteredStudents.map(s => s.id))
  }

  const deselectAll = () => {
    setSelectedStudents([])
  }

  const generateIDCard = (student: typeof students[0]) => {
    const cardWindow = window.open('', '_blank')
    if (!cardWindow) return

    const schoolColor = school?.primary_color || '#002045'
    const schoolName = school?.name || 'School'
    const schoolCode = school?.school_code || ''
    
    cardWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${student.first_name} ${student.last_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; }
          .id-card {
            width: 350px;
            height: 220px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: row;
          }
          .left-section {
            width: 100px;
            background: linear-gradient(180deg, ${schoolColor} 0%, ${schoolColor}dd 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 15px;
          }
          .avatar {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: ${schoolColor};
            border: 3px solid white;
          }
          .school-name-small {
            color: white;
            font-size: 8px;
            text-align: center;
            margin-top: 10px;
            font-weight: 500;
          }
          .right-section {
            flex: 1;
            padding: 15px;
            display: flex;
            flex-direction: column;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .school-name {
            font-size: 11px;
            font-weight: 700;
            color: ${schoolColor};
            text-transform: uppercase;
          }
          .card-type {
            font-size: 8px;
            color: #666;
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .student-name {
            font-size: 14px;
            font-weight: 700;
            color: #111;
            margin-bottom: 2px;
          }
          .student-info {
            font-size: 9px;
            color: #666;
            margin-bottom: 1px;
          }
          .barcode {
            margin-top: auto;
            height: 25px;
            background: repeating-linear-gradient(
              90deg,
              #111 0px,
              #111 1px,
              transparent 1px,
              transparent 3px
            );
            border-radius: 2px;
          }
          .footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: ${schoolColor};
          }
          @media print {
            body { margin: 0; }
            .id-card { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="id-card">
          <div class="left-section">
            <div class="avatar">${student.first_name?.[0]}${student.last_name?.[0]}</div>
            <div class="school-name-small">${schoolName}</div>
          </div>
          <div class="right-section">
            <div class="header">
              <span class="school-name">${schoolName}</span>
              <span class="card-type">STUDENT</span>
            </div>
            <div class="student-name">${student.first_name} ${student.last_name}</div>
            <div class="student-info">Class: ${student.classes?.name || 'N/A'}</div>
            <div class="student-info">Student No: ${student.student_number || 'N/A'}</div>
            <div class="student-info">Gender: ${student.gender === 'M' ? 'Male' : 'Female'}</div>
            <div class="barcode"></div>
          </div>
        </div>
      </body>
      </html>
    `)
    cardWindow.document.close()
    cardWindow.print()
  }

  const printAllCards = () => {
    selectedStudents.forEach(id => {
      const student = students.find(s => s.id === id)
      if (student) generateIDCard(student)
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Student ID Cards</h2>
          <p className="text-gray-500 mt-1">Generate and print student identification cards</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={printAllCards}
            disabled={selectedStudents.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
          >
            <MaterialIcon icon="print" className="text-lg" />
            Print Selected ({selectedStudents.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudents([]) }}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium"
        >
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button onClick={selectAll} className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl">
          Select All
        </button>
        <button onClick={deselectAll} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">
          Deselect All
        </button>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStudents.map(student => (
          <div 
            key={student.id} 
            className={`bg-white rounded-2xl border-2 overflow-hidden hover:shadow-md transition-all cursor-pointer ${
              selectedStudents.includes(student.id) 
                ? 'border-blue-500 shadow-md' 
                : 'border-gray-100'
            }`}
            onClick={() => toggleStudent(student.id)}
          >
            <div className="flex items-center p-4 gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${
                student.gender === 'M' 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
                  : 'bg-gradient-to-br from-pink-500 to-pink-600 text-white'
              }`}>
                {student.first_name?.[0]}{student.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{student.first_name} {student.last_name}</h3>
                <p className="text-sm text-gray-500">{student.classes?.name}</p>
                <p className="text-xs text-gray-400">{student.student_number}</p>
              </div>
              {selectedStudents.includes(student.id) && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <MaterialIcon className="text-white text-sm" style={{ fontVariationSettings: 'FILL 1' }}>check</MaterialIcon>
                </div>
              )}
            </div>
            <div className="px-4 pb-4">
              <button 
                onClick={(e) => { e.stopPropagation(); generateIDCard(student) }}
                className="w-full py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center gap-2"
              >
                <MaterialIcon className="text-lg">badge</MaterialIcon>
                Generate Card
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <MaterialIcon className="text-5xl text-gray-300 mx-auto mb-4">badge</MaterialIcon>
          <h3 className="font-bold text-gray-900 mb-2">No Students Found</h3>
          <p className="text-gray-500">Add students to generate ID cards</p>
        </div>
      )}
    </div>
  )
}
