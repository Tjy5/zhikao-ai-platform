'use client';

import AboutSection from './_home/components/AboutSection';
import CollectionSection from './_home/components/CollectionSection';
import FinalCtaSection from './_home/components/FinalCtaSection';
import HeroSection from './_home/components/HeroSection';
import TextureOverlay from './_home/components/TextureOverlay';
import { useHomeStats } from './_home/hooks/useHomeStats';

export default function HomePage() {
  const stats = useHomeStats();

  return (
    <div className='min-h-screen overflow-x-hidden bg-paper text-ink'>
      <HeroSection stats={stats} />
      <AboutSection />
      <CollectionSection stats={stats} />
      <FinalCtaSection />
      <TextureOverlay />
    </div>
  );
}
