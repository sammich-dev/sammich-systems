import {engine, Material, MeshRenderer, TextAlignMode, TextShape, Transform, VideoPlayer} from "@dcl/sdk/ecs";
import {TransformType} from "@dcl/ecs/dist/components/manual/Transform";
import {Vector3, Color3} from "@dcl/sdk/math";

export const createInstructionScreen = (
    {
        transform,
        gameAlias,
        gameInstructions
    }: {
        transform: TransformType,
        gameAlias: string,
        gameInstructions: string
    }) => {
    const {parent, position, rotation, scale} = transform;
    const screenEntity = engine.addEntity();
    let backupPositionY = position.y;

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
        text:`<b>INSTRUCTIONS</b>:\n${gameInstructions}\n\n\n\nPress any key when you are ready to play`,
        fontSize:0.4,
        textAlign:TextAlignMode.TAM_TOP_CENTER,
        shadowColor:Color3.Black(),
        shadowOffsetY:0.1,
        shadowOffsetX:0.1,
        shadowBlur:10
    });
    Transform.create(instructionsTextEntity, {parent:screenEntity, position:Vector3.create(0, 0.45,-0.001)});

    return {
        destroy: () => {
            engine.removeEntity(screenEntity)
            console.log("video screen destroy")
        },
        showWaitingForOtherPlayer:()=>{
            TextShape.getMutable(instructionsTextEntity).text = `<b>INSTRUCTIONS</b>:\n${gameInstructions}\n\n\n\nWaiting other player...`;
        },
        show:({alias}:any)=>{
            TextShape.getMutable(instructionsTextEntity).text = `<b>INSTRUCTIONS</b>:\n${gameInstructions}\n\n\n\nPress any key when you are ready to play`;
            Transform.getMutable(screenEntity).position.y = backupPositionY;
            VideoPlayer.getMutable(screenEntity).playing = true;
        },
        hide:()=>{
            Transform.getMutable(screenEntity).position.y = Number.MIN_SAFE_INTEGER;
            VideoPlayer.getMutable(screenEntity).playing = false;
        }
    }
}