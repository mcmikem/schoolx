// Demo data seeder for OmutoSMS
// Run this to populate the database with test data

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey || '')

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_ACADEMIC_YEAR = '2025'

async function seedDemoData() {
  console.log('🌱 Seeding demo data...')

  // 1. Create demo school
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .upsert({
      id: DEMO_SCHOOL_ID,
      name: "St. Mary's Primary School",
      school_code: 'STMS001',
      district: 'Kampala',
      school_type: 'primary',
      ownership: 'private',
      phone: '0700000000',
      subscription_plan: 'premium',
      subscription_status: 'active',
    }, { onConflict: 'id' })
    .select()
    .single()

  if (schoolError) {
    console.error('School error:', schoolError)
  }
  console.log('✓ School created')

  // 2. Create classes
  const classes = [
    { id: 'c001', name: 'P.1', level: 1, school_id: DEMO_SCHOOL_ID },
    { id: 'c002', name: 'P.2', level: 2, school_id: DEMO_SCHOOL_ID },
    { id: 'c003', name: 'P.3', level: 3, school_id: DEMO_SCHOOL_ID },
    { id: 'c004', name: 'P.4', level: 4, school_id: DEMO_SCHOOL_ID },
    { id: 'c005', name: 'P.5', level: 5, school_id: DEMO_SCHOOL_ID },
    { id: 'c006', name: 'P.6', level: 6, school_id: DEMO_SCHOOL_ID },
    { id: 'c007', name: 'P.7', level: 7, school_id: DEMO_SCHOOL_ID },
  ]

  await supabase.from('classes').upsert(classes, { onConflict: 'id' })
  console.log('✓ Classes created')

  // 3. Create subjects
  const subjects = [
    { id: 's001', name: 'Mathematics', code: 'MATH', school_id: DEMO_SCHOOL_ID },
    { id: 's002', name: 'English', code: 'ENG', school_id: DEMO_SCHOOL_ID },
    { id: 's003', name: 'Science', code: 'SCI', school_id: DEMO_SCHOOL_ID },
    { id: 's004', name: 'Social Studies', code: 'SST', school_id: DEMO_SCHOOL_ID },
    { id: 's005', name: 'Religious Education', code: 'RE', school_id: DEMO_SCHOOL_ID },
    { id: 's006', name: 'Physical Education', code: 'PE', school_id: DEMO_SCHOOL_ID },
  ]

  await supabase.from('subjects').upsert(subjects, { onConflict: 'id' })
  console.log('✓ Subjects created')

  // 4. Create demo users (staff)
  const staffUsers = [
    { id: 'u001', auth_id: 'demo-user-001', school_id: DEMO_SCHOOL_ID, full_name: 'John Headmaster', phone: '0700000001', role: 'headmaster', is_active: true },
    { id: 'u002', auth_id: 'demo-user-002', school_id: DEMO_SCHOOL_ID, full_name: 'Mary Teacher', phone: '0700000002', role: 'teacher', is_active: true },
    { id: 'u003', auth_id: 'demo-user-003', school_id: DEMO_SCHOOL_ID, full_name: 'James Bursar', phone: '0700000003', role: 'bursar', is_active: true },
    { id: 'u004', auth_id: 'demo-user-004', school_id: DEMO_SCHOOL_ID, full_name: 'Sarah Dean', phone: '0700000004', role: 'dean_of_studies', is_active: true },
  ]

  await supabase.from('users').upsert(staffUsers, { onConflict: 'id' })
  console.log('✓ Staff users created')

  // 5. Create academic year
  const { data: academicYear } = await supabase
    .from('academic_years')
    .upsert({
      school_id: DEMO_SCHOOL_ID,
      year: DEMO_ACADEMIC_YEAR,
      is_current: true,
    }, { onConflict: 'school_id,year' })
    .select()
    .single()

  // 6. Create terms
  const terms = [
    { school_id: DEMO_SCHOOL_ID, academic_year_id: academicYear?.id || 'ay001', term_number: 1, start_date: '2025-02-01', end_date: '2025-04-30', is_current: true },
    { school_id: DEMO_SCHOOL_ID, academic_year_id: academicYear?.id || 'ay001', term_number: 2, start_date: '2025-06-01', end_date: '2025-08-31', is_current: false },
    { school_id: DEMO_SCHOOL_ID, academic_year_id: academicYear?.id || 'ay001', term_number: 3, start_date: '2025-10-01', end_date: '2025-12-15', is_current: false },
  ]

  await supabase.from('terms').upsert(terms, { onConflict: 'school_id,term_number' })
  console.log('✓ Terms created')

  // 7. Create fee structure
  const feeStructure = [
    { school_id: DEMO_SCHOOL_ID, name: 'Tuition', amount: 150000, academic_year: DEMO_ACADEMIC_YEAR, term: 1 },
    { school_id: DEMO_SCHOOL_ID, name: 'Development Fund', amount: 50000, academic_year: DEMO_ACADEMIC_YEAR, term: 1 },
    { school_id: DEMO_SCHOOL_ID, name: 'PTA', amount: 30000, academic_year: DEMO_ACADEMIC_YEAR, term: 1 },
    { school_id: DEMO_SCHOOL_ID, name: 'Uniform', amount: 80000, academic_year: DEMO_ACADEMIC_YEAR, term: 1 },
    { school_id: DEMO_SCHOOL_ID, name: 'Books', amount: 45000, academic_year: DEMO_ACADEMIC_YEAR, term: 1 },
  ]

  await supabase.from('fee_structure').insert(feeStructure)
  console.log('✓ Fee structure created')

  // 8. Create demo students (20 students per class)
  const studentNames = [
    'Alice Nakato', 'Bob Okello', 'Carol Atieno', 'David Mukama', 'Eve Nambi',
    'Frank Tumusiime', 'Grace Akello', 'Henry Wanjala', 'Irene Mbabazi', 'James Ochieng',
    'Janet Namusoke', 'Kevin Laker', 'Lilian Achola', 'Martin Ssentamu', 'Nancy Nsubuga',
    'Peter Okwir', 'Queen Katusiime', 'Robert Ouma', 'Sarah Nandutu', 'Thomas Mutesasira',
  ]

  const students = []
  let studentNum = 1000

  for (const cls of classes.slice(0, 3)) {
    for (let i = 0; i < 20; i++) {
      students.push({
        school_id: DEMO_SCHOOL_ID,
        class_id: cls.id,
        first_name: studentNames[i].split(' ')[0],
        last_name: studentNames[i].split(' ')[1],
        gender: i % 2 === 0 ? 'M' : 'F',
        date_of_birth: `20${14 + (i % 6)}-0${1 + (i % 9)}-15`,
        student_number: `STU${studentNum++}`,
        status: 'active',
        parent_phone: `070${String(1000000 + studentNum).slice(-7)}`,
      })
    }
  }

  await supabase.from('students').insert(students)
  console.log('✓ Students created')

  // 9. Create some attendance records
  const today = new Date().toISOString().split('T')[0]
  const { data: allStudents } = await supabase.from('students').select('id').eq('school_id', DEMO_SCHOOL_ID).limit(30)

  if (allStudents && allStudents.length > 0) {
    const attendance = allStudents.slice(0, 30).map((s, i) => ({
      student_id: s.id,
      date: today,
      status: i % 5 === 0 ? 'absent' : 'present',
      recorded_by: 'u001',
    }))
    await supabase.from('attendance').insert(attendance)
    console.log('✓ Attendance created')
  }

  // 10. Create some grades
  if (allStudents && allStudents.length > 0) {
    const grades = []
    const subjectsList = await supabase.from('subjects').select('id').eq('school_id', DEMO_SCHOOL_ID).limit(3)
    
    if (subjectsList.data) {
      for (const student of allStudents.slice(0, 20)) {
        for (const subject of subjectsList.data) {
          grades.push({
            student_id: student.id,
            subject_id: subject.id,
            school_id: DEMO_SCHOOL_ID,
            assessment_type: 'exam',
            score: Math.floor(Math.random() * 40) + 60,
            term: 1,
            academic_year: DEMO_ACADEMIC_YEAR,
            recorded_by: 'u002',
          })
        }
      }
      await supabase.from('grades').insert(grades)
      console.log('✓ Grades created')
    }
  }

  console.log('\n✅ Demo data seeded successfully!')
  console.log('\n📋 Demo Login Credentials:')
  console.log('   Phone: 0700000001 | Password: demo1234 | Role: Headmaster')
  console.log('   Phone: 0700000002 | Password: demo1234 | Role: Teacher')
  console.log('   Phone: 0700000003 | Password: demo1234 | Role: Bursar')
  console.log('   Phone: 0700000004 | Password: demo1234 | Role: Dean of Studies')
}

seedDemoData().catch(console.error)
