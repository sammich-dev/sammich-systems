// noinspection TypeScriptValidateTypes,JSAnnotator
//TODO REFACTOR messages from Strings to exported enum
import {Client, Room} from "colyseus";
import {GameState, MiniGameResult, PlayerState} from "./GameState";
import { PrismaClient } from '@prisma/client';
import {createScreenRunner} from "../../../lib/game-runner";
import {createServerSpriteScreen} from "../../../lib/server-sprite-screen";
import {getGame, getGameKeys, setupGameRepository} from "../../../lib/game-repository";
import {sleep} from "../../../lib/functional";

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
        this.checkWinners = this.checkWinners.bind(this);
        this.forceWinner = this.forceWinner.bind(this);
        this.handleWinner = this.handleWinner.bind(this);
        this.autoDispose = false;

        this.setState(new GameState());

        this.onMessage("INSTRUCTIONS_READY", (client, {playerIndex})=>{
            console.log("INSTRUCTIONS_READY", {playerIndex});
            if(this.state.players[playerIndex].instructionsReady) return;
            this.state.players[playerIndex].instructionsReady = true;
            if(this.state.players.every(i=>i.instructionsReady)){
                const GameFactory:any = getGame(this.state.miniGameTrack[this.state.currentMiniGameIndex]);
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
                console.log("START_GAME", this.state.currentMiniGameIndex)
                this.broadcast("START_GAME", {miniGameId:this.state.miniGameTrack[this.state.currentMiniGameIndex]});
                this.screenRunners.forEach(g => g.runtime.start(false));
            }
        });

        this.onMessage("CREATE_GAME", (client, {user})=>{
            console.log("CREATE_GAME", user);
            if(this.state.players.length) return;

            this.state.players.push(new PlayerState({user, client, playerIndex:0}));
            //TODO we have to create the screen when we know the minigames, not before
        });

        this.onMessage("JOIN_GAME", (client, {user})=>{
            console.log("JOIN_GAME");
            if(!this.state.players.length || this.state.players.length === 2) return;
            this.state.players.push(new PlayerState({user, client, playerIndex:1}));
        });

        this.onMessage("PLAYER_FRAME", (client, {playerIndex, n})=>{
            const screenRunnerIndex =this.currentGameDefinition.split?playerIndex:0;

            this.screenRunners[
                screenRunnerIndex
            ]?.runtime.getState().running
            && this.screenRunners[
                screenRunnerIndex
            ]?.runtime.reproduceFramesUntil(n);
        });

        this.onMessage("INPUT_FRAME", (client, {frame, playerIndex})=>{
            if(!this.currentGameDefinition.split) this.broadcast("INPUT_FRAME", {frame, playerIndex})
            console.log("INPUT_FRAME", playerIndex, frame);
            this.screenRunners[this.currentGameDefinition.split?playerIndex:0]?.runtime.pushFrame(frame);
        });

        this.onMessage("READY", async (client, {playerIndex})=>{
            if(this.state.players[playerIndex].ready) return;
            this.state.players[playerIndex].ready = true;
            console.log("READY", playerIndex, this.state.started)
            if(!this.state.started && this.state.players.every((player)=>player.ready)){
                await this.state.setupNewGame();
                console.log("broadcast gameTrack")
                this.broadcast("MINI_GAME_TRACK", this.state.miniGameTrack.toJSON());
              //  this.broadcast("START_GAME", {miniGameId:this.state.miniGameTrack[this.state.miniGameResults.length]});
            }
        });
    }


    checkWinnerFunction:Function;
    askedToCheckWinners = [0,0];

    async tieBreaker({winnerIndex}:{winnerIndex:number}){
        console.log("TIE_BREAKER", winnerIndex, this.state.currentMiniGameIndex);
        this.screenRunners.forEach(r=>r.runtime.setState({tieBreaker:true}));
        this.broadcast("TIE_BREAKER", {winnerIndex});

        await sleep(7 * 5 * 7 * (1000/60) + 2000);//delay_frames * num_delays * rounds
        this.forceWinner({winnerIndex});
    }

    async forceWinner({winnerIndex}:{winnerIndex:number}){
        console.log("forceWinner")
        if(this.state.miniGameResults[this.state.currentMiniGameIndex]) return;
        const GameFactory:any = getGame(this.state.miniGameTrack[this.state.currentMiniGameIndex]);
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
        await this.handleWinner({winnerIndex});
    }

    async handleWinner({winnerIndex}:{winnerIndex:number}){
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
            const player1GlobalScore = this.getPlayerGlobalScore(0);
            const player2GlobalScore = this.getPlayerGlobalScore(1);
            let globalWinner = -1;
            if(
                ((player1GlobalScore >= 3 || player2GlobalScore >= 3) && player1GlobalScore !== player2GlobalScore)
                || this.state.currentMiniGameIndex === 4
            ){
                globalWinner = player1GlobalScore>player2GlobalScore?0:1
            }
            this.broadcast("MINI_GAME_WINNER", {
                ..._winnerInfo,
                miniGameIndex:this.state.currentMiniGameIndex,
                finalize:globalWinner >= 0,
                miniGameResults:this.state.miniGameResults
            });
            this.state.players.forEach((player:PlayerState) => {
                player.instructionsReady = false;
                player.miniGameScore = 0;
            });

            if(globalWinner === -1){
                this.state.currentMiniGameIndex++;
            }else{
                console.log("WAIT SLEEP");
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
                        scores: `${player1GlobalScore},${player2GlobalScore}`,
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

                console.log("RESET TRACK");
                this.state.resetTrack();
            }
        }
    }

    async checkWinners({playerIndex, n}:{playerIndex:0|1, n:number}){
        console.log("checkWinners",playerIndex, n, this.state.players[0].miniGameScore, this.state.players[1].miniGameScore, this.state.miniGameResults, );
         const GameFactory:any = getGame(this.state.miniGameTrack[this.state.currentMiniGameIndex]);
        if(this.state.miniGameResults[this.state.currentMiniGameIndex]) return;
         console.log("this.askedToCheckWinners",this.askedToCheckWinners);
        this.askedToCheckWinners[playerIndex] = n;

        if(!this.askedToCheckWinners.every(i=>i) && GameFactory.definition.split){ //TODO we should only return if its not sharedScreen
            //TODO if other player doesnt make any input, and we checkWinners on input, this never won't happen
                //TODO ... we should wait both players to ask winners infinite, we should set a delay to ask
                //TODO ... maybe just send a WS message to ask for winner
            return;
        }
        //TODO reproduce
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

    setWinnerFn(fn:Function){
        console.log("setWinnerFn", !!fn);
        this.checkWinnerFunction = fn;
        return ():any => this.checkWinnerFunction = null;
    }

    prepareNextMinigame(){

    }

    onJoin(client: Client, {user}:any) {
        console.log("onJoin", user)
        this.state.users.push(new PlayerState({user, client, playerIndex:-1}));
        //TODO only when it's player, not when it's user
    }

    onLeave(client: Client) {
        const foundUserIndex = this.state.users.findIndex(p=>p.client === client);
        const foundPlayerIndex = this.state.players.findIndex(p=>p.client === client);
        console.log("onLeave", foundUserIndex);
        foundUserIndex !== -1 && this.state.users.splice(foundUserIndex, 1);
        foundPlayerIndex !== -1 && this.state.players.splice(foundPlayerIndex, 1);
        this.screenRunners[foundPlayerIndex]?.runtime?.destroy();
        if(!this.state.players.length){
            this.state.started = false;
        }
    }

    onDispose(): void | Promise<any> {
        console.log("DISPOSE");
    }
}