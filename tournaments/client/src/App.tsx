import {
  BrowserRouter as Router,
  Route,
  Routes,
} from "react-router-dom";

import Home from "./pages/Home"
import CreateTournament from "../src/pages/CreateTournament";



  function App(): JSX.Element {
    return (
      <>
        <Router>
          <Routes>
            <Route element={<Home />} path="/" />
            <Route element={<CreateTournament />} path="/createTournament" />
          </Routes>
        </Router>
      </>
    );
  }

export default App
