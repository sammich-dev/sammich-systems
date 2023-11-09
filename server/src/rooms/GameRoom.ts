// noinspection TypeScriptValidateTypes,JSAnnotator
//TODO REFACTOR messages from Strings to exported enum
import {Client, Room} from "colyseus";
import {GameState, MiniGameResult, PlayerState} from "./GameState";

import { PrismaClient } from '@prisma/client';
import {createScreenRunner} from "../../../lib/game-runner";
import {SammichGame} from "../../../games/sammich-game";
import {createServerSpriteScreen} from "../../../lib/server-sprite-screen";
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

export class GameRoom extends Room<GameState> {
    screenRunners:any[] = [];
    //TODO when creating a game

    onCreate(...args:any[]) {
        this.autoDispose = false;

        this.setState(new GameState());

        this.onMessage("SAVE_FRAMES",(client, {frames, playerIndex, instanceId, seed, gameId})=>{
           const created = prisma.recordedGame.create({
                data: {
                    frames:JSON.stringify(frames),
                    playerIndex,
                    instanceId,
                    seed,
                    gameId
                }
            });
        });

        this.onMessage("INSTRUCTIONS_READY", (client, {playerIndex})=>{
            console.log("INSTRUCTIONS_READY", {playerIndex});
            if(this.state.players[playerIndex].instructionsReady) return;
            this.state.players[playerIndex].instructionsReady = true;
            if(this.state.players.every(i=>i.instructionsReady)){
                this.screenRunners[0] = createScreenRunner({
                    screen: createServerSpriteScreen(this.state.players[0]),
                    timers,
                    GameFactory: SammichGame,
                    playerIndex:0,
                    serverRoom:this,
                    clientRoom:undefined
                });
                this.screenRunners[1] = createScreenRunner({
                    screen: createServerSpriteScreen(this.state.players[1]),
                    timers,
                    GameFactory: SammichGame,
                    playerIndex:1,
                    serverRoom:this,
                    clientRoom:undefined
                });

                this.broadcast("START_GAME", {miniGameId:this.state.miniGameTrack[this.state.currentMiniGameIndex]});
                this.screenRunners.forEach(g => g.runtime.start(false));
            }
        });

        this.onMessage("CREATE_GAME", (client, {user})=>{
            console.log("CREATE_GAME", user);
            if(this.state.players.length) return;

            this.state.players.push(new PlayerState({user, client}));

            //TODO we have to create the screen when we know the minigames, not before
        });

        this.onMessage("JOIN_GAME", (client, {user})=>{
            console.log("JOIN_GAME");
            if(!this.state.players.length || this.state.players.length === 2) return;
            this.state.players.push(new PlayerState({user, client}));
        });

        this.onMessage("PLAYER_FRAME", (client, {playerIndex, n})=>{
            this.screenRunners[playerIndex]?.runtime.getState().running && this.screenRunners[playerIndex]?.runtime.reproduceFramesUntil(n);
        });

        this.onMessage("INPUT_FRAME", (client, {frame, playerIndex})=>{
             this.screenRunners[playerIndex]?.runtime.pushFrame(frame);
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

        if(this.state.miniGameResults[this.state.currentMiniGameIndex]) return;

        this.askedToCheckWinners[playerIndex] = n;
        if(!this.askedToCheckWinners.every(i=>i)){
            return;
        }
        this.askedToCheckWinners[0] = this.askedToCheckWinners[1] = 0;

        //TODO wait until both runners has reached the amount of frames
        const playersScore = this.state.players.map((p:any)=>p.miniGameScore);

        //TODO to check winner, both runners whould have same frames, otherwise, wait until both have.

        const _winnerInfo = this.checkWinnerFunction && this.checkWinnerFunction(...playersScore) || undefined;

        if(_winnerInfo !== undefined){
            console.log("WINNER FOUND", playerIndex, n,
                this.screenRunners[playerIndex?0:1].runtime.getState().lastReproducedFrame,
                this.screenRunners[playerIndex].runtime.getState().lastReproducedFrame
            );

            console.log("PUSH MINIGAME RESULT", _winnerInfo.winnerIndex);
            this.state.miniGameResults.push(_winnerInfo.winnerIndex);
            this.screenRunners.forEach(s=> s.runtime.stop());
            this.screenRunners.forEach(s=> s.runtime.destroy());
            this.screenRunners.splice(0,this.screenRunners.length);
            this.broadcast("MINI_GAME_WINNER", _winnerInfo);
            console.log("wij",_winnerInfo);

            this.state.currentMiniGameIndex++;
            this.state.players.forEach((player:PlayerState) => {
                player.instructionsReady = false;
                player.miniGameScore = 0;
            });
        }

        return _winnerInfo;
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
        this.state.users.push(new PlayerState({user, client}));
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