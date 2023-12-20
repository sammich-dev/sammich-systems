import {
    engine,
    Entity,
    Material,
    MaterialTransparencyMode,
    TextAlignMode,
    TextShape,
    TextureFilterMode,
    TextureWrapMode,
    Transform
} from "@dcl/sdk/ecs";


import {Color3, Quaternion, Vector3} from "@dcl/sdk/math";
import {Client} from "colyseus.js";
import {createSpriteScreen} from "../dcl-lib/sprite-screen";
import {getInputState, onInputKeyEvent, setupInputController} from "../dcl-lib/input-controller";
import {getDebugPanel} from "../dcl-lib/debug-panel";
import {getMinUserData, MinUserData} from "../dcl-lib/min-user-data";
import {createScreenRunner} from "../../lib/game-runner";
import {timers} from "@dcl-sdk/utils";
import {TransformTypeWithOptionals} from "@dcl/ecs/dist/components/manual/Transform";
import {createInstructionScreen} from "./instructions-screen";
import {DEFAULT_SPRITE_DEF, NAME_COLOR, SHARED_SCREEN_SCALE, SPLIT_SCREEN_SCALE} from "../../lib/sprite-constants";
import {createGlobalScoreTransition} from "./score-transition";
import {throttle} from "../dcl-lib/throttle";
import {getGame, setupGameRepository} from "../../lib/game-repository";
import {getRealm} from '~system/Runtime'
import {sleep} from "../dcl-lib/sleep";
import {GAME_STAGE} from "../../lib/game-stages";
import {cloneDeep, waitFor} from "../../lib/lib-util";
import {EVENT} from "./events";

const INSTRUCTION_READY_TIMEOUT = 5000;
const DEFAULT_SCREEN_SPRITE_DEFINITION = {
    ...DEFAULT_SPRITE_DEF,
    x: 576, y: 128, w: 192, h: 128,
}


