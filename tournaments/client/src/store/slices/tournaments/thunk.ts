import axios from "axios";

import { AppThunk } from "../../store";

// import {
//   ActionInterface,
//   TournamentsInterface,
// } from "../../../interfaces/Interfaces";

import { getTournaments, getTournamentById } from "./tournamentsSlice";
import { TournamentsInterface } from "../../../interfaces/Interfaces";

export function getAllTournamentsThunk(): AppThunk {
  return async (dispatch) => {
    try {
      const response = await axios.get("http://localhost:3000/api/tournaments");
      const results = response.data;
      dispatch(getTournaments(results));
      console.log(results);
    } catch (e) {
      console.error(e);
    }
  }
}

export function getTournament(id: string): AppThunk {
  return async (dispatch) => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/tournaments/${id}`
      );
      // let results = response.data.results;
      dispatch(getTournamentById(response.data[0]));
      // console.log(results);
    } catch (e) {
      console.error(e);
    }
  };
}

export const createTournamentThunk = (tournament: Omit<TournamentsInterface, 'id'>) => {
  return async () => {
      try {
          await axios.post("http://localhost:3000/api/tournaments", tournament)
      } catch (e) {
          console.error(e)
      }
  }
}

export const deleteTournamentThunk = (id: string | undefined) => {
  return async () => {
      try {
          if (id !== undefined) {
              await axios.delete(`http://localhost:3000/api/tournaments/${id}`)
          }
      } catch (e) {
          console.error(e)
      }
  }
}












