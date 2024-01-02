import {TextAlignMode} from "@dcl/sdk/ecs";
import {dclSleep} from "./dcl-sleep";
import {DEFAULT_SPRITE_DEF} from "../../../sprite-constants";

const SUM_SCORE_TEXT_POSITIONS =[
    [(192 / 4) , 128 / 4 - 16],//player1
    [(192 / 4) * 3 , 128 / 4 - 16]//player2
];
const textColor = [1,1,1,1];
export function createGlobalScoreTransition(screen:any){

    const winnerSprite = screen.addSprite({
        spriteDefinition:{
            ...DEFAULT_SPRITE_DEF,
            x:388, y:473,
            w:128, h:28
        },
        pixelPosition:[100,10],
        layer:3
    });
    //winnerSprite.hide()
    const loserSprite = screen.addSprite({
        spriteDefinition:{
            ...DEFAULT_SPRITE_DEF,
            x:433, y:397,
            w:62, h:21
        },
        pixelPosition:[4,10],
        layer:3
    });
    //loserSprite.hide();

    const player1GlobalScoreBig = screen.addText({
        pixelPosition:[192/4,128/4],
        textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
        text:"0",
        fontSize:2,
        textColor,
        layer:3
    });
    const winnerSumPointsText = screen.addText({
        pixelPosition:SUM_SCORE_TEXT_POSITIONS[0],
        textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
        text:"+1",
        fontSize:1,
        textColor,
        layer:3
    })
    const player2GlobalScoreBig = screen.addText({
        pixelPosition: [(192 / 4) * 3, 128 / 4],
        textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
        text:"0",
        fontSize:2,
        textColor,
        layer:3
    });

    const finalSprite = screen.addSprite({
        pixelPosition:[0,0],
        spriteDefinition:{
            ...DEFAULT_SPRITE_DEF,
            x:192, y:128,
            w:192, h:128
        },
        layer:2,
        zoom:[1,1]
    });
    const hide = ()=>{
        winnerSprite.hide();
        loserSprite.hide();
        player1GlobalScoreBig.hide();
        winnerSumPointsText.hide();
        player2GlobalScoreBig.hide();
    };

    finalSprite.hide();
    hide();

    return {
        destroy:()=>{

        },
        hide,
        showTransition:async ({winnerIndex, previousScores}:any)=>{
            winnerSprite.show();
            loserSprite.show();
            player1GlobalScoreBig.show();
            player2GlobalScoreBig.show();

            await dclSleep(1000);
            player1GlobalScoreBig.setText(previousScores[0])
            player2GlobalScoreBig.setText(previousScores[1])
            if(winnerIndex === 0){
                winnerSumPointsText.setPixelPosition(...SUM_SCORE_TEXT_POSITIONS[0]);
                winnerSumPointsText.show();
                await dclSleep(1000);
                winnerSumPointsText.hide();
                player1GlobalScoreBig.setText((previousScores[winnerIndex]+1).toString());
            }else if(winnerIndex === 1){
                winnerSumPointsText.setPixelPosition(...SUM_SCORE_TEXT_POSITIONS[1]);
                winnerSumPointsText.show();
                await dclSleep(1000);
                winnerSumPointsText.hide();
                player2GlobalScoreBig.setText((previousScores[winnerIndex]+1).toString());
            }
            await dclSleep(2000);
        },
        showFinalSprite:async (trackWinnerIndex:number)=>{
            finalSprite.show();
            finalSprite.setZoom([trackWinnerIndex?-1:1,1]);
            await dclSleep(5000);
            finalSprite.hide();
        },
        reset:()=>{
            player1GlobalScoreBig.setText("0");
            player2GlobalScoreBig.setText("0");
        }
    }
}