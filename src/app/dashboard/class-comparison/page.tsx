'use client'
import { useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/EmptyState'

export default function ClassComparisonPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)

  const classStats = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id)
      const boys = classStudents.filter(s => s.gender === 'M').length
      const girls = classStudents.filter(s => s.gender === 'F').length

      return {
        id: cls.id,
        name: cls.name,
        total: classStudents.length,
        boys,
        girls,
        genderRatio: classStudents.length > 0 ? Math.round((girls / classStudents.length) * 100) : 0,
      }
    }).sort((a, b) => b.total - a.total)
  }, [classes, students])

  const totals = useMemo(() => ({
    students: classStats.reduce((sum, c) => sum + c.total, 0),
    boys: classStats.reduce((sum, c) => sum + c.boys, 0),
    girls: classStats.reduce((sum, c) => sum + c.girls, 0),
  }), [classStats])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Class Comparison" 
        subtitle="Compare performance across classes"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-[var(--primary)]">{totals.students}</div>
            <div className="text-sm text-[var(--t3)]">Total Students</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-blue-600">{totals.boys}</div>
            <div className="text-sm text-[var(--t3)]">Boys</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-pink-600">{totals.girls}</div>
            <div className="text-sm text-[var(--t3)]">Girls</div>
          </CardBody>
        </Card>
      </div>

      {classStats.length === 0 ? (
        <EmptyState 
          icon="school" 
          title="No classes available"
          description="Create classes to see comparison data"
        />
      ) : (
        <>
          <Card>
            <CardBody>
              <div className="table-wrapper">
                <table className="table">
                  <thead className="bg-[var(--surface-container)]">
                    <tr>
                      <th>Class</th>
                      <th>Total</th>
                      <th>Boys</th>
                      <th>Girls</th>
                      <th>Gender Ratio</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStats.map((cls) => (
                      <tr key={cls.id}>
                        <td className="font-medium text-[var(--primary)]">{cls.name}</td>
                        <td>{cls.total}</td>
                        <td className="text-blue-600">{cls.boys}</td>
                        <td className="text-pink-600">{cls.girls}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-pink-500 rounded-full" 
                                style={{ width: `${cls.genderRatio}%` }}
                              />
                            </div>
                            <span className="text-sm text-[var(--t3)]">{cls.genderRatio}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            cls.total > 50 ? 'bg-amber-100 text-amber-700' : cls.total > 30 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {cls.total > 50 ? 'Large' : cls.total > 30 ? 'Medium' : 'Small'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card className="mt-6 max-w-2xl">
            <CardBody>
              <h2 className="font-semibold text-[var(--primary)] mb-4">About Class Comparison</h2>
              <ul className="space-y-2 text-sm text-[var(--t3)]">
                <li>Compare student enrollment across classes</li>
                <li>Identify overcrowded or underpopulated classes</li>
                <li>Track gender balance by class</li>
                <li>Help with resource allocation decisions</li>
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}