export async function createMachineScreen(parent: Entity, {position, rotation, scale}: TransformTypeWithOptionals, gameInstanceId:string) {
    setupInputController();
    setupGameRepository();
    let reconnectionToken:any;
    const callbacks: { onEvent: Function[] } = {
        onEvent: []
    };
    const state = {
        connected:false,
        gameStage:GAME_STAGE.NOT_CONNECTED,
        sentInstructionsReady:false,
        sentReady:false
    };
    const {realmInfo} = await getRealm({});
    console.log("realmInfo",realmInfo);

    const user: MinUserData = await getMinUserData();
    const entity = engine.addEntity();
    const waitingTextEntity = engine.addEntity();
    Transform.create(entity, {
        parent,
        position,
        rotation,
        scale
    });
    Transform.create(waitingTextEntity, {
        parent: entity,
        position: Vector3.create(0, -10000, -0.01),
    });
    TextShape.create(waitingTextEntity, {
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

    console.log("lobbyScreen", lobbyScreen);
    const disconnectionText = lobbyScreen.addText({text:"DISCONNECTED", textColor:[1,0,0,1], pixelPosition:[192/2,4], layer:10, textAlign:TextAlignMode.TAM_TOP_CENTER, fontSize:1});
    const scoreTransition = createGlobalScoreTransition(lobbyScreen);
    const colyseusClient: Client = new Client(~(realmInfo?.realmName||"").toLowerCase().indexOf("local")?`ws://localhost:2567`:"wss://sammich.pro/colyseus");

    const connectRoom = async ()=>{
        console.log("connectRoom");
        let _room;
        while(!state.connected){
            try{
                _room = await colyseusClient.join(`GameRoom`, {
                    user,
                    gameInstanceId
                });
                console.log("CONNECTED", _room?.roomId);
                state.connected = true;
            }catch(error:any){
                console.log("error connecting", error?.message);
                await sleep(3000);
                state.connected = false;
            }
        }
        return _room;
    };
    const onMiniGameTrack = async (miniGameTrack:any) => {
        //TODO show instructions of the game 0
        console.log("MINI_GAME_TRACK", miniGameTrack);
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
    const reconnect = async (code:number) => {
        console.log("leave code", code);
        disconnectionText.show();
        state.connected = false;
        let    error4212 = false;
        while(!state.connected){
            try{
                console.log("reconnecting...")
                room = error4212?await connectRoom(): await colyseusClient.reconnect(reconnectionToken);
                error4212 = false;
                console.log("connection DONE!", room, room?.reconnectionToken);

                reconnectionToken = room.reconnectionToken;
                state.connected = true;
                disconnectionText.hide();
                addRoomHandlers();
                handleLobbyScreenState();
            }catch(error:any){

                await sleep(3000);
                if(error?.code === 4212){
                    error4212 = true;
                }
                console.log("error reconnecting", error)
            }
        }
    };
    const inLocalStage = (stage:GAME_STAGE) => state.gameStage === stage;
    const inRoomStage = (stage:GAME_STAGE) => room.state.gameStage === stage;
    const diffStage = (stage:GAME_STAGE)=> inLocalStage(stage) !== inRoomStage(stage);
    const roomOnStateChange = () => {
        console.log("roomOnStateChange.");
        logStates();
        handleLobbyScreenState();
        handlePlayersSendingReady();
        handleStageChange( GAME_STAGE.SHOWING_INSTRUCTIONS, showInstructions, hideInstructions);
        handleStageChange( GAME_STAGE.PLAYING_MINIGAME, startMiniGame);
        handleStageChange( GAME_STAGE.TIE_BREAKER, showTieBreaker);
        handleStageChange( GAME_STAGE.SHOWING_SCORE_TRANSITION, handleScoreTransition)
        handleStageChange( GAME_STAGE.SHOWING_END, handleEndTrack);

        function handleEndTrack(){
            const trackWinnerIndex = getGlobalWinner();
            scoreTransition.showFinalSprite(trackWinnerIndex);
            callbacks.onEvent.forEach(e=>e({
                type:EVENT.END_TRACK,
                data:{
                    trackWinnerIndex
                }
            }));

            resetTrackState();
            disposeInputListener && disposeInputListener();


            function resetTrackState(){
                scoreTransition.reset();
                Object.assign(state, {
                    sentReady:false,
                    sentInstructionsReady:false
                })
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

        state.gameStage = room.state.gameStage;

        function handlePlayersSendingReady(){
            const playerIndex = getPlayerIndex();
            if (
                playerIndex >= 0
                && !state.sentReady
                && room.state.players.length === 2
                && inRoomStage(GAME_STAGE.WAITING_PLAYERS_READY)
            ) {
                state.sentReady = true;
                console.log("SEND READY")
                room.send("READY", {playerIndex});
                setInputListener();
            }
        }

        async function handleStageChange(gameStage:GAME_STAGE, fn:Function, elseFn?:Function){
            if(diffStage(gameStage)){
                if(inRoomStage(gameStage)){
                    fn();
                }else if(elseFn) {
                    elseFn();
                }
            }
        }

        function showTieBreaker(){
            console.log("showTieBreaker", room.state.tieBreakerWinner)
            if(getPlayerIndex() !== 0){
                screenRunners[0].runtime.reproduce();
            }
            screenRunners[0].runtime.tieBreaker({
                winnerIndex:room.state.tieBreakerWinner
            });
        }

        function showInstructions(){
            const nextMiniGameIndex = room.state.miniGameResults.length;
            const nextGameId = room.state.miniGameTrack[nextMiniGameIndex];
            lobbyScreen.show();
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
        }

        function hideInstructions(){
            lobbyScreen.hide();
            instructionsPanel?.destroy();
        }
    };

    let room: any = await connectRoom();

    addRoomHandlers();

    disconnectionText.hide();
    reconnectionToken = room.reconnectionToken;
console.log("reconnectionToken",reconnectionToken);
    const createButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 0, y: 387, w: 47, h: 25,
            metadata: {name: "createButton"}
        },
        pixelPosition: [10, 80],
        layer: 200,
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
        pixelPosition: [192 - 10 - 47, 80],
        layer: 200,
        onClick: onClickJoin,
        hoverText: "Join game",
        klass:"JoinButton"
    });

    joinButton.hide();
    createButton.hide();

    let playerScreens:any[] = [], screenRunners:any[] = [];
    let instructionsPanel:any;

    const handleScoreTransition = async () => {
        console.log("handleScoreTransition");
        const winnerIndex = room.state.miniGameResults[room.state.miniGameResults.length-1];
        const finalize = getGlobalWinner() !== -1;
        const miniGameResults = room.state.miniGameResults;
        //TODO esto despues de TIE_BREAKER
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


        await scoreTransition.showTransition({
            winnerIndex,
            previousScore,
            isFinal,
            displayName1:room.state.players[0].displayName,
            displayName2:room.state.players[1].displayName,
            trackWinnerIndex
        });
        scoreTransition.hide();
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

    function getPlayingMiniGameId(){
        let index;
        if(inRoomStage(GAME_STAGE.IDLE)) return;
        index = room.state.miniGameResults.length;
        return room.state.miniGameTrack[index];
    }
    const startMiniGame = async () => {
        const miniGameId = getPlayingMiniGameId();
        console.log("START_GAME", miniGameId);
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

    function logStates(){
        console.log("local state", cloneDeep(state));
        console.log("room state", room.state.toJSON());
    }


    function addRoomHandlers(){
        console.log("addRoomHandlers");
        //room.onMessage("MINI_GAME_WINNER", roomOnMessageMiniGameWinner);//TODO move to stage state logic
        room.onMessage("INPUT_FRAME", roomOnInputFrame);
        room.onMessage("MINI_GAME_TRACK", onMiniGameTrack);
        room.onMessage("*", (...args:any[])=>{
            console.log("any message", args)
        });
        //room.onMessage("START_GAME", roomOnStart);
        room.onLeave(reconnect);
        room.onStateChange(roomOnStateChange);
    }

    function setInputListener(){
        const playerIndex = getPlayerIndex();
        if(playerIndex < 0) return;
        disposeInputListener = onInputKeyEvent((inputActionKey: any, isPressed: any) => {
            console.log("input", inputActionKey, isPressed)
                if(inRoomStage(GAME_STAGE.SHOWING_INSTRUCTIONS) && !state.sentInstructionsReady){
                    state.sentInstructionsReady = true;
                    console.log("sending INSTRUCTIONS_READY");
                    room.send("INSTRUCTIONS_READY", {playerIndex, foo:1});
                    instructionsPanel.showWaitingForOtherPlayer({timeout:INSTRUCTION_READY_TIMEOUT});
                }else if(inRoomStage(GAME_STAGE.PLAYING_MINIGAME)){
                    getDebugPanel().setState(getInputState());
                    const gameId = room.state.miniGameTrack[room.state.miniGameResults.length];
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
        });
    }

    let disposeInputListener:any;

    function handleLobbyScreenState() {
        console.log("handleLobbyScreenState", room.state.toJSON());
        logStates();


        if (inRoomStage(GAME_STAGE.IDLE)) {
            hideWaitingText();
            createButton.show();
            joinButton.hide();
        } else if (inRoomStage(GAME_STAGE.WAITING_PLAYER_JOIN)) {
            createButton.hide();
            joinButton.show();
            showWaitingText(`<color=${NAME_COLOR}>${room.state.players[0]?.user?.displayName}</color> is waiting someone to join the game...`);
        } else {
            joinButton.hide();
            createButton.hide();
            hideWaitingText();
        }

        if(room.state.players.some((p:any)=>p?.user.userId === user?.userId)){
            joinButton.hide();
            createButton.hide();
        }

        if (inLocalStage(GAME_STAGE.SHOWING_END)) {
            createButton.hide();
            joinButton.hide();
        }
    }
    function showWaitingText(str:string){
        Transform.getMutable(waitingTextEntity).position.y = -0.24;
        TextShape.getMutable(waitingTextEntity).text = str;
    }

    function hideWaitingText(){
        Transform.getMutable(waitingTextEntity).position.y = -10000;
        TextShape.getMutable(waitingTextEntity).text = ``;
    }
    function getPlayerIndex() {
        return room.state.players.findIndex((p: any) => p?.user?.userId === user?.userId);
    }

    return {
        onEvent: (fn: Function) => {
            callbacks.onEvent.push(fn);
            return () => callbacks.onEvent.splice(callbacks.onEvent.indexOf(fn), 1)
        },
        getState:()=>({...state, ...room.state.toJSON()})
    }

    function onClickJoin() {
        console.log("onClick join");
        logStates();
        room.send("JOIN_GAME", {user})
    }

    function onClickCreate() {
        console.log("onClick create");
        logStates();

        room.send("CREATE_GAME", {user});
    }

    function getPlayerGlobalScore(playerIndex:number){
        return room.state.miniGameResults
            .reduce((acc:any, current:any)=>current === playerIndex ? (acc+1):acc,0)
    }

    function getGlobalWinner(){
        const player1GlobalScore = getPlayerGlobalScore(0);
        const player2GlobalScore = getPlayerGlobalScore(1);
        if(
            ((player1GlobalScore >= 3 || player2GlobalScore >= 3) && player1GlobalScore !== player2GlobalScore)
            || room.state.miniGameResults.length === 5
        ){
            return player1GlobalScore>player2GlobalScore?0:1
        }
        return -1;
    }
}
