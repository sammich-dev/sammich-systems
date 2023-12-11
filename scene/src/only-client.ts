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
import {Vector3, Color3, Quaternion} from "@dcl/sdk/math";
import {createScreenRunner} from "../../lib/game-runner";
import {SammichGame} from "../../games/sammich-game";
import {DifferenceGame} from "../../games/difference-game";
import {FrogGame} from "../../games/frog-game";

import {TestWait} from "../../games/test-wait";
import {timers} from "@dcl-sdk/utils";
import {getDebugPanel, hideDebugPanel} from "../dcl-lib/debug-panel";
import {getInputState, onInputKeyEvent, setupInputController} from "../dcl-lib/input-controller";
import {createSpriteScreen} from "../dcl-lib/sprite-screen";
import {getMinUserData, MinUserData} from "../dcl-lib/min-user-data";
import {Client, Room} from "colyseus.js";
import "../dcl-lib/decorate-console";
import "./polyfill";
import {sleep} from "../dcl-lib/sleep";
import {FrameEventType} from "../../lib/frame-util";
import {DEFAULT_SPRITE_DEF, SHARED_SCREEN_SCALE, SPLIT_SCREEN_SCALE} from "../../lib/sprite-constants";
import {AttackGame} from "../../games/attack-game";
import {MathGame} from "../../games/math-game";
import {TieBreaker} from "../../games/tie-breaker";
const FRAME_MS = 1000/60;

export const init = () => {
    const SPRITESHEET_WIDTH = 1024;
    const SPRITESHEET_HEIGHT = 1024;
    const SCREEN_RESOLUTION_WIDTH = 192;
    const SCREEN_WIDTH = SCREEN_RESOLUTION_WIDTH/40;
    const SPLIT_SCREEN_RESOLUTION_WIDTH = 192 / 2;
    const SPLIT_SCREEN_WIDTH = SPLIT_SCREEN_RESOLUTION_WIDTH / 40;

    const DEFAULT_SPRITE_DEF = {
        spriteSheetWidth: SPRITESHEET_WIDTH,
        spriteSheetHeight: SPRITESHEET_HEIGHT,
        columns: 1, frames: 1
    };
    const rootEntity = engine.addEntity();
    Transform.create(rootEntity, {
        position:Vector3.create(8,2,8),
        rotation:Quaternion.Zero(),
        scale: Vector3.create(192 / 40, 128 / 40, 1)
    })
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
    //hideDebugPanel();
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
            onClick
        });
        createButton.show();

        onClick();
    })();

    function onClick() {
        lobbyScreen.hide();
        (new Array(1)).fill(null).forEach((_, playerIndex) => {
            (async () => {
                console.log("gameScreen", playerIndex);
                const GameFactory = TieBreaker;
                const gameScreen = createSpriteScreen({
                    transform: {
                        position:Vector3.create(playerIndex,0,0),
                        scale: GameFactory.definition.split?SPLIT_SCREEN_SCALE:SHARED_SCREEN_SCALE,
                        parent: rootEntity
                    },
                    spriteMaterial,
                    spriteDefinition: {
                        ...DEFAULT_SPRITE_DEF,
                        x: 576,
                        y: 128,
                        w: (GameFactory.definition.split ? 192 / 2 : 192),
                        h: 128,
                    }
                });
                let checkWinnersFn:Function = ()=>{};
                const serverRoom = {
                    state:{players:[{miniGameScore:0, lastReproducedFrame:0},{miniGameScore:0, lastReproducedFrame:0}]},
                    checkWinners:(...args:any[])=>{
                        console.log("checkWinners",args);
                        const winnerInfo =  checkWinnersFn(
                            serverRoom.state.players[0].miniGameScore,
                            serverRoom.state.players[1].miniGameScore
                        );
                        if(winnerInfo?.winnerIndex !== undefined){
                            screenRunner.runtime.destroy();
                            gameScreen.destroy();
                        }
                    },
                    setWinnerFn:(fn:Function)=>{
                        console.log("checkWinnersFn = fn", checkWinnersFn = fn);
                        return () => checkWinnersFn = ()=>{};
                    }
                }
                const screenRunner = createScreenRunner({
                    screen: gameScreen, //TODO REVIEW; we really should use another screen, and decouple the lobby screen from the game
                    timers,
                    GameFactory,
                    playerIndex:1,
                    seed: 29,
                    isClientPlayer: true,
                    recordFrames: true,//TODO gameRunner should not record frames, but provide interface
                    serverRoom,
                    clientRoom: undefined,
                    velocityMultiplier: 1,
                    autoPlay:true
                });
                screenRunner.runtime.onWinner(()=>{
                    console.log("WINNER!")
                    screenRunner.runtime.destroy();
                    gameScreen.destroy();
                })

                console.log("onInputKeyEvent init");

                const disposeInputListener = onInputKeyEvent((inputActionKey: any, isPressed: any) => {
                    const inputFrame = screenRunner.runtime.pushInputEvent({
                        time:Date.now() - screenRunner.runtime.getState().startTime,
                        frameNumber:screenRunner.runtime.getState().lastReproducedFrame,
                        inputActionKey,
                        isPressed,
                        playerIndex
                    });
                });

                screenRunner.runtime.start();
            })();
        });

    }

}

