import { Link } from "react-router-dom"


const CreateTournament = () => {
    return (
        <>
        <Link to="/createTournament">
            <button className="px-3 py-1 mr-11 border-2 border-slate-800 bg-gray-200 text-slate-600 font-semibold focus:scale-95 transition duration-200 ease-linear">
                Create tournament
                <span className="border-r-2 border-slate-600"> </span>
                <span className="font-bold text-slate-600 bg-gray-200 px-1 ">
                    +
                </span>
            </button>
        </Link>
        </>
    )
}

export default CreateTournament