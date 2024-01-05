// noinspection TypeScriptValidateTypes,JSAnnotator
//TODO REFACTOR messages from Strings to exported enum
import {Client, Room} from "colyseus";
import {FrameEventSchema, GameState, InputFrameSchema, MiniGameResult, PlayerState} from "./GameState";
import { PrismaClient } from '@prisma/client';
import {createScreenRunner} from "../../../lib/sammich-machine/src/dcl-sprite-screen/game-runner";
import {createServerSpriteScreen} from "../../../lib/server-sprite-screen";
import {getGame, getGameKeys, setupGameRepository} from "../../../lib/game-repository";
import {sleep} from "../../../lib/functional";
import {GAME_STAGE} from "../../../lib/game-stages";
import {waitFor} from "../../../lib/lib-util";

const prisma = new PrismaClient();

(async ()=>{
    console.log("Games:\n", (await prisma.game.findMany()).map((g:any)=>`- ${g.name}`).join("\n"));
})();

const timers = {
    setTimeout,
    setInterval,
    clearInterval,
    clearTimeout
}

setupGameRepository();

const seed = 1;

export class GameRoom extends Room<GameState> {
    screenRunners:any[] = [];
    //TODO when creating a game
    currentGameDefinition:{
        alias:string,
        split:boolean,
        fps:number,
        instructions:string
    };
    onCreate(...args:any[]) {
        console.log("onCreate", args);
        this.checkWinners = this.checkWinners.bind(this);
        this.forceWinner = this.forceWinner.bind(this);
        this.handleWinner = this.handleWinner.bind(this);
        this.getGlobalWinner = this.getGlobalWinner.bind(this);
        this.getPlayerGlobalScore = this.getPlayerGlobalScore.bind(this);
        this.autoDispose = false;

        this.setState(new GameState());

        this.onMessage("INSTRUCTIONS_READY", (client, {playerIndex})=>{

            console.log("INSTRUCTIONS_READY", {playerIndex});
            if(!this.state.players[playerIndex]){
                //TODO
                console.warn("REVIEW WHY THIS CAN HAPPEN", this.state.toJSON());

                return;
            }
            if(this.state?.players[playerIndex]?.instructionsReady) return;

            this.state.players[playerIndex].instructionsReady = true;

            if(this.state.players.length === 2 && this.state.players.every(i=>i.instructionsReady)){
                const GameFactory:any = getGame(this.state.miniGameTrack[this.state.miniGameResults.length]);
                this.currentGameDefinition = GameFactory.definition;

                if(GameFactory.definition.split){
                    this.screenRunners[0] = createScreenRunner({
                        screen: createServerSpriteScreen(this.state.players[0]),
                        seed,
                        timers,
                        GameFactory,
                        playerIndex:0,
                        serverRoom:this,
                        clientRoom:undefined
                    });
                    this.screenRunners[1] = createScreenRunner({
                        screen: createServerSpriteScreen(this.state.players[1]),
                        seed,
                        timers,
                        GameFactory,
                        playerIndex:1,
                        serverRoom:this,
                        clientRoom:undefined
                    });
                } else {
                    this.screenRunners[0] = createScreenRunner({
                        screen: createServerSpriteScreen(this.state.players[0]),
                        seed,
                        timers,
                        GameFactory,
                        playerIndex:0,
                        serverRoom:this,
                        clientRoom:undefined
                    });
                }
                this.state.gameStage = GAME_STAGE.PLAYING_MINIGAME;
                this.screenRunners.forEach(g => g.runtime.start(false));
                this.broadcastPatch();
            }
            if(this.state.players.length !== 2){
                console.log("INSTRUCTIONS_READY bad state", this.state.toJSON());
            }
        });

        this.onMessage("CREATE_GAME", (client, {user})=>{
            console.log("CREATE_GAME", user);
            if(this.state.players.length) return;
            this.state.gameStage = GAME_STAGE.WAITING_PLAYER_JOIN;
            this.state.players.push(new PlayerState({user, client, playerIndex:0}));
            this.broadcastPatch();
        });

        this.onMessage("JOIN_GAME", (client, {user})=>{
            console.log("JOIN_GAME", user);
            if(!this.state.players.length || this.state.players.length === 2) return;
            if(this.state.players[0].user.userId === user.userId) return;
            this.state.gameStage = GAME_STAGE.WAITING_PLAYERS_READY;
            this.state.players.push(new PlayerState({user, client, playerIndex:1}));
            this.broadcastPatch();
            console.log("joined game state", this.state.toJSON())
        });

        this.onMessage("PLAYER_FRAME", async (client, {playerIndex, n})=>{
            await waitFor(()=>this.currentGameDefinition);//TODO review if still necessary
            const screenRunnerIndex =this.currentGameDefinition?.split?playerIndex:0;

            this.screenRunners[
                screenRunnerIndex
            ]?.runtime.getState().running
            && await this.screenRunners[
                screenRunnerIndex
            ]?.runtime.reproduceFramesUntil(n);
            this.broadcastPatch();
        });

        this.onMessage("INPUT_FRAME", (client, {frame, playerIndex})=>{
            if(!this.currentGameDefinition.split) this.broadcast("INPUT_FRAME", {frame, playerIndex})

            this.screenRunners[this.currentGameDefinition.split?playerIndex:0]?.runtime.pushFrame(frame);
            console.log("INPUT_FRAME previous state",this.state?.toJSON())

            this.state.screenFrames[this.currentGameDefinition.split?playerIndex:0].frames.push(new InputFrameSchema(frame));

            this.broadcastPatch();
        });

        this.onMessage("READY", async (client, {playerIndex})=>{
            console.log("READY", playerIndex);
            if(this.state.players[playerIndex].ready) return;
            this.state.players[playerIndex].ready = true;
            console.log("READY state", this.state.toJSON());
            if(
                inStage(GAME_STAGE.WAITING_PLAYERS_READY)
                && this.state.players.every((player)=>player.ready)
            ){
                await sleep(300);
                await this.state.setupNewTrack();//SHOWING_INSTRUCTIONS
                console.log("this.tate.gameStage", this.state.gameStage, this.state.toJSON())
                this.broadcastPatch();
            }
        });

        const inStage = (STATE:GAME_STAGE)=>this.state.gameStage === STATE;
    }
    patches:number = 0;

