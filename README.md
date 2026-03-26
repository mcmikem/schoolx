# SchoolX - School Management System

A modern school management system built for educational institutions.

![Next.js](https://img.shields.io/badge/Next.js-14.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-teal)
![Supabase](https://img.shields.io/badge/Supabase-2.45-green)

## Features

- **Student Management** - Register students, track records, export data
- **Attendance** - Mark daily attendance by class
- **Grades** - Enter marks, calculate averages, UNEB grading system
- **Fees** - Track payments, fee structure, mobile money support
- **SMS** - Send messages to parents via SMS
- **Reports** - Generate report cards and analytics
- **Staff** - Manage teachers and administrators
- **Timetable** - Create class schedules

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth) |
| SMS | Africa's Talking API |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/schoolx.git
cd schoolx

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Africa's Talking SMS
AFRICAS_TALKING_API_KEY=your-api-key
AFRICAS_TALKING_USERNAME=your-username
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

Visit `/api/setup` to create the required database tables.

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── import/    # CSV student import
│   │   ├── register/  # School registration
│   │   ├── reports/   # Report card generation
│   │   ├── setup/     # Database setup
│   │   └── sms/       # SMS sending
│   ├── dashboard/     # Dashboard pages
│   │   ├── attendance/
│   │   ├── fees/
│   │   ├── grades/
│   │   ├── messages/
│   │   ├── reports/
│   │   ├── settings/
│   │   ├── staff/
│   │   ├── students/
│   │   └── timetable/
│   ├── login/
│   └── register/
├── components/        # Reusable components
├── lib/
│   ├── auth-context.tsx  # Authentication
│   ├── grading.ts        # UNEB grading utilities
│   ├── hooks.ts          # Custom React hooks
│   └── supabase.ts       # Supabase client
└── types/             # TypeScript types
```

## UNEB Grading System

| Score | Grade | Division |
|-------|-------|----------|
| 80-100 | D1 | Division I |
| 70-79 | D2 | Division I |
| 65-69 | C3 | Division II |
| 60-64 | C4 | Division II |
| 55-59 | C5 | Division III |
| 50-54 | C6 | Division III |
| 45-49 | P7 | Division IV |
| 40-44 | P8 | Division IV |
| 0-39 | F9 | Ungraded |

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/register` | POST | Register new school |
| `/api/setup` | POST | Create database tables |
| `/api/sms` | POST | Send SMS to parents |
| `/api/import` | POST | Import students from CSV |
| `/api/reports` | POST | Generate report cards |

## Deployment

### Vercel

```bash
npm i -g vercel
vercel --prod
```

## License

MIT License
