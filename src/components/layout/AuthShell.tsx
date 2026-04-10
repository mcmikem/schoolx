import SkoolMateLogo from '@/components/SkoolMateLogo'

export default function AuthShell({ 
  children, 
  title, 
  subtitle 
}: { 
  children: React.ReactNode
  title: string
  subtitle?: string 
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6 bg-motif">
      <div className="w-full max-w-[440px]">
        <div className="mb-10 text-center">
          <div className="inline-block mb-6">
            <SkoolMateLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--t1)] mb-2">{title}</h1>
          {subtitle && <p className="text-[var(--t3)]">{subtitle}</p>}
        </div>
        
        <div className="bg-[var(--surface)] p-8 rounded-[var(--r2)] shadow-[var(--sh2)] border border-[var(--border)]">
          {children}
        </div>
        
        <div className="mt-8 text-center text-xs text-[var(--t4)]">
          © {new Date().getFullYear()} SkoolMate Foundation. All rights reserved.
        </div>
      </div>
    </div>
  )
}
