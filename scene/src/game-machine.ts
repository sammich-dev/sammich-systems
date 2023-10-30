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
import {Color3, Vector3, Color4} from "@dcl/sdk/math";
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

const SPRITESHEET_WIDTH = 1024;
const SPRITESHEET_HEIGHT = 1024;
const DEFAULT_SPRITE_DEF = {
    spriteSheetWidth: SPRITESHEET_WIDTH,
    spriteSheetHeight: SPRITESHEET_HEIGHT,
    columns: 1, frames: 1
};
const SPLIT_SCREEN_RESOLUTION_WIDTH = 192 / 2;
const SPLIT_SCREEN_WIDTH = SPLIT_SCREEN_RESOLUTION_WIDTH / 40;
const NAME_COLOR = `#e2bf37`;
const SPLIT_SCREEN_SCALE = Vector3.create(0.5, 1, 1)

export async function createMachineScreen(parent: Entity, {position, rotation, scale}: TransformTypeWithOptionals) {
    setupInputController();
    const callbacks: { onEvent: Function[] } = {
        onEvent: []
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

    let gameScreen, spectatorScreen, playerScreenRunner:any, spectatorScreenRunner:any;

    room.onMessage("MINI_GAME_WINNER", async ({done, winnerIndex, miniGameIndex}:any) => {
        console.log("MINI_GAME_WINNER", {done, winnerIndex, miniGameIndex});
        playerScreenRunner.stop();
        spectatorScreenRunner.stop();
        
        //TODO show winnerSprite and loser Sprite
    });
    
    room.onMessage("START_GAME", async ({miniGameId}: any) => {
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
            recordSnapshots: true
        });

        spectatorScreenRunner = createScreenRunner({
            screen: spectatorScreen, //TODO REVIEW; we really should use aanother screen, and decouple the lobby screen from the game
            timers,
            GameFactory: SammichGame,
            playerIndex: getOtherPlayerIndex(),
            serverRoom: undefined,
            clientRoom: room,
            isClientPlayer: false
        });

        let disposeInputListener: any;

        disposeInputListener = onInputKeyEvent((inputActionKey: any, isPressed: any) => {
            getDebugPanel().setState(getInputState());
            const inputFrame = playerScreenRunner.runtime.pushInputEvent({
                inputActionKey,
                isPressed,
                playerIndex: getPlayerIndex()
            });
            room.send("INPUT_FRAME", {frame: inputFrame, playerIndex: getPlayerIndex()});
        });

        playerScreenRunner.runtime.start();
        spectatorScreenRunner.runtime.start();

        playerScreenRunner.onFrame(() => {
            room.send("PLAYER_FRAME", {
                playerIndex: getPlayerIndex(),
                n: playerScreenRunner.runtime.getCurrentFrameNumber()
            });
        });
    });

    room.onStateChange((...args: any[]) => {
        if (room.state.players.length === 2) {
            const playerIndex = getPlayerIndex();
            if (playerIndex >= 0) {
                room.send("READY", {playerIndex});
            }
            if (room.state.miniGameResults?.length && room.state.miniGameResults.length === room.state.miniGameTrack.length) {
                //TODO finished the gamePlay?

            }
        }

        applyServerState();
    })

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

