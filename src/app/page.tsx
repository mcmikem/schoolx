'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import SchoolXLogo from '@/components/SchoolXLogo'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

/* ─── Animated counter hook ─── */
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(!startOnView)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!startOnView) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStarted(true); observer.disconnect() }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [startOnView])

  useEffect(() => {
    if (!started) return
    let frame: number
    const startTime = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [started, end, duration])

  return { count, ref }
}

/* ─── Trust badges (above the fold) ─── */
const trustBadges = [
  { icon: 'lock', label: 'TLS Encrypted' },
  { icon: 'shield', label: 'Role-Based Access' },
  { icon: 'verified_user', label: 'Uganda Data Protection Compliant' },
  { icon: 'backup', label: 'Auto-Backed Up' },
  { icon: 'support_agent', label: 'Local WhatsApp Support' },
  { icon: 'cloud_done', label: 'PostgreSQL / Supabase' },
]

/* ─── Hero stats ─── */
const heroStats = [
  { label: 'Built for', value: 'Ugandan schools' },
  { label: 'Billing', value: 'MTN, Airtel, PayPal' },
  { label: 'Coverage', value: 'Primary, secondary, combined' },
]

const roleStrip = ['Head teacher', 'Dean of studies', 'Bursar', 'Class teacher', 'Secretary', 'Dorm master']

const proofPoints = [
  'Attendance before assembly',
  'Fees, balances, and mobile money records',
  'UNEB-ready grading and report cards',
  'Parent SMS, bulk alerts, and templates',
]

const stories = [
  {
    eyebrow: 'Academic control',
    title: 'From marks entry to printable report cards without spreadsheet chaos.',
    body:
      'Teachers enter assessments once, SchoolX calculates the grade, and admin teams can print clean report cards or prepare UNEB-facing exports from the same workflow.',
    bullets: ['CA, BOT, Mid Term, Saturday Test, and EOT workflows', 'Class comparison, grading rules, marks completion, and comments', 'Printable reports for parents, directors, and board meetings'],
  },
  {
    eyebrow: 'Operations and finance',
    title: 'Know who paid, who is absent, and what needs action before the first lesson starts.',
    body:
      'The dashboard brings together attendance, fee balances, budgeting, inventory, dorm records, staff activity, and health logs so the bursar and head teacher are not hunting through notebooks.',
    bullets: ['Fee collection history, invoices, receipts, and payment plans', 'Cashbook, petty cash, payroll, budget, and approvals', 'Student lookup, transfers, behavior, visitors, and leave tracking'],
  },
  {
    eyebrow: 'Parent communication',
    title: 'Send the right message to the right parents at the right time.',
    body:
      'Use bulk SMS, saved templates, and automated reminders for fee balances, report availability, events, and attendance concerns. The result is fewer missed messages and faster follow-up.',
    bullets: ['Individual, class, and all-parent messaging', 'Reusable SMS templates and auto-SMS triggers', 'Parent portal and offline-first support on higher plans'],
  },
]

const modules = [
  'Students and parent records',
  'Attendance and period attendance',
  'Exams, grading config, comments, report cards',
  'Fees, invoicing, payment plans, payroll, budgets',
  'UNEB registration, UNEB analysis, and MoES exports',
  'Bulk SMS, auto SMS triggers, notices, and parent portal',
]

const plans = [
  {
    name: 'Basic',
    price: 'UGX 100,000',
    cadence: 'per term',
    description: 'For schools getting off paper and into one shared system.',
    features: ['Up to 300 students', 'PDF report cards', 'UNEB export', 'Excel data export'],
  },
  {
    name: 'Premium',
    price: 'UGX 200,000',
    cadence: 'per term',
    description: 'For schools that need stronger communication and deeper operational visibility.',
    features: ['Up to 1,000 students', 'Auto SMS reports', 'Parent portal', 'Global search and Luganda support'],
    featured: true,
  },
  {
    name: 'Max',
    price: 'UGX 370,000',
    cadence: 'per term',
    description: 'For multi-campus or high-volume schools that want full SchoolX coverage.',
    features: ['Unlimited students', 'Offline mode', 'Custom reports', 'Priority support and API access'],
  },
]

