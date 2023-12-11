import {createScoreTextComponent, updateScoreTextComponent} from "./utils/mini-game-score";

const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};
const WAIT_FOR_OTHER_PLAYER_RESPONSE_FRAMES = 60 * 2;
async function run({game}:any){
    const state = {
        keyAppearTime:0,
        playerMovedTime:[0,0],
        playerMovedKey:[0,0],
        firstMoveReceivedAtFrame:0,
        resolvingWinner:false,
        keyToPress:-1,
        showingKey:false,
        score:[0,0]
    };

    game.setWinnerFn((player1Score:number, player2Score:number) => {
        if((player1Score + player2Score) >= 5){
            if( player1Score > player2Score) return {winnerIndex:0};
            if( player1Score < player2Score) return {winnerIndex:1};
        }
    });

    createScoreTextComponent(game);

    game.setScreenSprite({
        spriteDefinition:{
            x:576,
            y:0,
            w:192,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    });

    const WomanSprite = game.registerSpriteEntity({
        klass:"Woman",
        spriteDefinition:{
            x:0,y:640, w:63, h:69, columns:3,frames:3,
            ...SPRITE_SHEET_DIMENSION,
        }
    });
    const w1 = WomanSprite.create({
        pixelPosition:[192/4*1 - Math.floor(WomanSprite.spriteDefinition.w/2) + 10, 45],
        layer:1,
        network:true
    });
    const w2 = WomanSprite.create({
        pixelPosition:[192/4*3 - Math.floor(WomanSprite.spriteDefinition.w/2) - 10, 45],
        layer:1,
        network:true
    });
    const womenAttack = game.registerSpriteEntity({
        klass:"Woman",
        spriteDefinition:{
            x:193, y:640, w:96, h:69,
            ...SPRITE_SHEET_DIMENSION,
        }
    }).create({
        pixelPosition:[192/2 - 96/2, 45],
        layer:5,
        network:true
    });
    womenAttack.hide();
    const KeySprite = game.registerSpriteEntity({
        klass:"Key",
        spriteDefinition:{
            x:96, y:388,
            w:18, h:24,columns:3,frames:3,
            ...SPRITE_SHEET_DIMENSION,
        }
    });
    const CrossSprite = game.registerSpriteEntity({
        klass:"Cross",
        spriteDefinition:{
            x:176, y:512,
            w:16, h:16,
            ...SPRITE_SHEET_DIMENSION,
        }
    });
    const c1 = CrossSprite.create({
            pixelPosition:[192/4*1 - Math.floor(KeySprite.spriteDefinition.w/2) + 10, 24],
            layer:5,
            network:true
    });
    const c2 = CrossSprite.create({
        pixelPosition:[192/4*3 - Math.floor(KeySprite.spriteDefinition.w/2) - 10, 24],
        layer:5,
        network:true
    });

    const t1 = game.addText({
        text:``,
        pixelPosition:[192/4*1 - Math.floor(KeySprite.spriteDefinition.w/2) + 10 - 20, 114],
        fontSize:1,
        textColor:[1,1,1,1]
    });
    const t2 = game.addText({
        text:``,
        pixelPosition:[192/4*3 - Math.floor(KeySprite.spriteDefinition.w/2) - 10 - 20, 114],
        fontSize:1,
        textColor:[1,1,1,1]
    });

    const timeTexts = [t1, t2];

    c1.hide();
    c2.hide();

    const k1 = KeySprite.create({
        pixelPosition:[192/4*1 - Math.floor(KeySprite.spriteDefinition.w/2) + 10, 20],
        layer:4,
        network:true
    });

    const k2 = KeySprite.create({
        pixelPosition:[192/4*3 - Math.floor(KeySprite.spriteDefinition.w/2) - 10, 20],
        layer:4,
        network:true
    });





    const women = [w1,w2];
    const crosses = [c1, c2];
    const keys = [k1,k2];

    w2.setZoom([-1,1]);

    game.onInput(async ({inputActionKey, isPressed, time, playerIndex, frameNumber}:any) => {
        console.log("onInput frameNumber",frameNumber)
        if(!state.showingKey) return;
        if(state.playerMovedTime[playerIndex]) return;

        state.playerMovedTime[playerIndex] = time;
        state.playerMovedKey[playerIndex] = inputActionKey;
        state.firstMoveReceivedAtFrame = state.firstMoveReceivedAtFrame || game.runtime.getState().lastReproducedFrame;

        if(isPressed){
            if( inputActionKey !== state.keyToPress){
                crosses[playerIndex].show();
            }
            women[playerIndex].applyFrame(1);
        }
    });

    game.onFrame(checkAttackMove);

    await setupKey();

    async function checkAttackMove(frameNumber:number){
        if(!state.showingKey) return;
        if(!state.firstMoveReceivedAtFrame) return;
        if(state.resolvingWinner) return;

        let winnerIndex = -1;
        if(state.playerMovedTime.every(i=>i)){
            if(state.playerMovedKey.every(i => i === state.keyToPress)){//both are correct
                winnerIndex = state.playerMovedTime[0] < state.playerMovedTime[1] ? 0 : 1;
            }else if(state.playerMovedKey.some(i => i === state.keyToPress)){//
                winnerIndex = state.playerMovedKey.findIndex(i=>i===state.keyToPress);
            }else if(state.playerMovedKey.every(i => i !== state.keyToPress)){
                winnerIndex = state.playerMovedTime[0] > state.playerMovedTime[1] ? 0 : 1;
            }
        }else if(state.firstMoveReceivedAtFrame && ((frameNumber - state.firstMoveReceivedAtFrame) > WAIT_FOR_OTHER_PLAYER_RESPONSE_FRAMES )){
            const playerAnswered = state.playerMovedTime.findIndex(i => i);
            if(playerAnswered >= 0){
                if(state.playerMovedKey[playerAnswered] === state.keyToPress){
                    winnerIndex = playerAnswered;
                }else{
                    winnerIndex = playerAnswered === 0 ? 1 : 0;
                }
            }
        }
        if(winnerIndex >= 0){
            state.resolvingWinner = true;
            console.log("setPlayerScore")
            game.players[winnerIndex].setPlayerScore(++state.score[winnerIndex]);
            women.forEach(w=>w.hide());
            womenAttack.setZoom([winnerIndex?-1:1,1])
            womenAttack.show();
            console.log("times", state.keyAppearTime, state.playerMovedTime[0])
            timeTexts.forEach((t,index)=>state.playerMovedTime[index] && t.setText(formatTime(  state.playerMovedTime[index]-state.keyAppearTime)));
            updateScoreTextComponent();
            await game.waitFrames(60);
            setupKey();
            game.checkWinners();
        }
    }

    async function setupKey(){
        state.firstMoveReceivedAtFrame = 0;
        state.playerMovedTime[0] = 0;
        state.playerMovedTime[1] = 0;
        state.showingKey = false;
        state.playerMovedKey[0] = -1;
        state.playerMovedKey[1] = -1;
        state.keyToPress = game.randomInt(0,2);
        console.log("SETUP_KEY", state.keyToPress, "frame:",game.runtime.getState().lastReproducedFrame )
        state.resolvingWinner = false;
        womenAttack.hide();
        women.forEach(w=>w.show(0));
        women.forEach(w=>w.applyFrame(0));
        crosses.forEach(c=>c.hide());
        keys.forEach(k=>k.hide());
        keys.forEach(k=>k.applyFrame(state.keyToPress));
        timeTexts.forEach(t=>t.setText(formatTime(0)));
        await game.waitFrames(60);
        state.keyAppearTime = Math.floor(game.runtime.getState().lastReproducedFrame * (1000/60));
        state.showingKey = true;
        keys.forEach(k=>k.show());
    }
}

const definition = {
    alias:"attack-game",
    split:false,
    fps:60,
    instructions:"attack-game"
};

const AttackGame = {definition, run};

export {AttackGame}

function formatTime(time:number){
    if(!time) return "";
    return `${Math.floor(time/1000).toString().padStart(2,"0")}:${(time%1000).toString().padStart(3,"0")}`;
}