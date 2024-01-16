import {Router} from "express";
import {readFileSync, existsSync, writeFileSync} from "fs";
import {prisma} from "./db";
const LAST_PLAYED_GAME_ID_FILE = ".last-played-game-id";
let _lastPlayedGameId:number = existsSync(LAST_PLAYED_GAME_ID_FILE)
    ? Number(readFileSync(LAST_PLAYED_GAME_ID_FILE, "utf8"))
    : 0;


require('dotenv').config();
const PLAYED_GAMES_URL = process.env.PLAYED_GAMES_URL;

const router = Router();

export const initPlayedGamesChecker =  () => {
    router.get("/check-tournament-games", async (req, res)=>{
        console.log(req, res);
        const tournamentId:number = Number(req.query.tournamentId);
        const {lastPlayedGameId} = await fetch(`${PLAYED_GAMES_URL}/last-played-game-id`).then(r=>r.json());
        if(_lastPlayedGameId !== lastPlayedGameId){
            const {results} =  await fetch(`${PLAYED_GAMES_URL}/played-games/${_lastPlayedGameId+1}`).then(r=>r.json());
            const tournaments = await prisma.tournaments.findMany({
                where: {
                    finished: false,
                    id:tournamentId
                },
                include: {
                    participants: true,
                    matches: true
                }
            });
            if(!tournaments?.length){
                return res.send({});
            }
            for(let playedGame of results){
                await processPlayedGameAgainstMatches(playedGame, tournaments);
            }
        }
        return res.send({});
    });

    router.get("/check-played-games", async (req, res)=>{
        console.log(req, res)
        const {lastPlayedGameId} = await fetch(`${PLAYED_GAMES_URL}/last-played-game-id`).then(r=>r.json());
        if(_lastPlayedGameId !== lastPlayedGameId){
            const {results} =  await fetch(`${PLAYED_GAMES_URL}/played-games/${_lastPlayedGameId+1}`).then(r=>r.json());
            const tournaments = await prisma.tournaments.findMany({
                where: {finished: false},
                include: {
                    participants: true,
                    matches: true
                }
            });
            for(let playedGame of results){
                await processPlayedGameAgainstMatches(playedGame, tournaments);
            }
        }

        return res.send({});
    });

    return router;

    async function processPlayedGameAgainstMatches(playedGame, tournaments){
        const playedGamePlayers = playedGame.playerUserIds.split(",").map(i=>i.toLowerCase()).sort((a,b)=>a.localeCompare(b));
        console.log(playedGame, tournaments)
        for(let tournament of tournaments){
            for(let match of tournament.matches){
                const matchPlayers = match.players.split(",").map(i=>i.toLowerCase()).sort((a,b)=>a.localeCompare(b));
                if(matchPlayers.toString() === playedGamePlayers.toString()){
                    const winnerIndex = playedGame.leaderboard.toLowerCase() === playedGame.playerUserIds.toLowerCase()
                                ? 0
                                : 1;
                    await prisma.tournamentsMatches.update({
                        where:{id:match.id},
                        data:{
                            winnerIndex,
                            resolutionDate: new Date()
                        }
                    });
                    console.log("FOUND MATCH AND UPDATED", match.tournamentId, match.id);
                }
            }
        }
        _lastPlayedGameId++;
        writeFileSync(LAST_PLAYED_GAME_ID_FILE,  _lastPlayedGameId.toString(), "utf8")
    }
}