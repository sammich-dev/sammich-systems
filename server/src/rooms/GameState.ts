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
    @type("string") publicKey: string;
    @type("boolean") hasConnectedWeb3: boolean;
    @type("string") userId: string;
    @type("int8") version: number;
    @type("string") displayName: string;

    constructor({publicKey, hasConnectedWeb3, userId, version, displayName}:any) {
        super();
        Object.assign(this,{publicKey, hasConnectedWeb3, userId, version, displayName});
    }
}

export class SpriteState extends Schema {
    @type("number") ID:number;
    @type("uint8") x: number;
    @type("uint8") y: number;
    @type("uint16") frame:number;
    @type("boolean") visible:boolean;

    constructor({ID,frame,x,y}:any){
        super();
        Object.assign(this, {ID, frame, x, y, visible:true});
    }
}

export class PlayerState extends Schema {
    @type(UserState) user:any;
    @type("boolean") instructionsReady:boolean = false;
    @type("number") miniGameScore:any;
    @type([SpriteState]) spriteEntities = new ArraySchema<SpriteState>();//sprites that are shared with network and belong or are related to player

    client:Client;
    ready:boolean;


    constructor({user, client}: { user:any, client:Client }) {
        super();
        this.user =  new UserState(user);
        this.client = client;
    }
}


export class ScreenState extends Schema {
    @type([SpriteState]) sprites = new ArraySchema<SpriteState>();
}

export class MiniGameResult extends Schema {
    score:number;
    winnerPlayerIndex:number;

    constructor({score, winnerPlayerIndex}:any) {
        super();
    }
}

export class GameState extends Schema {
    @type("number") currentMiniGameIndex:number = 0;
    @type("boolean") started = false;
    @type("uint64") created = new Date().getTime();
    @type([PlayerState]) players = new ArraySchema<PlayerState>();
    @type([PlayerState]) users = new ArraySchema<PlayerState>();
    @type(["uint8"]) miniGameTrack = new ArraySchema<number>();

    @type([MiniGameResult])
    miniGameResults:any = new ArraySchema<MiniGameResult>();

    async setupNewGame(){
        //TODO here we load minigames from database
        const miniGameIDs = (await prisma.game.findMany({select:{id:true}})).map(i=>i.id);
        this.miniGameTrack.splice(0, this.miniGameTrack.length);
        while(this.miniGameTrack.length < 5){
            this.miniGameTrack.push(getRandomFromList(miniGameIDs));
        }
        console.log("miniGameTrack", this.miniGameTrack.toJSON())
        this.started = true;
    }
    constructor() {
        super();
    }
}

