import { BsArrowRightCircle } from "react-icons/bs";
import { BsArrowLeftCircle } from "react-icons/bs";


interface Props {
    tournamentsPerPage: number;
    tournaments: number;
    currentPage: number;
    paginated: number;
    nextPage: () => void;
    previousPage: () => void;
    thePage: (pageNumber: number) => void;
}

export default function Paginated({
    tournamentsPerPage,
    tournaments,
    paginated,
    nextPage,
    previousPage,
}: Props): JSX.Element {
    const thePages: number[] = [];

    for (let i = 1; i <= Math.ceil(tournaments / tournamentsPerPage); i++) {
        thePages.push(i);
    }


    return (
        <div className="flex justify-center">
            {paginated === 1
                ? <button className="mx-5 p-2 cursor-not-allowed text-gray-900">
                    <BsArrowLeftCircle size={25} />
                </button>
                : <button
                    className="mx-5 p-2 text-gray-200 hover:text-gray-900"
                    disabled={paginated === 1}
                    onClick={() => previousPage()}
                >
                    <BsArrowLeftCircle size={25} />
                </button>
            }
            <div className="text-gray-200 font-bold rounded-3xl p-3 text-center ">
                {paginated}
            </div>
            {paginated === 7
                ? <button className="mx-5 p-2 cursor-not-allowed text-gray-900">
                    <BsArrowRightCircle size={25} />
                </button>
                : <button
                    className="mx-5 p-2 text-gray-200 hover:text-gray-900"
                    disabled={paginated === 7}
                    onClick={() => nextPage()}
                >
                    <BsArrowRightCircle size={25} />
                </button>
            }
        </div>
    );
}
