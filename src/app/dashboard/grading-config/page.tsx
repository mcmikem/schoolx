'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface GradingConfig {
  schoolLevel: 'primary' | 'secondary_o' | 'secondary_a'
  caWeight: number
  examWeight: number
  caBreakdown: {
    ca1: number
    ca2: number
    ca3: number
    ca4: number
    project: number
  }
  alevelSubjects: {
    principal: string[]
    subsidiary: string[]
  }
}

export default function GradingConfigPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<GradingConfig>({
    schoolLevel: 'primary',
    caWeight: 40,
    examWeight: 60,
    caBreakdown: {
      ca1: 20,
      ca2: 20,
      ca3: 20,
      ca4: 20,
      project: 20
    },
    alevelSubjects: {
      principal: ['Mathematics', 'Physics', 'Chemistry'],
      subsidiary: ['General Paper']
    }
  })

  useEffect(() => {
    const saved = localStorage.getItem('grading_config')
    if (saved) {
      try {
        setConfig(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    try {
      localStorage.setItem('grading_config', JSON.stringify(config))
      if (school?.id) {
        await supabase.from('school_settings').upsert({
          school_id: school.id,
          key: 'grading_config',
          value: JSON.stringify(config)
        }, { onConflict: 'school_id,key' })
      }
      toast.success('Grading configuration saved')
    } catch (err) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const totalCA = Object.values(config.caBreakdown).reduce((sum, v) => sum + v, 0)
  const totalWeight = config.caWeight + config.examWeight

  const getGradePreview = () => {
    if (config.schoolLevel === 'primary' || config.schoolLevel === 'secondary_o') {
      return [
        { range: '80-100%', grade: 'D1', desc: 'Distinction 1' },
        { range: '70-79%', grade: 'D2', desc: 'Distinction 2' },
        { range: '65-69%', grade: 'C3', desc: 'Credit 3' },
        { range: '60-64%', grade: 'C4', desc: 'Credit 4' },
        { range: '55-59%', grade: 'C5', desc: 'Credit 5' },
        { range: '50-54%', grade: 'C6', desc: 'Credit 6' },
        { range: '45-49%', grade: 'P7', desc: 'Pass 7' },
        { range: '40-44%', grade: 'P8', desc: 'Pass 8' },
        { range: '0-39%', grade: 'F9', desc: 'Fail' },
      ]
    } else {
      return [
        { range: '80-100%', grade: 'A', desc: 'Principal Pass' },
        { range: '70-79%', grade: 'B', desc: 'Principal Pass' },
        { range: '60-69%', grade: 'C', desc: 'Principal Pass' },
        { range: '50-59%', grade: 'D', desc: 'Principal Pass' },
        { range: '40-49%', grade: 'E', desc: 'Subsidiary Pass' },
        { range: '35-39%', grade: 'O', desc: 'Ordinary' },
        { range: '0-34%', grade: 'F', desc: 'Fail' },
      ]
    }
  }

  const gradePreview = getGradePreview()

  const getDivisionPreview = () => {
    if (config.schoolLevel === 'primary') {
      return [
        { aggregate: '4-12', division: 'Division I', desc: 'Excellent' },
        { aggregate: '13-24', division: 'Division II', desc: 'Very Good' },
        { aggregate: '25-28', division: 'Division III', desc: 'Good' },
        { aggregate: '29-32', division: 'Division IV', desc: 'Satisfactory' },
        { aggregate: '33+', division: 'Ungraded', desc: 'Below Standard' },
      ]
    } else if (config.schoolLevel === 'secondary_o') {
      return [
        { aggregate: '4-36', division: 'Division I', desc: 'Excellent (1-6)' },
        { aggregate: '37-44', division: 'Division II', desc: 'Very Good (7-12)' },
        { aggregate: '45-52', division: 'Division III', desc: 'Good (13-18)' },
        { aggregate: '53-58', division: 'Division IV', desc: 'Pass (19-23)' },
        { aggregate: '59+', division: 'Ungraded', desc: 'Below Standard' },
      ]
    } else {
      return [
        { points: '18-24', division: 'Division I', desc: '3 Principal + 1 Subsidiary' },
        { points: '15-17', division: 'Division II', desc: 'Good performance' },
        { points: '12-14', division: 'Division III', desc: 'Satisfactory' },
        { points: '9-11', division: 'Division IV', desc: 'Marginal Pass' },
        { points: '0-8', division: 'Ungraded', desc: 'Below Standard' },
      ]
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Grading Configuration</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure CA and Exam weighting per UNEB standards</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="space-y-6">
            {/* School Level */}
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">School Level</h2>
              <select
                value={config.schoolLevel}
                onChange={(e) => setConfig({...config, schoolLevel: e.target.value as any})}
                className="input"
              >
                <option value="primary">Primary (PLE)</option>
                <option value="secondary_o">Secondary O-Level (UCE)</option>
                <option value="secondary_a">Secondary A-Level (UACE)</option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {config.schoolLevel === 'primary' && 'Primary Leaving Examination - Uses D1-F9 grading'}
                {config.schoolLevel === 'secondary_o' && 'Uganda Certificate of Education - Uses D1-F9 with 8-subject division'}
                {config.schoolLevel === 'secondary_a' && 'Uganda Advanced Certificate - Uses A-F with points system'}
              </p>
            </div>

            {config.schoolLevel !== 'secondary_a' && (
              <>
                {/* Main Weighting */}
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Overall Weighting</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">CA Weight (%)</label>
                      <input
                        type="number"
                        value={config.caWeight}
                        onChange={(e) => setConfig({...config, caWeight: Number(e.target.value)})}
                        className="input"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="label">Exam Weight (%)</label>
                      <input
                        type="number"
                        value={config.examWeight}
                        onChange={(e) => setConfig({...config, examWeight: Number(e.target.value)})}
                        className="input"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  {totalWeight !== 100 && (
                    <p className="text-red-500 text-sm mt-2">Total must equal 100%</p>
                  )}
                </div>

                {/* CA Breakdown */}
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-4">CA Breakdown (within CA)</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">CA 1 (%)</label>
                      <input
                        type="number"
                        value={config.caBreakdown.ca1}
                        onChange={(e) => setConfig({
                          ...config,
                          caBreakdown: {...config.caBreakdown, ca1: Number(e.target.value)}
                        })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">CA 2 (%)</label>
                      <input
                        type="number"
                        value={config.caBreakdown.ca2}
                        onChange={(e) => setConfig({
                          ...config,
                          caBreakdown: {...config.caBreakdown, ca2: Number(e.target.value)}
                        })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">CA 3 (%)</label>
                      <input
                        type="number"
                        value={config.caBreakdown.ca3}
                        onChange={(e) => setConfig({
                          ...config,
                          caBreakdown: {...config.caBreakdown, ca3: Number(e.target.value)}
                        })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">CA 4 (%)</label>
                      <input
                        type="number"
                        value={config.caBreakdown.ca4}
                        onChange={(e) => setConfig({
                          ...config,
                          caBreakdown: {...config.caBreakdown, ca4: Number(e.target.value)}
                        })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Project (%)</label>
                      <input
                        type="number"
                        value={config.caBreakdown.project}
                        onChange={(e) => setConfig({
                          ...config,
                          caBreakdown: {...config.caBreakdown, project: Number(e.target.value)}
                        })}
                        className="input"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    CA Breakdown Total: {totalCA}% {totalCA !== 100 && <span className="text-red-500">(must equal 100%)</span>}
                  </p>
                </div>
              </>
            )}

            {config.schoolLevel === 'secondary_a' && (
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white mb-4">A-Level Subject Classification</h2>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    A-Level uses a points system: 3 Principal subjects + 1 Subsidiary (General Paper).<br/>
                    Points: A=6, B=5, C=4, D=3, E=2, O=1, F=0
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Principal Subjects</label>
                    <input
                      type="text"
                      value={config.alevelSubjects?.principal.join(', ')}
                      onChange={(e) => setConfig({
                        ...config,
                        alevelSubjects: {
                          ...config.alevelSubjects,
                          principal: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }
                      })}
                      className="input"
                      placeholder="Mathematics, Physics, Chemistry"
                    />
                  </div>
                  <div>
                    <label className="label">Subsidiary Subjects</label>
                    <input
                      type="text"
                      value={config.alevelSubjects?.subsidiary.join(', ')}
                      onChange={(e) => setConfig({
                        ...config,
                        alevelSubjects: {
                          ...config.alevelSubjects,
                          subsidiary: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }
                      })}
                      className="input"
                      placeholder="General Paper"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <button 
              onClick={saveConfig} 
              disabled={saving || (config.schoolLevel !== 'secondary_a' && (totalWeight !== 100 || totalCA !== 100))} 
              className="btn btn-primary w-full"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Grade Preview */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              {config.schoolLevel === 'secondary_a' ? 'A-Level Grade Scale (A-F)' : 'UNEB Grade Scale (D1-F9)'}
            </h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Grade</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {gradePreview.map((g, i) => (
                    <tr key={i}>
                      <td>{g.range}</td>
                      <td>
                        <span className={`font-bold ${
                          g.grade.startsWith('D') || g.grade === 'A' ? 'text-green-600' :
                          g.grade.startsWith('C') || g.grade === 'B' ? 'text-blue-600' :
                          g.grade.startsWith('P') || g.grade === 'C' ? 'text-yellow-600' :
                          'text-red-500'
                        }`}>
                          {g.grade}
                        </span>
                      </td>
                      <td className="text-gray-500">{g.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              {config.schoolLevel === 'secondary_a' ? 'A-Level Division System' : 
               config.schoolLevel === 'secondary_o' ? 'UCE Division (8 subjects)' : 'PLE Division (4 subjects)'}
            </h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>{config.schoolLevel === 'secondary_a' ? 'Points' : 'Aggregate'}</th>
                    <th>Division</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {getDivisionPreview().map((d, i) => (
                    <tr key={i}>
                      <td className="font-mono">{'aggregate' in d ? d.aggregate : d.points}</td>
                      <td>
                        <span className={`font-bold ${
                          d.division.includes('I') ? 'text-green-600' :
                          d.division.includes('II') ? 'text-blue-600' :
                          d.division.includes('III') ? 'text-yellow-600' :
                          'text-orange-500'
                        }`}>
                          {d.division}
                        </span>
                      </td>
                      <td className="text-gray-500">{d.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
