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
import {TransformTypeWithOptionals} from "@dcl/ecs/dist/components/manual/Transform";
import {createInstructionScreen} from "./instructions-screen";
import {DEFAULT_SPRITE_DEF, NAME_COLOR, SPLIT_SCREEN_SCALE, SHARED_SCREEN_SCALE} from "../../lib/sprite-constants";
import {createGlobalScoreTransition} from "./score-transition";
import {throttle} from "../dcl-lib/throttle";
import {getGame, setupGameRepository} from "../../lib/game-repository";
import {EVENT} from "./events";
const INSTRUCTION_READY_TIMEOUT = 5000;
const DEFAULT_SCREEN_SPRITE_DEFINITION = {
    ...DEFAULT_SPRITE_DEF,
    x: 576, y: 128, w: 192, h: 128,
}
import { getRealm } from '~system/Runtime'
import {create} from "domain";
import {sleep} from "../dcl-lib/sleep";


export async function createMachineScreen(parent: Entity, {position, rotation, scale}: TransformTypeWithOptionals, gameInstanceId:string) {
    setupInputController();
    setupGameRepository();
    const callbacks: { onEvent: Function[] } = {
        onEvent: []
    };
    const state = {
        connected:false,
        showingInstructions:false,
        playingMiniGame:false,
        sentInstructionsReady:false,
        sentReady:false,
        tieBreaker:false,
        ending:false
    };
    const {realmInfo} = await getRealm({});
    console.log("realmInfo",realmInfo);

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
    const disconnectionText = lobbyScreen.addText({text:"DISCONNECTED", textColor:[1,0,0,1], pixelPosition:[192/2,4], layer:10, textAlign:TextAlignMode.TAM_TOP_CENTER, fontSize:1});

    const scoreTransition = createGlobalScoreTransition(lobbyScreen);
    scoreTransition.hide();

    const user: MinUserData = await getMinUserData();

    const colyseusClient: Client = new Client((realmInfo?.realmName||"").indexOf("localhost")?`ws://localhost:2567`:"wss://sammich.pro/colyseus");

    const connectRoom = async ()=>{
        let _room;
        while(!state.connected){
            try{

                _room = await colyseusClient.join(`GameRoom`, {
                    user,
                    gameInstanceId
                });
                console.log("CONNECTED")
                state.connected = true;
            }catch(error:any){
                console.log("error connecting", error?.message);
                await sleep(3000);
                state.connected = false;
            }
        }
        return _room;
    }
    let room: any = await connectRoom();

    disconnectionText.hide();
    let reconnectionToken = room.reconnectionToken;


    const createButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 0, y: 387, w: 47, h: 25,
            metadata: {name: "createButton"}
        },
        pixelPosition: [10, 60],
        layer: 20,
        onClick: onClickCreate,
        hoverText: "Start new game",
        klass:"CreateButton"
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
        hoverText: "Join game",
        klass:"JoinButton"
    });

    joinButton.hide();
    createButton.hide();

    let playerScreens:any[] = [], screenRunners:any[] = [];
    let instructionsPanel:any;


    const roomOnMessage = async ({ winnerIndex, miniGameIndex, finalize,miniGameResults }:any) => {
        console.log("MINI_GAME_WINNER", winnerIndex, miniGameResults);

        disposeInputListener();
        playerScreens.forEach((s:any)=>s.destroy());
        screenRunners.forEach(sr=>sr.runtime.stop());
        screenRunners.forEach(sr=>sr.runtime.destroy());
        playerScreens = [];
        screenRunners = [];

        lobbyScreen.show();

        const previousScore = room.state.miniGameResults.reduce((acc:number, current:any)=>{
            return acc + (current === winnerIndex ? 1:0);
        },0);
        const isFinal = !!finalize;
        const trackWinnerIndex = getTrackWinnerFromMiniGameResults(miniGameResults);
        console.log("trackWinnerIndex",trackWinnerIndex)
        state.ending = isFinal;

        await scoreTransition.showTransition({
            winnerIndex,
            previousScore,
            isFinal,
            displayName1:room.state.players[0].displayName,
            displayName2:room.state.players[1].displayName,
            trackWinnerIndex
        });
        scoreTransition.hide();

        if(finalize){
            state.showingInstructions = false;

            console.log("finalize")
            state.sentReady = false;
            scoreTransition.reset();
            callbacks.onEvent.forEach(e=>e({
                type:EVENT.END_TRACK,
                data:{
                    trackWinnerIndex
                }
            }))
        }else{
            state.showingInstructions = true;

            const nextGameId = room.state.miniGameTrack[miniGameIndex+1];
            instructionsPanel = createInstructionScreen({
                transform: {
                    parent: lobbyScreen.getEntity(),
                    position: Vector3.create(0, 0, -0.05),
                    scale: Vector3.One(),
                    rotation: Quaternion.Zero()
                },
                gameAlias: getGame(nextGameId).definition.alias,
                gameInstructions: getGame(nextGameId).definition.instructions,
            });
            setInputListener(nextGameId)
        }

        state.ending = false;
        state.playingMiniGame = false;
        state.sentInstructionsReady = false;

        function getTrackWinnerFromMiniGameResults(miniGameResults:number[]){
            let scores:number[] = [0,0];
            miniGameResults.forEach(winnerIndex => {
                scores[winnerIndex]++
            });
            console.log("scores", scores);
            if(scores[0] > scores[1]){
                return 0;
            }else{
                return 1;
            }
        }
    };

    const roomOnTieBreaker = async ({winnerIndex}:{winnerIndex:number})=>{
        if(state.tieBreaker) return;
        console.log("TIE_BREAKER",{winnerIndex});

        state.tieBreaker = true;

        if(getPlayerIndex() !== 0){
            console.log("reproducing 0 runner from player", getPlayerIndex())
            screenRunners[0].runtime.reproduce();
        }
        await screenRunners[0].runtime.tieBreaker({winnerIndex});
    };
    const roomOnInputFrame = ({playerIndex, frame}:any)=>{
        //TODO review if best approach, for now to represent other player State
        if(playerIndex !== getPlayerIndex()){
            screenRunners.forEach(runner => {
                const inputData = frame.events[frame.events.length-1].data
                runner.runtime.pushInputEvent({
                    ...inputData,
                    playerIndex
                })
            })
        }
    };
    const onMiniGameTrack = async (miniGameTrack:any) => {
        //TODO show instructions of the game 0
        console.log("MINI_GAME_TRACK", miniGameTrack);
        state.showingInstructions = true;
        setInputListener(miniGameTrack[0])
        instructionsPanel = createInstructionScreen({
            transform: {
                parent: lobbyScreen.getEntity(),
                position: Vector3.create(0, 0, -0.05),
                scale: Vector3.One(),
                rotation: Quaternion.Zero()
            },
            gameAlias: getGame(miniGameTrack[0]).definition.alias,
            gameInstructions: getGame(miniGameTrack[0]).definition.instructions,
        });

    };
    const roomOnStart = async ({miniGameId}: any) => {
        console.log("START_GAME", miniGameId);

        state.tieBreaker = false;
        state.sentInstructionsReady = false;
        state.playingMiniGame = true;
        state.showingInstructions = false;
        instructionsPanel.destroy();
        lobbyScreen.hide();
        const GameFactory = getGame(miniGameId);
        console.log("GameFactory.definition",GameFactory.definition);
        if(GameFactory.definition.split){
            playerScreens = new Array(2).fill(null).map((_, playerIndex)=>createSpriteScreen({
                transform: {
                    position:Vector3.create(playerIndex?0.25:-0.25, 0, 0),
                    scale: SPLIT_SCREEN_SCALE,
                    parent: entity
                },
                spriteMaterial,
                spriteDefinition: {
                    ...DEFAULT_SCREEN_SPRITE_DEFINITION,
                    w: 192 / 2,
                }
            }));

            screenRunners = playerScreens.map((screen, playerIndex) => createScreenRunner({
                screen, //TODO REVIEW; we really should use another screen, and decouple the lobby screen from the game
                timers,
                GameFactory,
                playerIndex,
                serverRoom: undefined,
                clientRoom: room,
                isClientPlayer: playerIndex === getPlayerIndex(),
                velocityMultiplier:1
            }));
            screenRunners.forEach((runner, playerIndex)=>{
                if(playerIndex === getPlayerIndex()){
                    runner.runtime.attachDebugPanel(getDebugPanel());
                    startPlayerRunner(runner);
                }else{
                    runner.runtime.start(false);
                }
            })
        }else{//shared screen
            const playerIndex = getPlayerIndex();
            const screen = createSpriteScreen({
                transform: {
                    position:Vector3.Zero(),
                    scale: SHARED_SCREEN_SCALE,
                    parent: entity
                },
                spriteMaterial,
                spriteDefinition: {
                    ...DEFAULT_SCREEN_SPRITE_DEFINITION
                }
            });
            playerScreens = [screen];

            screenRunners = [createScreenRunner({
                screen, //TODO REVIEW; we really should use another screen, and decouple the lobby screen from the game
                timers,
                GameFactory,
                playerIndex: getPlayerIndex(),
                serverRoom: undefined,
                clientRoom: room,
                isClientPlayer:true,//TODO for shared-screen , is really a clientPlayer, it owuld be better to define if it's shared screen
                sharedScreen:true,//TODO or maybe: reactToNetworkSprites
                velocityMultiplier:1
            })];

            startPlayerRunner(screenRunners[0]);
        }

        function startPlayerRunner(runner:any){
            runner.runtime.start(true);
            let disposeOnFrame:any;
            const throttleSendPlayerFrame = throttle(() => { //TODO REVIEW, leak | dispose
                if(!runner || runner.runtime.getState().destroyed){
                    if(disposeOnFrame) disposeOnFrame();
                    return;
                }
                const playerFrameData = {
                    playerIndex:getPlayerIndex(),
                    n: runner.runtime.getState().lastReproducedFrame
                }
                room.send("PLAYER_FRAME", playerFrameData);
            },100);
            disposeOnFrame = runner.onFrame(throttleSendPlayerFrame);
        }
    };
    const reconnect = async (code:number) => {
        console.log("leave code",code);
        disconnectionText.show();
        state.connected = false;
        let    error4212 = false;
        while(!state.connected){
            try{
                room = error4212?await connectRoom(): await colyseusClient.reconnect(reconnectionToken);
                error4212 = false;
                console.log("connection DONE!", room, room?.reconnectionToken);

                reconnectionToken = room.reconnectionToken;
                state.connected = true;
                disconnectionText.hide();
            }catch(error:any){

                await sleep(3000);
                if(error?.code === 4212){
                    error4212 = true;
                }
                console.log("error reconnecting", error)
            }
        }
    };

    const roomOnStateChange = (...args: any[]) => {
        if (room.state.players.length === 2 && !room.state.started) {
            const playerIndex = getPlayerIndex();

            if (playerIndex >= 0 && !state.sentReady) {
                if(!state.sentReady){
                    console.log("sending ready",state.sentReady);
                    state.sentReady = true;
                    room.send("READY", {playerIndex});
                }
            }
        }

        if(room.state.players.filter((p:any)=>p.instructionsReady).length === 1){
            instructionsPanel.setTimeout(INSTRUCTION_READY_TIMEOUT);
            if(getPlayerIndex() >= 0 && !room.state.players[getPlayerIndex()].instructionsReady){
                timers.setTimeout(() => {
                    if(!state.sentInstructionsReady){
                        state.sentInstructionsReady = true;
                        room.send("INSTRUCTIONS_READY", { playerIndex: getPlayerIndex(), foo: 2 });
                    }
                }, INSTRUCTION_READY_TIMEOUT);
            }
        }

        applyServerState();
    };

    addRoomHandlers();

    function addRoomHandlers(){
        room.onMessage("MINI_GAME_WINNER", roomOnMessage);
        room.onMessage("TIE_BREAKER", roomOnTieBreaker);
        room.onMessage("INPUT_FRAME", roomOnInputFrame);
        room.onMessage("MINI_GAME_TRACK", onMiniGameTrack);
        room.onMessage("START_GAME", roomOnStart);
        room.onLeave(reconnect);
        room.onStateChange(roomOnStateChange);
    }

    function setInputListener(gameId:number){
        console.log("setInputListener", gameId);
        disposeInputListener = onInputKeyEvent((inputActionKey: any, isPressed: any) => {
            const playerIndex = getPlayerIndex();
            console.log("onInputKeyEvemt", inputActionKey, isPressed, playerIndex, JSON.stringify(state,null, " "));

            if(playerIndex >= 0){
                if(state.showingInstructions && !state.sentInstructionsReady){
                    state.sentInstructionsReady = true;
                    room.send("INSTRUCTIONS_READY", {playerIndex, foo:1});
                    instructionsPanel.showWaitingForOtherPlayer({timeout:INSTRUCTION_READY_TIMEOUT});
                }else if(state.playingMiniGame){
                    getDebugPanel().setState(getInputState());
                    const split = getGame(gameId).definition.split;
                    const runner = screenRunners[split?playerIndex:0];
                    const inputFrame = runner.runtime.pushInputEvent({
                        time:Date.now() - runner.runtime.getState().startTime,
                        frameNumber:runner.runtime.getState().lastReproducedFrame,
                        inputActionKey,
                        isPressed,
                        playerIndex
                    });

                    //TODO set time
                    room.send("INPUT_FRAME", {frame: inputFrame, playerIndex});
                }
            }
        });
    }

    let disposeInputListener:any;



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

        if (room.state.players.length === 2
            || state.ending
            || getPlayerIndex() !== -1
        ) {
            createButton.hide();
            joinButton.hide();
        }
    }

    function getPlayerIndex() {
        return room.state.players.findIndex((p: any) => p.user.userId === user?.userId);
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

