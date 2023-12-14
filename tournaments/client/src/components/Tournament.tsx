import { Link } from "react-router-dom"
import { TournamentsInterface } from "../interfaces/Interfaces"


const Tournament = ({
    id,   
    tournament_title,
    startDate,
    participants
  }: TournamentsInterface): JSX.Element => {
    return (
        <tbody key={id}>
            <tr className="border-b border-gray-200">
                <td className="p-3 text-sm text-gray-200 ">{id}</td>
                <td className="p-3 text-sm text-gray-200 ">{tournament_title}</td>
                <td className="p-3 text-sm text-gray-200 ">{participants.length}</td>
                <td className="p-3 text-sm text-gray-200 ">{startDate}</td>
                <td className="p-3 text-sm text-gray-200">Open</td>
                <Link to={`tournamentDetails/${id}`}>
                    <td className="p-3 text-sm text-gray-200 bg-slate-800 border-r border-l border-gray-200 text-center hover:bg-slate-600 hover:cursor-pointer font-semibold">View more details</td>
                </Link>
            </tr>
        </tbody>
    )
}

export default Tournament