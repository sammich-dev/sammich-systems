import { Link } from "react-router-dom"
import { TournamentsInterface } from "../interfaces/Interfaces"


const Tournament = ({
    id,   
    tournament_title,
    startDate,
    participants,
    finished
  }: TournamentsInterface): JSX.Element => {
    return (
        <tbody key={id}>
            <tr className="border-b border-gray-200">
                <td className="p-3 text-sm text-gray-200 ">{id}</td>
                <td className="p-3 text-sm text-gray-200 ">{tournament_title}</td>
                <td className="p-3 text-sm text-gray-200 ">{participants.length}</td>
                <td className="p-3 text-sm text-gray-200 ">{startDate.slice(0,10)}</td>
                {finished ? <td className="p-3 text-sm text-red-500">Finished</td> : <td className="p-3 text-sm text-lime-500">Open</td>}
                <Link to={`tournament-details/${id}`}>
                    <button className="p-3 text-sm w-full text-lime-500 bg-slate-800 border-r border-l border-slate-800 text-center font-semibold hover:bg-slate-600 hover:cursor-pointer hover:text-lime-300 transition ease-in-out duration-300">
                        More details
                        </button>
                </Link>
            </tr>
        </tbody>
    )
}

export default Tournament