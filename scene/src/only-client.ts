import {createSpriteScreen, createBox} from "dcl-sammich-screen";
import {Vector3, Color3} from "@dcl/sdk/math";
import {
    engine,
    Material,
    MaterialTransparencyMode,
    MeshRenderer,
    PBMaterial_PbrMaterial,
    TextureFilterMode,
    TextureWrapMode,
    Transform,
    Entity,
} from '@dcl/sdk/ecs';
import {DEFAULT_SPRITE_DEF} from "dcl-sammich-screen/dist/lib/sprite-constants";
import {timers} from "@dcl-sdk/utils";



export const init = () => {
    //createBox();

    const rootEntity = engine.addEntity();
    const spriteScreenTransform = {
        position: Vector3.create(4, 2, 8),
        scale: Vector3.create(192 / 40, 128 / 40, 1),
        parent: rootEntity
    };
    const spriteTexture = Material.Texture.Common({
        src: 'images/spritesheet.png',
        wrapMode: TextureWrapMode.TWM_REPEAT,
        filterMode: TextureFilterMode.TFM_POINT
    });
    const spriteMaterial = {
        texture: spriteTexture,
        emissiveTexture: spriteTexture,
        emissiveIntensity: 0.6,
        emissiveColor: Color3.create(1, 1, 1),
        specularIntensity: 0,
        roughness: 1,
        alphaTest: 1,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST
    };
    const lobbyScreen = createSpriteScreen({
        transform: spriteScreenTransform,
        spriteMaterial,
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 384,
            y: 128,
            w: 192,
            h: 128,

        }
    });

    const createButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 0, y: 387, w: 47, h: 25
        },
        pixelPosition: [10, 100],
        layer: 1,
    });

    console.log("TIME_0")
    timers.setTimeout(()=>{
        console.log("TIME_1")
        createButton.setPixelPosition(20,100);
    },5000)
    timers.setTimeout(()=>{
        console.log("TIME_2")
        createButton.setPixelPosition(30,100);

    },10000)
}

