import {InputAction} from "@dcl/sdk/ecs";//TODO REVIEW if to remove coupling to SDK
import {SpriteEntity} from "../lib/game-entities";
import {getFrameNumber} from "../lib/frame-util";
import {SammichGame} from "./sammich-game";

const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};

function DifferenceGame({game}:any){
    const state = {
        round:0
    }
    const BackgroundSpriteEntity = game.registerSpriteEntity({//TODO can memoize?
        klass:"SammichBackground",
        spriteDefinition:{
            x:576,
            y:128,
            w:192,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    });
}

DifferenceGame.definition = {
    split:false,
    fps:60,
    instructions:""
};


export {DifferenceGame}