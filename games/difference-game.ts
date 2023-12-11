import {InputAction} from "@dcl/sdk/ecs";
import {createScoreTextComponent, updateScoreTextComponent} from "./utils/mini-game-score";

const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};
const CURSOR_POSITION_Y = 104;

export const DifferenceGame = {
    definition:{
        alias:"difference-game",
        split:false,
        fps:60,
        instructions:"Select the correct answer\n use <color=#ffff00><b>E, F, 1, 2, 3</b></color> keys"
    },
    run:function DifferenceGameRun({game}:any){
        const FRAMES_TO_WAIT_A_SECOND = 60;

        const state = {
            scores:[0,0],
            playersSelectedState:[false,false]
        };
        game.setWinnerFn((player1Score:number, player2Score:number) => {
            if(player1Score === 2 && !player2Score) return {winnerIndex:0};//2-0 makes a winner, no need to play a 3rd time
            if(player2Score === 2 && !player1Score) return {winnerIndex:0};

            if(Math.max(player1Score,player2Score) >= 2){//should have player at least 2 games
                if( player1Score > player2Score) return {winnerIndex:0};
                if( player1Score < player2Score) return {winnerIndex:1};
            }
        });
        createScoreTextComponent(game);
        game.setScreenSprite({
            spriteDefinition:{
                x:576,
                y:128,
                w:192,
                h:128,
                ...SPRITE_SHEET_DIMENSION
            }
        });
        const spriteDefinition = {
            x:0,
            y:768,
            w:64,
            h:64,
            ...SPRITE_SHEET_DIMENSION,
            columns:9, frames:9
        };
        const CursorSprite = game.registerSpriteEntity({
            klass:"Cursor",
            spriteDefinition:{
                x:0,y:486, w:16, h:18, columns:2,frames:2,
                ...SPRITE_SHEET_DIMENSION,
            }
        });
        const PictureSprite = game.registerSpriteEntity({
            klass:"Picture",
            spriteDefinition
        });
        const CURSOR_PICTURE_DISPLACEMENT = 10;
        const PICTURE_WIDTH = 64;
        const PICTURE_CENTER = 64/2;
        const player1PixelPositions = [
            PICTURE_WIDTH,
            PICTURE_WIDTH*2,
            PICTURE_WIDTH*3
        ].map(i=>i-(PICTURE_CENTER + CURSOR_PICTURE_DISPLACEMENT)-4);
        const player2PixelPositions = [
            PICTURE_WIDTH,
            PICTURE_WIDTH*2,
            PICTURE_WIDTH*3
        ].map(i=>i-(PICTURE_CENTER - CURSOR_PICTURE_DISPLACEMENT)-4);

        const cursor1 = CursorSprite.create({
            pixelPosition:[player1PixelPositions[1], CURSOR_POSITION_Y],
            layer:3,
            network:true
        });

        const cursor2 = CursorSprite.create({
            pixelPosition:[player2PixelPositions[1], CURSOR_POSITION_Y],
            layer:3,
            network:true
        });
        cursor2.applyFrame(1);

        const answerSprites = new Array(3).fill(null).map((_,index) => PictureSprite.create({
            pixelPosition:[index*64, 40],
            layer:2,
            network:true
        }));

        let solutionPosition = -1;

        game.onInput(async ({inputActionKey, isPressed, time, playerIndex}:any) => {
            if(!isPressed) return;
            console.log("state.playersSelectedState",state.playersSelectedState)
            if(state.playersSelectedState.some(i=>i)) return;
            console.log("selecting ...")
            const cursorSprite = playerIndex ? cursor2 : cursor1;
            const cursorPositions = playerIndex? player2PixelPositions:player1PixelPositions;
            const currentCursorPosition = cursorPositions.indexOf(cursorSprite.getPixelPosition()[0]);
            if(inputActionKey === InputAction.IA_PRIMARY && currentCursorPosition > 0){
                cursorSprite.setPixelPosition(
                    cursorPositions[currentCursorPosition-1],
                    CURSOR_POSITION_Y
                )
            }else if(inputActionKey === InputAction.IA_SECONDARY && currentCursorPosition < 2){
                console.log("CCC")
                cursorSprite.setPixelPosition(
                    cursorPositions[currentCursorPosition+1],
                    CURSOR_POSITION_Y
                )
            }else if(inputActionKey === InputAction.IA_ACTION_3 && currentCursorPosition !== 0){
                cursorSprite.setPixelPosition(
                    cursorPositions[0],
                    CURSOR_POSITION_Y
                )
            }else if(inputActionKey === InputAction.IA_ACTION_4 && currentCursorPosition !== 1){
                cursorSprite.setPixelPosition(
                    cursorPositions[1],
                    CURSOR_POSITION_Y
                )
            }else if(inputActionKey === InputAction.IA_ACTION_5 && currentCursorPosition !== 2){
                cursorSprite.setPixelPosition(
                    cursorPositions[2],
                    CURSOR_POSITION_Y
                )
            }else if(inputActionKey === InputAction.IA_POINTER){
                const otherPlayerIndex = playerIndex?0:1;
                state.playersSelectedState[playerIndex] = true;
                cursorSprite.setPixelPosition(
                    cursorPositions[currentCursorPosition],
                    CURSOR_POSITION_Y-10
                );
                const isCorrectAnswer = solutionPosition === currentCursorPosition;
                console.log("isCorrectAnswer",isCorrectAnswer)
                if(isCorrectAnswer){
                    state.scores[playerIndex]++
                }else{
                    state.scores[otherPlayerIndex]++
                }
                console.log("state.scores",state.scores)
                game.players[0].setPlayerScore(state.scores[0]);
                game.players[1].setPlayerScore(state.scores[1]);
                updateScoreTextComponent();

                await game.waitFrames(FRAMES_TO_WAIT_A_SECOND);
                game.checkWinners();
                setupGame();
            }
        });

        function setupGame(){
            state.playersSelectedState[0] = state.playersSelectedState[1] = false;
            const solutionFrame = game.randomInt(0, spriteDefinition.frames - 1);
            const mirrorFrame = game.getRandomFromList( [0,1,2,3,4,5,6,7,8].filter(i=>i!=solutionFrame) );
            solutionPosition = game.randomInt(0, 2);
            cursor1.setPixelPosition(player1PixelPositions[1], CURSOR_POSITION_Y);
            cursor2.setPixelPosition(player2PixelPositions[1], CURSOR_POSITION_Y);
            answerSprites.forEach((answerSprite, index)=>{
                const frameToApply = index===solutionPosition?solutionFrame:mirrorFrame;
                answerSprite.applyFrame(frameToApply);
            });
        }

        game.onStart(({seed}:any)=>{
            setupGame();
        });

        //TODO select 2 sprites from the list
    }
}