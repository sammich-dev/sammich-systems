import {
    engine,
    Entity,
    Material,
    MaterialTransparencyMode,
    TextAlignMode,
    TextShape,
    TextureFilterMode,
    TextureWrapMode,
    Transform,
    MeshRenderer,
    MeshCollider,
    ColliderLayer
} from "@dcl/sdk/ecs";

import {Color3, Vector3, Color4, Quaternion} from "@dcl/sdk/math";
import {Client} from "colyseus.js";
import {createSpriteScreen} from "../dcl-lib/sprite-screen";
import {getInputState, onInputKeyEvent, setupInputController} from "../dcl-lib/input-controller";
import {getDebugPanel} from "../dcl-lib/debug-panel";
import {getMinUserData, MinUserData} from "../dcl-lib/min-user-data";
import {createScreenRunner} from "../../lib/game-runner";
import {timers} from "@dcl-sdk/utils";
import {SammichGame} from "../../games/sammich-game";
import {sleep} from "../dcl-lib/sleep";
import {TransformTypeWithOptionals} from "@dcl/ecs/dist/components/manual/Transform";
import {createInstructionScreen} from "./instructions-screen";
import {DEFAULT_SPRITE_DEF, NAME_COLOR, SPLIT_SCREEN_SCALE} from "../../lib/sprite-constants";
import {createGlobalScoreTransition} from "./score-transition";


