'use client'
import { ReactNode, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function BrandProvider({ children }: { children: ReactNode }) {
  const { school } = useAuth()
  
  useEffect(() => {
    if (school?.primary_color) {
      const root = document.documentElement;
      const color = school.primary_color;
      
      // Inject CSS variables
      root.style.setProperty('--primary', color);
      
      // Create a "soft" version (10% opacity)
      const softColor = `${color}1A`; 
      root.style.setProperty('--primary-soft', softColor);
      
      // Create a "dim" version (40% opacity)
      const dimColor = `${color}66`;
      root.style.setProperty('--primary-dim', dimColor);

      // Create a glass version
      const glassColor = `${color}33`;
      root.style.setProperty('--primary-glass', glassColor);
    }
  }, [school?.primary_color]);

  return <>{children}</>
}
