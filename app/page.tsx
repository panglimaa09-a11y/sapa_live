import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Manifesto from "../components/Manifesto";
import Features from "../components/Features";
import HowItWorks from "../components/HowItWorks";
import Faq from "../components/Faq";
import Cta from "../components/Cta";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Manifesto />
        <Features />
        <HowItWorks />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
