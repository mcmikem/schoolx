'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Calendar,
  GraduationCap,
  Users,
  Settings,
  Globe,
  Zap,
  Activity,
  Star,
  Clock,
  Shield,
  Loader2
} from 'lucide-react'
import BackgroundBlobs from '@/components/BackgroundBlobs'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const steps = [
  { id: 1, title: 'Academic Cycle', icon: Calendar },
  { id: 2, title: 'Curriculum Protocol', icon: GraduationCap },
  { id: 3, title: 'Class Matrices', icon: Users },
  { id: 4, title: 'Subject Hub', icon: BookOpen },
  { id: 5, title: 'System Configuration', icon: Settings },
]

const curricula = [
  { id: 'uganda_primary', name: 'Uganda Primary (NCDC)', desc: 'P1-P7, PLE National Examination Protocol' },
  { id: 'uganda_secondary', name: 'Uganda Secondary (NCDC)', desc: 'S1-S6, UNEB UCE & UACE Certification' },
  { id: 'cambridge', name: 'Cambridge International', desc: 'IGCSE & A-Level Global Standards' },
  { id: 'ib', name: 'International Baccalaureate', desc: 'IB Diploma Elite Programme' },
  { id: 'edexcel', name: 'Edexcel (Pearson)', desc: 'GCSE & A-Level Certification' },
]

const defaultClasses = {
  uganda_primary: ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'],
  uganda_secondary: ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'],
  cambridge: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'],
  ib: ['Grade 11', 'Grade 12'],
  edexcel: ['Year 10', 'Year 11', 'Year 12', 'Year 13'],
}

const defaultSubjects = {
  uganda_primary: [
    'English Language', 'Mathematics', 'Integrated Science', 'Social Studies',
    'Religious Education', 'Local Language', 'Kiswahili', 'CAPE'
  ],
  uganda_secondary: [
    'English Language', 'Mathematics', 'Integrated Science', 'Social Studies',
    'Entrepreneurship', 'ICT', 'Physical Education', 'Creative Arts', 'Technology & Design'
  ],
  cambridge: [
    'English', 'Mathematics', 'Science', 'History', 'Geography',
    'French', 'Art & Design', 'Physical Education', 'ICT'
  ],
  ib: [
    'English A', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'History', 'Economics', 'Theory of Knowledge'
  ],
  edexcel: [
    'English', 'Mathematics', 'Biology', 'Chemistry', 'Physics',
    'History', 'Geography', 'Computer Science'
  ],
}

const languages = [
  'Luganda', 'Runyankole', 'Rukiga', 'Runyoro', 'Rutoro', 'Lusoga',
  'Acholi', 'Luo', 'Ateso', 'Lugbara', 'Swahili', 'English'
]

