import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Back to top"
      className={`
        fixed bottom-6 right-6 z-50
     text-white
     py-2 px-2 rounded-full bg-orange-500
        shadow-[0_0_25px_rgba(249,115,22,0.25)]
        transition-all duration-300
        hover:-translate-y-1
        hover:bg-orange-400
        hover:shadow-[0_0_30px_rgba(249,115,22,0.45)]
        focus:outline-none
        focus:ring-offset-2 focus:ring-offset-[#05070b]
        ${
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-5 opacity-0"
        }
      `}
    >
      <ChevronUp size={25} strokeWidth={2.5} />
    </button>
  );
}

export default ScrollToTop;
