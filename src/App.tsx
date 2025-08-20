import { BrowserRouter, Route, Routes } from "react-router";

import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import DesignPage from "./pages/DesignPage";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
