// noinspection TypeScriptValidateTypes,JSAnnotator
//TODO REFACTOR messages from Strings to exported enum
import {Client, Room} from "colyseus";
import {GameState, MiniGameResult, PlayerState} from "./GameState";
import { PrismaClient } from '@prisma/client';
import {createScreenRunner} from "../../../lib/game-runner";
import {createServerSpriteScreen} from "../../../lib/server-sprite-screen";
import {getGame, setupGameRepository} from "../../../lib/game-repository";
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
            this.screenRunners[this.currentGameDefinition.split?playerIndex:0]?.runtime.getState().running && this.screenRunners[this.currentGameDefinition.split?playerIndex:0]?.runtime.reproduceFramesUntil(n);
        });

        this.onMessage("INPUT_FRAME", (client, {frame, playerIndex})=>{
            console.log("INPUT_FRAME", playerIndex, frame);
             this.screenRunners[this.currentGameDefinition.split?playerIndex:0]?.runtime.pushFrame(frame);
        });

        this.onMessage("READY", async (client, {playerIndex})=>{
            this.state.players[playerIndex].ready = true;
            console.log("READY", this.state.started)
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

     async checkWinners({playerIndex, n}:{playerIndex:0|1, n:number}){
        console.log("checkWinners",playerIndex, n, this.state.players[0].miniGameScore, this.state.players[1].miniGameScore, this.state.miniGameResults, );
         const GameFactory:any = getGame(this.state.miniGameTrack[this.state.currentMiniGameIndex]);
        if(this.state.miniGameResults[this.state.currentMiniGameIndex]) return;
         console.log("this.askedToCheckWinners",this.askedToCheckWinners);
        this.askedToCheckWinners[playerIndex] = n;
        if(!this.askedToCheckWinners.every(i=>i) && GameFactory.definition.split){ //TODO we should only return if its not sharedScreen
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
        console.log("WINNER FOUND", playerIndex, n,
            _winnerInfo,
            this.screenRunners[playerIndex?0:1]?.runtime.getState().lastReproducedFrame,
            this.screenRunners[playerIndex]?.runtime.getState().lastReproducedFrame
        );

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
                globalWinner = player1GlobalScore>player2GlobalScore?player1GlobalScore:player2GlobalScore
            }
            this.broadcast("MINI_GAME_WINNER", {
                ..._winnerInfo,
                miniGameIndex:this.state.currentMiniGameIndex,
                finalize:globalWinner >= 0,
                miniGameResults:this.state.miniGameResults
            });

            if(globalWinner === -1){
                this.state.currentMiniGameIndex++;
                this.state.players.forEach((player:PlayerState) => {
                    player.instructionsReady = false;
                    player.miniGameScore = 0;
                });
            }else{
                console.log("WAIT SLEEP");
                await sleep(5000);


                //TODO save data in the database about the played game, start-date, end-date, scores, miniGameIds, seed, playerUserIds,
                // other table players with ID, playerUserId, publicKey, displayName
                // other table played_game_player : ID, playedGameID, playerID
                const gameIds = (await prisma.game.findMany()).map(i => i.id);

                const playedMatch = await prisma.playedMatch.create({
                    data: {
                        startDate: this.state.created,
                        endDate: Date.now(),
                        scores: `${player1GlobalScore},${player2GlobalScore}`,
                        miniGameCollection: gameIds.join(","),
                        seed,
                        parcel:"0,0",//TODO
                        playerUserIds:this.state.players.map(p=>p.user.userId).join(","),//TODO
                        playerDisplayNames:this.state.players.map(p=>p.user.displayName).join(","),
                        miniGameIds:this.state.miniGameTrack.join(","),
                        gameInstanceId:null
                        //TODO gameTrackHash: null,
                    }
                });
                console.log("playedMatch",playedMatch)
                const playerIds = await manageGetOrCreateIndexedPlayers(this.state.players);
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
                //TODO manageGetOrCreatePlayers

                console.log("RESET TRACK");
                this.state.resetTrack();
            }
        }

        return _winnerInfo;

        async function manageGetOrCreateIndexedPlayers(players:PlayerState[]){
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