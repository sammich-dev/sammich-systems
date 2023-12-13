/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ActionInterface {
    type: string
    payload: Record
}

export interface InitialState {
    currentPage: number
    tournaments: TournamentsInterface[]
    tournamentDetails: TournamentsInterface | Record<string>
    participants: ParticipantInterface[]
    matches: string[]
}

export interface TournamentsInterface {
  id: number
  title: string
  description?: string
  createdBy: string
  startDate: any
  endDate: any
  participants: any
  matches: any
}

export interface ParticipantInterface {
  adress: string
  displayName?: string
  tournamentId?: any
}