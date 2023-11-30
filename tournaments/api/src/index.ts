import express from "express";
import { Request } from "express";
import cors from "cors";


import matchesRoute from "./routes/matches.routes"
import participantsRoute from "./routes/participants.routes"
import tournamentsRoute from "./routes/tournaments.routes"


// Server Port
const PORT = 3000

// Express methods
const app = express();
app.use(cors<Request>());
app.use(express.json())

app.use("/api", matchesRoute);
app.use("/api", participantsRoute);
app.use("/api", tournamentsRoute)

app.listen(PORT)
console.log(`App listening on port ${PORT}`);