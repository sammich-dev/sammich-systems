import { SpriteEntity, SpriteKlass } from "./game-entities";
export declare enum SpawnerFrameSpawnMethod {
    SAME = 0,
    RANDOM = 1,
    SEQUENTIAL = 2
}
export type SpawnerOptions = {
    pixelPosition: number[];
    pixelsPerSecond: number[];
    frameMethod?: SpawnerFrameSpawnMethod;
    layer?: number;
    stopOnCollision?: boolean;
    destroyOnStop?: boolean;
    spawnIntervalMs?: number;
    spawnRandomFrame?: number[];
    autoStart?: boolean;
};
export declare const createSpawner: (spriteEntityFactory: SpriteKlass, _options: SpawnerOptions, game: any) => {
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
export declare function getPixelsPerSecond({ startPixelPosition, endPixelPosition, timeMs }: {
    startPixelPosition: number[];
    endPixelPosition: number[];
    timeMs: number;
}): void;
