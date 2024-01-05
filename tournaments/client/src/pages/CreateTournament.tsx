import CreationForm from "../components/CreationForm"
import GoBack from "../components/GoBack"

const CreateTournament = () => {
    return (
        <>
        <div className="flex justify-center">
            <h1 className="felx text-center text-3xl font-semibold text-gray-200 p-4">
                CREATE YOUR TOURNAMENT
            </h1>
            <GoBack />
        </div>
            <section className="flex justify-center text-center items-center mt-6">
                <CreationForm />
            </section>
        </>
    )
}

export default CreateTournament