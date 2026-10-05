import { HeroSection }    from '@/components/HeroSection';
import { FieldToStillTeaser } from '@/components/FieldToStillTeaser';
import { SpiritsSection } from '@/components/SpiritsSection';
import { ProcessSection } from '@/components/ProcessSection';

export default function Home() {
  return (
    <main>
      <HeroSection />
      <FieldToStillTeaser />
      <SpiritsSection />
      <ProcessSection />
    </main>
  );
}
