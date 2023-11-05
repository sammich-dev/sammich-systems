import {TextAlignMode} from "@dcl/sdk/ecs";
import {Color4} from "@dcl/sdk/math";
import {sleep} from "../dcl-lib/sleep";
import {DEFAULT_SPRITE_DEF} from "../../lib/sprite-constants";
const WINNER_POSITIONS = [
    [4,10],//player1
    [100,10]//player2
];
const SUM_SCORE_TEXT_POSITIONS =[
    [(192 / 4) , 128 / 2 - 16],//player1
    [(192 / 4) * 3 , 128 / 2 - 16]//player2
];

export function createGlobalScoreTransition(screen:any){
    const winnerSprite = screen.addSprite({
        spriteDefinition:{
            ...DEFAULT_SPRITE_DEF,
            x:388, y:473,
            w:128, h:28
        },
        pixelPosition:[100,10],
        layer:1
    });
    //winnerSprite.hide()
    const loserSprite = screen.addSprite({
        spriteDefinition:{
            ...DEFAULT_SPRITE_DEF,
            x:433, y:397,
            w:62, h:21
        },
        pixelPosition:[4,10],
        layer:1
    });
    //loserSprite.hide();

    const player1GlobalScoreBig = screen.addText({
        pixelPosition:[192/4,128/2],
        textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
        text:"0",
        fontSize:2,
        textColor:Color4.Black()
    });
    const winnerSumPointsText = screen.addText({
        pixelPosition:SUM_SCORE_TEXT_POSITIONS[0],
        textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
        text:"+1",
        fontSize:1,
        textColor:Color4.Black()
    })
    const player2GlobalScoreBig = screen.addText({
        pixelPosition: [(192 / 4) * 3, 128 / 2],
        textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
        text:"0",
        fontSize:2,
        textColor:Color4.Black()
    });


    return {
        hide:()=>{
            winnerSprite.hide();
            loserSprite.hide();
            player1GlobalScoreBig.hide();
            winnerSumPointsText.hide();
            player2GlobalScoreBig.hide();
        },
        showTransition:async ({winnerIndex, previousScore}:any)=>{
            winnerSprite.show();
            loserSprite.show();
            player1GlobalScoreBig.show();
            player2GlobalScoreBig.show();

            await sleep(1000);

            if(winnerIndex === 0){
                winnerSumPointsText.setPixelPosition(...SUM_SCORE_TEXT_POSITIONS[0]);

                winnerSumPointsText.show();
                await sleep(1000);
                winnerSumPointsText.hide();
                player1GlobalScoreBig.setText((previousScore+1).toString());
            }else if(winnerIndex === 1){
                winnerSumPointsText.setPixelPosition(...SUM_SCORE_TEXT_POSITIONS[1]);
                winnerSumPointsText.show();
                await sleep(1000);
                winnerSumPointsText.hide();
                player2GlobalScoreBig.setText((previousScore+1).toString());
            }

        }
    }
}