// Type declarations for Supabase SSR
declare module '@supabase/ssr' {
  export function createServerClient(
    url: string,
    key: string,
    options: {
      cookies: {
        get(name: string): string | undefined;
        set(name: string, value: string, options: any): void;
        remove(name: string, options: any): void;
      };
    }
  ): any;
}

declare module 'next/headers' {
  export function cookies(): {
    get(name: string): { value: string } | undefined;
    set(name: string, value: string, options: any): void;
  };
}