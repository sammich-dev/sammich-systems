import Login from "./Login"

const Header = () => {
    return (
        <nav>
            <div className="flex justify-between text-center p-2 px-14">
                <h1 className="text-gray-200 font-bold text-3xl">
                    Tournaments
                </h1>
                <ul className="flex text-gray-200">
                    <li className="">
                       <Login />
                    </li>
                </ul>
            </div>
        </nav>
    )
}

export default Header