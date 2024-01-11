import {InputAction} from "@dcl/sdk/ecs";
import {SpriteEntity} from "../lib/game-entities";

const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};

const definition = {
    alias:"test-example",
    split:false,
    fps:60,
    instructions:"test wait"
};

async function run({game}:any){
    game.setScreenSprite({//BACKGROUND SPRITE
        spriteDefinition:{
            ...SPRITE_SHEET_DIMENSION,
            x:576,
            y:128,
            w:192,//THE SCREEN BACKGROUND SPRITE IS 192 PIXELS WIDTH
            h:128
        }
    });

    const CursorSprite = game.registerSpriteEntity({
        klass:"Cursor",
        spriteDefinition:{
            x:0,y:486, w:16, h:18, columns:2,frames:2,
            ...SPRITE_SHEET_DIMENSION,
        }
    });

    const spawner = game.createSpawner(CursorSprite, {
        pixelPosition:[0, 50],
        pixelsPerSecond:[30, 0],
        layer:30,
        spawnIntervalMs:1000,
        spawnRandomFrame:[0,1],
        autoStart:false
    });
    spawner.start();
    spawner.onSpawn((spawnedEntity:SpriteEntity)=>{
        console.log("spawned")
    });

    const c1 = CursorSprite.create({
        pixelPosition:[20, 20],
        layer:2,
        network:true
    });
    /**
     * lets wait 1 second = FRAMES_PER_SECOND
     */
    const FRAMES_PER_SECOND = game.runtime.getFps();
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    console.log("______")
    await game.waitFrames(FRAMES_PER_SECOND);
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    c1.setPixelPosition(10,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(20,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(30,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(40,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(50,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(60,20);

    game.onInput(({inputActionKey, isPressed, time, playerIndex}:any)=>{
        if(inputActionKey === InputAction.IA_PRIMARY){
            //..do stuff
        }
    });
}

const TestExample = {definition, run};


export {TestExample}