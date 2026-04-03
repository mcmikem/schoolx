import { HeroSection } from '@/components/marketing/HeroSection'
import { FeaturesSection } from '@/components/marketing/FeaturesSection'
import { PricingSection } from '@/components/marketing/PricingSection'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--surface)]">
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
    </main>
  )
}
