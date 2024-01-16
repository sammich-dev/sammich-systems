/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
//import { Navigate } from 'react-router-dom';
//import { useParams } from "react-router-dom";

import Web3 from 'web3';
import Swal from "sweetalert2";

import { createTournamentThunk, getAllTournamentsThunk } from "../store/slices/tournaments/thunk"

import type { AppDispatch } from '../store/store'
import { TournamentsInterface } from "../interfaces/Interfaces";



const CreationForm = () => {

    //const [created, setCreated] = useState(false) 
    //const navigate = useNavigate()                - > To use for redirect after creation 
    //const { id } = useParams();                   
    const dispatch: AppDispatch = useDispatch()
    const [address, setAddress] = useState<string>("")
    // const { tournaments } = useSelector(
    //     (state: RootState) => state.tournaments
    // );
    const [tournament, setTournament] = useState<Omit<TournamentsInterface, 'id'>>({
        tournament_title: "",
        tournament_description: "",
        createdBy: address,
        startDate: "",
        endDate: null,
        finished: false,
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

    const detectCurrentProvider = () => {
        let provider;
        //@ts-expect-error
        if (window.ethereum) {
            //@ts-expect-error
            provider = window.ethereum;
            //@ts-expect-error
        } else if (window.web3) {
            //@ts-expect-error
            provider = window.web3.currentProvider;
        } else {
            alert("Non-ethereum browser detected. You should install Metamask");
        }
        return provider;
    };

    const onConnect = async () => {
        try {
            const currentProvider = detectCurrentProvider();
            if (currentProvider) {
                await currentProvider.request({ method: 'eth_requestAccounts' });
                const web3 = new Web3(currentProvider);
                const userAccount = await web3.eth.getAccounts();
                const account = userAccount[0];
                setTournament(() => ({ ...tournament, createdBy: account }))
            }
        } catch (err) {
            console.log(err);
        }
    }
    

    const handleAddParticipant = () => {
        setTournament((prevState) => {
            const newParticipant = { address, displayName: "user" }
            if (tournament.participants.length > 23) {
                tournament.participants.splice(23, 1)
            }
            return {
                ...prevState,
                participants: [...tournament.participants, newParticipant]
            }
        })
    }

    const handleReset = () => {
        setTournament({...tournament,
            participants: []
        })
    }

    // ALERTS
    // An error alert to validate the empty participant list
    const ErrorAlert = () => {
        Swal.fire({
            title: "<strong>Something wrong!</strong>",
            icon: "error",
            html: "Add participants please",
            showCloseButton: true,
            focusConfirm: false,
            reverseButtons: true,
            confirmButtonText: "Back",
        })
    }

    const ErrorParticipantsAlert = () => {
        Swal.fire({
            title: "<strong>Something wrong!</strong>",
            icon: "error",
            html: "Repeated participants",
            showCloseButton: true,
            focusConfirm: false,
            reverseButtons: true,
            confirmButtonText: "Back",
        })
    }

    // An alert to be displayed when the tournament is created successfully
    const creationSuccessAlert = () => {
        Swal.fire({
            title: "<strong>Your tournament has been created!</strong>",
            icon: "success",
            html: "Tournament created",
            showCloseButton: true,
            focusConfirm: false,
            confirmButtonColor: "#111827",
            reverseButtons: true,
            confirmButtonText: "Ok",
        }).then((result) => {
            // const idTournament = tournaments.slice(0)[0]
            if (result.value) {
                // window.location.href = `http://localhost:5173/tournament-details/${idTournament.id + 1}`;
                window.location.href = "/";
            }
        });
    };

    // This is my comparative list to send the new tournament with non repeated participants
    const list: any[] = []
    tournament.participants.map((el:any) => list.push(el.address))
    const resultList = list.filter((item,index)=>{
        return list.indexOf(item) === index;
      })
    

    // This is the functionality to create the tournament with empty participants input validation
    const onSubmit = (e: React.FormEvent): void => {
        e.preventDefault()
        //const repeatedParticipant = tournaments.filter(tourn => tourn.participants === tournament.participants.address);
        if (!tournament.participants.length) return ErrorAlert()
        if (resultList.length !== tournament.participants.length) return ErrorParticipantsAlert()
        if (tournament.participants.length){
            dispatch(createTournamentThunk(tournament))
            creationSuccessAlert()
            clearInputs()
        }
        // navigate(`/home/tournament-details/${id}`) - > To use for redirect after creation 
        // setCreated(true)                           -
    }

    // This is functionality for clearing the input fields
    const clearInputs = (): void => {
        setTournament({
            tournament_title: "",
            tournament_description: "",
            createdBy: "",
            startDate: "",
            endDate: null,
            finished: false,
            participants: [],
            matches: [],
        })
    }

    // This is useEffect hook to bring the tournaments and metamask wallet address with onConnect method
    useEffect(() => {
        dispatch(getAllTournamentsThunk());
        onConnect()
    }, [dispatch]);

    
   

    return (
        <form className="w-full max-w-lg pb-20" onSubmit={onSubmit}>
            <div className="w-auto p-2">
                <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2 bg-slate-600 p-2">
                    Created By
                </label>
                    <p className="block tracking-wide text-gray-200 text-xs font-bold mb-2 bg-slate-600 p-2">{tournament.createdBy}</p>
                </div>
            <div className="flex flex-wrap -mx-3 mb-6">
                {/* no necesary */}
                {/* <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0"> 
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-semibold mb-2">
                        Game
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white"
                        type="text"
                        placeholder="Enter the game" />
                </div> */}
                <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                    Title
                </label>
                <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                    required
                    type="text"
                    name="tournament_title"
                    value={tournament.tournament_title}
                    onChange={onInputChange}
                    placeholder="Enter the title" />

                <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                    Participant
                </label>
            <div className="flex w-full justify-around">
                <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                    type="text"
                    maxLength={42}
                    name="participants"
                    onChange={(e) => setAddress(e.currentTarget.value)}
                    placeholder="Add participant" />
                <input type="reset" value="Clear" className="text-gray-200 font-semibold px-3 hover:cursor-pointer hover:scale-105 hover:text-red-500"/>
            </div>
            <div className="flex justify-between w-full">
                <button
                    type="button"
                    onClick={handleAddParticipant}
                    className="bg-gray-200 text-slate-700 p-2 my-2 rounded font-medium hover:scale-95">
                        Add Participant +
                </button>
                <button
                    type="button"
                    onClick={()=>handleReset()}
                    className="bg-gray-200 text-slate-700 p-2 my-2 rounded font-medium hover:scale-95">
                        Remove all
                </button>
            </div>

            </div>
            <div className="mb-10 w-full px-4">
                <ul className="list-disc pt-3">
                    {
                        tournament?.participants?.map((participant: any, index: any) =>
                            <li key={index} className="text-gray-200 font-medium list-decimal">
                                {participant.address}
                                <button
                                    type="button"
                                    className="bg-red-500 text-gray-900 px-2 text-center ml-3 text-xs rounded hover:cursor-pointer hover:text-gray-200"
                                    onClick={() => { setTournament({ ...tournament, participants: tournament.participants.filter((part: any) => part.address !== participant.address) }) }}>
                                    X
                                </button>
                            </li>)
                    }
                </ul>
            </div>
            <div className="flex flex-wrap -mx-3 mb-6">
                <div className="w-full">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Description
                    </label>
                    <textarea className="appearance-none block w-full max-h-36 bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        name="tournament_description"
                        value={tournament.tournament_description}
                        onChange={(event) => { setTournament({ ...tournament, tournament_description: event.target.value }) }}
                        placeholder="Tournament description" />
                </div>
            </div>
            <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 md:mb-0">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        Start date
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        required
                        type="datetime-local"
                        name="startDate"
                        value={tournament.startDate}
                        onChange={onInputChange}
                        placeholder="Start" />
                </div>
                <div className="w-full md:w-1/2 px-3 md:mb-0">
                    <label className="block uppercase tracking-wide text-gray-200 text-xs font-bold mb-2">
                        End date
                    </label>
                    <input className="appearance-none block w-full bg-gray-200 text-slate-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                        type="datetime-local"
                        name="endDate"
                        value={tournament.endDate}
                        onChange={onInputChange}
                        placeholder="The end" />
                </div>
            </div>
            <div className="w-full justify-center flex">
                <button
                    type="submit"
                    className="appearance-none md:w-1/3 flex justify-center w-full bg-blue-700 text-white border border-gray-200 rounded py-2.5 px-5 font-semibold mt-6 hover:scale-95">
                    Create
                </button>
            </div>
            {/* {created && <Navigate to={`/home/tournament-details/${id}`}/>} */}
        </form>
    )
}

export default CreationForm