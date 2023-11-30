export interface ActionInterface {
    type: string
    payload: Record
}

export interface InitialState {
    currentPage: number,
    tournaments: TournamentsInterface[]
    tournamentDetails: TournamentsInterface | Record<string>
}

export interface TournamentsInterface {
  id: number,
  title: string,
  description: string, 
  startDate: any,
  participants: string[]
  matches: string[]
}