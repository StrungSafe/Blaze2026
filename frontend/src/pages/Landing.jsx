import Navbar from "../layout/Navbar";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import FeaturedTemplates from "../components/FeaturedTemplates";

function LandingPage() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <FeaturedTemplates />
      </main>
    </>
  );
}

export default LandingPage;