'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { canAccess, type UserRole, type RolePermissions } from '@/lib/roles'
import { resolveRouteAccess, useRoleRouteOverrides } from '@/lib/role-access-overrides'

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
  '/dashboard/permissions': 'settings',
  '/dashboard/data-quality': 'settings',
  '/dashboard/discipline': 'discipline',
  '/dashboard/invoicing': 'invoicing',
  '/dashboard/assets': 'assets',
  '/dashboard/store': 'assets',
  '/dashboard/store/inventory': 'assets',
  '/dashboard/analytics': 'analytics',
  '/dashboard/export': 'export',
  '/dashboard/board-report': 'boardReport',
  '/dashboard/auto-sms': 'autoSMS',
  '/dashboard/warnings': 'warnings',
  '/dashboard/visitors': 'visitors',
}

export function useRoutePermissions() {
  const { user, authInitialized, school } = useAuth()
  const { overrides } = useRoleRouteOverrides(school?.id)
  const router = useRouter()
  const pathname = usePathname()
  const path = pathname ?? ''

  useEffect(() => {
    if (!authInitialized) return

    if (!user && !publicRoutes.includes(path)) {
      router.replace('/login')
      return
    }

    if (path === '/login' && user) {
      router.replace('/dashboard')
      return
    }

    if (!user) return

    const routeKey = Object.keys(roleBasedRoutes).find(key => 
      path.startsWith(key)
    )

    if (routeKey) {
      const permission = roleBasedRoutes[routeKey]
      const role = user.role as UserRole
      const baseAllowed = role ? canAccess(role, permission) : false
      const allowed = role ? resolveRouteAccess(role, path, baseAllowed, overrides) : baseAllowed
      if (user.role && !allowed) {
        router.replace('/dashboard')
      }
    }
  }, [user, authInitialized, path, router, overrides])

  return { user, authInitialized }
}
