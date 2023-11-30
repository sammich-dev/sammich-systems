import { useState } from "react";
import { useDispatch } from "react-redux";
// import { Link } from "react-router-dom";

import { createTournamentThunk } from "../store/slices/tournaments/thunk"

import type { AppDispatch } from '../store/store'
import { TournamentsInterface } from "../interfaces/Interfaces";



const CreationForm = () => {

    //const tournamentState = useSelector((state: RootState) => state.tournaments)
    const dispatch: AppDispatch = useDispatch()
    const [tournament, setTournament] = useState<Omit<TournamentsInterface, 'id'>>({
        title: "",
        description: "",
        startDate: "",
        participants: [],
        matches: [],
    })

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        e.preventDefault()
        setTournament({
            ...tournament,
            [e.target.name]: e.target.value,
        })
    };

    const onSubmit = (e: React.FormEvent): void => {
        e.preventDefault()

        dispatch(createTournamentThunk(tournament))

        clearInputs()
    }

    const clearInputs = (): void => {
        setTournament({
            title: "",
            description: "",
            startDate: "",
            participants: [],
            matches: [],
        })
    }


    return (
        <form className="w-full max-w-lg" onSubmit={onSubmit}>
            <div className="flex flex-wrap -mx-3 mb-6">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-semibold mb-2">
                        Game
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white"
                        type="text"
                        placeholder="Enter the game" />
                </div>
                <div className="w-full md:w-1/2 px-3">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Title
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        type="text"
                        name="title"
                        value={tournament.title}
                        onChange={onInputChange}
                        placeholder="Enter the title" />
                </div>
            </div>
            <div className="flex flex-wrap -mx-3 mb-6">
                <div className="w-full px-3">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Participants
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        type="text"
                        name="participants"
                        value={tournament.participants}
                        onChange={onInputChange}
                        placeholder="Add participant +" />
                </div>
                <div className="bg-gray-200 w-full h-[8rem] max-h-[30rem] rounded">
                    <label className="block ml-3 tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Participants
                    </label>
                </div>
            </div>
            <div className="flex flex-wrap -mx-3 mb-6">
                <div className="w-full px-3">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Description
                    </label>
                    <input className="appearance-none block w-full max-h-36 bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        name="description"
                        value={tournament.description}
                        onChange={onInputChange}
                        placeholder="Tournament description" />
                </div>
            </div>
            <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/3 px-3 mb-6 md:mb-0">
                    <label className="block uppercase tracking-wide text-slate-700 text-xs font-bold mb-2">
                        Start date
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        type="date"
                        name="startDate"
                        value={tournament.startDate?.toString()}
                        onChange={onInputChange}
                        placeholder="Start" />
                </div>
                <div className="w-full md:w-1/3 px-3 mb-6 md:mb-0">
                    <label className="block uppercase tracking-wide text-slate-700 text-xs font-bold mb-2">
                        End date
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        type="date"
                        name="startDate"
                        value={tournament.startDate?.toString()}
                        onChange={onInputChange}
                        placeholder="Start" />
                </div>
                <div className="w-full md:w-1/3 px-3 md:mb-0">
                    
                        <button
                            type="submit"
                            className="appearance-none flex justify-center w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-2.5 px-5 font-semibold mt-6 hover:scale-95">
                            Create
                        </button>
                    {/* 0x0Bef38A5D84ac68B4721d0fB6279ba9de42DF210 */}
                </div>
            </div>
        </form>
    )
}

export default CreationForm