const securityFeatures = [
  { icon: 'lock', title: 'Encrypted Data', desc: 'All student records, grades, and financial data are encrypted in transit (TLS 1.3) and at rest (AES-256).' },
  { icon: 'shield', title: 'Role-Based Access', desc: 'Head teachers, bursars, teachers, and parents each see only what they need. No one can access data outside their permission level.' },
  { icon: 'cloud_done', title: 'Secure Cloud Hosting', desc: 'Hosted on Supabase with PostgreSQL — a battle-tested database trusted by organisations worldwide.' },
  { icon: 'backup', title: 'Automatic Backups', desc: 'Your school data is backed up continuously. Nothing is lost if a device fails or someone makes a mistake.' },
  { icon: 'privacy_tip', title: 'Data Privacy', desc: 'Student data belongs to the school. We never sell, share, or use your data for advertising. Period.' },
  { icon: 'verified_user', title: 'Compliance Ready', desc: 'Built to support Uganda\'s Data Protection and Privacy Act requirements for handling personal information.' },
]

const storyMoments = [
  'Registers getting lost between offices and classrooms.',
  'Marks being calculated late into the night before report deadlines.',
  'Report cards taking weeks because the workflow lives in separate books and spreadsheets.',
  'Headteachers making serious decisions without a clear view of attendance, fees, or performance.',
]

const storyPrinciples = [
  'Simple enough for any teacher to use',
  'Reliable even when the internet is not',
  'Built around attendance, marks, fees, and communication in one flow',
  'Made to save time instead of creating more admin work',
]

const osxLinks = [
  'When student leaders track attendance or activities through OSX, SchoolX makes that data visible and usable.',
  'When schools are working to improve academic performance, SchoolX helps identify where students are struggling early.',
  'When leadership needs to act, SchoolX replaces guesswork with a clean, current picture of the school.',
]

/* ─── Interactive Desktop Mockup ─── */
const desktopTabs = ['Dashboard', 'Students', 'Attendance', 'Exams', 'Finance', 'Messages']

