import axios from "axios";

import { AppThunk } from "../../store";

// import {
//   ActionInterface,
//   TournamentsInterface,
// } from "../../../interfaces/Interfaces";

import { getTournaments, getTournamentById } from "./tournamentsSlice";
import { ParticipantInterface, TournamentsInterface } from "../../../interfaces/Interfaces";

export function getAllTournamentsThunk(): AppThunk {
  return async (dispatch) => {
    try {
      const response = await axios.get("/api/tournaments"); // quitar el local host
      const results = response.data;
      dispatch(getTournaments(results));
      // console.log(results);
    } catch (e) {
      console.error(e);
    }
  }
}

export function getTournament(id: string): AppThunk {
  return async (dispatch) => {
    try {
      const response = await axios.get(
        `/api/tournament/${id}`
      );
      // const results = response.data;
      // console.log(results);
      dispatch(getTournamentById(response.data));
    } catch (e) {
      console.error(e);
    }
  };
}

export const createTournamentThunk = (tournament: Omit<TournamentsInterface, 'id'>) => {
  return async () => {
      try {
          await axios.post("/api/tournament", tournament)
      } catch (e) {
          console.error(e)
      }
  }
}

export function getParticipants(): AppThunk {
  return async (dispatch) => {
    try {
      const response = await axios.get("/api/participants");
      const results = response.data;
      dispatch(getTournaments(results));
      // console.log(results);
    } catch (e) {
      console.error(e);
    }
  }
}

export const createParticipantThunk = (participant:Omit<ParticipantInterface, 'id'>) => {
  return async () => {
      try {
          await axios.post("/api/participant", participant)
      } catch (e) {
          console.error(e)
      }
  }
}

export const deleteParticipantThunk = (id: string | undefined) => {
  return async () => {
    try {
        if (id !== undefined) {
            await axios.delete(`/api/participant/${id}`)
        }
    } catch (e) {
        console.error(e)
    }
}
}

export const deleteTournamentThunk = (id: number | undefined) => {
  return async () => {
      try {
          if (id !== undefined) {
              await axios.delete(`/api/tournament/${id}`)
          }
      } catch (e) {
          console.error(e)
      }
  }
}












