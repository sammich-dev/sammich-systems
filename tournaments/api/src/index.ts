import express from "express";
import { Request } from "express";
import cors from "cors";


import matchesRoute from "./routes/matches.routes"
import participantsRoute from "./routes/participants.routes"
import tournamentsRoute from "./routes/tournaments.routes"


// Server Port
const PORT = process.env.PORT || 3000

// Express methods
const app = express();

app.use(
        cors({
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
            allowedHeaders: [
                'Origin',
                'X-Requested-With',
                'Content-Type',
                'Accept',
            ],
        })
    )

app.use(express.json())
const frontendFiles = __dirname + '/../../client/dist';
console.log("frontendFiles", frontendFiles);
app.use("/", express.static(frontendFiles));
app.use("/api", matchesRoute);
app.use("/api", participantsRoute);
app.use("/api", tournamentsRoute)

app.listen(PORT)
console.log(`App listening on port ${PORT}`);