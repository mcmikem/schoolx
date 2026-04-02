'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import MaterialIcon from '@/components/MaterialIcon'

interface Note {
  id: string
  title: string
  content: string
  category: 'app' | 'teaching' | 'curriculum' | 'general'
  icon: string
}

interface ExpandedNote extends Note {
  fullContent: string
}

const expandNote = (note: Note): ExpandedNote => {
  return { ...note, fullContent: note.content }
}

const defaultNotes: Note[] = [
  {
    id: '1',
    title: 'Getting Started with SchoolX',
    category: 'app',
    icon: 'school',
    content: `Welcome to SchoolX School Management System! Here's how to get started:

1. **Set Up Your School** - Go to Setup to configure your school details, academic year, and terms.

2. **Add Classes** - Create classes (P.5A, S.1 West, etc.) in the Classes section.

3. **Add Students** - Register students individually or import from CSV/Excel.

4. **Set Up Subjects** - Configure subjects for your school based on the Uganda curriculum.

5. **Set Fee Structure** - Define tuition, development, and other fees per class/term.

6. **Start Using** - Mark attendance, enter grades, record payments, and send messages to parents.`
  },
  {
    id: '2',
    title: 'Marking Daily Attendance',
    category: 'app',
    icon: 'fact_check',
    content: `The attendance feature helps you track student presence daily:

• Select a class from the dropdown
• Choose the date (defaults to today)
• Mark each student as Present, Absent, Late, or Excused
• Click "Save Attendance" to record

**Tips:**
- Mark attendance at the start of each school day
- Late students can be marked with a specific time
- Use the "Mark All Present" quick action for full attendance
- Review attendance reports in Analytics`
  },
  {
    id: '3',
    title: 'Recording Student Grades',
    category: 'app',
    icon: 'grade',
    content: `Grade entry supports the UNEB assessment framework:

**Assessment Types:**
- CA1, CA2, CA3, CA4 (Continuous Assessment)
- Project Work
- End of Term Exam

**Grading follows UNEB standards:**
- D1-D2: 80-100 (Division I)
- C3-C4: 65-79 (Division II)  
- C5-C6: 55-64 (Division III)
- P7-P8: 45-49 (Division IV)
- F9: 0-44 (Ungraded)

**Tips:**
- Enter marks throughout the term for accurate averages
- Use topic coverage to track curriculum progress
- Generate report cards at term end`
  },
  {
    id: '4',
    title: 'Managing School Fees',
    category: 'app',
    icon: 'payments',
    content: `The fees module handles all financial operations:

**Fee Structure:**
- Set fees per class per term (Tuition, Development, Exam fees, etc.)
- Define due dates for each fee item

**Recording Payments:**
- Cash payments - record amount and payer
- Mobile Money - include MTN/Airtel transaction ID
- Bank - record reference number
- Installments - track partial payments

**Reports:**
- View student balances
- Track collections by method
- Export payment records

**Tip:** Use Mobile Money for instant payment tracking via parent phone numbers.`
  },
  {
    id: '5',
    title: 'Sending SMS to Parents',
    category: 'app',
    icon: 'sms',
    content: `Keep parents informed via SMS:

**Individual Messages:**
- Enter parent phone number directly
- Send specific student updates

**Class Messages:**
- Select a class to message all parents
- Bulk SMS to entire class

**Broadcast:**
- Message all parents in the school

**Auto-SMS Reports:**
- Set up automatic attendance summaries
- Fee status notifications
- Weekly performance reports

**Note:** SMS requires Africa's Talking API configuration. Contact your administrator.`
  },
  {
    id: '6',
    title: 'Uganda Primary Curriculum Overview',
    category: 'curriculum',
    icon: 'menu_book',
    content: `The Uganda Primary School Curriculum (NCDC 2024):

**P1-P3 (Lower Primary):**
- English, Mathematics
- Integrated Science
- Social Studies
- Religious Education
- Physical Education

**P4-P7 (Upper Primary):**
All P1-P3 subjects plus:
- Local Language
- Art & Craft
- Music
- Agriculture

**Assessment:**
- Continuous Assessment (40%)
- End of Term Exams (60%)
- Primary Leaving Examination (PLE)

**Key Focus Areas:**
- Competency-based learning
- Thematic approach in lower primary
- STEM integration`
  },
  {
    id: '7',
    title: 'Uganda Secondary Curriculum (New)',
    category: 'curriculum',
    icon: 'school',
    content: `Uganda's New Lower Secondary Curriculum (2024+):

**S1-S4 Structure (Competency-Based):**

**Core Subjects (All Students):**
- English, Mathematics
- Computer Studies
- Entrepreneurship Education
- Physical Education

**Science Stream:**
- Biology, Chemistry, Physics
- Geography, History
- CRE/IRE

**Arts Stream:**
- Literature, Geography, History
- CRE/IRE, Fine Art

**Commercial Stream:**
- Commerce, Accounting
- Economics, Mathematics

**Assessment:**
- Continuous Assessment (50%)
- End of Term Exams (50%)`
  },
  {
    id: '8',
    title: 'Effective Teaching Strategies',
    category: 'teaching',
    icon: 'psychology',
    content: `Best Practices for Ugandan Classrooms:

**Lesson Planning:**
- Use schemes of work as guide
- Prepare teaching aids locally
- Incorporate local examples

**Student Engagement:**
- Group work and discussions
- Practical demonstrations
- Regular questioning

**Assessment:**
- Daily exit tickets
- Weekly quizzes
- Monthly tests

**Differentiation:**
- Pair strong students with struggling ones
- Provide extra support for slow learners
- Challenge advanced learners

**Class Management:**
- Establish clear rules early
- Use positive reinforcement
- Keep lessons interactive`
  },
  {
    id: '9',
    title: 'Handling Student Discipline',
    category: 'teaching',
    icon: 'gavel',
    content: `Positive Discipline Approaches:

**Preventive Measures:**
- Create clear classroom expectations
- Build relationships with students
- Make lessons engaging

**When Issues Arise:**
1. Stay calm - don't react emotionally
2. Understand the context
3. Apply fair, consistent consequences
4. Document incidents

**Recording:**
- Use the Discipline section to log issues
- Track patterns over time
- Communicate with parents

**Support:**
- Refer serious issues to counseling
- Work with administration
- Involve parents early`
  },
  {
    id: '10',
    title: 'Parent Communication Tips',
    category: 'teaching',
    icon: 'family_restroom',
    content: `Building Strong Parent Partnerships:

**Regular Updates:**
- Send attendance alerts
- Share progress reports
- Announce school events

**Positive First Contact:**
- Introduce yourself at start of term
- Share your expectations
- Establish communication channel

**Handling Concerns:**
- Listen actively
- Acknowledge parent feelings
- Focus on solutions
- Follow up

**Best Times for Contact:**
- After school hours
- Weekend for urgent matters
- Schedule meetings in advance

**Use SMS Wisely:**
- Be brief and clear
- Avoid sensitive matters via text
- Follow up with calls when needed`
  },
  {
    id: '11',
    title: 'Academic Calendar & Terms',
    category: 'general',
    icon: 'calendar_month',
    content: `Uganda School Terms 2026:

**Term 1:** 
- January - March
- Approximately 12 weeks
- Includes opening day activities

**Term 2:**
- May - August  
- Approximately 12 weeks
- Mid-term breaks

**Term 3:**
- September - November
- Approximately 12 weeks
- End of year exams

**Key Dates to Remember:**
- Term start/end dates
- Mid-term breaks
- Exam periods
- Parent meetings
- Sports day
- PLE/UCE examination periods

Set these up in the School Setup section.`
  },
  {
    id: '12',
    title: 'Data Management Best Practices',
    category: 'general',
    icon: 'storage',
    content: `Keeping Your School Data Safe:

**Backups:**
- Data is stored in Supabase cloud
- Export important data regularly

**Student Records:**
- Keep student numbers unique
- Update contact info regularly
- Track status changes (transferred, left)

**Financial Records:**
- Reconcile daily
- Keep payment references
- Issue receipts for all payments

**Privacy:**
- Student data is confidential
- Only authorized staff should access
- Don't share login credentials

**Reporting:**
- Use Analytics for insights
- Generate reports regularly
- Keep copies of important reports`
  },
]