    checkWinnerFunction:Function;
    askedToCheckWinners = [0,0];

    async tieBreaker({winnerIndex}:{winnerIndex:number}){
        console.log("TIE_BREAKER", winnerIndex, this.state.miniGameResults.length);
        this.state.gameStage = GAME_STAGE.TIE_BREAKER;
        //TODO we are defining the winner before ending the minigame, can be confusing, maybe better create another state.tieBreakerWinner
        this.state.tieBreakerWinner = winnerIndex;
        this.screenRunners.forEach(r=>r.runtime.setState({tieBreaker:true}));
        this.broadcastPatch();
        await sleep(7 * 5 * 7 * (1000/60) + 2000 + 500);//coin animation: delay_frames * num_delays * rounds + pl2HalfSecond
        this.forceWinner({winnerIndex});
    }

    async forceWinner({winnerIndex}:{winnerIndex:number}){
        const GameFactory:any = getGame(this.state.miniGameTrack[this.state.miniGameResults.length]);
        console.log("forceWinner", GameFactory.definition.alias);
        if(GameFactory.definition.split){
            console.log("split, cjecking lastReproducedFrame")
            if(this.screenRunners[0].runtime.getState().lastReproducedFrame > this.screenRunners[1].runtime.getState().lastReproducedFrame){
                console.log("lastReproducedFrame 0 > 1", this.screenRunners[1].runtime.getState().lastReproducedFrame);
                this.screenRunners[1].runtime.reproduceFramesUntil(this.screenRunners[0].runtime.getState().lastReproducedFrame);
            }
            console.log("miniGameScoreB", this.state.players.map((p:any)=>p.miniGameScore));
            if(this.screenRunners[1].runtime.getState().lastReproducedFrame > this.screenRunners[0].runtime.getState().lastReproducedFrame){
                console.log("lastReproducedFrame 1 > 0", this.screenRunners[0].runtime.getState().lastReproducedFrame);
                this.screenRunners[0].runtime.reproduceFramesUntil(this.screenRunners[1].runtime.getState().lastReproducedFrame);
            }
        }
        this.askedToCheckWinners[0] = this.askedToCheckWinners[1] = 0;
        await this.handleWinner({winnerIndex});
    }

