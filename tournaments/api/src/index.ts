import express from "express";
// import { Request } from "express";
import cors from "cors";
import history from "connect-history-api-fallback"

import matchesRoute from "./routes/matches.routes"
import participantsRoute from "./routes/participants.routes"
import tournamentsRoute from "./routes/tournaments.routes"
import {initPlayedGamesChecker} from "./played-games-checker";

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
app.use((req,_,next)=>{
    console.log(new Date().toLocaleTimeString(), req.url);
    next();
})
app.use(express.json());
app.use("/api", matchesRoute);
app.use("/api", participantsRoute);
app.use("/api", tournamentsRoute);
app.use("/api", initPlayedGamesChecker());
app.use(history());
app.use('/', express.static("../client/dist"));
app.listen(PORT);
console.log(`App listening on port ${PORT}`);