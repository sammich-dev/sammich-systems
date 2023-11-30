import { createSlice } from "@reduxjs/toolkit";
import { InitialState } from "../../../interfaces/Interfaces";

const initialState: InitialState = {
  currentPage: 1,
  tournaments: [],
  tournamentDetails: {}
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
  },
});

export const {
  getTournaments,
  getTournamentById,
} = tournamentsSlice.actions;

export default tournamentsSlice.reducer;
