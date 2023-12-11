import {InputAction} from "@dcl/sdk/ecs";
import {SpriteEntity} from "../lib/game-entities";
import {boxCollision} from "../lib/math-util";
const SPRITE_SIZE = {w:8,h:8};
const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};
const SAMMICH_POSITIONS = [
    12,
    28,
    44,
    60,
    76,
];
const INPUT_LEFT =  InputAction.IA_PRIMARY;
const INPUT_RIGHT =  InputAction.IA_SECONDARY;
const INPUT_FORWARD = InputAction.IA_POINTER;
const FROG_INITIAL_POSITION = [4 + 8*5, 8 + 8 * 11];
const MIN_FROG_POS_X =4 + 8*1;
const MAX_FROG_POS_X =4 + 8*10;
const MIN_CAR_POS_X = MIN_FROG_POS_X - 16;
const MAX_CAR_POS_X = MAX_FROG_POS_X + 8;

async function run({game}:any){
    const state = {
        moving:false,
        takingBurger:false,
        collision:false
    }
    game.setScreenSprite({
        spriteDefinition:{
            x:768,
            y:128,
            w:192/2,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    });

    game.setWinnerFn((player1Score:number, player2Score:number) => {
        console.log("FROG_CHECK_WINNER", player1Score, player2Score);

        if(player1Score === player2Score) return;

        const msPassed = game.runtime.getState().lastReproducedFrame * (1000/60);
        const secondsPassed = Math.floor(msPassed);

        if(
            (secondsPassed > 100 && player1Score !== player2Score)
            || Math.max(player1Score,player2Score) === 5
        ){
            if(player1Score > player2Score) return {winnerIndex:0};
            if(player1Score < player2Score) return {winnerIndex:1};
        }
    });
    const CarSprite = game.registerSpriteEntity({
        klass:"Car",
        spriteDefinition:{
            x:24,y:528, w:8, h:8, columns:1, frames:1,
            ...SPRITE_SHEET_DIMENSION,
        }
    });
    const CursorSprite = game.registerSpriteEntity({
        klass:"Frog",
        spriteDefinition:{
            x:0,y:528, w:8, h:8, columns:1,frames:2,
            ...SPRITE_SHEET_DIMENSION,
        }
    });
    const BurgerSprite = game.registerSpriteEntity({
       klass:"Burguer",
       spriteDefinition:{
           x:8,y:528, w:8, h:8,
           ...SPRITE_SHEET_DIMENSION,
       }
    });
    const burgers = SAMMICH_POSITIONS.map(px=>{
        return BurgerSprite.create({
            pixelPosition:[px,5],
            layer:1
        })
    });
    const frog = CursorSprite.create({
        pixelPosition:[...FROG_INITIAL_POSITION],
        layer:2,
        network:true,
        frame:0
    });

    game.onInput(async ({inputActionKey, isPressed, time, playerIndex}:any)=>{
        if(!isPressed || state.moving || state.collision || state.takingBurger) return;
        let [x,y] = frog.getPixelPosition();
        if(inputActionKey === INPUT_LEFT){
            if(x <= MIN_FROG_POS_X) return;
            state.moving = true;
            frog.setPixelPosition(
                x-4,
                y
            );
            await animateFrog();
            frog.setPixelPosition(
                x-8,
                y
            );
            state.moving = false;
        }else if(inputActionKey === INPUT_RIGHT){
            state.moving = true;
            if(x >= MAX_FROG_POS_X) return;
            frog.setPixelPosition(
                x+4,
                y
            );
            await animateFrog();
            frog.setPixelPosition(
                x+8,
                y
            );
            state.moving = false;
        }else if(inputActionKey === INPUT_FORWARD){
            state.moving = true;
            frog.setPixelPosition(
                x,
                y-4
            );
            await animateFrog();
            frog.setPixelPosition(
                x,
                y-8
            );
            if(y <= 16){
                checkBurgers();
                resetFrog();
            }
            state.moving = false;
        }
        game.checkWinners();

        function checkBurgers(){
            [x,y] = frog.getPixelPosition();
            const foundBurger = SAMMICH_POSITIONS.findIndex(i=>i===x);
            if(~foundBurger){
                burgers[foundBurger].sprite.hide();
                game.setPlayerScore(game.getPlayerScore()+1);
                state.takingBurger = true;
            }
        }
    });

    game.onFrame(async (n:number)=>
        carTracks.forEach((c:any)=>
            c.frame(n)));

    const carTracks = [1,2,3,4,5,7,8,9,10].map(track => createCarPool(game, track));

    function createCarPool(game:any,track:number = 1){
        const carPoolState = {
            countDt:0,
            nextCarAt:Number.MAX_VALUE,
            currentPoolIndex:0
        };
        const NUM_CARS = game.randomInt(1,3);

        const velocity = game.randomInt(2,8);
        const CAR_SIZE = 8;
        let cancel:any, iterations = 0;
        const direction = game.randomInt(0,1) ? 1 : -1;
        const spawnsX = Array(NUM_CARS).fill(null).reduce((acc, current)=>{
            let x = game.randomInt(1, 7)*10;
            while(!cancel && acc.find((xx:number)=>(xx) - (x) < ((CAR_SIZE)+1))){
                x = game.randomInt(1, 7)*10;

                iterations++;
                if(iterations > 10000){
                    console.error("Tell the author he did something wrong in the code", iterations);
                    cancel = true;
                }
            }
            acc.push(x);

            return acc;
        },[]);

        const pool = spawnsX.map((v:number,index:number)=>{
            return CarSprite.create({
                pixelPosition:[v, 8 + 8 * track],
                frame:1,
                layer:2,
            })
        });

        return {
            frame:(n:number)=>{
                carPoolState.countDt++;
                if(carPoolState.countDt > velocity){
                    carPoolState.countDt = 0;
                    pool.forEach((car:SpriteEntity, index:number) => {
                        const [x,y] = car.getPixelPosition();
                        if(x > MAX_CAR_POS_X || x < MIN_CAR_POS_X){
                            car.setPixelPosition(direction > 0 ? MIN_CAR_POS_X : MAX_CAR_POS_X, y)
                        }else{
                            car.setPixelPosition(x+direction, y);
                        }

                        const [fx,fy] = frog.getPixelPosition();
                        const [cx ,cy] = car.getPixelPosition();
                        if(!state.collision && boxCollision({x:fx, y:fy,...SPRITE_SIZE},{x:cx, y:cy,...SPRITE_SIZE})){
                            console.log("COLLISITON",state.collision)

                            state.collision = true;
                            resetFrog();
                        }
                    });
                }
            }
        }
    }
    async function resetFrog(){
        await game.waitFrames(60);
        frog.setPixelPosition(...FROG_INITIAL_POSITION);
        state.moving = false;
        state.collision = false;
        state.takingBurger = false;
        console.log("COLLISITON reste")
    }

    async function animateFrog(){
        frog.applyFrame(1);
        await game.waitFrames(4);
        frog.applyFrame(0);
    }
}


const definition = {
    alias:"frog-game",
    split:true,
    fps:60,
    instructions:"play with frog"
};

const FrogGame = {definition, run};


export {FrogGame}
