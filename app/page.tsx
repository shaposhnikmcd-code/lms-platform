import Hero from '@/components/home/Hero';
import About from '@/components/home/About';
import Directions from '@/components/home/Directions';
import WhyUs from '@/components/home/WhyUs';
import CTA from '@/components/home/CTA';
import AboutTetiana from '@/components/home/AboutTetiana'; // ← додайте цей імпорт

export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      <Directions />
      <WhyUs />
      <AboutTetiana /> {/* ← додайте цей компонент */}
      <CTA />
    </main>
  );
}