import {TransformTypeWithOptionals} from "@dcl/ecs/dist/components/manual/Transform";
import {
    ColliderLayer,
    engine,
    Font,
    InputAction,
    Material,
    MeshCollider,
    MeshRenderer,
    PBMaterial_PbrMaterial,
    PointerEvents,
    pointerEventsSystem,
    PointerEventType,
    TextAlignMode,
    TextShape,
    Transform
} from "@dcl/sdk/ecs";
import {Color4, Vector3} from "@dcl/sdk/math";

import {
    createSpriteAnimationUVSGetter,
    getUvsFromSprite,
    Sprite,
    SpriteDefinition,
    UVS_BACK
} from "../../lib/sprite-util";

export type SpriteScreenOptions = {
    transform: TransformTypeWithOptionals,
    spriteMaterial: PBMaterial_PbrMaterial,
    spriteDefinition: SpriteDefinition,
    playerIndex?:number
};

export function createSpriteScreen({
                                       playerIndex = -1,
                                       transform,
                                       spriteMaterial,
                                       spriteDefinition//will also define screen resolution, which will affect zoom and click event info with coords
                                   }: SpriteScreenOptions) {
    const screenEntity = createSpritePlane({spriteMaterial, spriteDefinition, transform})
    const state:{spriteDefinition:SpriteDefinition} = {
        spriteDefinition
    };
    MeshCollider.setPlane(screenEntity);

    const screenSpriteDefinition = spriteDefinition;
    const pixelSize = [
        (transform?.scale?.x || 0) / spriteDefinition.w,
        (transform?.scale?.y || 0) / spriteDefinition.h
    ];


    const SPRITE_BUTTON_POINTER_OPTIONS = {pointerEvents:[{
            eventType: PointerEventType.PET_DOWN,
            eventInfo: {
                button: InputAction.IA_POINTER,
                showFeedback: true
            }
        }]}
    const transformBackup = (JSON.parse(JSON.stringify(transform)));
    return {
        setBackgroundSprite:({spriteDefinition}:{spriteDefinition:SpriteDefinition})=>{
            const mutablePlane:any = MeshRenderer.getMutable(screenEntity);
            state.spriteDefinition = spriteDefinition;
            if(mutablePlane.mesh) mutablePlane.mesh[mutablePlane.mesh.$case].uvs = getUvsFromSprite({spriteDefinition, back:UVS_BACK.MIRROR});
        },
        getSize:()=>[state.spriteDefinition.w, state.spriteDefinition.h],
        addSprite: ({ID, spriteDefinition, onClick, pixelPosition, layer, network, hoverText}: any):Sprite => {
            const normalizedPixelPosition = normalizePixelPosition(pixelPosition[0], pixelPosition[1], layer);
            const state = {
                pixelPosition,
                network,
                layer,
                frame:0,
                destroyed:false
            };
            const spriteEntity = createSpritePlane({
                spriteDefinition,
                transform: {
                    parent: screenEntity,
                    scale: Vector3.create(
                        spriteDefinition.w / screenSpriteDefinition.w,
                        spriteDefinition.h / screenSpriteDefinition.h,
                        1),
                    position: Vector3.create(
                        ...normalizedPixelPosition
                    )
                },
                spriteMaterial
            });
            let spriteAnimationUVS:any;
            if(spriteDefinition.columns){
                spriteAnimationUVS = createSpriteAnimationUVSGetter({
                    spriteDefinition,
                    back:UVS_BACK.MIRROR
                });
            }


            if (onClick) {
                console.log("0mClick", spriteEntity);
                MeshCollider.setPlane(spriteEntity, [ColliderLayer.CL_POINTER]);
                PointerEvents.create(spriteEntity, SPRITE_BUTTON_POINTER_OPTIONS)
                pointerEventsSystem.onPointerDown({ entity: spriteEntity, opts:{hoverText, showFeedback:true, button:InputAction.IA_POINTER} },(event) => onClick(event));
            }else{
                MeshCollider.setPlane(spriteEntity, [ColliderLayer.CL_NONE])
            }

            return {
                ID,
                destroy: () => {
                    console.log("destroy", ID);
                    engine.removeEntity(spriteEntity);
                    state.destroyed = true;
                    console.log("DESTROYED ", ID)
                    //TODO REVIEW POSSIBLE MEMORY LEAKS
                },
                applyFrame:(n:number)=>{
                    if(!spriteAnimationUVS) return;
                    state.frame = n;
                    if(state.destroyed) return;
                   const mutablePlane:any = MeshRenderer.getMutable(spriteEntity);
                   if(mutablePlane.mesh) mutablePlane.mesh[mutablePlane.mesh.$case].uvs = spriteAnimationUVS(n);
                },
                getFrame:()=>state.frame,
                getLayer:()=>state.layer,
                hide:()=>{
                    //pointerEventsSystem.removeOnPointerUp(spriteEntity);
                    Transform.getMutable(spriteEntity).position.y = Number.MIN_SAFE_INTEGER;
                },
                show:()=>{
                    //pointerEventsSystem.onPointerUp({ entity: spriteEntity },(event) => onClick(event));
                    Transform.getMutable(spriteEntity).position.y = normalizedPixelPosition[1];
                },
                getPixelPosition:()=>state.pixelPosition,
                setPixelPosition:(px:number,py:number)=>{
                    if(state.destroyed) return;
                    state.pixelPosition = [ px, py ];
                    const mutablePosition = Transform.getMutable(spriteEntity).position;
                    const normalizedPixelPosition = normalizePixelPosition(px,py, layer);
                    mutablePosition.x = normalizedPixelPosition[0];
                    mutablePosition.y = normalizedPixelPosition[1];
                },
                getNetwork:()=>state.network,
                setNetwork:(value:boolean)=>state.network = value
            }

            function normalizePixelPosition(xPixels: number, yPixels: number, layer: number) {
                const offsetX = (spriteDefinition.w / screenSpriteDefinition.w) / 2 - 0.5;
                const offsetY = 0.5 - (spriteDefinition.h / screenSpriteDefinition.h) / 2

                return [
                    offsetX + (xPixels / screenSpriteDefinition.w),
                    offsetY - (yPixels / screenSpriteDefinition.h),
                    -layer * 0.001
                ];
            }

        },
        addText: ({pixelPosition = [0,0], textAlign = TextAlignMode.TAM_TOP_LEFT, text = "FOO", textColor = Color4.create(0,0,0,1), fontSize = 0.5, layer = 10}:any) => {
            const normalizedPosition = normalizePixelPositionForText(pixelPosition[0], pixelPosition[1], layer)
            console.log("text normalizedPosition",normalizedPosition);
            const textEntity = engine.addEntity();
            TextShape.create(textEntity, {text, textAlign, textColor, fontSize, font:Font.F_MONOSPACE});
            Transform.create(textEntity, {
                parent:screenEntity,
                position:Vector3.create(...normalizedPosition)
            });
            return {
                destroy: () => {
                    engine.removeEntity(textEntity)
                },
                setText: (value:string) => TextShape.getMutable(textEntity).text = value.toString(),
                setPixelPosition:(px:number,py:number)=>{
                    const normalizedPosition = normalizePixelPositionForText(px,py, layer);
                    console.log("text normalizedPosition",px,py,normalizedPosition);
                    const mutablePosition = Transform.getMutable(textEntity).position;
                    mutablePosition.x = normalizedPosition[0];
                    mutablePosition.y = normalizedPosition[1];
                },
                hide: () => Transform.getMutable(textEntity).position.y = -10000,
                show: () => Transform.getMutable(textEntity).position.y = normalizedPosition[1],
            }

            function normalizePixelPositionForText(xPixels: number, yPixels: number, layer: number) {
                return [
                   (xPixels - (screenSpriteDefinition.w/2)) * (1 / screenSpriteDefinition.w) ,
                   -(yPixels + (screenSpriteDefinition.h/2)) * (1 / screenSpriteDefinition.h) + 1,
                   -layer * 0.001
                ];
            }
        },
        getEntity: () => screenEntity,
        hide:()=>{
            Transform.getMutable(screenEntity).position.y = Number.MIN_SAFE_INTEGER;
        },
        show:()=>{
            console.log("show lobby screen", transformBackup.position?.y)
            Transform.getMutable(screenEntity).position.y = (transformBackup.position?.y || 0);
        },
        destroy:()=>{
            engine.removeEntity(screenEntity);
        }
    }
}


export function createSpritePlane({spriteDefinition, transform, spriteMaterial}: any) {
    const planeEntity = engine.addEntity();

    MeshRenderer.setPlane(planeEntity, getUvsFromSprite({
        spriteDefinition, back: UVS_BACK.MIRROR
    }));
    Transform.create(planeEntity, transform);
    Material.setPbrMaterial(planeEntity, spriteMaterial);

    return planeEntity;
}
