import { SpawnerOptions } from "../../../spawner";
import { SpriteEntity, SpriteKlass, SpriteKlassParams } from "../../../game-entities";
import { Frame, InputEventRepresentation } from "../../../frame-util";
import { TextAlignMode } from "@dcl/sdk/ecs";
import { SpriteDefinitionParams } from "./sprite-util";
export type GameRunnerCallback = {
    onStart: Function[];
    onInput: Function[];
    onFrame: Function[];
    onFinish: Function[];
    onDestroy: Function[];
    onWinner: Function | null;
    onProposedWinner: Function | null;
};
export declare const createScreenRunner: ({ screen, timers, seed, GameFactory, onFinish, clientRoom, serverRoom, isClientPlayer, playerIndex, recordFrames, velocityMultiplier }: any) => {
    definition: any;
    runtime: {
        tieBreaker: ({ winnerIndex }: {
            winnerIndex: number;
        }) => Promise<number>;
        getPlayerIndex: () => any;
        onProposedWinner: (fn: Function) => Function;
        onWinner: (fn: Function) => Function;
        attachDebugPanel: (debugPanel: any) => any;
        rollbackToFrame: (frameNumber: number) => void;
        getState: () => any;
        setState: (o: any) => any;
        getFps: () => any;
        destroy: () => void;
        pushInputEvent: (inputEventRepresentation: InputEventRepresentation) => Frame;
        pushFrame: (_frame: any) => Frame;
        getCurrentFrameNumber: () => number;
        reproduceFramesUntil: (frameNumber: number) => Promise<void>;
        reproduce: (autoPlay?: boolean) => void;
        start: (autoPlay?: boolean) => void;
        finish: () => void;
        stop: () => void;
        getScreen: () => any;
    };
    setScreenSprite: ({ spriteDefinition }: SpriteDefinitionParams) => any;
    waitFrames: (n: number) => Promise<unknown>;
    onStart: (fn: Function) => () => Function[];
    onInput: (fn: Function) => () => Function[];
    onFrame: (fn: Function) => () => Function[];
    onFinish: (fn: Function) => () => Function[];
    onDestroy: (fn: Function) => () => Function[];
    registerSpriteEntity: (options: SpriteKlassParams) => any;
    getSpriteEntityKlasses: () => any;
    createSpawner: (spriteEntity: SpriteKlass, options: SpawnerOptions) => {
        spawn: ({ offsetPixelPosition, layer }: any) => SpriteEntity;
        setOptions: (_options: any) => void;
        stop: () => void;
        start: () => void;
        frame: (n: number) => void;
        isLocked: (spriteEntity: SpriteEntity) => boolean;
        isSpawned: (spriteEntity: SpriteEntity) => {
            ID: number;
            spriteEntity: SpriteEntity;
            locked: boolean;
            startFrame: number;
            detectCollisions: boolean;
            toJSON: Function;
        };
        onCollide: () => void;
        onStop: (fn: Function) => () => Function[];
        onSpawn: (fn: Function) => () => Function[];
        cleanSprites: () => void;
        rollbackToFrame: (frameNumber: number) => void;
        getSpawnedSprites: () => any;
        destroy: () => void;
    };
    addText: ({ text, pixelPosition, textAlign, fontSize, textColor, layer }: {
        text: string;
        textColor?: number[];
        fontSize?: number;
        textAlign?: TextAlignMode;
        pixelPosition: number[];
        layer?: number;
    }) => any;
    setWinnerFn: (fn: WinnerFunction) => void;
    checkWinners: () => void;
    getSpriteEntities: any;
    random: () => any;
    randomInt: (min: number, max: number) => number;
    getRandomFromList: (list: any[]) => any;
    shuffleList: (list: any[]) => any[];
    reproduceSpriteFrames: (sprite: SpriteEntity, { loop, stepsPerFrame }: any) => void;
    players: {
        setPlayerScore: (data: number) => number;
        getPlayerScore: () => any;
    }[];
    setPlayerScore: (data: number) => void;
    getPlayerScore: () => any;
};
export type WinnerFunction = () => void | undefined | {
    winnerIndex: number;
};
