import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux";

import { getAllTournamentsThunk } from "../store/slices/tournaments/thunk"
import type { AppDispatch, RootState } from "../../src/store/store";

import Tournament from "./Tournament";
import Paginated from "./Paginated";


const TournamentsTable = () => {

    const dispatch: AppDispatch = useDispatch();
    const { tournaments } = useSelector(
        (state: RootState) => state.tournaments
    );
    const currentPage = 0
    const [paginated, setPaginated] = useState(1);
    const [tournamentsPerPage] = useState(8);

    const lastTournamentLocation = paginated * tournamentsPerPage;
    const firstTournamentLocation = lastTournamentLocation - tournamentsPerPage;
    const tournamentsPages = tournaments.slice(firstTournamentLocation, lastTournamentLocation);

    const nextPage = function () {
        setPaginated(paginated + 1);
    };
    const previousPage = function () {
        setPaginated(paginated - 1);
    };

    const thePage = (pageNumber: number) => {
        setPaginated(pageNumber);
    };

    useEffect(() => {
        dispatch(getAllTournamentsThunk());
    }, [dispatch]);

    console.log(tournaments)
    return (
        <>
        <div className="block w-auto h-auto m-auto">
            <table className="w-[90%] m-auto">
                <thead className="bg-gray-200 border-2 border-slate-800 text-slate-600">
                    <tr>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Id</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Title</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">N. Participants</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Start Date</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">State</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-center">View more</th>
                    </tr>
                </thead>
                {tournamentsPages ? tournamentsPages?.map((tournament, index) => (
                    <Tournament
                        key={index}
                        id={tournament.id}
                        createdBy={tournament.createdBy}
                        startDate={tournament.startDate}
                        endDate={tournament.endDate}
                        tournament_title={tournament.title}
                        participants={tournament.participants}
                        matches={tournament.matches}
                    />
                )) : "Loading..."}
            </table>
        </div>
            <div className="flex justify-center items-center w-[100%] m-auto text-center my-4">
                <Paginated
                    tournaments={tournamentsPerPage}
                    paginated={paginated}
                    tournamentsPerPage={tournamentsPerPage}
                    thePage={thePage}
                    nextPage={nextPage}
                    previousPage={previousPage}
                    currentPage={currentPage}
                />
            </div>
        </>
    )
}

export default TournamentsTable