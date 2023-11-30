import GoToCreateTournamentBtn from "../components/GoToCreateTournamentBtn"
import Header from "../components/Header"
import TournamentsTable from "../components/TournamentsTable"


const Home = () => {
  return (
    <>
    <header>
        <Header />
      </header>
      <main>
        <section className="flex justify-end p-6">
          <GoToCreateTournamentBtn />
        </section>
        <article>
          <TournamentsTable />
        </article>
      </main>
    </>
  )
}

export default Home