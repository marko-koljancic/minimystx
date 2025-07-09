import { BrowserRouter, Route, Routes } from "react-router";

import MainLayout from "./layouts/MainLayout";
import Home from "./components/home";
import NotFound from "./components/not-found";
import Header from "./components/header";
import Design from "./components/design/Design";

const App = () => {
  return (
    <BrowserRouter>
      <Header />
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/design" element={<Design />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
