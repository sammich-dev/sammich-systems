/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";

import { AppDispatch, RootState } from "../store/store";
import { getTournament } from "../store/slices/tournaments/thunk";
import { clearDetails } from "../store/slices/tournaments/tournamentsSlice"

//import { TournamentsInterface } from "../interfaces/Interfaces";
import GoBack from "../components/GoBack";


const TournamentDetails: React.FC = () => {

  const dispatch: AppDispatch = useDispatch();
  const { id } = useParams();

  const tournaments: any = useSelector(
    (state: RootState) => state.tournaments.tournamentDetails
  );

  useEffect(() => {
    dispatch(getTournament(id as string));

    return () => {
      dispatch(clearDetails());
    };
  }, [dispatch, id]);

  const mitad = Math.floor(tournaments.participants?.length / 2);
  const players1 = tournaments.participants?.slice(mitad)
  const players2 = tournaments.participants?.slice(mitad, tournaments.participants?.length)

  return (
    <div key={id}>
      <div className="flex justify-center">
        <h1 className="felx text-center text-3xl font-semibold text-gray-200 p-4">
          Tournament details
        </h1>
        <GoBack />
      </div>
      <h3 className="text-gray-200 font-medium text-lg p-8">Tournament created by: <span className="font-normal text-lime-300">{tournaments.createdBy}</span></h3>
      <div className="text-gray-200 font-medium text-lg p-8">
        <p className="text-gray-200">{tournaments.description}</p>
      </div>
      <h3 className="text-gray-200 font-bold text-xl p-8">Pendent Matches</h3>
      <div className="flex p-4">
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 1</h5>
          {

            tournaments ? players1?.map((t:any, i:any) =>
              <aside key={ i } className="w-full p-2 text-center font-medium">{t.displayName} </aside>)
              : null

          }
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 2</h5>
          {

            tournaments ? players2?.map((t:any, i:any) =>
              <aside key={ i } className="w-full p-2 text-center font-medium">{t.displayName} </aside>)
              : null

          }
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Open Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments.startDate} </aside>
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">End Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments.endDate} </aside>
        </section>
      </div>
      <h3 className="text-gray-200 font-bold text-xl p-8">Resolved Matches</h3>
      <div className="flex p-4">
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 1</h5>
          {

            tournaments ? players1?.map((t:any, i:any) =>
              <aside key={ i } className="w-full p-2 text-center font-medium">{t.displayName} </aside>)
              : null

          }
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Player 2</h5>
          {

            tournaments ? players2?.map((t:any, i:any) =>
              <aside key={ i } className="w-full p-2 text-center font-medium">{t.displayName} </aside>)
              : null

          }
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Open Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments.startDate} </aside>
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">End Date</h5>
          <aside className="w-full p-2 text-center font-medium">{tournaments.endDate} </aside>
        </section>
        <section className="w-[20%]">
          <h5 className="text-center font-medium text-lg p-4 border border-gray-400">Score Results</h5>
          <aside className="w-full p-2 text-center font-medium"> 20 - 20 </aside>
        </section>
      </div>
    </div>
  )
}

export default TournamentDetails;