export default function SetupWizardPage() {
  const router = useRouter()
  const { user, school } = useAuth()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    academicYear: '2026',
    currentTerm: '1',
    curriculum: 'uganda_primary',
    classes: [] as string[],
    streams: {} as Record<string, string[]>,
    subjects: [] as string[],
    gradingSystem: 'uneb',
    language: 'English',
    schoolStart: '08:00',
    schoolEnd: '16:00',
  })

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedCurriculum = curricula.find((c) => c.id === form.curriculum)

  // Initialize classes when curriculum changes
  const handleCurriculumChange = (curriculumId: string) => {
    const classes = defaultClasses[curriculumId as keyof typeof defaultClasses] || []
    const subjects = defaultSubjects[curriculumId as keyof typeof defaultSubjects] || []
    updateForm('curriculum', curriculumId)
    updateForm('classes', classes)
    updateForm('subjects', subjects)
  }

  const addStream = (className: string) => {
    const current = form.streams[className] || []
    const nextStream = String.fromCharCode(65 + current.length) // A, B, C...
    updateForm('streams', {
      ...form.streams,
      [className]: [...current, nextStream],
    })
  }

  const removeStream = (className: string, stream: string) => {
    updateForm('streams', {
      ...form.streams,
      [className]: (form.streams[className] || []).filter((s) => s !== stream),
    })
  }

  const toggleClass = (className: string) => {
    if (form.classes.includes(className)) {
      updateForm('classes', form.classes.filter((c) => c !== className))
    } else {
      updateForm('classes', [...form.classes, className])
    }
  }

  const toggleSubject = (subject: string) => {
    if (form.subjects.includes(subject)) {
      updateForm('subjects', form.subjects.filter((s) => s !== subject))
    } else {
      updateForm('subjects', [...form.subjects, subject])
    }
  }

  const handleSave = async () => {
    if (!user?.school_id) {
      toast.error('No school associated with your account')
      return
    }

    setSaving(true)
    try {
      // Create classes
      for (const className of form.classes) {
        const streams = form.streams[className] || ['A']
        for (const stream of streams) {
          const { error } = await supabase.from('classes').insert({
            school_id: user.school_id,
            name: `${className}${streams.length > 1 ? stream : ''}`,
            level: form.curriculum.includes('primary') ? 'primary' : 'secondary',
            stream: streams.length > 1 ? stream : null,
            academic_year: form.academicYear,
            max_students: 50,
          })
          if (error) throw error
        }
      }

      // Create subjects
      for (const subject of form.subjects) {
        const { error } = await supabase.from('subjects').insert({
          school_id: user.school_id,
          name: subject,
          code: subject.substring(0, 3).toUpperCase(),
          level: form.curriculum.includes('primary') ? 'primary' : 'secondary',
          is_compulsory: true,
        })
        if (error) throw error
      }

      toast.success('Setup completed successfully!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save setup')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      <BackgroundBlobs />
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <Zap className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Onboarding Experience</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Institutional Provisioning</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Configure your school's structural identity with the Omuto V3 high-fidelity setup protocol.</p>
        </div>
      </div>

      {/* Progress Steps Matrix */}
      <div className="flex items-center justify-between gap-4 bg-white/70 backdrop-blur-xl rounded-[40px] border border-white shadow-2xl shadow-gray-200/10 p-6 overflow-x-auto no-scrollbar">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div
              className={`flex items-center gap-4 px-8 py-4 rounded-[24px] transition-all duration-700 ${
                currentStep === step.id
                  ? 'bg-primary-800 text-white shadow-2xl shadow-primary-500/30'
                  : currentStep > step.id
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-gray-50/50 text-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentStep === step.id ? 'bg-white/20' : ''}`}>
                {currentStep > step.id ? (
                  <Check className="w-5 h-5 stroke-[3px]" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <span className="text-xs font-black uppercase tracking-[2px] hidden lg:inline">{step.title}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-6 h-6 text-gray-100 mx-4" />
            )}
          </div>
        ))}
      </div>

      {/* Extreme Glass Content Card */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[64px] border border-white shadow-2xl shadow-gray-200/20 p-12 lg:p-20 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-96 h-96 bg-primary-50/20 rounded-full blur-3xl -mr-48 -mt-48 transition-all duration-1000 group-hover:bg-primary-50/40" />

        {/* Step 1: Academic Cycle */}
        {currentStep === 1 && (
          <div className="space-y-12 animate-in slide-in-from-right-10 duration-700 relative z-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-4">Temporal Configuration</h2>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] italic">Active Academic Lifecycle Protocol</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'Academic Year', key: 'academicYear', options: ['2025', '2026', '2027'], icon: Calendar },
                { label: 'Current Term', key: 'currentTerm', options: ['1', '2', '3'], icon: Activity },
                { label: 'Cycle Duration', key: 'duration', options: ['10 weeks', '12 weeks (Standard)', '14 weeks'], icon: Clock },
              ].map((field, i) => (
                <div key={i} className="space-y-4">
                  <label className="text-[10px] font-black text-primary-800 uppercase tracking-[3px] ml-4">{field.label}</label>
                  <div className="relative group/field">
                    <field.icon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300 group-focus-within/field:text-primary-800 transition-all" />
                    <select
                      value={(form as any)[field.key]}
                      onChange={(e) => updateForm(field.key, e.target.value)}
                      className="w-full h-18 bg-white/50 backdrop-blur-md border border-gray-100/50 rounded-[28px] pl-16 pr-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer shadow-lg shadow-gray-200/5 transition-all"
                    >
                      {field.options.map(opt => <option key={opt} value={opt.split(' ')[0]}>{opt}</option>)}
                    </select>
                    <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200 rotate-90" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Curriculum Protocol */}
        {currentStep === 2 && (
          <div className="space-y-12 animate-in slide-in-from-right-10 duration-700 relative z-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-4">Scholastic Framework</h2>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] italic">Educational Standards Injection</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {curricula.map((curriculum) => (
                <button
                  key={curriculum.id}
                  onClick={() => handleCurriculumChange(curriculum.id)}
                  className={`p-10 rounded-[40px] border-4 text-left transition-all duration-500 relative group/card ${
                    form.curriculum === curriculum.id
                      ? 'border-primary-800 bg-primary-800/10 shadow-2xl shadow-primary-500/20'
                      : 'border-transparent bg-gray-50/50 hover:bg-white hover:border-gray-100 hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`text-xl font-black tracking-tight ${form.curriculum === curriculum.id ? 'text-primary-800' : 'text-gray-900'}`}>{curriculum.name}</div>
                    {form.curriculum === curriculum.id && (
                      <div className="w-10 h-10 bg-primary-800 text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                         <Check className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-bold text-gray-400 group-hover/card:text-gray-500 uppercase tracking-widest">{curriculum.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Class Matrices */}
        {currentStep === 3 && (
          <div className="space-y-12 animate-in slide-in-from-right-10 duration-700 relative z-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-4">Operational Tiers</h2>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] italic">{selectedCurriculum?.name} Levels</p>
            </div>
            <div className="space-y-4">
              {(defaultClasses[form.curriculum as keyof typeof defaultClasses] || []).map((className) => {
                const isSelected = form.classes.includes(className)
                const streams = form.streams[className] || []
                return (
                  <div
                    key={className}
                    className={`p-8 rounded-[40px] border-2 transition-all duration-500 ${
                      isSelected
                        ? 'border-primary-100 bg-primary-50/50 shadow-lg'
                        : 'border-transparent bg-gray-50/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-8">
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => toggleClass(className)}
                          className={`w-10 h-10 rounded-2xl border-4 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary-800 border-primary-800 text-white rotate-[15deg]'
                              : 'border-gray-200'
                          }`}
                        >
                          {isSelected && <Check className="w-6 h-6" />}
                        </button>
                        <span className="text-xl font-black text-gray-900">{className} Matrix</span>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-4 flex-wrap">
                          {streams.map((stream) => (
                            <span
                              key={stream}
                              className="flex items-center gap-3 px-5 py-2.5 bg-white text-primary-800 rounded-2xl text-[10px] font-black uppercase tracking-[2px] border border-primary-50 shadow-sm"
                            >
                              Cluster {stream}
                              <button onClick={() => removeStream(className, stream)} className="hover:text-red-500 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </span>
                          ))}
                          <button
                            onClick={() => addStream(className)}
                            className="flex items-center gap-3 px-5 py-2.5 bg-primary-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[2px] hover:bg-black transition-all shadow-lg shadow-primary-500/10"
                          >
                            <Plus className="w-4 h-4" /> Add Logic Stream
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4: Subject Hub */}
        {currentStep === 4 && (
          <div className="space-y-12 animate-in slide-in-from-right-10 duration-700 relative z-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-4">Intellectual Nodes</h2>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] italic">Scholastic Discipline Injection</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(defaultSubjects[form.curriculum as keyof typeof defaultSubjects] || []).map((subject) => {
                const isSelected = form.subjects.includes(subject)
                return (
                  <button
                    key={subject}
                    onClick={() => toggleSubject(subject)}
                    className={`p-10 rounded-[40px] border-4 text-left transition-all duration-500 group/sub ${
                      isSelected
                        ? 'border-primary-800 bg-primary-800/10 shadow-2xl shadow-primary-500/10'
                        : 'border-transparent bg-gray-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-gray-900 tracking-tight group-hover/sub:text-primary-800">{subject}</span>
                      {isSelected && <div className="w-6 h-6 bg-primary-800 rounded-lg" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 5: System Configuration */}
        {currentStep === 5 && (
          <div className="space-y-12 animate-in slide-in-from-right-10 duration-700 relative z-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-4">Protocol Synthesis</h2>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] italic">Final System Calibration</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {[
                { label: 'Instruction Language', key: 'language', options: languages, icon: Globe },
                { label: 'Assessment Logic', key: 'gradingSystem', options: ['uneb', 'percentage', 'gpa', 'cambridge'], labels: ['UNEB (D1-F9)', 'Percentage Only', 'GPA (4.0 Scale)', 'Cambridge (A*-G)'], icon: Shield },
                { label: 'Protocol Ignition', key: 'schoolStart', type: 'time', icon: Activity },
                { label: 'Protocol Termination', key: 'schoolEnd', type: 'time', icon: Clock },
              ].map((field, i) => (
                <div key={i} className="space-y-4">
                   <label className="text-[10px] font-black text-primary-800 uppercase tracking-[3px] ml-4">{field.label}</label>
                   <div className="relative group/field">
                    <field.icon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300 group-focus-within/field:text-primary-800 transition-all" />
                    {field.options ? (
                      <select
                        value={(form as any)[field.key]}
                        onChange={(e) => updateForm(field.key, e.target.value)}
                        className="w-full h-18 bg-white/50 backdrop-blur-md border border-gray-100/50 rounded-[28px] pl-16 pr-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer shadow-lg shadow-gray-200/5 transition-all"
                      >
                        {field.options.map((opt, idx) => <option key={opt} value={opt}>{field.labels ? field.labels[idx] : opt}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={(form as any)[field.key]}
                        onChange={(e) => updateForm(field.key, e.target.value)}
                        className="w-full h-18 bg-white/50 backdrop-blur-md border border-gray-100/50 rounded-[28px] pl-16 pr-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none shadow-lg shadow-gray-200/5 transition-all"
                      />
                    )}
                    {field.options && <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200 rotate-90" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Protocol */}
            <div className="bg-primary-900/90 backdrop-blur-2xl rounded-[48px] p-12 text-white shadow-2xl shadow-primary-900/20 group/summary relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
               <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-10 opacity-60">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[4px]">Ecosystem Summary</span>
                 </div>
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      { label: 'Temporal Year', value: `${form.academicYear}, T${form.currentTerm}` },
                      { label: 'Scholastic Framework', value: selectedCurriculum?.name },
                      { label: 'Active Matrices', value: `${form.classes.length} Levels` },
                      { label: 'Intellectual Nodes', value: `${form.subjects.length} Hubs` },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="text-[9px] font-black opacity-40 uppercase tracking-[2px]">{item.label}</div>
                        <div className="text-sm font-black tracking-tight">{item.value}</div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* Global Navigation Hub */}
        <div className="flex justify-between mt-20 pt-10 border-t border-gray-100 relative z-10">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="h-16 px-12 bg-gray-50/50 text-gray-400 rounded-[28px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-white hover:text-gray-900 transition-all border border-transparent hover:border-gray-100 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-6 h-6" />
            Previous Node
          </button>
          {currentStep < 5 ? (
            <button
              onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
              className="h-16 px-12 bg-primary-800 text-white rounded-[28px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95"
            >
              Progress Hub
              <ChevronRight className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-16 px-12 bg-emerald-600 text-white rounded-[28px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-emerald-500/30 active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Check className="w-6 h-6" />
              )}
              {saving ? 'Saving...' : 'Commit Synthesis'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
