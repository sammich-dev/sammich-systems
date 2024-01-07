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
  const tournament: TournamentsInterface = useSelector(
    (state: RootState) => state.tournaments.tournamentDetails
  );


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


  useEffect(() => {
    dispatch(getTournament(id as string));
    onConnect()
    return () => {
      dispatch(clearDetails());
    };
  }, [dispatch, id]);

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
          Title: <span className="text-lime-300 font-normal">{tournament.title}</span>
        </div>
        <div className="text-gray-200 font-medium text-lg px-8">
          Created By: <span className="text-lime-300 font-normal">{tournament.createdBy}</span>
        </div>
        <div className="text-gray-200 font-medium text-lg px-8">
          Description: <span className="text-lime-300 font-normal">{tournament.description}</span>
        </div>
        <div className="text-gray-200 font-medium text-lg px-8">
          Winner: <span className="text-lime-300 font-normal">pending...</span>
        </div>
      </section>
      <div className="text-gray-200 font-bold text-xl pl-8">Pendent Matches</div>
      <section className="p-8">
        <table className="table-auto text-white">
          <thead>
          <tr>
            <th>Player</th>
            <th>Player</th>
          </tr>
          </thead>
          <tbody>
          {tournament?.matches?.filter(i => !i.resolutionDate).map((match: any) => {
            return <tr>
              <td>{match.players.split(",")[0]}</td>
              <td>{match.players.split(",")[1]}</td>
            </tr>;
          })}

          </tbody>
        </table>
      </section>


      <div className="text-gray-200 font-bold text-xl pl-8">Resolved Matches</div>
      <section className="p-8">
        <table className="table-auto text-white">
          <thead>
          <tr>
            <th>Player&nbsp;&nbsp;</th>
            <th>Player</th>
            <th>Date</th>
          </tr>
          </thead>
          <tbody>
          {tournament?.matches?.filter(i => i.resolutionDate).map((match: any) => {
            return <tr>
              <td className={match.winnerIndex === 0?"bg-yellow-100 text-black":""}>{match.players.split(",")[0]}</td>
              <td className={match.winnerIndex === 1?"bg-yellow-100 text-black":""}>{match.players.split(",")[1] || " - none - "}</td>
              <td className={match.winnerIndex === 1?"bg-yellow-100 text-black":""}>{new Date(match.resolutionDate).toLocaleDateString()} {new Date(match.resolutionDate).toLocaleTimeString()}</td>
            </tr>;
          })}

          </tbody>
        </table>
      </section>

    </div>
  )
}

export default TournamentDetails;
