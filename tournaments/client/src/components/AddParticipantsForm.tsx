import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
// import { Link } from "react-router-dom";

import { createParticipantThunk, getAllTournamentsThunk } from "../store/slices/tournaments/thunk"

import type { AppDispatch, RootState } from '../store/store'
import { ParticipantInterface } from "../interfaces/Interfaces";
// import { useParams } from "react-router-dom";



const AddParticipantsForm = () => {

    const tournamentState = useSelector((state: RootState) => state.tournaments)
    const theID = tournamentState.tournaments.slice(-1)[0]
    console.log(theID)
    // const { id } = useParams();
    const dispatch: AppDispatch = useDispatch()
    const [participant, setParticipant] = useState<Omit<ParticipantInterface, 'id'>>({
        adress: "",
        displayName: "",
        tournamentId: theID.id
    })

    function onChange(e: React.ChangeEvent<HTMLInputElement>): void {
        e.preventDefault();
        setParticipant({
            ...participant,
            [e.target.name]: e.target.value,
        });
    }

    const onSubmit = (e: React.FormEvent): void => {
        e.preventDefault()

        dispatch(createParticipantThunk(participant))

        clearInputs()
    }

    const clearInputs = (): void => {
        setParticipant({
            adress: "",
            displayName: "",
        })
    }

    useEffect(() => {
        dispatch(getAllTournamentsThunk());
    }, [dispatch]);


    return (
        <form className="w-full max-w-lg" onSubmit={onSubmit}>
            <div className="flex flex-wrap -mx-3 mb-6 p-20">
                <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                    <span className="text-gray-200 font-normal">Tournament ID: </span>
                </label>
                <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                    type="text"
                    value={participant.tournamentId} 
                    onChange={onChange}
                    />
                <div className="w-full px-3">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Participants
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        type="text"
                        name="adress"
                        value={participant.adress}
                        onChange={onChange}
                        placeholder="Enter the participant address" />
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        type="text"
                        name="displayName"
                        value={participant.displayName}
                        onChange={onChange}
                        placeholder="Add display name" />

                </div>
                <button
                    type="submit"
                    className="appearance-none flex justify-center mb-4 w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-2.5 px-5 font-semibold mt-6 hover:scale-95">
                    Add Participant
                </button>
                <div className="bg-gray-200 w-full h-[8rem] max-h-[30rem] rounded">
                    <ul>
                        <li></li>
                    </ul>
                </div>
            </div>

            {/* 0x0Bef38A5D84ac68B4721d0fB6279ba9de42DF210 */}
        </form>
    )
}

export default AddParticipantsForm