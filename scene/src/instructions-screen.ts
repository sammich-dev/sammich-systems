import {engine, Material, MeshRenderer, TextAlignMode, TextShape, Transform, VideoPlayer} from "@dcl/sdk/ecs";
import {TransformType} from "@dcl/ecs/dist/components/manual/Transform";
import {Vector3, Color3} from "@dcl/sdk/math";
import {timers} from "@dcl-sdk/utils";

export const createInstructionScreen = (
    {
        transform,
        gameAlias,
        gameInstructions,
        playerIndex
    }: {
        transform: TransformType,
        gameAlias: string,
        gameInstructions: string,
        playerIndex: number
    }) => {
    console.log("createInstructionScreen", gameAlias);
    const state = {
        timeoutStartedTime:0,
        waitingOther:false,
        timeout:0
    }
    const {parent, position, rotation, scale} = transform;
    let screenEntity = engine.addEntity();
    const WAITING_BOTH_PLAYERS_TEXT = `<b>INSTRUCTIONS</b>:\n${gameInstructions}\n\n\n\nPress any key when you are ready to play`;
    const WAITING_ONE_PLAYER_TEXT = `<b>INSTRUCTIONS</b>:\n${gameInstructions}\n\n\n\nWaiting other player...`;
    const WAITING_FROM_NON_PLAYER = `<b>INSTRUCTIONS</b>:\n${gameInstructions}\n\n\n\nWaiting players ...`;

    MeshRenderer.setPlane(screenEntity);

    Transform.create(screenEntity, {parent, position, rotation, scale});

    VideoPlayer.create(screenEntity, {
        src: `instruction-videos/${gameAlias}.mp4`,
        playing: true,
    });
    const videoTexture = Material.Texture.Video({videoPlayerEntity: screenEntity})
    Material.setPbrMaterial(screenEntity, {
        texture: videoTexture,
        roughness: 1.0,
        specularIntensity: 0,
        metallic: 0,
    });

    const instructionsTextEntity = engine.addEntity();
    TextShape.create(instructionsTextEntity, {
        text:~playerIndex?WAITING_BOTH_PLAYERS_TEXT:WAITING_FROM_NON_PLAYER,
        fontSize:0.4,
        textAlign:TextAlignMode.TAM_TOP_CENTER,
        shadowColor:Color3.Black(),
        shadowOffsetY:0.1,
        shadowOffsetX:0.1,
        shadowBlur:10
    });
    Transform.create(instructionsTextEntity, {parent:screenEntity, position:Vector3.create(0, 0.45,-0.001)});
    let countdownInterval:number = 0;
    const setTimeout = (timeout:number)=> {
        console.log("countdown",setTimeout)
        state.timeout = timeout;
        if(countdownInterval) timers.clearInterval(countdownInterval);
        state.timeoutStartedTime = Date.now();
        countdownInterval = timers.setInterval(()=>{
            if(~playerIndex){
                if(state.waitingOther){
                    TextShape.getMutable(instructionsTextEntity).text = WAITING_ONE_PLAYER_TEXT + `\n\n${formatTimeout(state.timeout - (Date.now() - state.timeoutStartedTime))}`;
                }else{
                    TextShape.getMutable(instructionsTextEntity).text = WAITING_BOTH_PLAYERS_TEXT+ `\n\n${formatTimeout(state.timeout - (Date.now() - state.timeoutStartedTime))}`;
                }
            }else{
                TextShape.getMutable(instructionsTextEntity).text = WAITING_FROM_NON_PLAYER+ `\n\n${formatTimeout(state.timeout - (Date.now() - state.timeoutStartedTime))}`;
            }
        }, 300);
    };
    return {
        destroy: () => {
            engine.removeEntity(instructionsTextEntity);
            engine.removeEntity(screenEntity);
            timers.clearInterval(countdownInterval);
            countdownInterval = 0;
            console.log("video screen destroy")
        },
        getState:()=>state,
        showWaitingForOtherPlayer:({timeout = 20000})=>{
            state.waitingOther = true;
            TextShape.getMutable(instructionsTextEntity).text = WAITING_ONE_PLAYER_TEXT;
            if(timeout){
                setTimeout(timeout);
            }
        },
        setTimeout
    }
}

function formatTimeout(ms:number){
    return `<b>${Math.max(0,Math.floor(ms/1000))}</b>`;
}