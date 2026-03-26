// Luganda translations for key UI elements

export type Language = 'en' | 'lg'

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    students: 'Students',
    attendance: 'Attendance',
    grades: 'Grades',
    fees: 'Fees',
    reports: 'Reports',
    messages: 'Messages',
    timetable: 'Timetable',
    staff: 'Staff',
    settings: 'Settings',
    
    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    loading: 'Loading',
    noData: 'No data found',
    
    // Dashboard
    welcome: 'Welcome back',
    totalStudents: 'Total Students',
    presentToday: 'Present Today',
    feesCollected: 'Fees Collected',
    feesBalance: 'Fees Balance',
    quickActions: 'Quick Actions',
    markAttendance: 'Mark Attendance',
    enterGrades: 'Enter Grades',
    recordPayment: 'Record Payment',
    sendMessage: 'Send Message',
    
    // Attendance
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    saveAttendance: 'Save Attendance',
    markAllPresent: 'Mark All Present',
    markAllAbsent: 'Mark All Absent',
    
    // Fees
    totalPaid: 'Total Paid',
    balance: 'Balance',
    paid: 'Paid',
    notPaid: 'Not Paid',
    partial: 'Partial',
    recordFee: 'Record Payment',
    
    // Grades
    subject: 'Subject',
    score: 'Score',
    grade: 'Grade',
    average: 'Average',
    
    // Messages
    sendMessageTitle: 'Send Message',
    phone: 'Phone Number',
    message: 'Message',
    send: 'Send',
  },
  lg: {
    // Navigation
    dashboard: 'Bbwa ebyokola',
    students: 'Abasomesa',
    attendance: 'Obujja',
    grades: 'Ebipimo',
    fees: 'Senta',
    reports: 'Ebipandiika',
    messages: 'Obubaka',
    timetable: 'Ebiseera',
    staff: 'Abakozi',
    settings: 'Entegeka',
    
    // Common
    save: 'Kuuma',
    cancel: 'Sazaamu',
    delete: 'Jjawo',
    edit: 'Kyusa',
    add: 'Gatta',
    search: 'Noonya',
    loading: 'Kirindawo',
    noData: 'Tewali bifulumye',
    
    // Dashboard
    welcome: 'Ozaayo nno',
    totalStudents: 'Abasomesa bonna',
    presentToday: 'Abajja leero',
    feesCollected: 'Senta ezikkiriziddwa',
    feesBalance: 'Senta ezisigadde',
    quickActions: 'Ebikola mangu',
    markAttendance: 'Wandika obujja',
    enterGrades: 'Wandika ebipimo',
    recordPayment: 'Wandika senta',
    sendMessage: 'Weereza obubaka',
    
    // Attendance
    present: 'Aliwo',
    absent: 'Taliwo',
    late: 'Yazeeyo',
    saveAttendance: 'Kuuma obujja',
    markAllPresent: 'Yandika bonna',
    markAllAbsent: 'Banna tewali',
    
    // Fees
    totalPaid: 'Zonna eziwasiddwa',
    balance: 'Ebisigadde',
    paid: 'Ziweddwa',
    notPaid: 'Tewali ziweddwa',
    partial: 'Bitono',
    recordFee: 'Wandika senta',
    
    // Grades
    subject: 'Ekisomo',
    score: 'Ekibalo',
    grade: 'Ekiteeso',
    average: 'Omusingi',
    
    // Messages
    sendMessageTitle: 'Weereza obubaka',
    phone: 'Namba ya essimu',
    message: 'Obubaka',
    send: 'Weereza',
  }
}

let currentLanguage: Language = 'en'

export function setLanguage(lang: Language) {
  currentLanguage = lang
  localStorage.setItem('language', lang)
}

export function getLanguage(): Language {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('language') as Language
    if (saved && (saved === 'en' || saved === 'lg')) {
      currentLanguage = saved
    }
  }
  return currentLanguage
}

export function t(key: string): string {
  const lang = getLanguage()
  return translations[lang]?.[key] || translations.en[key] || key
}
