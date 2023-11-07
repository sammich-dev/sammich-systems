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
} from '@dcl/sdk/ecs'
import {Vector3, Color3} from "@dcl/sdk/math";
import {createScreenRunner} from "../../lib/game-runner";
import {SammichGame} from "../../games/sammich-game";
import {DifferenceGame} from "../../games/difference-game";

import {timers} from "@dcl-sdk/utils";
import {getDebugPanel} from "../dcl-lib/debug-panel";
import {getInputState, onInputKeyEvent, setupInputController} from "../dcl-lib/input-controller";
import {createSpriteScreen} from "../dcl-lib/sprite-screen";
import {getMinUserData, MinUserData} from "../dcl-lib/min-user-data";
import {Client, Room} from "colyseus.js";
import "../dcl-lib/decorate-console";
import "./polyfill";
import {sleep} from "../dcl-lib/sleep";
import {FrameEventType} from "../../lib/frame-util";


export const init = ()=>{
    const SPRITESHEET_WIDTH = 1024;
    const SPRITESHEET_HEIGHT = 1024;

    const SPLIT_SCREEN_RESOLUTION_WIDTH = 192 / 2;
    const SPLIT_SCREEN_WIDTH = SPLIT_SCREEN_RESOLUTION_WIDTH / 40;

    const DEFAULT_SPRITE_DEF = {
        spriteSheetWidth: SPRITESHEET_WIDTH,
        spriteSheetHeight: SPRITESHEET_HEIGHT,
        columns: 1, frames: 1
    };
    const rootEntity = engine.addEntity();
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
    const spriteScreenTransform = {
        position: Vector3.create(2, 4, 8),
        scale: Vector3.create(192 / 40, 128 / 40, 1),
        parent: rootEntity
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

    const state = {
        playerIndex: -1
    }

    getDebugPanel();
    setupInputController();


    console.log("INDEX2");

    (async () => {



        const createButton = lobbyScreen.addSprite({
                spriteDefinition: {
                    ...DEFAULT_SPRITE_DEF,
                    x: 0, y: 387, w: 47, h: 25
                },
                pixelPosition: [10, 100],
                layer: 1,
                onClick: (event: any) => {
                    lobbyScreen.hide();
                    (new Array(4)).fill(null).forEach((_,playerIndex) => {
                        (async () => {
                            console.log("gameScreen", playerIndex)
                            const gameScreen = createSpriteScreen({
                                transform: {
                                    position: Vector3.create(playerIndex*2.4, 4, 8 - 0.1),
                                    scale: Vector3.create(SPLIT_SCREEN_WIDTH, 128 / 40, 1),
                                    parent: rootEntity
                                },
                                spriteMaterial,
                                spriteDefinition: {
                                    ...DEFAULT_SPRITE_DEF,
                                    x: 576,
                                    y: 128,
                                    w: 192 / 2,
                                    h: 128,
                                },
                                playerIndex
                            });

                            const screenRunner = createScreenRunner({
                                screen: gameScreen, //TODO REVIEW; we really should use another screen, and decouple the lobby screen from the game
                                timers,
                                GameFactory: SammichGame,
                                serverRoom: undefined,
                                playerIndex,
                                clientRoom: undefined,
                                isClientPlayer: true,
                                recordFrames: true,
                                seed:30,
                                velocityMultiplier:playerIndex
                            });

                            const disposeInputListener = onInputKeyEvent((inputActionKey: any, isPressed: any) => {
                             //   getDebugPanel().setState(getInputState());
                                const inputFrame = screenRunner.runtime.pushInputEvent({
                                    inputActionKey,
                                    isPressed,
                                    playerIndex
                                });

                            });
                            screenRunner.runtime.start();
                        })();
                    });

                }
            });
        createButton.show();
    })();
}

