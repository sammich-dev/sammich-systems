import { useEffect } from "react"
import { useSelector, useDispatch } from "react-redux";

import { getAllTournamentsThunk } from "../store/slices/tournaments/thunk"

import type { AppDispatch, RootState } from "../../src/store/store";


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
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Game</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Title</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">N. Participants</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">Start Date</th>
                        <th className="p-3 text-sm font-semibold tracking-wide text-left">State</th>
                    </tr>
                </thead>
                {tournaments ? tournaments.map((tournament, index) => (

                    <tbody key={index}>
                        <tr className="border-b border-gray-200">
                            <td className="p-3 text-sm text-gray-200 ">{tournament.id}</td>
                            <td className="p-3 text-sm text-gray-200 ">{tournament.description}</td>
                            <td className="p-3 text-sm text-gray-200 ">{tournament.title}</td>
                            <td className="p-3 text-sm text-gray-200 ">{tournament.participants}</td>
                            <td className="p-3 text-sm text-gray-200 ">{tournament.startDate}</td>
                            <td className="p-3 text-sm text-gray-200 ">Open</td>
                        </tr>
                    </tbody>

                )) : "Loading..."}
            </table>
        </div>
    )
}

export default TournamentsTable