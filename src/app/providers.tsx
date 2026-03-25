'use client'
import { AuthProvider } from '@/lib/auth-context'
import { AcademicProvider } from '@/lib/academic-context'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AcademicProvider>{children}</AcademicProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