    async handleWinner({winnerIndex}:{winnerIndex:number}){
        console.log("handleWinner",winnerIndex)
        const _winnerInfo = {winnerIndex};

        if(_winnerInfo !== undefined){
            console.log("PUSH MINIGAME RESULT", _winnerInfo.winnerIndex);

            this.state.miniGameResults.push(_winnerInfo.winnerIndex);
            this.screenRunners.forEach(s=> s?.runtime.stop());
            this.screenRunners.forEach(s=> s?.runtime.destroy());
            this.screenRunners.splice(0,this.screenRunners.length);

            console.log("wij",_winnerInfo);

            console.log("miniGameScore",  this.state.players.map((p:any)=>p.miniGameScore).join("-"));

            //TODO if 1 player has >= 3 globalScore and the other has less score, end game
            const globalWinner = this.getGlobalWinner();
            console.log("SHOW SCORE TRANSITION");
            this.state.gameStage = GAME_STAGE.SHOWING_SCORE_TRANSITION;
            this.broadcastPatch();
            await sleep(1000 + 1000 + 2000);

            this.state.players.forEach((player:PlayerState) => {
                player.instructionsReady = false;
                player.miniGameScore = 0;
            });

            if(globalWinner >= 0){
                this.state.gameStage = GAME_STAGE.SHOWING_END;
                this.broadcastPatch();
                await sleep(5000);
                const gameIds = getGameKeys();//TODO this should be collected at start of the game, not at the end just in case new are added
                const playedMatch = await prisma.playedMatch.create({
                    data: {
                        startDate: this.state.created,
                        endDate: Date.now(),
                        miniGameCollection: gameIds.join(","),
                        //TODO gameTrackHash: null, //TODO: a hash of the mini-games and their versions
                        seed,
                        parcel:"0,0",//TODO
                        miniGameIds:this.state.miniGameTrack.join(","),
                        gameInstanceId:null,
                        playerUserIds:this.state.players.map(p=>p.user.userId).join(","),//TODO
                        playerDisplayNames:this.state.players.map(p=>p.user.displayName).join(","),
                        scores: `${this.getPlayerGlobalScore(0)},${this.getPlayerGlobalScore(1)}`,
                        leaderboard:[globalWinner, globalWinner===0?1:0 ].map(i=>this.state.players[i].user.userId).join(",")
                    }
                });
                console.log("playedMatch",playedMatch)
                const playerIds = await this.manageGetOrCreateIndexedPlayers(this.state.players);
                console.log("playerIds", playerIds);
                for(let playerId of playerIds){
                    const playerMatchPlayer = await prisma.playedMatchPlayer.create({
                        data:{
                            playedMatchId:playedMatch.ID,
                            playerId
                        }
                    });
                    console.log("created playerMatchPlayer", playerMatchPlayer)
                }
                this.state.resetTrack();
            }else{
                this.state.gameStage = GAME_STAGE.SHOWING_INSTRUCTIONS;
            }
            this.broadcastPatch();
        }
    }

    async checkWinners({playerIndex, n}:{playerIndex:0|1, n:number}){
        const anyOfChecksDueTime = () => this.askedToCheckWinners.some(i=> i + 60 < n );
        console.log("checkWinners",playerIndex, n, this.state.players[0].miniGameScore, this.state.players[1].miniGameScore, this.state.miniGameResults, );
         const GameFactory:any = getGame(this.state.miniGameTrack[this.state.miniGameResults.length]);
        if(this.state.miniGameResults[this.state.miniGameResults.length]) return;
         console.log("this.askedToCheckWinners",this.askedToCheckWinners);
        this.askedToCheckWinners[playerIndex] = this.askedToCheckWinners[playerIndex] || n;

        if(!this.askedToCheckWinners.every(i=>i) && GameFactory.definition.split && !(anyOfChecksDueTime())){
            return;
        }
         console.log("miniGameScoreA", this.state.players.map((p:any)=>p.miniGameScore));
        if(GameFactory.definition.split){
            if(this.screenRunners[0].runtime.getState().lastReproducedFrame > this.screenRunners[1].runtime.getState().lastReproducedFrame){
                console.log("lastReproducedFrame 0 > 1", this.screenRunners[1].runtime.getState().lastReproducedFrame);
                this.screenRunners[1].runtime.reproduceFramesUntil(this.screenRunners[0].runtime.getState().lastReproducedFrame);
            }
            console.log("miniGameScoreB", this.state.players.map((p:any)=>p.miniGameScore));
            if(this.screenRunners[1].runtime.getState().lastReproducedFrame > this.screenRunners[0].runtime.getState().lastReproducedFrame){
                console.log("lastReproducedFrame 1 > 0", this.screenRunners[0].runtime.getState().lastReproducedFrame);
                this.screenRunners[0].runtime.reproduceFramesUntil(this.screenRunners[1].runtime.getState().lastReproducedFrame);
            }
        }

        this.askedToCheckWinners[0] = this.askedToCheckWinners[1] = 0;

        //TODO wait until both runners has reached the amount of frames
        const playersScore = this.state.players.map((p:any)=>p.miniGameScore);

        console.log("miniGameScoreC", this.state.players.map((p:any)=>p.miniGameScore));
        //TODO to check winner, both runners whould have same frames, otherwise, wait until both have.

        const _winnerInfo = this.checkWinnerFunction && this.checkWinnerFunction(...playersScore) || undefined;
        if(_winnerInfo){
            return await this.handleWinner(_winnerInfo);
        }
    }

