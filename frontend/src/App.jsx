
import { Routes, Route } from "react-router-dom";

import LandingPage from "./pages/Landing";
import Publish from "./pages/Publish";
import Policy from "./pages/Policy";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/publish" element={<Publish />} />
      <Route path="/policy" element={<Policy />} />

      {/* Add the template detail page when it is ready */}
      {/* <Route path="/t/:identifier" element={<Template />} /> */}
    </Routes>
  );
}

export default App;
