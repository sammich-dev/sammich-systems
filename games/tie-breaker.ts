import {InputAction, TextAlignMode} from "@dcl/sdk/ecs";
import {getFrameNumber} from "../lib/frame-util";

const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};

async function run({game}:any){
    game.setScreenSprite({
        spriteDefinition:{
            x:576,
            y:0,
            w:192,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    });
    const winnerIndex = await game.runtime.tieBreaker({winnerIndex:0});
    
    console.log("WINNER",winnerIndex);
}

const definition = {
    alias:"test-wait",
    split:false,
    fps:60,
    instructions:"test wait"
};

const TieBreaker = {definition, run};


export {TieBreaker}