    async manageGetOrCreateIndexedPlayers(players:PlayerState[]){
        let playerIds = [];
        for(let player of players){
            const {user} = player;
            const {displayName, publicKey, hasConnectedWeb3, userId, version} = user;
            const foundPlayer = await prisma.user.findFirst({where:{userId}});
            console.log("foundPlayer",foundPlayer)
            if(foundPlayer){
                playerIds.push(foundPlayer.id)
            }else{
                const created = await prisma.user.create({
                    data: {
                        displayName,
                        publicKey,
                        hasConnectedWeb3,
                        userId,
                        version
                    }
                });
                console.log("player created",created)
                playerIds.push(created.id);
            }
        }

        return playerIds;
    }

    getPlayerGlobalScore(playerIndex:number){
        return this.state.miniGameResults
            .reduce((acc, current)=>current === playerIndex ? (acc+1):acc,0)
    }

    getGlobalWinner(){
        const player1GlobalScore = this.getPlayerGlobalScore(0);
        const player2GlobalScore = this.getPlayerGlobalScore(1);
        if(
            ((player1GlobalScore >= 3 || player2GlobalScore >= 3) && player1GlobalScore !== player2GlobalScore)
            || this.state.miniGameResults.length === 5
        ){
            return player1GlobalScore > player2GlobalScore ? 0 : 1
        }
        return -1;
    }

    setWinnerFn(fn:Function){
        console.log("setWinnerFn", !!fn);
        this.checkWinnerFunction = fn;
        return ():any => this.checkWinnerFunction = null;
    }

    onJoin(client: Client, {user}:any) {
        //TODO if there is already an item in players or users with same userId, remove them
        const foundUserIndex = this.state.users.findIndex((p:PlayerState)=>p.user.userId === user.userId);
        const foundPlayerIndex = this.state.players.findIndex((p:PlayerState)=>p.user.userId === user.userId);
        if(foundUserIndex >= 0) console.log("foundUserIndex",foundUserIndex);
        if(foundPlayerIndex >= 0) console.log("foundPlayerIndex", foundPlayerIndex);
        if(foundUserIndex >= 0) this.state.users.splice(foundUserIndex,1);
        if(foundPlayerIndex >= 0) this.resetGame();
        if(this.state.players.length === 1 && this.state.gameStage !== GAME_STAGE.WAITING_PLAYER_JOIN){
            this.resetGame();
        }
        if(this.state.players.length === 0 && this.state.gameStage !== GAME_STAGE.IDLE){
            this.resetGame();
        }
        console.log("onJoin", user);
        console.log("onJoin state", this.state.toJSON());
        this.state.users.push(new PlayerState({user, client, playerIndex:-1}));
        this.broadcastPatch();
        //TODO only when it's player, not when it's user
    }

    async onLeave(client: Client, consented:boolean) {
        try {
            //if gameStage is waiting to join, and one of the players is the client, cancel and reset
            if(this.state.gameStage === GAME_STAGE.WAITING_PLAYER_JOIN && this.state.players.find(p=>p.client === client)){
                this.resetGame();
            }
            if (consented) {
                throw new Error("consented leave");
            }

            // allow disconnected client to reconnect into this room until 20 seconds
            //TODO review if after reconnection, it needs to change maps of clients/sessionId on any PlayerState

            await this.allowReconnection(client, 10);//TODO or until game finishes if it's a participant to also allow one player to win

            console.log("allowed reconnection", client.id);
        } catch (e) {
            console.log("catching onLeave", consented)
            const foundUserIndex = this.state.users.findIndex(p=>p.client === client);
            const foundPlayerIndex = this.state.players.findIndex(p=>p.client === client);
            console.log("onLeave foundUserIndex:", foundUserIndex,"  foundPlayerIndex:", foundPlayerIndex);

            if(foundUserIndex >= 0){
                console.log("user leaving displayName", this.state.users[foundUserIndex].user.displayName)
                this.state.users.splice(foundUserIndex, 1);
            }
            if(foundPlayerIndex >= 0){
                //TODO when a player leaves, if connected player was winning, he should win the track
                this.resetGame();
            }

        }
        this.broadcastPatch();
        console.log("onLeave state", this.state.toJSON());
    }

    resetGame(){
        this.state.players.splice(0, this.state.players.length);
        console.log("resetGame")
        this.screenRunners[0]?.runtime?.destroy();
        this.screenRunners[1]?.runtime?.destroy();
        this.state.gameStage = GAME_STAGE.IDLE;
        this.state.resetTrack();
    }

    onDispose(): void | Promise<any> {
        this.clients.forEach(c=>c.leave())
        console.log("DISPOSE");
        process.exit(0);
    }
}