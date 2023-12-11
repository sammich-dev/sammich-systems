import {SPRITE_SHEET_DIMENSION} from "../lib/sprite-constants";
import {InputAction, TextAlignMode} from "@dcl/sdk/ecs";
import {Color4} from "@dcl/sdk/math";
import {waitFor} from "../lib/lib-util";
import {createScoreTextComponent, updateScoreTextComponent} from "./utils/mini-game-score";

//TODO BEST OF 3
const WAIT_FOR_OTHER_PLAYER_RESPONSE_FRAMES = 60 * 2;
const TEXT_DEFAULTS = { fontSize: 1, textColor: [1, 1, 1, 1],  textAlign: TextAlignMode.TAM_MIDDLE_CENTER  };
const TIME_TEXT_DEFAULTS = {
    text:`00:000`,
    fontSize:0.6,
    textAlign:TextAlignMode.TAM_MIDDLE_CENTER,
    textColor:[0,0,0,1]
}
async function run({game}:any){

    const state:any = {
        num1:0,
        num2:0,
        solution:0,
        solutionIndex:0,
        playerCursorIndex:[0,0],
        playerMovedTime:[0,0],
        answerValues:[],
        showingQuestion:false,
        resolvingWinner:false,
        firstMoveReceivedAtFrame:0,
        appearTime:0,
        score:[0,0]
    };
    game.setScreenSprite({
        spriteDefinition:{
            x:384,
            y:0,
            w:192,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    });
    game.setWinnerFn((player1Score:number, player2Score:number) => {
        if((player1Score + player2Score) >= 5){
            if( player1Score > player2Score) return {winnerIndex:0};
            if( player1Score < player2Score) return {winnerIndex:1};
        }
    });
    createScoreTextComponent(game);

    const TeacherSprite = game.registerSpriteEntity({
        klass:"Teacher",
        spriteDefinition:{
            x:0,y:573, w:64, h:64, columns:4,frames:4,
            ...SPRITE_SHEET_DIMENSION,
        }
    });

    const teachers = [
        TeacherSprite.create({
            pixelPosition:[0, 50],
            layer:1
        }),
        TeacherSprite.create({
            pixelPosition:[192-64, 50],
            layer:1,
            zoom:[-1,1]
        }),
    ];

    const timeTexts = [game.addText({
        ...TIME_TEXT_DEFAULTS,
        pixelPosition:[30, 54],

    }), game.addText({
        ...TIME_TEXT_DEFAULTS,
        pixelPosition:[192-30, 54],
    })];

    const CursorSprite = game.registerSpriteEntity({
        klass:"Cursor",
        spriteDefinition:{
            x:0,y:486, w:16, h:18, columns:2,frames:2,
            ...SPRITE_SHEET_DIMENSION,
        }
    });
    const CURSOR_POSITIONS = [
        new Array(6).fill(null).map((_,answerIndex)=>[
            192/2 + (answerIndex%3)*30 - 43,
            55 + Math.floor(answerIndex/3)*24
        ]),//player1
        new Array(6).fill(null).map((_,answerIndex)=>[
            192/2 + (answerIndex%3)*30 - 27,
            55 + Math.floor(answerIndex/3)*24
        ])//player2
    ];
    const cursors = [
        CursorSprite.create({pixelPosition:[...CURSOR_POSITIONS[0][state.playerCursorIndex[0]]],layer:3, network:true}),
        CursorSprite.create({pixelPosition:[...CURSOR_POSITIONS[1][state.playerCursorIndex[1]]],layer:3, network:true, frame:1})
    ]

    const answerTexts = new Array(6).fill(null).map((_,answerIndex)=>
        game.addText({ ...TEXT_DEFAULTS,
            pixelPosition:[
                192/2 + (answerIndex%3)*30 - 30,
                55 + Math.floor(answerIndex/3)*24
            ],
            fontSize:0.8,
            text: "XX"})
    );
    const questionText = game.addText({ ...TEXT_DEFAULTS,
        pixelPosition: [192 / 2, 32],
        text: `${state.num1} + ${state.num2}`
    });

    game.onInput(async ({inputActionKey, isPressed, time, playerIndex, frameNumber}:any) => {
        console.log("onInput frameNumber",frameNumber)
        if(!state.showingQuestion) return;
        if(state.playerMovedTime[playerIndex]) return;
        if(!isPressed) return;

        if(inputActionKey === InputAction.IA_POINTER){
            state.playerMovedTime[playerIndex] = time;
            state.firstMoveReceivedAtFrame = state.firstMoveReceivedAtFrame || game.runtime.getState().lastReproducedFrame;
            const currentPosition = CURSOR_POSITIONS[playerIndex][state.playerCursorIndex[playerIndex]]
            cursors[playerIndex].setPixelPosition(
                currentPosition[0], currentPosition[1]-4
            )
        }else if(inputActionKey === InputAction.IA_PRIMARY || inputActionKey === InputAction.IA_SECONDARY){
            console.log("player index", state.playerCursorIndex[playerIndex]);
            if(inputActionKey === InputAction.IA_SECONDARY && state.playerCursorIndex[playerIndex] === 5 ){
                state.playerCursorIndex[playerIndex] = 0;
            }else if(inputActionKey === InputAction.IA_PRIMARY && state.playerCursorIndex[playerIndex] === 0 ){
                state.playerCursorIndex[playerIndex] = 5;
            }else{
                state.playerCursorIndex[playerIndex] =
                    inputActionKey === InputAction.IA_PRIMARY
                        ? Math.min(state.playerCursorIndex[playerIndex]-1,5)
                        : inputActionKey === InputAction.IA_SECONDARY
                            ? Math.max(state.playerCursorIndex[playerIndex]+1,0)
                            : state.playerCursorIndex[playerIndex];
            }

            cursors[playerIndex].setPixelPosition(...CURSOR_POSITIONS[playerIndex][state.playerCursorIndex[playerIndex]])
        }
    });

    game.onFrame(checkSelection);
    generateQuestion();

    async function checkSelection(frameNumber:number){
        if(!state.showingQuestion) return;
        if(!state.firstMoveReceivedAtFrame) return;
        if(state.resolvingWinner) return;

        let winnerIndex = -1;
        console.log("winnerIndex1",winnerIndex)
        if(state.playerMovedTime.every((i:number)=>i)){
            if(state.playerCursorIndex.every((i:number) => i === state.solutionIndex)){//both are correct
                winnerIndex = state.playerMovedTime[0] < state.playerMovedTime[1] ? 0 : 1;
            }else if(state.playerCursorIndex.some((i:number) => i === state.solutionIndex)){//
                winnerIndex = state.playerCursorIndex.findIndex((i:number)=>i===state.solutionIndex);
            }else if(state.playerCursorIndex.every((i:number) => i !== state.solutionIndex)){
                winnerIndex = state.playerMovedTime[0] > state.playerMovedTime[1] ? 0 : 1;
            }
        }else if(state.firstMoveReceivedAtFrame && ((frameNumber - state.firstMoveReceivedAtFrame) > WAIT_FOR_OTHER_PLAYER_RESPONSE_FRAMES )){
            const playerAnswered = state.playerMovedTime.findIndex((i:number) => i);
            console.log("playerAnswered", playerAnswered);
            if(playerAnswered >= 0){
                if(state.playerCursorIndex[playerAnswered] === state.solutionIndex){
                    winnerIndex = playerAnswered;
                }else{
                    winnerIndex = playerAnswered === 0 ? 1 : 0;
                }
            }
        }
        console.log("winnerIndex2",winnerIndex)
        if(winnerIndex >= 0){
            timeTexts.forEach((t,index)=>state.playerMovedTime[index] && t.setText(formatTime(  state.playerMovedTime[index] - state.appearTime)));

            state.resolvingWinner = true;
            game.players[winnerIndex].setPlayerScore(++state.score[winnerIndex]);
            teachers[winnerIndex].applyFrame(2);
            teachers[winnerIndex?0:1].applyFrame(1);
            await game.waitFrames(20);
            teachers[winnerIndex].applyFrame(3);
            updateScoreTextComponent();
            await game.waitFrames(60);
            generateQuestion();
            game.checkWinners();
            cursors.forEach((_, playerIndex) => {
                cursors[playerIndex].setPixelPosition(...CURSOR_POSITIONS[playerIndex][state.playerCursorIndex[playerIndex]]);
            })
        }
    }

    function generateQuestion(){
        console.log("generateQuestion");
        timeTexts.forEach((t,index)=>t.setText(formatTime(  0)));
        state.firstMoveReceivedAtFrame = 0;
        state.showingQuestion = false;
        state.appearTime = Math.floor(game.runtime.getState().lastReproducedFrame * (1000/60));//TODO implement game.now = () => game.runtime.getState().lastReproducedFrame * (1000/60)
        state.playerMovedTime[0] = state.playerMovedTime[1] = 0;
        state.num1 = game.randomInt(0,50);
        state.num2 = game.randomInt(0,50);
        state.solution = state.num1 + state.num2;
        state.solutionIndex = game.randomInt(0,5);
        state.resolvingWinner = false;

        const solutionMinus = state.solution - 1;
        const solutionMinusIndex = randomIntExcept(0,5, [state.solutionIndex]);
        const solutionMinus10 = state.solution - 10;
        const solutionMinus10Index = randomIntExcept(0,5, [state.solutionIndex, solutionMinusIndex]);
        const solutionPlus10 = state.solution + 10;
        const solutionPlus10Index = randomIntExcept(0,5, [state.solutionIndex, solutionMinusIndex, solutionMinus10Index]);
        state.showingQuestion = true;
        questionText.setText( `${state.num1} + ${state.num2}` );
        answerTexts.forEach((answerText, index)=>{
            if(index === state.solutionIndex) {
                answerText.setText(state.answerValues[index] = state.solution);
            }else if(index === solutionMinusIndex){
                answerText.setText(state.answerValues[index] = Math.max(1, solutionMinus));
            }else if(index === solutionMinus10Index) {
                answerText.setText(state.answerValues[index] = Math.max(1, solutionMinus10));
            }else if(index === solutionPlus10Index){
                answerText.setText(state.answerValues[index] = Math.max(1, solutionPlus10));
            }else{
                answerText.setText(state.answerValues[index] = randomIntExcept(0,100,state.answerValues));
            }
        });
        teachers.forEach(t=>t.applyFrame(0));
    }

    function randomIntExcept(min:number ,max:number, exceptions:number[]){
        let result = game.randomInt(min, max);

        while(exceptions.indexOf(result) >= 0){
            result = game.randomInt(min, max);
        }

        return result;
    }
}

const definition = {
    alias:"math-game",
    split:false,
    fps:60,
    instructions:"Select correct answer"
};

const MathGame = {definition, run};


export {MathGame}

function formatTime(time:number){
    if(!time) return "";
    return `${Math.floor(time/1000).toString().padStart(2,"0")}:${(time%1000).toString().padStart(3,"0")}`;
}