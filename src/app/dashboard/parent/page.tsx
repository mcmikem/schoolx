'use client'
import { useAuth } from '@/lib/auth-context'

const recentAttendance = [
  { date: 'Mar 22', status: 'present' },
  { date: 'Mar 21', status: 'present' },
  { date: 'Mar 20', status: 'absent' },
  { date: 'Mar 19', status: 'present' },
  { date: 'Mar 18', status: 'late' },
  { date: 'Mar 17', status: 'present' },
  { date: 'Mar 16', status: 'present' },
]

const feeStatus = { totalFee: 250000, totalPaid: 150000, balance: 100000 }

const recentGrades = [
  { subject: 'Mathematics', ca: 72, exam: 65, grade: 'C4' },
  { subject: 'English', ca: 82, exam: 78, grade: 'D2' },
  { subject: 'Science', ca: 88, exam: 85, grade: 'D1' },
  { subject: 'Social Studies', ca: 65, exam: 58, grade: 'C5' },
]

const notifications = [
  { type: 'fee', message: 'Fee balance: UGX 100,000 remaining', time: '2h ago' },
  { type: 'attendance', message: 'Sarah was absent on March 20th', time: '2d ago' },
  { type: 'grade', message: 'Term 1 exam results available', time: '5d ago' },
]

export default function ParentPortal() {
  const { user } = useAuth()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parent Portal</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">View your child's progress</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Student Card */}
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-300">SN</span>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">Sarah Nakato</div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Class: P.5A</span>
              <span>•</span>
              <span>STU00001</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">55/60</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Attendance</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">75.6%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Average</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">100K</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Balance</div>
          </div>
        </div>

        {/* Fee Status */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Fee Status</h2>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Paid: UGX {feeStatus.totalPaid.toLocaleString()}</span>
              <span>Total: UGX {feeStatus.totalFee.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all" 
                style={{ width: `${(feeStatus.totalPaid / feeStatus.totalFee) * 100}%` }} 
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Balance</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">UGX {feeStatus.balance.toLocaleString()}</div>
            </div>
            <button className="btn btn-primary btn-sm">Pay Now</button>
          </div>
        </div>

        {/* Attendance */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Attendance</h2>
          <div className="flex gap-2">
            {recentAttendance.map((day, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={`w-full h-10 rounded-lg flex items-center justify-center ${
                  day.status === 'present' ? 'bg-green-100 dark:bg-green-900/30' : 
                  day.status === 'absent' ? 'bg-red-100 dark:bg-red-900/30' : 
                  'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                  {day.status === 'present' ? (
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : day.status === 'absent' ? (
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{day.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grades */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Grades</h2>
          <div className="space-y-3">
            {recentGrades.map((grade, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="font-medium text-gray-900 dark:text-white">{grade.subject}</div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">CA: {grade.ca}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Exam: {grade.exam}</span>
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                    grade.grade.startsWith('D') ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 
                    grade.grade.startsWith('C') ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 
                    'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {grade.grade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
          <div className="space-y-3">
            {notifications.map((notif, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  notif.type === 'fee' ? 'bg-yellow-500' : 
                  notif.type === 'attendance' ? 'bg-red-500' : 
                  'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">{notif.message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notif.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
