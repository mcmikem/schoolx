
import { supabase } from './supabase';

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

const FIRST_NAMES = [
  'Sarah', 'Grace', 'Betty', 'Esther', 'Florence', 'Mary', 'Agnes', 'Jane', 'Ruth', 'Mercy',
  'John', 'Joseph', 'David', 'Francis', 'Patrick', 'Paul', 'Samuel', 'Daniel', 'Robert', 'Charles'
];

const LAST_NAMES = [
  'Nakato', 'Namugala', 'Auma', 'Nalwoga', 'Akello', 'Nakamya', 'Nabirye', 'Nansubuga', 'Nalwadda', 'Nabukeera',
  'Omongoin', 'Kato', 'Wasswa', 'Okelo', 'Mukasa', 'Ssenyonjo', 'Lule', 'Kaggwa', 'Semanda', 'Lumu'
];

const SUBJECTS = [
  { name: 'English Language', code: 'ENG' },
  { name: 'Mathematics', code: 'MATH' },
  { name: 'Integrated Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SST' }
];

export async function seedDemoData() {
  console.log('Starting comprehensive seeding for Demo School...');

  try {
    // 1. Get classes
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', DEMO_SCHOOL_ID);

    if (!classes || classes.length === 0) {
      throw new Error('No classes found for demo school. Run basic setup first.');
    }

    // 2. Generate Students
    console.log('Seeding students...');
    const students = [];
    for (let i = 0; i < 50; i++) {
        const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const gender = Math.random() > 0.5 ? 'M' : 'F';
        const classObj = classes[Math.floor(Math.random() * classes.length)];
        
        students.push({
            school_id: DEMO_SCHOOL_ID,
            student_number: `STU${String(i + 1).padStart(4, '0')}`,
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            date_of_birth: new Date(2010 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), 1).toISOString(),
            parent_name: `${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]} ${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]}`,
            parent_phone: '07' + Math.floor(10000000 + Math.random() * 90000000),
            class_id: classObj.id,
            status: 'active'
        });
    }

    const { data: seededStudents, error: studentError } = await supabase
        .from('students')
        .upsert(students, { onConflict: 'student_number,school_id' })
        .select();

    if (studentError) throw studentError;
    console.log(`Seeded ${seededStudents.length} students.`);

    // 3. Get a fee ID for payments
    const { data: feeStructure } = await supabase
        .from('fee_structure')
        .select('id')
        .eq('school_id', DEMO_SCHOOL_ID)
        .limit(1);
    
    const feeId = feeStructure?.[0]?.id;

    // 4. Seed Attendance (Last 30 days)
    console.log('Seeding attendance...');
    const attendanceRecords = [];
    const today = new Date();
    
    // Pick 3 students to be "at risk" (absent for last 15 days)
    const atRiskIndices = [0, 5, 12];
    
    for (let day = 0; day < 30; day++) {
        const date = new Date(today);
        date.setDate(today.getDate() - day);
        const dateStr = date.toISOString().split('T')[0];
        
        // Skip Sundays
        if (date.getDay() === 0) continue;

        seededStudents.forEach((student, index) => {
            let status = 'present';
            
            // At risk students - absent for many days
            if (atRiskIndices.includes(index) && day < 20) {
                status = 'absent';
            } else if (Math.random() < 0.05) {
                // Random 5% absence
                status = 'absent';
            }

            attendanceRecords.push({
                student_id: student.id,
                class_id: student.class_id,
                date: dateStr,
                status: status
            });
        });
    }

    // Chunk attendance inserts (supabase limits)
    for (let i = 0; i < attendanceRecords.length; i += 500) {
        const chunk = attendanceRecords.slice(i, i + 500);
        await supabase.from('attendance').upsert(chunk, { onConflict: 'student_id,date' });
    }
    console.log('Seeded attendance history.');

    // 5. Seed Payments
    console.log('Seeding payments...');
    const payments = [];
    seededStudents.forEach((student, index) => {
        // 80% of students have paid something
        if (Math.random() < 0.8 && feeId) {
            const amount = 50000 + Math.floor(Math.random() * 10) * 10000;
            const ways = ['cash', 'mobile_money', 'bank'];
            
            payments.push({
                student_id: student.id,
                fee_id: feeId,
                amount_paid: amount,
                payment_method: ways[Math.floor(Math.random() * ways.length)],
                payment_date: new Date().toISOString().split('T')[0],
                payment_reference: `REF${Math.floor(Math.random() * 1000000)}`,
                notes: 'Partial payment for Term 1'
            });
        }
    });

    if (payments.length > 0) {
        await supabase.from('fee_payments').insert(payments);
    }
    console.log('Seeded fee payments.');

    return { success: true, count: seededStudents.length };
  } catch (err: any) {
    console.error('Seeding error:', err.message);
    return { success: false, error: err.message };
  }
}
