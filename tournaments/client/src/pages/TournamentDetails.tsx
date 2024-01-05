/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";

import { AppDispatch, RootState } from "../store/store";
import { deleteTournamentThunk, getTournament } from "../store/slices/tournaments/thunk";
import { clearDetails } from "../store/slices/tournaments/tournamentsSlice"

import { TournamentsInterface } from "../interfaces/Interfaces";
import GoBack from "../components/GoBack";
import Web3 from "web3";
import Swal from "sweetalert2";


const TournamentDetails: React.FC = () => {

  const dispatch: AppDispatch = useDispatch();
  const { id } = useParams();
  const tournaments: TournamentsInterface = useSelector(
    (state: RootState) => state.tournaments.tournamentDetails
  );
  const [address, setAddress] = useState("");
  const [winners, setWinners] = useState([""])


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
      alert("Please download metamask")
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
        setAddress(account);
      }
    } catch (err) {
      console.log(err);
    }
  }

  const deletedSuccessAlert = (id:any) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#111827",
      cancelButtonColor: "#b91c1c",
      confirmButtonText: "Yes, delete it!"
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: "Deleted!",
          text: "Your tournament has been deleted.",
          icon: "success"
        });
        dispatch(deleteTournamentThunk(id))
        window.location.href = "http://localhost:5173/";
      }
    })
    
  };

  const handleWinnersButton = () => {

  }


  useEffect(() => {
    dispatch(getTournament(id as string));
    onConnect()
    return () => {
      dispatch(clearDetails());
    };
  }, [dispatch, id]);

  // PLAYERS RECEIVED FROM THE BACKEND WITH RANDOM SORT TO THE MATCHES.
  // Separate the players 
  const mitad = Math.floor(tournaments?.participants?.length / 2);
  // Get all players
  const allPlayers = tournaments.matches?.slice(1,2)
  const players = allPlayers?.[0].players.split(',');
  const players1 = players?.slice(0, mitad);
  const players2 = players?.slice(mitad);

  console.log(players)
  return (
    <div key={id}>
      <div className="flex justify-center">
        <h1 className="felx text-center text-3xl font-semibold text-gray-200 p-4">
          TOURNAMENT DETAILS
        </h1>
        <GoBack />
      </div>
      <section className="mt-10">
        <div className="text-gray-200 font-medium text-lg px-8">
          Title: <span className="text-lime-300 font-normal">{tournaments.title}</span>
        </div>
        <div className="text-gray-200 font-medium text-lg px-8">
          Created By: <span className="text-lime-300 font-normal">{tournaments.createdBy}</span>
        </div>
        <div className="text-gray-200 font-medium text-lg px-8">
          Description: <span className="text-lime-300 font-normal">{tournaments.description}</span>
        </div>
        {tournaments.createdBy === address ?
          <div className="text-red-700 font-medium text-base p-8">
            <button onClick={() => deletedSuccessAlert(id)} className="p-2 bg-gray-900 rounded hover:bg-gray-800 hover:text-red-500 hover:scale-105 ease-in-out transition duration-500"> Delete </button>
          </div>
          : null}
      </section>
      <h3 className="text-gray-200 font-bold text-xl p-8">Pendent Matches</h3>
      <div className="flex p-4">
        <section className="w-[27%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 1</h5>
          <ul className="w-full p-2 text-center font-normal">
            {
              players1 ? players1.map((pla: any, i: any) =>
                <button className="focus:outline-none focus:border-2 focus:border-yellow-400 border border-gray-200 my-1 p-1 hover:cursor-pointer">
                  <li key={i} className="my-2 text-sm text-gray-200">{pla}</li>
                </button>
              ) : null
            }
          </ul>
        </section>
        <div className="w-[4%] text-center font-medium text-lg p-4">vs</div>
        <section className="w-[27%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 2</h5>
          <ul className="w-full p-2 text-center font-normal">
            {
              players2 ? players2.map((pla: any, i: any) =>
              <button className="focus:outline-none focus:border-2 focus:border-yellow-400 border border-gray-200 my-1 p-1 hover:cursor-pointer">
                  <li key={i} className="my-2 text-sm text-gray-200">{pla}</li>
                </button>
              ) : null
            }
          </ul>
        </section>
        {/* <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Open Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments?.startDate?.slice(0, 19)} </aside>
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">End Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments?.endDate?.slice(0, 19)} </aside>
        </section> */}
      </div>
      <h3 className="text-gray-200 font-bold text-xl p-8">Resolved Matches</h3>
      <div className="flex p-4">
        <section className="w-[27%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 1</h5>
          <ul className="w-full p-2 text-center font-normal">
            {
              players1 ? players1.map((pla: any, i: any) =>
                <div className="border border-gray-200 p-1 my-1">
                  <li key={i} className="my-2 text-sm text-gray-200">{pla}</li>
                </div>
              ) : null
            }
          </ul>
        </section>
        <div className="w-[4%] text-center font-medium text-lg p-4">vs</div>
        <section className="w-[27%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 2</h5>
          <ul className="w-full p-2 text-center font-normal">
            {
              players2 ? players2.map((pla: any, i: any) =>
                <div className="border border-gray-200 p-1 my-1">
                  <li key={i} className="my-2 text-sm text-gray-200">{pla}</li>
                </div>
              ) : null
            }
          </ul>
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Resolution Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments?.startDate?.slice(0, 19)} </aside>
        </section>
        {/* <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">End Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments?.endDate?.slice(0, 19)} </aside>
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Score Results</h5>
          <aside className="w-full p-2 text-center font-medium"> 20 - 20 </aside>
        </section> */}
      </div>
    </div>
  )
}

export default TournamentDetails;
