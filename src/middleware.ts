import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');
  const isHealthRoute = pathname.startsWith('/api/health');
  const isPublicRoute = [
    '/api/register',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/demo-login',
    '/api/health',
    '/api/health/env',
  ].some((p) => pathname.startsWith(p));

  if (isApiRoute && !isPublicRoute && !isHealthRoute) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
  }

  if (isApiRoute && process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_TEST_ROUTES === 'true') {
    const devRoutes = ['/api/debug/log', '/api/demo-login'];
    if (devRoutes.some((p) => pathname.startsWith(p))) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
