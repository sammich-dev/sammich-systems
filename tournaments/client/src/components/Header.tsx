
const Header = () => {
    return (
        <nav>
            <div className="flex justify-between text-center p-6">
                <h1 className="text-gray-200 font-bold text-3xl">
                    Tournaments
                </h1>
                <ul className="flex text-gray-200">
                    <li>
                        <button>
                            USER
                        </button>
                    </li>
                </ul>
            </div>
        </nav>
    )
}

export default Header