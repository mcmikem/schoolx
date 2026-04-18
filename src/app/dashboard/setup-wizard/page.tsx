'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { getErrorMessage } from '@/lib/validation'

const STEPS = [
  { id: 1, title: 'School Info', icon: 'school' },
  { id: 2, title: 'Academic', icon: 'calendar_today' },
  { id: 3, title: 'Classes', icon: 'class' },
  { id: 4, title: 'Subjects', icon: 'menu_book' },
  { id: 5, title: 'Staff', icon: 'person' },
  { id: 6, title: 'Fees', icon: 'payments' },
  { id: 7, title: 'Import', icon: 'upload_file' },
  { id: 8, title: 'Done', icon: 'check_circle' },
]

const PRIMARY_CLASSES = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7']
const SECONDARY_CLASSES = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']
const COMBINED_CLASSES = [...PRIMARY_CLASSES, ...SECONDARY_CLASSES]

const PRIMARY_SUBJECTS = [
  { name: 'English Language', code: 'ENG', compulsory: true },
  { name: 'Mathematics', code: 'MATH', compulsory: true },
  { name: 'Integrated Science', code: 'SCI', compulsory: true },
  { name: 'Social Studies', code: 'SST', compulsory: true },
  { name: 'Religious Education', code: 'RE', compulsory: true },
  { name: 'Local Language', code: 'LL', compulsory: false },
  { name: 'Kiswahili', code: 'KIS', compulsory: false },
  { name: 'Creative Arts', code: 'CA', compulsory: false },
  { name: 'Physical Education', code: 'PE', compulsory: false },
]

const SECONDARY_SUBJECTS = [
  { name: 'English Language', code: 'ENG', compulsory: true },
  { name: 'Mathematics', code: 'MATH', compulsory: true },
  { name: 'Physics', code: 'PHY', compulsory: false },
  { name: 'Chemistry', code: 'CHEM', compulsory: false },
  { name: 'Biology', code: 'BIO', compulsory: false },
  { name: 'History', code: 'HIST', compulsory: false },
  { name: 'Geography', code: 'GEO', compulsory: false },
  { name: 'Economics', code: 'ECON', compulsory: false },
  { name: 'Literature', code: 'LIT', compulsory: false },
  { name: 'Divinity', code: 'DIV', compulsory: false },
  { name: 'Agriculture', code: 'AGR', compulsory: false },
  { name: 'Computer Studies', code: 'COMP', compulsory: false },
  { name: 'Fine Art', code: 'FA', compulsory: false },
  { name: 'Music', code: 'MUS', compulsory: false },
  { name: 'Entrepreneurship', code: 'ENT', compulsory: false },
]

const DEFAULT_FEE_ITEMS = {
  primary: [
    { name: 'Tuition', amount: 150000 },
    { name: 'Lunch', amount: 80000 },
    { name: 'Library', amount: 20000 },
    { name: 'Sports', amount: 15000 },
    { name: 'Development', amount: 50000 },
  ],
  secondary: [
    { name: 'Tuition', amount: 250000 },
    { name: 'Boarding', amount: 200000 },
    { name: 'Lunch', amount: 80000 },
    { name: 'Library', amount: 25000 },
    { name: 'Laboratory', amount: 30000 },
    { name: 'Sports', amount: 20000 },
    { name: 'Development', amount: 75000 },
  ],
}

