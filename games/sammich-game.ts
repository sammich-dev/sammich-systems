import {InputAction} from "@dcl/sdk/ecs";//TODO REVIEW if to remove coupling to SDK
import {SpriteEntity} from "../lib/game-entities";
import {getFrameNumber} from "../lib/frame-util";
import {Color3} from "@dcl/sdk/math";
import {SPRITE_SHEET_DIMENSION} from "../lib/sprite-constants";

const PIXELS_MOVEMENT = 8;
const INITIAL_BASE_POSITION_X = (192/2)/2 - (16/2);
const INGREDIENT_FRAMES = [1,2,3,5,6,7];
const LEVEL_VELOCITY = [30, 60, 70, 80, 90];
const LEVEL_SPAWN_DELAY = [2000,1000,600,400, 300];

function SammichGame({
    game
}:any){
    const state = {
        score:0,
        level:0,
        ingredientsToFall:3,
        sammichCompleted:false
    };
    console.log("SammichGame", game.runtime.getPlayerIndex() ,game.runtime.getState().lastReproducedFrame);
    game.setScreenSprite({
        spriteDefinition:{
            x:0,
            y:128,
            w:96,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    })

    const BaseSpriteEntity = game.registerSpriteEntity({
        klass:"SammichBase",
        spriteDefinition:{
            x:0,
            y:512,
            w:16,
            h:16,
            ...SPRITE_SHEET_DIMENSION,
            columns:9, frames:9
        },
        collisionBox:{x:0, y:13, w:16, h:3 }
    });
    const baseSprite = BaseSpriteEntity.create({
        pixelPosition:[INITIAL_BASE_POSITION_X, 90],
        layer:2,
        network:true
    });
    const scoreText = game.addText({text:"--"})
    const spawner = game.createSpawner(
        BaseSpriteEntity,
        {
            pixelPosition:[INITIAL_BASE_POSITION_X, 0],
            pixelsPerSecond:[0,LEVEL_VELOCITY[state.level]],
            layer:3,
            stopOnCollision:true,
            spawnIntervalMs:LEVEL_SPAWN_DELAY[state.level],
            spawnRandomFrame:INGREDIENT_FRAMES,
            autoStart:false
        }
    );
    const FRAME_MS = 1000 / game.runtime.getFps();
    const FRAMES_TO_WAIT_A_SECONDS = getFrameNumber( 1000, FRAME_MS);

    game.setWinnerFn((player1Score:number, player2Score:number) => {
        console.log("winnerFn", state.level, player1Score, player2Score);
        if( state.level > 0 && player1Score > player2Score) return {winnerIndex:0};
        if( state.level > 0 && player1Score < player2Score) return {winnerIndex:1};
    });

    baseSprite.applyFrame(4);
    game.onFinish(()=>{
        console.log("listened finished mini-game from mini-game code");
    });
    spawner.onSpawn((spawnedEntity:SpriteEntity)=>{
        const possibleOffsets = [-PIXELS_MOVEMENT, 0, +PIXELS_MOVEMENT];
        const spawnedIngredients = game.getSpriteEntities().filter((i:SpriteEntity)=>spawner.isSpawned(i)).length;
        const spawnRandomFrame = spawnedIngredients > state.ingredientsToFall ? [8]:INGREDIENT_FRAMES;
        const spawnIntervalMs = spawnedIngredients > (state.ingredientsToFall+1) ? 0 : LEVEL_SPAWN_DELAY[state.level];

        spawner.setOptions({
            pixelPosition:[INITIAL_BASE_POSITION_X + possibleOffsets[Math.floor(game.random()*2)], 0],
            spawnRandomFrame,
            spawnIntervalMs
        });
    });

    spawner.onStop(async (spriteEntity:SpriteEntity) => {
        spriteEntity.setNetwork(true);
        const lockedIngredients = game.getSpriteEntities().filter((i:SpriteEntity)=>spawner.isLocked(i)).length;

        if(baseSprite.getPixelPosition()[0] === spriteEntity.getPixelPosition()[0]){
            state.score++;
            game.setPlayerScore(state.score);
        }


        if(lockedIngredients > (state.ingredientsToFall + 1)){
            console.log("SAMMICH COMPLETED")
            /**TODO
             * - wait a delay of 1 second
             * - remove all sprites
             * - increase velocity
             * -
             */
            //await game.sleep(1000);

            //TODO count scores, count all the spawned sprites which are at the same position than base

            console.log("wait frames",game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame, FRAMES_TO_WAIT_A_SECONDS);

            await game.waitFrames(FRAMES_TO_WAIT_A_SECONDS );//TODO dont use await, it should be synchronous?
            console.log("AFTER WAIT-A", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame,FRAMES_TO_WAIT_A_SECONDS)
            spawner.cleanSprites();
            baseSprite.sprite.hide();
            console.log("game.getPlayerScore", game.getPlayerScore());

            spawner.stop();
            console.log("wait frames.",game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame,FRAMES_TO_WAIT_A_SECONDS)
            await game.waitFrames( FRAMES_TO_WAIT_A_SECONDS );
            console.log("AFTER WAIT-B", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame,FRAMES_TO_WAIT_A_SECONDS)
            baseSprite.sprite.show();
            console.log("state.level", state.level, LEVEL_VELOCITY)
            if(state.level < (LEVEL_VELOCITY.length-1)){
                state.level++;
            }

            state.ingredientsToFall+=2;
            spawner.setOptions({
                pixelsPerSecond:[0,LEVEL_VELOCITY[state.level]],
                spawnIntervalMs:LEVEL_SPAWN_DELAY[state.level],
                spawnRandomFrame:INGREDIENT_FRAMES
            });

            spawner.start();

            game.checkWinners();
        }
    });

    game.onStart(async ({seed}:any)=>{
        console.log("game.onStart", seed);
        //spawner.spawn({layer:3});
        //spawner.start();
    });
    game.onInput(({inputActionKey, isPressed, time, playerIndex}:any) => {
        if(!isPressed) return;

        const [px,py] = baseSprite.getPixelPosition();
        const lockedIngredients = game.getSpriteEntities().filter((i:SpriteEntity)=>spawner.isLocked(i))
        if(inputActionKey === InputAction.IA_PRIMARY && px > (INITIAL_BASE_POSITION_X-PIXELS_MOVEMENT)){
            baseSprite.setPixelPosition(px-PIXELS_MOVEMENT, py);

            lockedIngredients.forEach((spriteEntity:SpriteEntity) => {
                const [px,py] = spriteEntity.getPixelPosition();
                spriteEntity.setPixelPosition(px-PIXELS_MOVEMENT,py);
            });

        }else if(inputActionKey === InputAction.IA_SECONDARY && px < (INITIAL_BASE_POSITION_X+PIXELS_MOVEMENT)){
            baseSprite.setPixelPosition(px+PIXELS_MOVEMENT, py);
            lockedIngredients.forEach((spriteEntity:SpriteEntity) => {
                const [px,py] = spriteEntity.getPixelPosition();
                spriteEntity.setPixelPosition(px+PIXELS_MOVEMENT,py);
            });
        }
    });

    game.onFrame((frameNumber:number, dt:number, frame:any)=>{
        scoreText.setText((game.getPlayerScore() || ("--" + Math.random())) + `            ${frameNumber} ${game.runtime.getState().lastReproducedFrame}`);
     //   frame && console.log("frame-->--->-->", frameNumber, dt, frame);
    });
}

SammichGame.definition = {
    alias:"sammich-game",
    split:true,
    fps:60,
    instructions:"Perfect sammich is when ingredients\n are aligned with bread.\nMove to sides with <color=#ffff00><b>E - F</b></color> keys"
};

export {SammichGame}