function DesktopMockup() {
  const [activeTab, setActiveTab] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const feeCounter = useCounter(18.4, 2500)
  const staffCounter = useCounter(43, 1800)
  const lowAttCounter = useCounter(3, 1200)

  const barData = [
    { name: 'S.1', value: 78, color: 'bg-[#17325F]' },
    { name: 'S.2', value: 84, color: 'bg-[#2E9448]' },
    { name: 'S.3', value: 71, color: 'bg-[#B86B0C]' },
    { name: 'S.4', value: 88, color: 'bg-[#17325F]' },
  ]

  const actionItems = [
    { title: 'Approve expense request', note: 'Lab practical supplies', icon: 'payments' },
    { title: 'Review leave request', note: '2 staff awaiting action', icon: 'event_busy' },
    { title: 'Send fee reminder', note: 'S.2 Blue parents with balances', icon: 'sms' },
    { title: 'Print report cards', note: 'S.4 candidate review', icon: 'description' },
  ]

  return (
    <div className={`mockup-shell mockup-desktop relative rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_40px_90px_rgba(15,23,42,0.14)] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {/* Browser chrome */}
      <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            schoolx.app/dashboard
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="border-b border-slate-200 bg-[#0e2345] p-5 text-white lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white">
                <MaterialIcon icon="school" className="text-[20px]" />
              </div>
              <div>
                <p className="text-sm font-semibold">SchoolX</p>
                <p className="text-xs text-white/65">Head teacher workspace</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {desktopTabs.map((item, index) => (
                <button
                  key={item}
                  onClick={() => setActiveTab(index)}
                  className={`w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-200 cursor-pointer ${
                    index === activeTab
                      ? 'bg-white text-[#0e2345] shadow-sm'
                      : 'bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-4 p-4 sm:p-5">
            {/* Stat cards with animated counters */}
            <div className="grid gap-3 md:grid-cols-3">
              <div ref={feeCounter.ref} className="story-card rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow cursor-default">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Fees this term</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  UGX {feeCounter.count}<span className="text-base">M</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">cash, bank, and mobile money</p>
              </div>
              <div ref={staffCounter.ref} className="story-card rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow cursor-default">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Staff on duty</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{staffCounter.count}</p>
                <p className="mt-1 text-sm text-slate-500">present and late captured</p>
              </div>
              <div ref={lowAttCounter.ref} className="story-card rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow cursor-default">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Low attendance</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{lowAttCounter.count}</p>
                <p className="mt-1 text-sm text-slate-500">follow-up before assembly</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              {/* Performance bars with animation */}
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Candidate and class performance</p>
                    <p className="text-xs text-slate-500">Term II academic snapshot</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    UNEB scale
                  </div>
                </div>
                <div className="space-y-4">
                  {barData.map((bar, i) => (
                    <div key={bar.name}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{bar.name}</span>
                        <span className="text-slate-500">{bar.value}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full ${bar.color} transition-all duration-1000 ease-out`}
                          style={{
                            width: mounted ? `${bar.value}%` : '0%',
                            transitionDelay: `${i * 200 + 500}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action queue */}
              <div className="rounded-[28px] bg-[#eef5ff] p-5 ring-1 ring-[#d7e4fb]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Action queue</p>
                    <p className="text-xs text-slate-500">This morning</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#17325F]">
                    6 urgent
                  </div>
                </div>
                <div className="space-y-3">
                  {actionItems.map((item, i) => (
                    <div
                      key={item.title}
                      className={`story-card flex items-start gap-3 rounded-[22px] bg-white p-3.5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${
                        mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                      }`}
                      style={{ transitionDelay: `${i * 100 + 800}ms` }}
                    >
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F] flex-shrink-0">
                        <MaterialIcon icon={item.icon} className="text-[20px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 truncate">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Interactive Phone Mockup with typing SMS ─── */
const smsMessages = [
  {
    from: 'SchoolX',
    text: 'Dear parent, your child was absent today and current Term II fee balance is UGX 185,000. Please contact the office if you need a statement.',
    type: 'incoming',
  },
  {
    from: 'System',
    text: 'Bulk SMS delivered — S.4 candidates, 8:14 AM. 426 recipients, 147/160 characters.',
    type: 'outgoing',
  },
]

function PhoneMockup() {
  const [activeMsg, setActiveMsg] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const msg = smsMessages[activeMsg].text
    setTypedText('')
    let i = 0
    const interval = setInterval(() => {
      if (i <= msg.length) {
        setTypedText(msg.slice(0, i))
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => setActiveMsg((prev) => (prev + 1) % smsMessages.length), 3000)
      }
    }, 25)
    return () => clearInterval(interval)
  }, [activeMsg])

  return (
    <div className={`mockup-shell mockup-phone mx-auto w-[280px] rounded-[36px] border border-slate-200 bg-[#0b1220] p-2.5 shadow-[0_35px_80px_rgba(15,23,42,0.2)] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="overflow-hidden rounded-[30px] bg-white">
        {/* Phone header */}
        <div className="flex items-center justify-between bg-[#17325F] px-4 pb-3 pt-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">SchoolX parent portal</p>
            <p className="text-sm font-semibold">Fee &amp; attendance update</p>
          </div>
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]">SMS</div>
        </div>

        {/* Messages */}
        <div className="space-y-3 bg-[#f6f9fc] p-4 min-h-[280px]">
          <div className="rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900 mb-2">
              {smsMessages[activeMsg].from}
              <span className="ml-2 text-[10px] text-slate-400 font-normal">
                {activeMsg === 0 ? 'Incoming' : 'Outgoing'}
              </span>
            </p>
            <p className="text-sm leading-6 text-slate-600 min-h-[60px]">
              {typedText}
              <span className="inline-block w-[2px] h-[16px] bg-[#17325F] ml-0.5 animate-pulse align-middle" />
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-[#17325F]/30 transition-all">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Recipients</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">426</p>
            </div>
            <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-[#17325F]/30 transition-all">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Characters</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">147/160</p>
            </div>
          </div>

          {/* Message indicators */}
          <div className="flex justify-center gap-2 pt-1">
            {smsMessages.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveMsg(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeMsg ? 'w-6 bg-[#17325F]' : 'w-2 bg-slate-300'
                }`}
                aria-label={`View message ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Scroll animation wrapper ─── */
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/* ─── HOME PAGE ─── */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(23,50,95,0.13),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(46,148,72,0.10),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_#f4f7fb_72%)]" />
        <div className="absolute left-[8%] top-24 h-40 w-40 rounded-full bg-[#d6e4ff] blur-3xl" />
        <div className="absolute right-[10%] top-40 h-48 w-48 rounded-full bg-[#dff3e5] blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pb-24">
          {/* Nav */}
          <nav className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
            <SchoolXLogo size="md" />
            <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <a href="#features" className="transition hover:text-slate-950">Features</a>
              <a href="#story" className="transition hover:text-slate-950">Story</a>
              <a href="#security" className="transition hover:text-slate-950">Security</a>
              <a href="#pricing" className="transition hover:text-slate-950">Pricing</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="btn btn-secondary btn-sm">Sign in</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Start free trial</Link>
            </div>
          </nav>

          {/* Role strip */}
          <div className="mt-5 overflow-hidden rounded-full border border-[#d9e4f4] bg-white/70 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-xs">
              {roleStrip.map((role) => (
                <span key={role} className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2E9448]" />
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* Hero grid */}
          <div className="grid gap-14 pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4fb] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#17325F] shadow-sm">
                <MaterialIcon icon="bolt" className="text-[18px]" />
                Built from experience on the ground in schools
              </div>
              <h1 className="mt-6 font-['Sora'] text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">
                Run your entire school
                <br />
                from one <span className="text-[#2E9448]">dashboard</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                Attendance, grades, fees, and parent SMS — all in one system built for Ugandan schools. Stop juggling notebooks and spreadsheets.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                  Start 30-day free trial
                </Link>
                <Link href="/login" className="btn btn-secondary px-7 py-4 text-base">
                  Open dashboard
                </Link>
              </div>

              {/* Trust badges — ABOVE THE FOLD */}
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {trustBadges.map((badge) => (
                  <div key={badge.label} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <MaterialIcon icon={badge.icon} className="text-[14px] text-[#2E9448]" />
                    {badge.label}
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="story-card rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockups */}
            <div className="relative hero-stage">
              <div className="floating-note absolute right-0 top-0 z-20 hidden w-52 rounded-[28px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur xl:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Today at a glance</p>
                <div className="mt-4 space-y-3">
                  {[
                    ['Attendance filed', '12 classes by 8:05 AM'],
                    ['Fee follow-up', '426 parents queued'],
                    ['Candidate review', 'S.4 report cards ready'],
                  ].map(([label, note]) => (
                    <div key={label} className="rounded-[20px] bg-slate-50 p-3 ring-1 ring-slate-200">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="phone-stage relative z-10 mx-auto mb-6 max-w-[320px] lg:absolute lg:-left-8 lg:top-10 lg:mb-0 xl:block">
                <PhoneMockup />
              </div>
              <div className="desktop-stage relative z-0 lg:ml-16">
                <DesktopMockup />
              </div>
              <div className="floating-callout absolute bottom-5 left-3 z-20 hidden rounded-[24px] border border-[#d7e4fb] bg-white/92 px-4 py-3 shadow-[0_22px_55px_rgba(15,23,42,0.12)] backdrop-blur md:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#17325F]">From registers to reports</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">One flow, one view, one calmer morning.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <FadeIn>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">What schools actually need</p>
              <h2 className="mt-4 max-w-md font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Not generic software. Real workflows for head teachers, bursars, deans of studies, and class teachers.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {proofPoints.map((item, i) => (
                <FadeIn key={item} delay={i * 100}>
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                      <MaterialIcon icon="check_circle" className="text-[22px]" />
                    </div>
                    <p className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{item}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="bg-white py-18 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            {stories.map((story, index) => (
              <FadeIn key={story.title} delay={index * 150}>
                <div
                  className="grid gap-6 rounded-[36px] border border-slate-200 p-6 shadow-sm lg:grid-cols-[0.82fr_1.18fr] lg:p-8 hover:shadow-md transition-shadow"
                >
                  <div className={`rounded-[30px] p-6 ${index === 1 ? 'bg-[#17325F] text-white' : 'bg-[#f5f8fc] text-slate-900'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${index === 1 ? 'text-white/65' : 'text-[#17325F]'}`}>
                      {story.eyebrow}
                    </p>
                    <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em]">
                      {story.title}
                    </h3>
                    <p className={`mt-4 text-base leading-7 ${index === 1 ? 'text-white/78' : 'text-slate-600'}`}>
                      {story.body}
                    </p>
                  </div>
                  <div className="grid gap-3 self-center">
                    {story.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-3 rounded-[22px] bg-slate-50 px-4 py-4 ring-1 ring-slate-200 hover:ring-[#17325F]/20 transition-colors">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#17325F] shadow-sm ring-1 ring-slate-200">
                          <MaterialIcon icon="arrow_outward" className="text-[18px]" />
                        </div>
                        <p className="text-sm font-medium leading-6 text-slate-700">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STORY ===== */}
      <section id="story" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <FadeIn>
            <div className="rounded-[34px] bg-[#0f1f3d] p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] lg:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">The story behind SchoolX</p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                It did not start as an idea. It started with what schools kept carrying every day.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/76">
                At Omuto Foundation, the work has been close enough to schools to see the real picture, not an abstract one. The issue was never that people were not trying. The issue was that the system around them kept slowing the work down.
              </p>
              <div className="mt-8 grid gap-3">
                {storyMoments.map((item) => (
                  <div key={item} className="story-card rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-sm leading-6 text-white/82">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <div className="grid gap-5">
            <FadeIn>
              <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">What became obvious</p>
                <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950">
                  Schools do not need more pressure. They need better tools.
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  SchoolX was built to match the real flow of school life: attendance, marks, fees, communication, and decision-making in one place. Not another generic system. A calmer operating layer for schools that are already working hard.
                </p>
              </div>
            </FadeIn>

            <div className="grid gap-4 sm:grid-cols-2">
              {storyPrinciples.map((item, i) => (
                <FadeIn key={item} delay={i * 100}>
                  <div className="story-card rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-sm h-full">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                      <MaterialIcon icon="bolt" className="text-[20px]" />
                    </div>
                    <p className="mt-4 text-base font-semibold leading-7 text-slate-900">{item}</p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={200}>
              <div className="rounded-[34px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-sm lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">What changes when the system runs well</p>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Teachers get more time to focus on students. Leaders can see what is working and what is not. Parents stay informed. Students are noticed early instead of slipping through the cracks. The X in SchoolX stands for Xperience, because this system comes from what has been seen, learned, and asked for in the field.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ===== MODULES ===== */}
      <section className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <FadeIn>
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">Inside the platform</p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Every major school unit connected in one system.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                From academics to administration, SchoolX is designed to reduce duplicate work. Enter data once, then reuse it across report cards, parent communication, financial follow-up, UNEB prep, and board reporting.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {modules.map((module, i) => (
                <FadeIn key={module} delay={i * 80}>
                  <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                        <MaterialIcon icon="grid_view" className="text-[20px]" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{module}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ===== OSX ===== */}
      <section id="osx" className="bg-white py-18 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">SchoolX and OSX</p>
                <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  SchoolX is the system layer inside the wider Omuto School Xperience.
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                  OSX is the broader transformation model. SchoolX is the layer that helps that transformation hold, because progress is hard to sustain when the underlying school systems stay scattered and manual.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[32px] border border-slate-200 bg-[#f7f9fc] p-6 shadow-sm lg:p-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">OSX</p>
                      <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Drives transformation</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">Leadership, student engagement, accountability, and a culture where schools do not just operate, but perform.</p>
                    </div>
                    <div className="rounded-[24px] bg-[#17325F] p-5 text-white hover:shadow-lg transition-shadow">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">SchoolX</p>
                      <p className="mt-3 text-xl font-semibold tracking-tight">Sustains it daily</p>
                      <p className="mt-3 text-sm leading-6 text-white/76">Attendance, academics, fees, communication, and operational visibility working in one reliable school workflow.</p>
                    </div>
                  </div>
                </div>

                {osxLinks.map((item, i) => (
                  <FadeIn key={item} delay={i * 100}>
                    <div className="story-card flex items-start gap-3 rounded-[26px] border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448] flex-shrink-0">
                        <MaterialIcon icon="north_east" className="text-[18px]" />
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{item}</p>
                    </div>
                  </FadeIn>
                ))}

                <div className="rounded-[30px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">The result</p>
                  <p className="mt-4 text-base leading-7 text-slate-700">
                    Together, OSX drives the transformation and SchoolX makes it visible, usable, and measurable. That is the complete school experience: organised systems, informed decisions, earlier support, and progress that leaders can actually track.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== SECURITY & DATA PROTECTION ===== */}
      <section id="security" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">Security &amp; Data Protection</p>
            <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Your school data is safe with us.
            </h2>
            <p className="mt-5 max-w-2xl mx-auto text-lg leading-8 text-slate-600">
              We take data security seriously because student records, grades, and financial information are sensitive. Here is how we protect your school.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {securityFeatures.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 100}>
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                  <MaterialIcon icon={feature.icon} className="text-[24px]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="bg-[#0d1930] py-18 text-white lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">Pricing</p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                Clear term pricing for schools that want to move fast.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/72">
                Start with a 30-day free trial. Upgrade when your team is ready.
              </p>
            </div>
          </FadeIn>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 150}>
                <div
                  className={`rounded-[32px] border p-6 h-full flex flex-col ${
                    plan.featured
                      ? 'border-white/20 bg-white text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.28)] scale-[1.02]'
                      : 'border-white/12 bg-white/6 backdrop-blur'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-lg font-semibold ${plan.featured ? 'text-slate-950' : 'text-white'}`}>{plan.name}</p>
                    {plan.featured && (
                      <span className="rounded-full bg-[#17325F] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                        Most chosen
                      </span>
                    )}
                  </div>
                  <p className={`mt-4 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] ${plan.featured ? 'text-slate-950' : 'text-white'}`}>
                    {plan.price}
                  </p>
                  <p className={`mt-1 text-sm ${plan.featured ? 'text-slate-500' : 'text-white/60'}`}>{plan.cadence}</p>
                  <p className={`mt-5 text-sm leading-6 ${plan.featured ? 'text-slate-600' : 'text-white/72'}`}>{plan.description}</p>
                  <div className="mt-6 space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <MaterialIcon icon="check" className={`mt-0.5 text-[18px] ${plan.featured ? 'text-[#2E9448]' : 'text-white'}`} />
                        <p className={`text-sm ${plan.featured ? 'text-slate-700' : 'text-white/80'}`}>{feature}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/register"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      plan.featured ? 'bg-[#17325F] text-white hover:bg-[#1d3c6d]' : 'bg-white text-slate-950 hover:bg-slate-100'
                    }`}
                  >
                    Start with {plan.name}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">Ready to launch</p>
              <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950">
                Give your school one place to run the term.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Register your school, set up classes and subjects, and start using attendance, grading, fees, and parent communication in a single workspace.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                Start free trial
              </Link>
              <Link href="/login" className="btn btn-secondary px-7 py-4 text-base">
                Sign in
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <SchoolXLogo size="md" />
              <p className="mt-4 text-sm leading-6 text-slate-500">
                The school operating system built from real experience in Ugandan schools.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Product</h4>
              <ul className="mt-4 space-y-3">
                <li><a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition">Features</a></li>
                <li><a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900 transition">Pricing</a></li>
                <li><a href="#security" className="text-sm text-slate-600 hover:text-slate-900 transition">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Resources</h4>
              <ul className="mt-4 space-y-3">
                <li><a href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">Sign In</a></li>
                <li><a href="/register" className="text-sm text-slate-600 hover:text-slate-900 transition">Register School</a></li>
                <li><Link href="/parent" className="text-sm text-slate-600 hover:text-slate-900 transition">Parent Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Contact</h4>
              <ul className="mt-4 space-y-3">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <MaterialIcon icon="mail" className="text-[16px] text-[#17325F]" />
                  <a href="mailto:sms@omuto.org" className="hover:text-slate-900 transition">sms@omuto.org</a>
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <MaterialIcon icon="phone" className="text-[16px] text-[#17325F]" />
                  <a href="tel:0750028703" className="hover:text-slate-900 transition">0750 028 703</a>
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <MaterialIcon icon="chat" className="text-[16px] text-[#25D366]" />
                  <a href="https://wa.me/256750028703" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition">WhatsApp</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Omuto Foundation. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <MaterialIcon icon="lock" className="text-[14px]" />
              <span>Your data is encrypted and never shared.</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
