// noinspection TypeScriptValidateTypes,JSAnnotator
//TODO REFACTOR messages from Strings to exported enum
import {Client, Room} from "colyseus";
import {GameState, MiniGameResult, PlayerState} from "./GameState";

import { PrismaClient } from '@prisma/client';
import {createScreenRunner} from "../../../lib/game-runner";
import {SammichGame} from "../../../games/sammich-game";
import {createServerSpriteScreen} from "../../../lib/server-sprite-screen";

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
            this.state.players[playerIndex].instructionsReady = true;
            if(this.state.players.every(i=>i.instructionsReady)){
                this.broadcast("START_GAME", {miniGameId:this.state.miniGameTrack[this.state.currentMiniGameIndex]});
            }
        });

        this.onMessage("CREATE_GAME", (client, {user})=>{
            if(this.state.players.length) return;

            this.state.players.push(new PlayerState({user, client}));

            //TODO we have to create the screen when we know the minigames, not before
            this.screenRunners[0] = createScreenRunner({
                screen: createServerSpriteScreen(this.state.players[0]),
                timers,
                GameFactory: SammichGame,
                playerIndex:0,
                serverRoom:this,
                clientRoom:undefined
            });
        });
        this.onMessage("JOIN_GAME", (client, {user})=>{
            if(!this.state.players.length || this.state.players.length === 2) return;
            this.state.players.push(new PlayerState({user, client}));

            this.screenRunners[1] = createScreenRunner({
                screen: createServerSpriteScreen(this.state.players[1]),
                timers,
                GameFactory: SammichGame,
                playerIndex:1,
                serverRoom:this,
                clientRoom:undefined
            });
        });
        this.onMessage("PLAYER_FRAME", (client, {playerIndex, n})=>{
            this.screenRunners[playerIndex]?.runtime.reproduceFramesUntil(n);
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

                this.screenRunners.forEach(g => g.runtime.start(false));
            }
        });
    }

    checkWinnerFunction:Function;

    checkWinners(){
        if(this.state.miniGameResults[this.state.currentMiniGameIndex]) return;
        const playersScore = this.state.players.map((p:any)=>p.miniGameScore);
        const _winnerInfo = this.checkWinnerFunction(...playersScore);

        if(_winnerInfo !== undefined){
            console.log("WINNER FOUND", _winnerInfo);
            this.state.miniGameResults.push(_winnerInfo as MiniGameResult);
            this.screenRunners.forEach(s=> s.runtime.destroy());
            this.screenRunners.splice(0,this.screenRunners.length);
            this.broadcast("MINI_GAME_WINNER", _winnerInfo);
        }

        return _winnerInfo;
    }
    setWinnerFn(fn:Function){
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