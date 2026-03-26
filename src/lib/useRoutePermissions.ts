'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { canAccess, type UserRole, type RolePermissions } from '@/lib/roles'

const publicRoutes = ['/login', '/register', '/', '/setup', '/setup-admin']
const roleBasedRoutes: Record<string, keyof RolePermissions> = {
  '/dashboard/students': 'students',
  '/dashboard/attendance': 'attendance',
  '/dashboard/grades': 'grades',
  '/dashboard/fees': 'fees',
  '/dashboard/messages': 'messages',
  '/dashboard/reports': 'reports',
  '/dashboard/staff': 'staff',
  '/dashboard/settings': 'settings',
  '/dashboard/discipline': 'discipline',
  '/dashboard/invoicing': 'invoicing',
  '/dashboard/assets': 'assets',
  '/dashboard/analytics': 'analytics',
  '/dashboard/export': 'export',
  '/dashboard/board-report': 'boardReport',
  '/dashboard/auto-sms': 'autoSMS',
  '/dashboard/warnings': 'warnings',
  '/dashboard/visitors': 'visitors',
}

export function useRoutePermissions() {
  const { user, loading: authLoading, school } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (authLoading) return

    if (!user && !publicRoutes.includes(pathname)) {
      router.push('/login')
      return
    }

    if (pathname === '/login' && user) {
      router.push('/dashboard')
      return
    }

    if (!user) return

    const routeKey = Object.keys(roleBasedRoutes).find(key => 
      pathname.startsWith(key)
    )

    if (routeKey) {
      const permission = roleBasedRoutes[routeKey]
      if (user.role && !canAccess(user.role as UserRole, permission)) {
        router.push('/dashboard')
      }
    }
  }, [user, authLoading, pathname, router])

  return { user, loading: authLoading }
}
