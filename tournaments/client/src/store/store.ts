import { configureStore } from "@reduxjs/toolkit";
import type { Action, ThunkAction } from "@reduxjs/toolkit";
import tournamentsSlice from "./slices/tournaments/tournamentsSlice"

export const store = configureStore({
  reducer: {
    tournaments: tournamentsSlice,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    immutableCheck: false,
    serializableCheck: false,
  })
});
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType,RootState,unknown,Action<string>
>;