export default function NotesPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedNote, setSelectedNote] = useState<ExpandedNote | null>(null)

  const filteredNotes = defaultNotes.filter(note => {
    const matchesFilter = filter === 'all' || note.category === filter
    const matchesSearch = note.title.toLowerCase().includes(search.toLowerCase()) ||
                         note.content.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const categories = [
    { value: 'all', label: 'All Notes', icon: 'apps' },
    { value: 'app', label: 'App Guide', icon: 'touch_app' },
    { value: 'teaching', label: 'Teaching Tips', icon: 'psychology' },
    { value: 'curriculum', label: 'Curriculum', icon: 'menu_book' },
    { value: 'general', label: 'General', icon: 'info' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Teacher Notes</h1>
        <p className="text-[#5c6670] mt-1">Guides, curriculum info, and teaching resources</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f]" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="tabs">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={`tab flex items-center gap-1.5 ${filter === cat.value ? 'active' : ''}`}
            >
              <MaterialIcon className="text-sm">{cat.icon}</MaterialIcon>
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNotes.map(note => (
          <div 
            key={note.id} 
            onClick={() => setSelectedNote(expandNote(note))}
            className="card hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center flex-shrink-0">
                <MaterialIcon className="text-primary" style={{ fontVariationSettings: 'FILL 1' }}>{note.icon}</MaterialIcon>
              </div>
              <div>
                <h3 className="font-semibold text-[#002045]">{note.title}</h3>
                <span className="text-xs text-[#74777f] uppercase">{note.category}</span>
              </div>
            </div>
            <div className="text-sm text-[#5c6670] whitespace-pre-line line-clamp-6">
              {note.content}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-[#74777f]">
              <span>Click to read more</span>
              <MaterialIcon className="text-lg">arrow_forward</MaterialIcon>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for full note */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center flex-shrink-0">
                <MaterialIcon className="text-primary text-2xl" style={{ fontVariationSettings: 'FILL 1' }}>{selectedNote.icon}</MaterialIcon>
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-xl text-[#002045]">{selectedNote.title}</h2>
                <span className="text-xs text-[#74777f] uppercase bg-gray-100 px-2 py-0.5 rounded">{selectedNote.category}</span>
              </div>
              <button onClick={() => setSelectedNote(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <MaterialIcon className="text-xl">close</MaterialIcon>
              </button>
            </div>
            <div className="p-6 text-sm text-[#5c6670] whitespace-pre-line">
              {selectedNote.fullContent}
            </div>
          </div>
        </div>
      )}

      {filteredNotes.length === 0 && (
        <div className="empty-state">
          <MaterialIcon className="text-4xl text-[#74777f]">search_off</MaterialIcon>
          <h3 className="text-lg font-semibold text-[#002045] mt-4">No notes found</h3>
          <p className="text-[#5c6670]">Try adjusting your search or filter</p>
        </div>
      )}

      {/* Help Card */}
      <div className="mt-8 bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <MaterialIcon className="text-4xl" style={{ fontVariationSettings: 'FILL 1' }}>lightbulb</MaterialIcon>
          <div>
            <h3 className="font-bold text-lg">Need More Help?</h3>
            <p className="text-white/80 text-sm">Contact your school administrator or email support@omuto.sms for assistance.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
