import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { matchMaker } from "colyseus"

/**
 * Import your Room files
 */
import {GameRoom} from "./rooms/GameRoom";
import {createRoom, controller} from "@colyseus/core/build/MatchMaker";
import {PrismaClient} from "@prisma/client";
import {Express} from "express";
import {getCatchResponseError} from "./express-util";
import {tryFn} from "../../lib/functional";
const prisma = new PrismaClient();


controller.getCorsHeaders = function(req) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Vary': '*',
        // 'Vary': "<header-name>, <header-name>, ...",
    }
}

export default config({

    initializeGameServer: (gameServer) => {
        console.log("initializeGameServer");
        /**
         * Define your room handlers:
         */
        const room = gameServer.define('GameRoom', GameRoom);
        matchMaker.createRoom("GameRoom", {});
    },

    initializeExpress: (app) => {
        app.get("/colyseus/api/played-games/:from", async (req, res) => {
            tryFn(async ()=>{
                const pageSize = req.query.pageSize || 100;
                const rows = await prisma.playedMatch.findMany({
                    take:Number(pageSize),
                    where:{
                        ID:{gte:Number(req.params.from)}
                    }
                });
                const lastPlayedGameId = (await prisma.playedMatch.findFirst({orderBy:{ID:"desc"}})).ID;
                res.send({
                    results:rows,
                    lastPlayedGameId
                });
            }, getCatchResponseError(res));
        });

        app.get("/colyseus/api/raffle/:from/:to", async (req, res)=>{
            const {from, to} = req.params;
            const fromDate = new Date(from);
            const toDate = new Date(to);
            const tickets = await getRaffleTickets(fromDate,toDate);

            return res.send({
                tickets
            });
        });

        app.get("/colyseus/api/raffle-html/:from/:to", async (req, res)=>{
            const {from, to} = req.params;
            const fromDate = new Date(from);
            const toDate = new Date(to);
            const result = await getRaffleTickets(fromDate,toDate);

            return res.send(Object.keys(result).map(address => {
                return `${address} : ${result[address]}`;
            }).join("<br/>"));
        });

        async function getRaffleTickets(fromDate:Date,toDate:Date){
            const playedGames = await prisma.playedMatch.findMany({
                where:{
                    endDate:{
                        gte:fromDate.getTime(),
                        lte:toDate.getTime()
                    }
                }
            });
            const users = playedGames.reduce((acc:any, current:any)=>{
                const [address1,address2] = current.playerUserIds.split(",");
                const {parcel} = current;

                acc[address1] = acc[address1] || {against:{}, locations:{}, id:address1};
                acc[address1].against[address2] = true;
                acc[address1].locations[parcel] = true;

                acc[address2] = acc[address2] || {against:{}, locations:{}, id:address2};
                acc[address2].against[address1] = true;
                acc[address2].locations[parcel] = true;

                return acc;
            },{});

            const result = Object.values(users).reduce((acc:any, current:any)=>{
                acc[current.id] = Math.min(Object.keys(current.against).length, Object.keys(current.locations).length);
                return acc;
            },{});
            return result;
        }

        app.get("/colyseus/api/last-played-game-id", async (req, res) => {
            const lastPlayedGameId = (await prisma.playedMatch.findFirst({orderBy:{ID:"desc"}})).ID;
            return res.send(lastPlayedGameId)
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)

        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground);
        }         */

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * //TODO Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/colyseus/monitor", monitor());
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
