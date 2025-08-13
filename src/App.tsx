import { Route, Routes } from "react-router-dom";
import HomePage from "./page/Home";
import MainPage from "./page/Main";
import RandomPage from "./page/Random";
function App() {
  // const [count, setCount] = useState(0);

  return (
    <>
      {/* <Main /> */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/random" element={<RandomPage />} />
      </Routes>
    </>
  );
}

export default App;
