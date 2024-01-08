/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import Select from 'react-select'
import { AppDispatch, RootState } from "../store/store";
import { getTournament } from "../store/slices/tournaments/thunk";
import { clearDetails } from "../store/slices/tournaments/tournamentsSlice"

import { TournamentsInterface } from "../interfaces/Interfaces";
import GoBack from "../components/GoBack";
import Web3 from "web3";
import axios from "axios";


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
  const [address, setAddress] = useState("");
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
  }, [ id]);
  const [resolving, setResolving] = useState();
  const [resolvingMatchPlayer, setResolvingMatchPlayer] = useState(false);
  const [sendingRsolution, setSendingResolution] = useState(false);

  const sendResolution = async (match, player) => {
    setSendingResolution(true);
    console.log(match.players, player);
    await axios.post(`/api/manual-match-resolution`, {
      match, winnerIndex:match.players.split(",").indexOf(player)
    });
    setSendingResolution(false);
    setResolving(undefined);
    dispatch(getTournament(id as string));
  }

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
          Winner: {tournament.finished ? <span className="bg-yellow-100 text-black p-1">{tournament.winner}</span> :  <span className="text-lime-300 font-normal">pending...</span> }
        </div>
        <div className="text-gray-200 font-medium text-lg px-8">
          Participants: {tournament.participantAddresses?.toString()}
        </div>
      </section>
      <div className="text-gray-200 font-bold text-xl pl-8">Pendent Matches</div>
      {tournament?.matches?.filter(i => !i.resolutionDate).length > 0 ?<section className="p-8">
            <table className="table-auto text-white">
              <thead>
              <tr>
                <th className="p-2">Round</th>
                <th className="p-2">Player</th>
                <th className="p-2">Player</th>
                <th className="p-2">Action</th>
              </tr>
              </thead>
              <tbody>
              {tournament?.matches?.filter(i => !i.resolutionDate).map((match: any) => {
                return <tr key={match.id}>
                  <td className="p-4">{match.round}</td>
                  <td className="p-4">{match.players.split(",")[0]}</td>
                  <td className="p-4">{match.players.split(",")[1]}</td>
                  <td className="p-4" >
                    {
                      (resolving === match)
                          ? <>
                            {!!resolvingMatchPlayer}
                            {!resolvingMatchPlayer && <Select className="w-96" options={match.players.split(",").map(a=>({value:a,label:a}))} value={resolvingMatchPlayer} onChange={(newValue)=>setResolvingMatchPlayer(newValue.value)} styles={{
                              menu: (baseStyles, state) => ({
                                color:"black",
                                backgroundColor:"white"
                              }),
                            }}></Select>}
                            {resolvingMatchPlayer && <div>{resolvingMatchPlayer}</div>}
                            {resolvingMatchPlayer && <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" key={1} onClick={()=>sendResolution(match, resolvingMatchPlayer)}>OK</button> }
                            <button className="bg-grey-500 hover:bg-grey-700 text-white font-bold py-2 px-4 rounded" key={2} onClick={()=>setResolving(false)}>CANCEL</button>
                          </>
                          : <div onClick={()=>(setResolving(match),setResolvingMatchPlayer(undefined))}>Resolve</div>
                    }
                  </td>
                </tr>;
              })}

              </tbody>
            </table>
          </section>
          :<section className="text-white pl-10"> - No pendent Matches -</section>
      }



      <div className="text-gray-200 font-bold text-xl pl-8">Resolved Matches</div>
      <section className="p-8">
        <table className="table-auto text-white">
          <thead>
          <tr>
            <th className="p-2">Round</th>
            <th className="p-2">Player&nbsp;&nbsp;</th>
            <th className="p-2">Player</th>
            <th className="p-2">Date</th>
          </tr>
          </thead>
          <tbody>
          {tournament?.matches?.filter(i => i.resolutionDate).sort((a,b)=>b.resolutionDate - a.resolutionDate).map((match: any) => {
            return <tr key={match.id}>
              <td className="p-4">{match.round}</td>
              <td className={match.winnerIndex === 0?"p-4 bg-yellow-100 text-black":"p-4"}>{match.players.split(",")[0]}</td>
              <td className={match.winnerIndex === 1?"p-4 bg-yellow-100 text-black":"p-4"}>{match.players.split(",")[1] || " - none - "}</td>
              <td className="p-4">{new Date(match.resolutionDate).toLocaleDateString()} {new Date(match.resolutionDate).toLocaleTimeString()}</td>
            </tr>;
          })}

          </tbody>
        </table>
      </section>

    </div>
  )
}

export default TournamentDetails;

function getTotalNumberOfRounds (numParticipants:number){return Math.ceil(Math.log2(numParticipants))}