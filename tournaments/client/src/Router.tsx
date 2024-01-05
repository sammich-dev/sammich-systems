import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/Home";
import CreateTournament from "./pages/CreateTournament";
import TournamentDetails from "./pages/TournamentDetails";
import Root from "./components/Root";

const router = createBrowserRouter(
    [
        {
            path: "/",
            element: <Root />,
            children: [
                {
                    path: "/",
                    element: <Home />,
                    index: true
                },
                {
                    path: "/create-tournament",
                    element: <CreateTournament />
                },
                {
                    path: "/tournament-details/:id",
                    element: <TournamentDetails />
                },
            ]
        }
    ]
);

export default router;