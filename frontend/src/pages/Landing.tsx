
import Navbar from "../layout/Navbar";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import FeaturedTemplates from "../components/FeaturedTemplates";
import Footer from "../components/Footer";
import ScrollToTop from "../components/ScrollToTop";

function LandingPage() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <FeaturedTemplates />
      </main>

      <Footer />

      <ScrollToTop />
    </>
  );
}

export default LandingPage;