export default function SetupWizardPage() {
  const router = useRouter()
  const { user, school } = useAuth()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<Record<string, boolean>>({})

  const [schoolInfo, setSchoolInfo] = useState({
    motto: '',
    phone: school?.phone || '',
    email: '',
    address: '',
    district: school?.district || '',
    logo_url: '',
    primary_color: '#002045',
  })

  const [academic, setAcademic] = useState({
    year: new Date().getFullYear().toString(),
    type: 'primary' as 'primary' | 'secondary' | 'combined',
    terms: 3,
    grading_system: 'uneb' as 'uneb' | 'percentage' | 'custom',
  })

  const [classes, setClasses] = useState<string[]>(PRIMARY_CLASSES)
  const [subjects, setSubjects] = useState(PRIMARY_SUBJECTS.map(s => ({ ...s, selected: true })))
  const [staff, setStaff] = useState<{ name: string; phone: string; role: string }[]>([])
  const [fees, setFees] = useState<{ name: string; amount: string }[]>(
    DEFAULT_FEE_ITEMS.primary.map(f => ({ ...f, amount: f.amount.toString() }))
  )
  const [importChoice, setImportChoice] = useState<'students' | 'fees' | 'skip'>('skip')

  const handleTypeChange = (type: 'primary' | 'secondary' | 'combined') => {
    const classList = type === 'primary' ? PRIMARY_CLASSES : type === 'secondary' ? SECONDARY_CLASSES : COMBINED_CLASSES
    const subjectList = type === 'secondary' ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS
    const feeList = type === 'secondary' ? DEFAULT_FEE_ITEMS.secondary : DEFAULT_FEE_ITEMS.primary

    setAcademic(prev => ({ ...prev, type }))
    setClasses(classList)
    setSubjects(subjectList.map(s => ({ ...s, selected: true })))
    setFees(feeList.map(f => ({ ...f, amount: f.amount.toString() })))
  }

  const toggleSubject = (index: number) => {
    setSubjects(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s))
  }

  const addStaff = () => setStaff(prev => [...prev, { name: '', phone: '', role: 'teacher' }])
  const removeStaff = (i: number) => setStaff(prev => prev.filter((_, idx) => idx !== i))
  const updateStaff = (i: number, field: string, value: string) => {
    setStaff(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const addFee = () => setFees(prev => [...prev, { name: '', amount: '0' }])
  const removeFee = (i: number) => setFees(prev => prev.filter((_, idx) => idx !== i))
  const updateFee = (i: number, field: string, value: string) => {
    setFees(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }

  const createStaffAccount = async (schoolId: string, member: { name: string; phone: string; role: string }) => {
    const digitsOnly = member.phone.replace(/\D/g, '')
    const defaultPassword = `Welcome${digitsOnly.slice(-4) || '1234'}`

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId,
        fullName: member.name,
        phone: member.phone,
        password: defaultPassword,
        role: member.role,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Failed to create staff member "${member.name}"`)
    }
  }

  // Local submit handler only used by this page; it does not need stable memoization.
  const handleSave = async () => {
    if (!user?.school_id && !school?.id) {
      toast.error('No school associated with your account')
      return
    }
    const schoolId = user?.school_id || school?.id
    if (!schoolId) {
      toast.error('No school associated with your account')
      return
    }

    setSaving(true)
    try {
      const classRows = classes
        .map((className) => className.trim())
        .filter(Boolean)
        .map((className) => ({
          school_id: schoolId,
          name: className,
          level: academic.type,
          academic_year: academic.year,
          max_students: 60,
        }))

      const subjectRows = subjects
        .filter((subject) => subject.selected)
        .map((subject) => ({
          school_id: schoolId,
          name: subject.name,
          code: subject.code,
          level: academic.type,
          is_compulsory: subject.compulsory,
        }))

      const feeRows = fees
        .filter((fee) => fee.name.trim() && parseFloat(fee.amount) > 0)
        .map((fee) => ({
          school_id: schoolId,
          name: fee.name.trim(),
          amount: parseFloat(fee.amount),
          term: 1,
          academic_year: academic.year,
        }))

      const staffRows = staff.filter((member) => member.name.trim() && member.phone.trim())

      // Step 1: Update school info (without marking onboarding complete yet)
      const { error: schoolError } = await supabase.from('schools').update({
        phone: schoolInfo.phone,
        district: schoolInfo.district,
        school_motto: schoolInfo.motto,
        primary_color: schoolInfo.primary_color,
      }).eq('id', schoolId)
      if (schoolError) throw new Error(`Failed to update school info: ${schoolError.message}`)

      // Step 2: Create classes
      if (classRows.length > 0) {
        const { error: classError } = await supabase
          .from('classes')
          .upsert(classRows, { onConflict: 'school_id,name,academic_year' })

        if (classError) throw new Error(`Failed to save classes: ${classError.message}`)
      }

      // Step 3: Create subjects
      if (subjectRows.length > 0) {
        const { error: subjectError } = await supabase
          .from('subjects')
          .upsert(subjectRows, { onConflict: 'school_id,code' })

        if (subjectError) throw new Error(`Failed to save subjects: ${subjectError.message}`)
      }

      // Step 4: Create staff through the hardened provisioning route
      for (const member of staffRows) {
        await createStaffAccount(schoolId, member)
      }

      // Step 5: Create fee structure
      if (feeRows.length > 0) {
        const { error: feeError } = await supabase
          .from('fee_structure')
          .upsert(feeRows, { onConflict: 'school_id,name,term,academic_year' })

        if (feeError) throw new Error(`Failed to save fee structure: ${feeError.message}`)
      }

      const checklistItems = [
        { item_key: 'academic_calendar', item_label: 'Academic Calendar' },
        { item_key: 'class_structure', item_label: 'Class & Stream Setup' },
        { item_key: 'fee_structure', item_label: 'Fee Structure' },
        { item_key: 'staff_accounts', item_label: 'Staff Accounts' },
      ]

      if (checklistItems.length > 0) {
        const { error: checklistError } = await supabase
          .from('setup_checklist')
          .upsert(
            checklistItems.map((item) => ({
              school_id: schoolId,
              ...item,
              is_completed: true,
              completed_at: new Date().toISOString(),
            })),
            { onConflict: 'school_id,item_key' },
          )

        if (checklistError) {
          throw new Error(`Failed to update setup checklist: ${checklistError.message}`)
        }
      }

      // Step 6: Mark onboarding complete only after all steps succeed
      const { error: completeError } = await supabase.from('schools').update({
        onboarding_complete: true,
      }).eq('id', schoolId)
      if (completeError) throw new Error(`Failed to finalize setup: ${completeError.message}`)

      toast.success('School setup completed!')
      setProgress({ complete: true })
      setCurrentStep(8)
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Failed to save setup changes')
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const stepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-[#002045]">School Information</h2>
            <p className="text-sm text-[#5c6670]">Basic details about your school. This appears on reports, receipts, and the dashboard.</p>
            <div>
              <label className="label">School Motto (optional)</label>
              <input type="text" value={schoolInfo.motto} onChange={(e) => setSchoolInfo({...schoolInfo, motto: e.target.value})} className="input" placeholder="e.g., Education for Life" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input type="tel" value={schoolInfo.phone} onChange={(e) => setSchoolInfo({...schoolInfo, phone: e.target.value})} className="input" placeholder="0700000000" />
              </div>
              <div>
                <label className="label">District</label>
                <input type="text" value={schoolInfo.district} onChange={(e) => setSchoolInfo({...schoolInfo, district: e.target.value})} className="input" placeholder="e.g., Kampala" />
              </div>
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input type="email" value={schoolInfo.email} onChange={(e) => setSchoolInfo({...schoolInfo, email: e.target.value})} className="input" placeholder="info@school.ac.ug" />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={schoolInfo.primary_color} onChange={(e) => setSchoolInfo({...schoolInfo, primary_color: e.target.value})} className="w-12 h-10 rounded border cursor-pointer" />
                <input type="text" value={schoolInfo.primary_color} onChange={(e) => setSchoolInfo({...schoolInfo, primary_color: e.target.value})} className="input flex-1" />
                <span className="text-xs text-[#5c6670]">Used in reports, receipts & dashboard</span>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-[#002045]">Academic Settings</h2>
            <p className="text-sm text-[#5c6670]">Set up your school type, academic year, and grading system.</p>
            <div>
              <label className="label">Academic Year</label>
              <input type="text" value={academic.year} onChange={(e) => setAcademic({...academic, year: e.target.value})} className="input" />
            </div>
            <div>
              <label className="label">School Type</label>
              <div className="grid grid-cols-3 gap-3">
                {(['primary', 'secondary', 'combined'] as const).map(type => (
                  <button key={type} onClick={() => handleTypeChange(type)} className={`p-4 rounded-xl border-2 text-center transition-all ${academic.type === type ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="font-medium text-[#002045] capitalize">{type}</div>
                    <div className="text-xs text-[#5c6670] mt-1">
                      {type === 'primary' ? 'P.1 – P.7' : type === 'secondary' ? 'S.1 – S.6' : 'P.1 – S.6'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Terms per Year</label>
              <select value={academic.terms} onChange={(e) => setAcademic({...academic, terms: parseInt(e.target.value)})} className="input">
                <option value={3}>3 Terms (Uganda standard)</option>
                <option value={2}>2 Terms (Semester)</option>
                <option value={4}>4 Terms (Quarterly)</option>
              </select>
            </div>
            <div>
              <label className="label">Grading System</label>
              <select value={academic.grading_system} onChange={(e) => setAcademic({...academic, grading_system: e.target.value as any})} className="input">
                <option value="uneb">UNEB (Division I–IV)</option>
                <option value="percentage">Percentage (0–100%)</option>
                <option value="custom">Custom (Configure later)</option>
              </select>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#002045]">Classes</h2>
                <p className="text-sm text-[#5c6670]">{classes.length} classes will be created</p>
              </div>
              <button onClick={() => { const name = prompt('Class name:'); if (name) setClasses(prev => [...prev, name]) }} className="btn btn-secondary btn-sm">
                <MaterialIcon icon="add" /> Add
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {classes.map((cls, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#f8fafb] rounded-lg">
                  <span className="font-medium text-[#002045]">{cls}</span>
                  <button onClick={() => setClasses(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <MaterialIcon icon="close" style={{ fontSize: 18 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-[#002045]">Subjects</h2>
            <p className="text-sm text-[#5c6670]">Select subjects for your school. Compulsory subjects are pre-selected.</p>
            <div className="grid grid-cols-2 gap-2">
              {subjects.map((subject, i) => (
                <button key={i} onClick={() => toggleSubject(i)} className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${subject.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 opacity-60'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${subject.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {subject.selected && <MaterialIcon icon="check" style={{ fontSize: 16, color: '#fff' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#002045]">{subject.name}</div>
                    <div className="text-xs text-[#5c6670]">{subject.code} {subject.compulsory && '• Compulsory'}</div>
                  </div>
                </button>
              ))}
            </div>
            <div>
              <label className="label">Add Custom Subject</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Subject name" className="input flex-1" onKeyDown={(e) => { if (e.key === 'Enter') { const target = e.target as HTMLInputElement; if (target.value.trim()) { setSubjects(prev => [...prev, { name: target.value.trim(), code: target.value.trim().substring(0, 4).toUpperCase(), compulsory: false, selected: true }]); target.value = '' } } }} />
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#002045]">Staff</h2>
                <p className="text-sm text-[#5c6670]">Add key staff members. You can add more later.</p>
              </div>
              <button onClick={addStaff} className="btn btn-secondary btn-sm"><MaterialIcon icon="add" /> Add</button>
            </div>
            {staff.length === 0 && (
              <div className="text-center py-8 text-[#5c6670]">
                <MaterialIcon icon="person_add" className="text-3xl mx-auto mb-2" />
                <p className="text-sm">No staff added yet. Add at least a headteacher and bursar.</p>
                <button onClick={addStaff} className="text-blue-600 text-sm font-medium mt-2">+ Add first staff member</button>
              </div>
            )}
            <div className="space-y-3">
              {staff.map((member, i) => (
                <div key={i} className="p-4 bg-[#f8fafb] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#5c6670]">Staff #{i + 1}</span>
                    <button onClick={() => removeStaff(i)} className="text-red-400 hover:text-red-600"><MaterialIcon icon="delete" style={{ fontSize: 18 }} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" placeholder="Full name" value={member.name} onChange={(e) => updateStaff(i, 'name', e.target.value)} className="input" />
                    <input type="tel" placeholder="Phone" value={member.phone} onChange={(e) => updateStaff(i, 'phone', e.target.value)} className="input" />
                    <select value={member.role} onChange={(e) => updateStaff(i, 'role', e.target.value)} className="input">
                      <option value="teacher">Teacher</option>
                      <option value="headmaster">Headteacher</option>
                      <option value="bursar">Bursar</option>
                      <option value="dean_of_studies">Dean of Studies</option>
                      <option value="secretary">Secretary</option>
                      <option value="dorm_master">Dorm Master</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#002045]">Fee Structure</h2>
                <p className="text-sm text-[#5c6670]">Set up Term 1 fees. You can edit and add terms later.</p>
              </div>
              <button onClick={addFee} className="btn btn-secondary btn-sm"><MaterialIcon icon="add" /> Add</button>
            </div>
            <div className="space-y-2">
              {fees.map((fee, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#f8fafb] rounded-lg">
                  <input type="text" placeholder="Fee name" value={fee.name} onChange={(e) => updateFee(i, 'name', e.target.value)} className="input flex-1" />
                  <input type="number" placeholder="Amount" value={fee.amount} onChange={(e) => updateFee(i, 'amount', e.target.value)} className="input w-32" />
                  <button onClick={() => removeFee(i)} className="text-red-400 hover:text-red-600"><MaterialIcon icon="delete" style={{ fontSize: 18 }} /></button>
                </div>
              ))}
            </div>
            {fees.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                Total per student: <strong>UGX {fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0).toLocaleString()}</strong>
              </div>
            )}
          </div>
        )

      case 7:
        return (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-[#002045]">Bulk Import (Optional)</h2>
            <p className="text-sm text-[#5c6670]">You can import data now or do it later from the dashboard.</p>
            <div className="space-y-3">
              {[
                { key: 'students' as const, icon: 'group', title: 'Students', desc: 'Import student records from Excel/CSV', badge: 'Recommended' },
                { key: 'fees' as const, icon: 'payments', title: 'Fee Balances', desc: 'Import existing fee balances per student', badge: '' },
                { key: 'skip' as const, icon: 'skip_next', title: 'Skip for Now', desc: 'I\'ll set up data later from the dashboard', badge: '' },
              ].map(option => (
                <button key={option.key} onClick={() => setImportChoice(option.key)} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${importChoice === option.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <MaterialIcon icon={option.icon} className="text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-[#002045]">{option.title}</div>
                    <div className="text-sm text-[#5c6670]">{option.desc}</div>
                  </div>
                  {option.badge && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{option.badge}</span>}
                </button>
              ))}
            </div>
          </div>
        )

      case 8:
        return (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <MaterialIcon icon="check_circle" className="text-4xl text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#002045]">School Setup Complete!</h2>
            <p className="text-[#5c6670] max-w-md mx-auto">
              Your school is configured with {classes.length} classes, {subjects.filter(s => s.selected).length} subjects, and {fees.length} fee items.
            </p>
            {importChoice === 'students' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 mb-2">
                  <MaterialIcon icon="upload_file" className="text-amber-600" />
                  <span className="font-medium text-amber-800">Next: Import Students</span>
                </div>
                <p className="text-sm text-amber-700">You'll be redirected to the import page to upload your student records.</p>
              </div>
            )}
            {importChoice === 'fees' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 mb-2">
                  <MaterialIcon icon="payments" className="text-amber-600" />
                  <span className="font-medium text-amber-800">Next: Import Fee Balances</span>
                </div>
                <p className="text-sm text-amber-700">You'll be redirected to import existing fee balances.</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <PageErrorBoundary>
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8eaed] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#002045]">School Setup Wizard</h1>
            <p className="text-sm text-[#5c6670]">Step {currentStep} of {STEPS.length}</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-[#5c6670] hover:text-[#002045]">
            Skip to Dashboard
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1 min-w-0">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${currentStep >= step.id ? 'bg-blue-50 text-blue-700' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > step.id ? 'bg-blue-600 text-white' : currentStep === step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {currentStep > step.id ? <MaterialIcon icon="check" style={{ fontSize: 14 }} /> : step.id}
                  </div>
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          {stepContent()}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
            {currentStep > 1 && currentStep < 8 && (
              <button onClick={() => setCurrentStep(currentStep - 1)} className="btn btn-secondary">Back</button>
            )}
            {currentStep < 7 ? (
              <button onClick={() => setCurrentStep(currentStep + 1)} className="btn btn-primary flex-1">Next</button>
            ) : currentStep === 7 ? (
              <button onClick={() => setCurrentStep(8)} className="btn btn-primary flex-1">Continue</button>
            ) : currentStep === 8 ? (
              <button onClick={() => {
                if (importChoice === 'students') router.push('/dashboard/import?type=students')
                else if (importChoice === 'fees') router.push('/dashboard/import?type=fees')
                else router.push('/dashboard')
              }} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Saving...' : importChoice === 'skip' ? 'Go to Dashboard' : 'Continue to Import'}
              </button>
            ) : null}
            {currentStep === 7 && (
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  )
}
