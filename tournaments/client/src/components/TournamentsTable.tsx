import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux";

import { getAllTournamentsThunk } from "../store/slices/tournaments/thunk"
import type { AppDispatch, RootState } from "../../src/store/store";

import Tournament from "./Tournament";

import { BsArrowRightCircle } from "react-icons/bs";
import { BsArrowLeftCircle } from "react-icons/bs";


const TournamentsTable = () => {

    const dispatch: AppDispatch = useDispatch();
    const { tournaments } = useSelector(
        (state: RootState) => state.tournaments
    );
    // const currentPage = 0
    const [paginated, setPaginated] = useState(1);
    const [tournamentsPerPage] = useState(8);

    const lastTournamentLocation = paginated * tournamentsPerPage;
    const firstTournamentLocation = lastTournamentLocation - tournamentsPerPage;
    const tournamentsPages = tournaments.slice(firstTournamentLocation, lastTournamentLocation);

    const nextPage = function () {
        if (lastTournamentLocation >= tournaments.length) return

        setPaginated(paginated + 1);
    };
    const previousPage = function () {
        setPaginated(paginated - 1);
    };

    useEffect(() => {
        dispatch(getAllTournamentsThunk());
    }, [dispatch]);


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
                            finished={tournament.finished}
                        />
                    )) : "Loading..."}
                </table>
            </div>
            {/* PAGINATION */}
            <div className="flex justify-center items-center w-[100%] m-auto text-center my-4">
                <div className="flex justify-center">
                    {
                        paginated === 1
                            ? <button className="mx-5 p-2 cursor-not-allowed text-gray-900" disabled>
                                <BsArrowLeftCircle size={25} />
                            </button>
                            : <button
                                className="mx-5 p-2 text-gray-200 hover:text-gray-900"
                                onClick={() => previousPage()}
                            >
                                <BsArrowLeftCircle size={25} />
                            </button>
                    }
                    <div className="text-gray-200 font-bold rounded-3xl p-3 text-center ">
                        {paginated}
                    </div>
                    {
                        lastTournamentLocation >= tournaments.length
                            ? <button className="mx-5 p-2 cursor-not-allowed text-gray-900" disabled>
                                <BsArrowRightCircle size={25} />
                            </button>
                            : <button
                                className="mx-5 p-2 text-gray-200 hover:text-gray-900"
                                onClick={() => nextPage()}
                            >
                                <BsArrowRightCircle size={25} />
                            </button>
                    }
                </div>
            </div>
            {/* PAGINATION END */}
        </>
    )
}

export default TournamentsTable