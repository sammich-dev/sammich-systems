// noinspection JSAnnotator

import { Schema, Context, ArraySchema, MapSchema, type } from "@colyseus/schema";
import {Client} from "colyseus";
import {PrismaClient} from "@prisma/client";
import {getRandomFromList} from "../../../lib/lib-util";

const prisma = new PrismaClient();

export enum GAME_STATE {
    IDLE,
    CREATING,
    INSTRUCTIONS,
    PLAYING,
    FINISH
}

export class UserState extends Schema {
    @type("string") publicKey: string = "";
    @type("boolean") hasConnectedWeb3: boolean = false;
    @type("string") userId: string = "";
    @type("int8") version: number = 0;
    @type("string") displayName: string = "";

    constructor({publicKey, hasConnectedWeb3, userId, version, displayName}:any) {
        super();
        Object.assign(this,{publicKey:publicKey||this.publicKey, hasConnectedWeb3, userId, version, displayName});
    }
}

export class SpriteState extends Schema {
    @type("number") ID:number;
    @type("string") klass:string;
    @type("uint8") playerIndex: number = -1;
    @type("uint8") x: number = 0;
    @type("uint8") y: number = 0;
    @type("uint8") layer: number = 1;
    @type("uint16") frame:number = 0;
    @type("boolean") visible:boolean = false;


    constructor({ID,frame,x,y, playerIndex, klass, layer}:any){
        super();
        this.klass = klass;
        this.ID = ID;
        this.layer = layer;
        Object.assign(this, {ID, frame, x, y, visible:true, playerIndex});
    }
}

export class PlayerState extends Schema {
    @type(UserState) user:any;
    @type("uint8") playerIndex:number = -1;
    @type("boolean") instructionsReady:boolean = false;
    @type("number") miniGameScore:any = 0;
    @type("uint32") lastReproducedFrame:number = -1;
    @type([SpriteState]) spriteEntities = new ArraySchema<SpriteState>();//sprites that are shared with network and belong or are related to player

    client:Client;

    @type("boolean")
    ready:boolean = false;


    constructor({user, client, playerIndex}: { user:any, client:Client, playerIndex:number }) {
        super();
        this.playerIndex = playerIndex;
        this.user =  new UserState(user);
        this.client = client;
    }
}


export class ScreenState extends Schema {
    @type([SpriteState]) sprites = new ArraySchema<SpriteState>();
}

export class MiniGameResult extends Schema {
    @type("uint8")
    winnerPlayerIndex:number;

    constructor({score, winnerPlayerIndex}:any) {
        super();
        this.winnerPlayerIndex = winnerPlayerIndex;
    }
}

export class GameState extends Schema {
    @type("number") currentMiniGameIndex:number = 0;
    @type("boolean") started = false;
    @type("uint64") created = Date.now();
    @type([PlayerState]) players = new ArraySchema<PlayerState>();
    @type([PlayerState]) users = new ArraySchema<PlayerState>();
    @type(["uint8"]) miniGameTrack = new ArraySchema<number>();

    @type(["uint8"])
    miniGameResults:number[] = new ArraySchema<number>();

    async setupNewGame(){
        this.miniGameResults.splice(0, this.miniGameResults.length);
        this.currentMiniGameIndex = 0;
        this.started = false;
        this.created = new Date().getTime();

        if(this.players.length > 2 ){
            throw Error("FIX CODE PLAYERS > 2");
        }

        //TODO Don't load minigames from database for now, because for now we have mini-games code in local
       // const miniGameIDs = (await prisma.game.findMany({select:{id:true}})).map(i=>i.id);

        this.miniGameTrack.splice(0, this.miniGameTrack.length);
        while(this.miniGameTrack.length < 5){
       //     this.miniGameTrack.push(getRandomFromList(miniGameIDs));
         //   this.miniGameTrack.push(this.miniGameTrack.length%2===0?2:1);
            this.miniGameTrack.push(4);
        }
        console.log("miniGameTrack", this.miniGameTrack.toJSON())
        this.started = true;
    }

    resetTrack(){
        this.currentMiniGameIndex = 0;
        this.started = false;
        this.created = 0;
        this.players.splice(0,this.players.length);
        this.miniGameTrack.splice(0,this.miniGameTrack.length);
        this.miniGameResults.splice(0,this.miniGameResults.length);
    }

    constructor() {
        super();
    }
}

