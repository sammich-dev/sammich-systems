import {SpriteEntity, SpriteKlass, SpriteKlassParams} from "./game-entities";
import {getDebugPanel} from "../scene/dcl-lib/debug-panel";

export enum SpawnerFrameSpawnMethod {
    SAME,
    RANDOM,
    SEQUENTIAL
}
export type SpawnerOptions = {
    pixelPosition:number[],
    pixelsPerSecond:number[],//pixels per second
    frameMethod?:SpawnerFrameSpawnMethod,
    layer?:number,
    stopOnCollision?:boolean,
    destroyOnStop?:boolean,
    spawnIntervalMs?:number,
    spawnRandomFrame?:number[],
    autoStart?:boolean,
}

export const createSpawner = (spriteEntityFactory:SpriteKlass, _options:SpawnerOptions, game:any) => {
    console.log("createSpawner", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);

    const [SCREEN_W, SCREEN_H] = game.runtime.getScreen().getSize();//TODO review leak by reference
    const state = {
        count:0,
        totalDt:0,
        dt:0,
        startedFrame:0,
        frame:0,
        lastSpawnedFrame:0,
        stopped:!!_options.autoStart
    };
    const _snapshots:any[] = [];
    const callbacks:{
        onStop:Function[],
        onSpawn:Function[]
    } = {
        onStop:[],
        onSpawn:[]
    }


    const options:SpawnerOptions & {spawnIntervalMs:number} = {spawnIntervalMs:1000, ..._options};
    const {frameMethod, pixelsPerSecond, stopOnCollision} = options;
    const spawnedItems: {
        ID: number;
        spriteEntity:SpriteEntity, locked:boolean, startFrame:number,detectCollisions:boolean, toJSON:Function }[] = [];

    const frameMs = 1000/game.runtime.getFps();//TODO

    const isLocked = (spriteEntity:SpriteEntity)=>{
        return spawnedItems.find(spawnedItem => spawnedItem.spriteEntity === spriteEntity)?.locked;
    };
    const isSpawned =(spriteEntity:SpriteEntity)=>{
        return spawnedItems.find(spawnedItem => spawnedItem.spriteEntity === spriteEntity);
    };
    const spawn =({offsetPixelPosition = [0,0], layer}:any) => {

        const {pixelPosition} = options;
        const position = [pixelPosition[0] + offsetPixelPosition[0], pixelPosition[1] + offsetPixelPosition[1]];
        const spriteEntity:SpriteEntity = spriteEntityFactory.create({
            pixelPosition:position,
            layer:layer || options.layer,
            network:true
        });
        state.stopped = false
        if(options.spawnRandomFrame?.length){
            const index = Math.floor(game.random() * options.spawnRandomFrame.length )
            spriteEntity.applyFrame( options.spawnRandomFrame[index])
        }
        state.count++;
        const spawnedItem:any = {
            ID:spriteEntity.ID,
            klass:spriteEntity.klassParams.klass,
            locked:false,
            startFrame:state.frame,
            detectCollisions:spriteEntityFactory.collisionBox && !!stopOnCollision,
            spriteEntity:spriteEntity,
        };

        spawnedItem.toJSON = getSpriteSnapshotToJSONFn(spawnedItem);
        spawnedItems.push(spawnedItem);
        if(stopOnCollision){
            //TODO REVIEW we must add this listener also when rollback and there is already a spawned item, because listener was removed,... or decouple collision listeners from entities
            spawnedItem.spriteEntity.onCollide(getCollisionListener({spriteEntity, spawnedItem}))
        }
        callbacks.onSpawn.forEach(f=>f(spriteEntity));
        state.lastSpawnedFrame = game.runtime.getCurrentFrameNumber();
        return spriteEntity;


    };

    function getCollisionListener({spawnedItem, spriteEntity}:any){
        return ({otherSprite}:any)=>{

            spawnedItem.locked = true;

            console.log("Collision calling onStop", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);
            // spawnedItem.spriteEntity.detectCollisions = false;
            callbacks.onStop.forEach(f=>f(spriteEntity));
        }
    }

    function getSpawnedSprites(){
        return game.getSpriteEntities().filter((e:SpriteEntity)=>isSpawned(e));
    }
    return {
        spawn,
        setOptions: (_options:any) => {
            Object.assign(options, _options);
        },
        stop: () =>{
            console.log("STOP!!", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);

            state.stopped = true;
            spawnedItems.forEach((_,index)=>(_.locked = true))
        },
        start: () => {
            console.log("SPAWNER START", {...state}, game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);
            return (state.stopped = false, state.startedFrame = state.frame);
        },
        frame: (n:number) => {
            state.frame = n;

            if(state.stopped) return;
            if(state.startedFrame === undefined) return;
            const framesSinceStart = state.frame - state.startedFrame;
            const spawnIntervalFrames = Math.floor(options.spawnIntervalMs / frameMs);

            if(options.spawnIntervalMs && ((state.count+1) * spawnIntervalFrames < framesSinceStart)){
                spawn({layer:(options.layer||1)+state.count});
            }

            spawnedItems.filter(i=>!i.locked).forEach((spawnedItem, index) => {
                if(spawnedItem.locked) return;
                const framesSinceStart = state.frame - spawnedItem.startFrame;
                const pixelsPerMs:number[] = options.pixelsPerSecond?.map(i=>i/1000);
                const newPixelPosition = [
                    spawnedItem.spriteEntity.createParams.pixelPosition[0] + Math.floor((framesSinceStart * frameMs) * pixelsPerMs[0]),
                    spawnedItem.spriteEntity.createParams.pixelPosition[1] + Math.floor((framesSinceStart * frameMs) * pixelsPerMs[1])
                ];

                spawnedItem.spriteEntity.setPixelPosition(...newPixelPosition);

                if(
                    (newPixelPosition[0] > SCREEN_W) ||
                    (newPixelPosition[1] > SCREEN_H )
                ) {
                    spawnedItem.locked = true;
                    spawnedItem.spriteEntity.destroy();
                    spawnedItems.splice(spawnedItems.indexOf(spawnedItem), 1);
                    //TODO we should remove

                }
            });


            _snapshots.push({
                frameNumber:n,
                state: { ...state },
                spawnedItemsSnapshot:[...spawnedItems.map(s=>s.toJSON())]
            });
        },
        isLocked,
        isSpawned,
        onCollide:()=>{},
        onStop:(fn:Function)=>{
            callbacks.onStop.push(fn);
            return ()=> callbacks.onStop.splice(callbacks.onStop.indexOf(fn),1)
        },
        onSpawn:(fn:Function)=>{
            callbacks.onSpawn.push(fn);
            return ()=> callbacks.onSpawn.splice(callbacks.onSpawn.indexOf(fn),1)
        },
        cleanSprites: () => {
            spawnedItems.forEach(s => s.spriteEntity.destroy());
            spawnedItems.splice(0, spawnedItems.length);
        },
        rollbackToFrame: (frameNumber:number) => {
            console.log("spawner rollback from to", state.frame, frameNumber);
            const snapshot = _snapshots.find(snapshot=>snapshot.frameNumber === frameNumber);
            console.log("spawner", state, JSON.stringify(snapshot,null, " "));
            Object.assign(state, snapshot.state);

            spawnedItems.splice(0, spawnedItems.length);

            const gameSpriteEntities = game.getSpriteEntities();
            console.log("gameSpriteEntities",gameSpriteEntities);
            snapshot.spawnedItemsSnapshot.forEach((spriteSnapshot:any)=>{
                const spriteEntity = gameSpriteEntities.find((spriteEntity:SpriteEntity) => spriteEntity.ID === spriteSnapshot.ID);
                console.log("SPAWNER restoring snapshot sprite, to entity", spriteSnapshot.toJSON(), spriteEntity.toJSON())
                const spawnedItem = {
                    ...spriteSnapshot,
                    spriteEntity
                }
                spawnedItem.toJSON = getSpriteSnapshotToJSONFn(spawnedItem);
                spawnedItems.push(spawnedItem);
                if(stopOnCollision){
                    //TODO REVIEW we must add this listener also when rollback and there is already a spawned item, because listener was removed,... or decouple collision listeners from entities
                    spawnedItem.spriteEntity.onCollide(getCollisionListener({spriteEntity, spawnedItem}))
                }
            })
            _snapshots.splice(frameNumber + 1, _snapshots.length - frameNumber - 1);
        },
        getSpawnedSprites,
        destroy:()=>{
            spawnedItems.forEach(s => s.spriteEntity.destroy());
            spawnedItems.splice(0, spawnedItems.length);
            _snapshots.splice(0, _snapshots.length);
        }
    }
}

export function getPixelsPerSecond({startPixelPosition, endPixelPosition, timeMs}:{startPixelPosition:number[],endPixelPosition:number[], timeMs:number}){

}

function getSpriteSnapshotToJSONFn(spawnedItem:any){
    return () => {

        return {...spawnedItem, spriteEntity:undefined}
    };
}