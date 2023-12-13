import {
  BrowserRouter as Router,
  Route,
  Routes,
} from "react-router-dom";

import Home from "./pages/Home"
import CreateTournament from "../src/pages/CreateTournament";
import TournamentDetails from "../src/pages/TournamentDetails";
import Login from "./components/Login";




  function App(): JSX.Element {
    return (
      <>
        <Router>
          <Routes>
            <Route element={<Login />} path="/" />
            <Route element={<Home />} path="/Home" />
            <Route element={<CreateTournament />} path="/createTournament" />
            
            <Route element={<TournamentDetails />} path="/Home/tournamentDetails/:id" />
          </Routes>
        </Router>
      </>
    );
  }

export default App
