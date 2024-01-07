/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ActionInterface {
    type: string
    payload: Record<any, any>
}

export interface InitialState {
    currentPage: number
    tournaments: TournamentsInterface[]
    tournamentDetails: TournamentsInterface | Record<string, any>
    participants: ParticipantInterface[]
    matches: string[]
}

export interface TournamentsInterface {
  id: number
  title?: string
  tournament_title?: string
  tournament_description?: string
  description?: string
  createdBy: any
  startDate: any | undefined
  endDate?: any
  finished: boolean
  participants: any | []
  matches: any
}

export interface ParticipantInterface {
  adress: string
  displayName?: string
  tournamentId?: any
}