export async function createMachineScreen(parent: Entity, {position, rotation, scale}: TransformTypeWithOptionals) {
    setupInputController();

    const callbacks: { onEvent: Function[] } = {
        onEvent: []
    };
    const state = {
        showingInstructions:false,
        playingMiniGame:false
    };
    const colyseusClient: Client = new Client(`ws://localhost:2567`);

    const entity = engine.addEntity();

    Transform.create(entity, {
        parent,
        position,
        rotation,
        scale
    });

    const textEntity = engine.addEntity();
    Transform.create(textEntity, {
        parent: entity,
        position: Vector3.create(0, -10000, -0.01),
    });
    TextShape.create(textEntity, {
        text: ``,
        fontSize: 0.35,
        textAlign: TextAlignMode.TAM_TOP_CENTER,
    });

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
    const lobbyScreenTransform = {//TODO can be different for each player screen
        position: Vector3.create(0, 0, 0),
        parent: entity
    };
    const lobbyScreen = createSpriteScreen({
        transform: lobbyScreenTransform,
        spriteMaterial,
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 384,
            y: 128,
            w: 192,
            h: 128,

        }
    });

    const scoreTransition = createGlobalScoreTransition(lobbyScreen);
    scoreTransition.hide();

    const user: MinUserData = await getMinUserData();
    const room: any = await colyseusClient.join(`GameRoom`, {
        user,
        instanceId: 1,
        gameId: 1
    });
    const createButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 0, y: 387, w: 47, h: 25,
            metadata: {name: "createButton"}
        },
        pixelPosition: [10, 60],
        layer: 20,
        onClick: onClickCreate,
        hoverText: "Start new game"
    });

    const joinButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 49, y: 387, w: 47, h: 25,
            metadata: {name: "joinButton"}
        },
        pixelPosition: [192 - 10 - 47, 60],
        layer: 20,
        onClick: onClickJoin,
        hoverText: "Join game"
    });

    joinButton.hide();
    createButton.hide();

    let gameScreen:any, spectatorScreen:any, playerScreenRunner:any, spectatorScreenRunner:any;


    room.onMessage("MINI_GAME_WINNER", async ({ winnerIndex }:any) => {
        console.log("MINI_GAME_WINNER", winnerIndex);
        lobbyScreen.show()
        gameScreen.destroy();
        spectatorScreen.destroy();
        playerScreenRunner.runtime.stop();
        spectatorScreenRunner.runtime.stop();
        playerScreenRunner.runtime.destroy();//TODO it's not removing background sprite
        spectatorScreenRunner.runtime.destroy();

console.log("DESTROYED RUNNERS");

        await scoreTransition.showTransition({
            winnerIndex,
            previousScore:room.state.miniGameResults.reduce((acc:number, current:any)=>{
                return acc + (current.winnerPlayerIndex === winnerIndex ? 1:0);
            },0)
        });
        scoreTransition.hide();
        console.log("end transition");

    });

    let instructionsPanel:any;

    const disposeInputListener = onInputKeyEvent((inputActionKey: any, isPressed: any) => {
        //TODO use it also to send "INSTRUCTIONS_READY"
        console.log("KEY", state, inputActionKey, isPressed);
        if(state.showingInstructions){
            const playerIndex = getPlayerIndex();
            console.log("playerIndex-", playerIndex)
            room.send("INSTRUCTIONS_READY", {playerIndex: getPlayerIndex(), foo:true});
            instructionsPanel.showWaitingForOtherPlayer();
        }else if(state.playingMiniGame){
            getDebugPanel().setState(getInputState());
            const inputFrame = playerScreenRunner.runtime.pushInputEvent({
                inputActionKey,
                isPressed,
                playerIndex: getPlayerIndex()
            });
            room.send("INPUT_FRAME", {frame: inputFrame, playerIndex: getPlayerIndex()});
        }
    });

    room.onMessage("MINI_GAME_TRACK", async (miniGameTrack:any)=>{
       //TODO show instructions of the game 0
        console.log("MINI_GAME_TRACK",miniGameTrack)
        state.showingInstructions = true;
        instructionsPanel = createInstructionScreen({transform:{
                parent:lobbyScreen.getEntity(),
                position:Vector3.create(0,0,-0.05),
                scale:Vector3.One(),
                rotation:Quaternion.Zero()
            }, gameAlias:SammichGame.definition.alias, gameInstructions:SammichGame.definition.instructions});

        console.log("miniGameTrack", miniGameTrack);
    });


    room.onMessage("START_GAME", async ({miniGameId}: any) => {

        state.playingMiniGame = true;
        state.showingInstructions = false;
        instructionsPanel?.destroy();
        console.log("START_GAME", miniGameId);
        lobbyScreen.hide();

        gameScreen = createSpriteScreen({
            transform: {
                position: Vector3.create(getPlayerIndex() ? 0.25 : -0.25, 0, 0),
                //  position: Vector3.create(0.5+(SPLIT_SCREEN_WIDTH*getPlayerIndex())-SPLIT_SCREEN_WIDTH/0.5, 0,0),
                scale: SPLIT_SCREEN_SCALE,
                parent: entity
            },
            spriteMaterial,
            spriteDefinition: {
                ...DEFAULT_SPRITE_DEF,
                x: 576,
                y: 128,
                w: 192 / 2,
                h: 128,
            },
            playerIndex: getPlayerIndex()
        });

        spectatorScreen = createSpriteScreen({
            transform: {
                position: Vector3.create(getOtherPlayerIndex() ? 0.25 : -0.25, 0, 0),
                //    position: Vector3.create(2+(SPLIT_SCREEN_WIDTH*getOtherPlayerIndex())-SPLIT_SCREEN_WIDTH/2, 2,0),
                scale: SPLIT_SCREEN_SCALE,
                parent: entity
            },
            spriteMaterial,
            spriteDefinition: {
                ...DEFAULT_SPRITE_DEF,
                x: 576,
                y: 128,
                w: 192 / 2,
                h: 128
            },
            playerIndex: getOtherPlayerIndex()
        });

        playerScreenRunner = createScreenRunner({
            screen: gameScreen, //TODO REVIEW; we really should use another screen, and decouple the lobby screen from the game
            timers,
            GameFactory: SammichGame,
            playerIndex: getPlayerIndex(),
            serverRoom: undefined,
            clientRoom: room,
            isClientPlayer: true,
            recordSnapshots: true,
            velocityMultiplier:10
        });

        spectatorScreenRunner = createScreenRunner({
            screen: spectatorScreen, //TODO REVIEW; we really should use aanother screen, and decouple the lobby screen from the game
            timers,
            GameFactory: SammichGame,
            playerIndex: getOtherPlayerIndex(),
            serverRoom: undefined,
            clientRoom: room,
            isClientPlayer: false,
            velocityMultiplier:10
        });

        playerScreenRunner.runtime.start();
        spectatorScreenRunner.runtime.start();

        playerScreenRunner.runtime.attachDebugPanel(getDebugPanel());
        spectatorScreenRunner.runtime.attachDebugPanel(getDebugPanel());

        playerScreenRunner.onFrame(() => {
            room.send("PLAYER_FRAME", {
                playerIndex: getPlayerIndex(),
                n: playerScreenRunner.runtime.getCurrentFrameNumber()
            });
        });
    });

    room.onStateChange((...args: any[]) => {
        if (room.state.players.length === 2 && !room.state.started) {
            const playerIndex = getPlayerIndex();

            if (playerIndex >= 0 && !room.state.players[getPlayerIndex()].ready) {
                room.send("READY", {playerIndex});
            }

            if (room.state.miniGameResults?.length && room.state.miniGameResults.length === room.state.miniGameTrack.length) {
                //TODO finished the gamePlay?
            }
        }
        
        applyServerState();
    });

    function applyServerState() {
        if (room?.state?.players?.length === 0) {
            createButton.show();
        } else {
            createButton.hide();
        }
        if (room.state.players.length === 1) {
            Transform.getMutable(textEntity).position.y = -0.24;
            TextShape.getMutable(textEntity).text = `<color=${NAME_COLOR}>${user.displayName}</color> is waiting someone to join the game...`;
        } else {
            Transform.getMutable(textEntity).position.y = -10000;
            TextShape.getMutable(textEntity).text = ``;
        }
        if (room.state.players.length === 1 && room.state.players[0].user.userId !== user.userId) {
            joinButton.show();
        }
        if (getPlayerIndex() !== -1) {
            createButton.hide();
            joinButton.hide();
        }
        if (room.state.players.length === 2) {
            createButton.hide();
            joinButton.hide();
        }
    }

    function getPlayerIndex() {
        return room.state.players.findIndex((p: any) => p.user.userId === user?.userId);
    }

    function getOtherPlayerIndex() {
        const playerIndex = getPlayerIndex();
        if (playerIndex === -1) return -1;
        return playerIndex === 0 ? 1 : 0;
    }

    return {
        onEvent: (fn: Function) => {
            callbacks.onEvent.push(fn);
            return () => callbacks.onEvent.splice(callbacks.onEvent.indexOf(fn), 1)
        },
        onClickCreate,
        onClickJoin
    }

    function onClickJoin() {
        console.log("onClick join");
        room.send("JOIN_GAME", {user})
    }

    function onClickCreate() {
        console.log("onClick create")
        room.send("CREATE_GAME", {user});
    }
}

