import { useEffect } from "react"
import { useSelector, useDispatch } from "react-redux";

import { getAllTournamentsThunk } from "../store/slices/tournaments/thunk"
import type { AppDispatch, RootState } from "../../src/store/store";

import Tournament from "./Tournament";


const TournamentsTable = () => {

    const dispatch: AppDispatch = useDispatch();
    const { tournaments } = useSelector(
        (state: RootState) => state.tournaments
    );

    useEffect(() => {
        dispatch(getAllTournamentsThunk());
    }, [dispatch]);

    return (
        <div className="">
            <table className="w-[90%] m-auto">
                <thead className="bg-gray-200 border-2 border-slate-800 text-slate-600">
                    <tr>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Id</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Title</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">N. Participants</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Start Date</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">State</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Details</th>
                    </tr>
                </thead>
                {tournaments ? tournaments.map((tournament:any, index:number) => (
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
    )
}

export default TournamentsTable