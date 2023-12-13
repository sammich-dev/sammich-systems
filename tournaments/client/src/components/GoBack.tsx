import { Link } from "react-router-dom"
import { MdArrowBack } from "react-icons/md";



const GoBack = () => {
    return (
        <>
            <Link to="/Home">
                <div className="absolute left-0 top-0 p-5 font-bold text-gray-200">
                <MdArrowBack size={35}/>
                </div>
            </Link>
        </>
    )
}

export default GoBack