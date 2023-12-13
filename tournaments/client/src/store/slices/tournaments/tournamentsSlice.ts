import { createSlice } from "@reduxjs/toolkit";
import { InitialState } from "../../../interfaces/Interfaces";

const initialState: InitialState = {
  currentPage: 1,
  tournaments: [],
  tournamentDetails: {},
  participants: [],
  matches: [],
};

const tournamentsSlice = createSlice({
  name: "tournaments",
  initialState,
  reducers: {
    getTournaments: (state, action) => {
      state.tournaments = action.payload;
    },
    getTournamentById: (state, action) => {
      state.tournamentDetails = action.payload;
    },
    getParticipants: (state, action) => {
      state.participants = action.payload;
    },
    getParticipantById: (state, action) => {
      state.tournamentDetails = action.payload;
    },
    clearDetails: (state) => {
      state.tournamentDetails = {};
    },
  },
});

export const {
  getTournaments,
  getTournamentById,
  clearDetails,
  getParticipants,
  getParticipantById
} = tournamentsSlice.actions;

export default tournamentsSlice.reducer;
