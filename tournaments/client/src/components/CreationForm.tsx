import { useState } from "react";
import { useDispatch } from "react-redux";
// import { Link } from "react-router-dom";

import { createTournamentThunk } from "../store/slices/tournaments/thunk"

import type { AppDispatch } from '../store/store'
import { TournamentsInterface } from "../interfaces/Interfaces";



const CreationForm = () => {

    const dispatch: AppDispatch = useDispatch()
    const [address, setAddress] = useState<string>("")
    const [tournament, setTournament] = useState<Omit<TournamentsInterface, 'id'>>({
        title: "",
        description: "",
        createdBy: "",
        startDate: "",
        endDate: "",
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

    const handleAddParticipant = () => {
        setTournament((prevState) => {
            const newParticipant = { address, displayName: "user" }
            if(tournament.participants.length > 7){
                tournament.participants.splice(7,1)
            } 
            return {
                ...prevState,
                participants: [...tournament.participants, newParticipant]
            }
        })
    }

    const onSubmit = (e: React.FormEvent): void => {
        e.preventDefault()

        dispatch(createTournamentThunk(tournament))

        clearInputs()
    }

    const clearInputs = (): void => {
        setTournament({
            title: "",
            description: "",
            createdBy: "",
            startDate: "",
            endDate: "",
            participants: [],
            matches: [],
        })
    }

    return (
        <form className="w-full max-w-lg pb-20" onSubmit={onSubmit}>
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
                <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                    Created By
                </label>
                <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                   required
                   type="text"
                   maxLength={42}
                   name="createdBy"
                   value={tournament.createdBy}
                   onChange={onInputChange}
                   placeholder="Enter creator address" />
                <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                    Participant
                </label>
                <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                    required
                    type="text"
                    maxLength={42}
                    name="participants"
                    onChange={(e) => setAddress(e.currentTarget.value)}
                    placeholder="Add participant" />
                <button
                    type="button"
                    onClick={handleAddParticipant}
                    className="bg-gray-200 text-slate-700 p-2 m-2 rounded font-medium hover:scale-95">Add Participant +</button>

                <div className="bg-gray-200 w-full h-[20rem] max-h-[50rem] rounded">
                    <ul>
                        {
                            tournament.participants.map((participant: any, index: any) =>
                                <li key={index}>
                                    {participant.address}
                                </li>)
                        }
                    </ul>
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
                        value={tournament.startDate}
                        onChange={onInputChange}
                        placeholder="Start" />
                </div>
                <div className="w-full md:w-1/3 px-3 mb-6 md:mb-0">
                    <label className="block uppercase tracking-wide text-slate-700 text-xs font-bold mb-2">
                        End date
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        type="date"
                        name="endDate"
                        value={tournament.endDate}
                        onChange={onInputChange}
                        placeholder="Final" />
                </div>
                <div className="w-full md:w-1/3 px-3 md:mb-0">

                    <button
                        type="submit"
                        className="appearance-none flex justify-center w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-2.5 px-5 font-semibold mt-6 hover:scale-95">
                        Create
                    </button>

                </div>
            </div>
        </form>
    )
}

export default CreationForm