// noinspection JSAnnotator

import { Schema, Context, ArraySchema, MapSchema, type } from "@colyseus/schema";
import {Client} from "colyseus";
import {PrismaClient} from "@prisma/client";
import {getRandomFromList} from "../../../lib/lib-util";
import {getGameKeys} from "../../../lib/game-repository";
import {GAME_STAGE} from "../../../lib/game-stages";
import {Frame, FrameEvent, FrameEventData, InputEventRepresentation} from "../../../lib/frame-util";

const prisma = new PrismaClient();

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

export class FrameEventDataSchema extends Schema {
    @type("uint64") frameNumber?:number;
    @type("uint8") playerIndex?:number;
    @type("boolean") isPressed?:boolean;
    @type("uint8") inputActionKey?:number;
    @type("uint64") time?:number;

    constructor(data:FrameEventData){
        super();
        this.frameNumber = data.frameNumber;
        this.playerIndex = data.playerIndex;
        this.isPressed = data.isPressed;
        this.inputActionKey = data.inputActionKey;
        this.time = data.time;
    }
}

export class FrameEventSchema extends Schema {
    @type("uint8") type:number;
    @type(FrameEventDataSchema) data:any;

    constructor(event:FrameEvent){
        super();
        this.type = event.type;
        this.data = new FrameEventDataSchema(event.data);
    }
}
export class InputFrameSchema extends Schema {
    @type("uint64") index:number;
    @type([FrameEventSchema]) events:FrameEventSchema[];

    constructor(frame:Frame){
        super();
        this.index = frame.index;
        this.events = new ArraySchema<FrameEventSchema>();
        frame.events.forEach((e) => this.events.push(new FrameEventSchema(e)) );
    }
}

class PlayerFrameCollection extends Schema {
    @type([InputFrameSchema]) frames = new ArraySchema<InputFrameSchema>();
}

export class GameState extends Schema {
    @type("int8") gameStage:number = 1;
    @type("int8") tieBreakerWinner:number = -1;
    @type("uint64") created = Date.now();
    @type([PlayerState]) players = new ArraySchema<PlayerState>();
    @type([PlayerState]) users = new ArraySchema<PlayerState>();
    @type(["int8"]) miniGameTrack = new ArraySchema<number>();
    @type(["int8"])
    miniGameResults:number[] = new ArraySchema<number>();

    @type([PlayerFrameCollection])
    screenFrames = new ArraySchema<PlayerFrameCollection>();

    constructor() {
        super();
        this.screenFrames[0] = new PlayerFrameCollection();
        this.screenFrames[1] = new PlayerFrameCollection();
    }

    async setupNewTrack(seed = Math.random()){
        this.resetTrack(false);
        //TODO Don't load minigames from database for now, because for now we have mini-games code in local, later we will need to filter by state, etc. later, maybe we need to add new GAME_STAGE.DEFINING_TRACK or use WAITING_READY && !this.miniTrack.length
       // const miniGameIDs = (await prisma.game.findMany({select:{id:true}})).map(i=>i.id);
        const miniGameIDs = getGameKeys();

        while(this.miniGameTrack.length < 5){
            this.miniGameTrack.push(getRandomFromList(miniGameIDs));
            //this.miniGameTrack.push(2);
        }


        this.gameStage = GAME_STAGE.SHOWING_INSTRUCTIONS;

        return {seed, miniGameTrack:this.miniGameTrack};
    }

    resetTrack(resetPlayers = true){
        this.created = 0;
        if(resetPlayers) this.players.splice(0,this.players.length);
        this.miniGameTrack.splice(0,this.miniGameTrack.length);
        this.miniGameResults.splice(0,this.miniGameResults.length);
        this.screenFrames[0].frames.splice(0,this.screenFrames[0].frames.length);
        this.screenFrames[1].frames.splice(0,this.screenFrames[1].frames.length);
        this.tieBreakerWinner = -1;
        this.gameStage = GAME_STAGE.IDLE;
    }

}

