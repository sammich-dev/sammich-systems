import { Schema, ArraySchema } from "@colyseus/schema";
import { Client } from "colyseus";
import { Frame, FrameEvent, FrameEventData } from "../../../lib/frame-util";
export declare class UserState extends Schema {
    publicKey: string;
    hasConnectedWeb3: boolean;
    userId: string;
    version: number;
    displayName: string;
    constructor({ publicKey, hasConnectedWeb3, userId, version, displayName }: any);
}
export declare class SpriteState extends Schema {
    ID: number;
    klass: string;
    playerIndex: number;
    x: number;
    y: number;
    layer: number;
    frame: number;
    visible: boolean;
    constructor({ ID, frame, x, y, playerIndex, klass, layer }: any);
}
export declare class PlayerState extends Schema {
    user: any;
    playerIndex: number;
    instructionsReady: boolean;
    miniGameScore: any;
    lastReproducedFrame: number;
    spriteEntities: ArraySchema<SpriteState>;
    client: Client;
    ready: boolean;
    constructor({ user, client, playerIndex }: {
        user: any;
        client: Client;
        playerIndex: number;
    });
}
export declare class ScreenState extends Schema {
    sprites: ArraySchema<SpriteState>;
}
export declare class MiniGameResult extends Schema {
    winnerPlayerIndex: number;
    constructor({ score, winnerPlayerIndex }: any);
}
export declare class FrameEventDataSchema extends Schema {
    frameNumber?: number;
    playerIndex?: number;
    isPressed?: boolean;
    inputActionKey?: number;
    time?: number;
    constructor(data: FrameEventData);
}
export declare class FrameEventSchema extends Schema {
    type: number;
    data: any;
    constructor(event: FrameEvent);
}
export declare class InputFrameSchema extends Schema {
    index: number;
    events: FrameEventSchema[];
    constructor(frame: Frame);
}
declare class PlayerFrameCollection extends Schema {
    frames: ArraySchema<InputFrameSchema>;
}
export declare class GameState extends Schema {
    gameStage: number;
    tieBreakerWinner: number;
    created: number;
    players: ArraySchema<PlayerState>;
    users: ArraySchema<PlayerState>;
    miniGameTrack: ArraySchema<number>;
    miniGameResults: number[];
    gameInstanceId: string;
    screenFrames: ArraySchema<PlayerFrameCollection>;
    constructor(gameInstanceId: string);
    setupNewTrack(seed?: number): Promise<{
        seed: number;
        miniGameTrack: ArraySchema<number>;
    }>;
    resetTrack(resetPlayers?: boolean): void;
}
export {};
