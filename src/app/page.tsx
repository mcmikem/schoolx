'use client'

import Link from 'next/link'
import SchoolXLogo from '@/components/SchoolXLogo'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

const stats = [
  { label: 'Built for', value: 'Ugandan schools' },
  { label: 'Billing', value: 'MTN, Airtel, PayPal' },
  { label: 'Coverage', value: 'Primary, secondary, combined' },
]

const proofPoints = [
  'Attendance before assembly',
  'Fees, balances, and mobile money records',
  'UNEB-ready grading and report cards',
  'Parent SMS, bulk alerts, and templates',
]

const roleStrip = ['Head teacher', 'Dean of studies', 'Bursar', 'Class teacher', 'Secretary', 'Dorm master']

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

function DesktopMockup() {
  return (
    <div className="mockup-shell mockup-desktop relative rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_40px_90px_rgba(15,23,42,0.14)]">
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
              {['Dashboard', 'Students', 'Attendance', 'Exams', 'Finance', 'Messages'].map((item, index) => (
                <div
                  key={item}
                  className={`rounded-2xl px-3 py-2.5 ${
                    index === 0 ? 'bg-white text-[#0e2345]' : 'bg-white/5 text-white/80'
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['Fees this term', 'UGX 18.4M', 'cash, bank, and mobile money'],
                ['Staff on duty', '43', 'present and late captured'],
                ['Low-attendance classes', '3', 'follow-up before assembly'],
              ].map(([label, value, note]) => (
                <div key={label} className="story-card rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
                  <p className="mt-1 text-sm text-slate-500">{note}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
                  {[
                    ['S.1', '78%', 'bg-[#17325F]'],
                    ['S.2', '84%', 'bg-[#2E9448]'],
                    ['S.3', '71%', 'bg-[#B86B0C]'],
                    ['S.4', '88%', 'bg-[#17325F]'],
                  ].map(([name, value, color]) => (
                    <div key={name}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{name}</span>
                        <span className="text-slate-500">{value}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div className={`h-2.5 rounded-full ${color}`} style={{ width: value }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
                  {[
                    ['Approve expense request', 'Lab practical supplies', 'payments'],
                    ['Review leave request', '2 staff awaiting action', 'event_busy'],
                    ['Send fee reminder', 'S.2 Blue parents with balances', 'sms'],
                    ['Print report cards', 'S.4 candidate review', 'description'],
                  ].map(([title, note, icon]) => (
                    <div key={title} className="story-card flex items-start gap-3 rounded-[22px] bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                        <MaterialIcon icon={icon} className="text-[20px]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="text-xs text-slate-500">{note}</p>
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

function PhoneMockup() {
  return (
    <div className="mockup-shell mockup-phone mx-auto w-[280px] rounded-[36px] border border-slate-200 bg-[#0b1220] p-2.5 shadow-[0_35px_80px_rgba(15,23,42,0.2)]">
      <div className="overflow-hidden rounded-[30px] bg-white">
        <div className="flex items-center justify-between bg-[#17325F] px-4 pb-3 pt-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">SchoolX parent portal</p>
            <p className="text-sm font-semibold">Fee and attendance update</p>
          </div>
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]">SMS</div>
        </div>
        <div className="space-y-3 bg-[#f6f9fc] p-4">
          <div className="rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">SchoolX parent SMS</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dear parent, your child was absent today and current Term II fee balance is UGX 185,000. Please contact the office if you need a statement.
            </p>
          </div>
          <div className="rounded-[24px] bg-[#17325F] p-3.5 text-white">
            <p className="text-sm font-medium">Bulk SMS delivered</p>
            <p className="mt-1 text-xs text-white/70">S.4 candidates, 8:14 AM</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Recipients</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">426</p>
            </div>
            <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Characters</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">147/160</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(23,50,95,0.13),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(46,148,72,0.10),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_#f4f7fb_72%)]" />
        <div className="absolute left-[8%] top-24 h-40 w-40 rounded-full bg-[#d6e4ff] blur-3xl" />
        <div className="absolute right-[10%] top-40 h-48 w-48 rounded-full bg-[#dff3e5] blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pb-24">
          <nav className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
            <SchoolXLogo size="md" />
            <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <a href="#features" className="nav-link transition hover:text-slate-950">Features</a>
              <a href="#story" className="nav-link transition hover:text-slate-950">Story</a>
              <a href="#osx" className="nav-link transition hover:text-slate-950">OSX</a>
              <a href="#pricing" className="nav-link transition hover:text-slate-950">Pricing</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Start free trial
              </Link>
            </div>
          </nav>

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

          <div className="grid gap-14 pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4fb] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#17325F] shadow-sm">
                <MaterialIcon icon="bolt" className="text-[18px]" />
                Built from xperience on the ground in schools
              </div>
              <h1 className="mt-6 font-['Sora'] text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">
                The school system
                <br />
                built from what
                <br />
                schools actually
                <br />
                go through.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                SchoolX came from the daily reality we kept seeing in schools: lost registers, late-night marks entry, delayed report cards, and leaders forced to decide without clear data. It brings attendance, academics, fees, communication, and operations into one steady system that fits how schools here already work.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                  Start 30-day free trial
                </Link>
                <Link href="/login" className="btn btn-secondary px-7 py-4 text-base">
                  Open dashboard
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {stats.map((item) => (
                  <div key={item.label} className="story-card rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

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

      <section id="features" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">What schools actually need</p>
            <h2 className="mt-4 max-w-md font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Not generic software. Real workflows for head teachers, bursars, deans of studies, and class teachers.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {proofPoints.map((item) => (
              <div key={item} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                  <MaterialIcon icon="check_circle" className="text-[22px]" />
                </div>
                <p className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white py-18 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            {stories.map((story, index) => (
              <div
                key={story.title}
                className="grid gap-6 rounded-[36px] border border-slate-200 p-6 shadow-sm lg:grid-cols-[0.82fr_1.18fr] lg:p-8"
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
                    <div key={bullet} className="flex items-start gap-3 rounded-[22px] bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#17325F] shadow-sm ring-1 ring-slate-200">
                        <MaterialIcon icon="arrow_outward" className="text-[18px]" />
                      </div>
                      <p className="text-sm font-medium leading-6 text-slate-700">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="story" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
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

          <div className="grid gap-5">
            <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">What became obvious</p>
              <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950">
                Schools do not need more pressure. They need better tools.
              </h3>
              <p className="mt-4 text-base leading-7 text-slate-600">
                SchoolX was built to match the real flow of school life: attendance, marks, fees, communication, and decision-making in one place. Not another generic system. A calmer operating layer for schools that are already working hard.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {storyPrinciples.map((item) => (
                <div key={item} className="story-card rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                    <MaterialIcon icon="bolt" className="text-[20px]" />
                  </div>
                  <p className="mt-4 text-base font-semibold leading-7 text-slate-900">{item}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[34px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-sm lg:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">What changes when the system runs well</p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Teachers get more time to focus on students. Leaders can see what is working and what is not. Parents stay informed. Students are noticed early instead of slipping through the cracks. The X in SchoolX stands for Xperience, because this system comes from what has been seen, learned, and asked for in the field.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
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
            {modules.map((module) => (
              <div key={module} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                    <MaterialIcon icon="grid_view" className="text-[20px]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{module}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="osx" className="bg-white py-18 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                  <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">OSX</p>
                    <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Drives transformation</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">Leadership, student engagement, accountability, and a culture where schools do not just operate, but perform.</p>
                  </div>
                  <div className="rounded-[24px] bg-[#17325F] p-5 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">SchoolX</p>
                    <p className="mt-3 text-xl font-semibold tracking-tight">Sustains it daily</p>
                    <p className="mt-3 text-sm leading-6 text-white/76">Attendance, academics, fees, communication, and operational visibility working in one reliable school workflow.</p>
                  </div>
                </div>
              </div>

              {osxLinks.map((item) => (
                <div key={item} className="story-card flex items-start gap-3 rounded-[26px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                    <MaterialIcon icon="north_east" className="text-[18px]" />
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}

              <div className="rounded-[30px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">The result</p>
                <p className="mt-4 text-base leading-7 text-slate-700">
                  Together, OSX drives the transformation and SchoolX makes it visible, usable, and measurable. That is the complete school experience: organised systems, informed decisions, earlier support, and progress that leaders can actually track.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#0d1930] py-18 text-white lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">Pricing</p>
            <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
              Clear term pricing for schools that want to move fast.
            </h2>
            <p className="mt-5 text-lg leading-8 text-white/72">
              Start with a 30-day free trial. Upgrade when your team is ready to bring academics, finance, communication, and reporting into one platform.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[32px] border p-6 ${
                  plan.featured
                    ? 'border-white/20 bg-white text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.28)]'
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
                <div className="mt-6 space-y-3">
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
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
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
      </section>
    </main>
  )
}
