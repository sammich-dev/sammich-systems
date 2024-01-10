import { engine, Transform } from "@dcl/sdk/ecs";
import "./polyfill";
import { Color3, Quaternion, Vector3 } from "@dcl/sdk/math";
import { Client } from "colyseus.js";
import { createSpriteScreen } from "./sprite-screen";
import { onInputKeyEvent, setupInputController } from "./input-controller";
import { getMinUserData } from "./min-user-data";
import { createScreenRunner } from "./game-runner";
import { timers } from "@dcl-sdk/utils";
import { createInstructionScreen } from "./instructions-screen";
import { DEFAULT_SPRITE_DEF, NAME_COLOR, SHARED_SCREEN_SCALE, SPLIT_SCREEN_SCALE, SPRITE_SHEET_DIMENSION } from "../../../sprite-constants";
import { createGlobalScoreTransition } from "./score-transition";
import { throttle } from "./throttle";
import { getGame, setupGameRepository } from "../../../game-repository";
import { dclSleep } from "./dcl-sleep";
import { GAME_STAGE } from "../../../game-stages";
import { cloneDeep } from "../../../lib-util";
import { EVENT } from "./events";
import { getTexture } from "./texture-repository";
const INSTRUCTION_READY_TIMEOUT = 7000;
const INSTRUCTION_TOTAL_TIMEOUT = 30000;
const DEFAULT_SCREEN_SPRITE_DEFINITION = {
    ...DEFAULT_SPRITE_DEF,
    x: 576, y: 128, w: 192, h: 128,
};
const WAITING_TEXT_Y = 104;
const FONT_SIZE = 0.35;
const COVER_SPRITE_DEFINITION = {
    ...DEFAULT_SPRITE_DEF,
    x: 0,
    y: 0,
    w: 192,
    h: 128,
};
const TRANSITION_SCREEN_SPRITE_DEFINITION = {
    x: 576,
    y: 128,
    w: 192,
    h: 128,
    ...SPRITE_SHEET_DIMENSION
};
export async function createSammichScreen(parent, { position, rotation, scale, defaultTextureSrc = "https://sammich.pro/images/spritesheet.png", baseInstructionVideoURL = "https://sammich.pro/instruction-videos", colyseusServerURL = "wss://sammich.pro/colyseus" }, _gameInstanceId) {
    const gameInstanceId = _gameInstanceId || "default";
    setupInputController();
    setupGameRepository();
    console.log("SAMMICH_SCREEN");
    let reconnectionToken;
    const callbacks = {
        onEvent: []
    };
    const state = {
        connected: false,
        gameStage: GAME_STAGE.NOT_CONNECTED,
        sentInstructionsReady: false,
        sentReady: false
    };
    const user = await getMinUserData();
    const entity = engine.addEntity();
    Transform.create(entity, {
        parent,
        position,
        rotation,
        scale
    });
    const spriteTexture = getTexture(defaultTextureSrc);
    const spriteMaterial = {
        texture: spriteTexture,
        emissiveTexture: spriteTexture,
        emissiveIntensity: 0.6,
        emissiveColor: Color3.create(1, 1, 1),
        specularIntensity: 0,
        roughness: 1,
        alphaTest: 1,
        transparencyMode: 1
    };
    const lobbyScreenTransform = {
        position: Vector3.create(0, 0, 0),
        parent: entity
    };
    const lobbyScreen = createSpriteScreen({
        transform: lobbyScreenTransform,
        spriteMaterial,
        spriteDefinition: COVER_SPRITE_DEFINITION
    });
    const waitingTextEntity = lobbyScreen.addText({
        pixelPosition: [192 / 2, WAITING_TEXT_Y + 4],
        textAlign: 1,
        text: `    <color=${NAME_COLOR}>Gest</color> is waiting som`,
        textColor: [1, 1, 1, 1],
        fontSize: FONT_SIZE,
        layer: 2
    });
    const waitingTextBackground = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 384, y: 218, w: 192, h: 25,
            metadata: { name: "text-background" }
        },
        pixelPosition: [0, WAITING_TEXT_Y],
        layer: 1,
        klass: "TextBackground"
    });
    waitingTextEntity.hide();
    waitingTextBackground.hide();
    const disconnectionText = lobbyScreen.addText({ text: "DISCONNECTED", textColor: [1, 0, 0, 1], pixelPosition: [192 / 2, 110], layer: 10, textAlign: 1, fontSize: 1 });
    const scoreTransition = createGlobalScoreTransition(lobbyScreen);
    const colyseusClient = new Client(colyseusServerURL);
    const connectRoom = async () => {
        console.log("connectRoom");
        let _room;
        while (!state.connected) {
            try {
                _room = await colyseusClient.joinOrCreate(`GameRoom`, {
                    user,
                    gameInstanceId
                });
                console.log("CONNECTED", _room?.roomId);
                state.connected = true;
            }
            catch (error) {
                console.log("error connecting", error?.message);
                await dclSleep(3000);
                state.connected = false;
            }
        }
        return _room;
    };
    const onMiniGameTrack = async (miniGameTrack) => {
        console.log("MINI_GAME_TRACK", miniGameTrack);
    };
    const roomOnInputFrame = ({ playerIndex, frame }) => {
        if (playerIndex !== getPlayerIndex()) {
            screenRunners.forEach(runner => {
                const inputData = frame.events[frame.events.length - 1].data;
                runner.runtime.pushInputEvent({
                    ...inputData,
                    playerIndex
                });
            });
        }
    };
    const reconnect = async (code) => {
        console.log("leave code", code);
        disconnectionText.show();
        state.connected = false;
        let error4212 = false;
        while (!state.connected) {
            try {
                console.log("reconnecting...");
                room = error4212 ? await connectRoom() : await colyseusClient.reconnect(reconnectionToken);
                error4212 = false;
                console.log("connection DONE!", room, room?.reconnectionToken);
                reconnectionToken = room.reconnectionToken;
                state.connected = true;
                disconnectionText.hide();
                addRoomHandlers();
                handleLobbyScreenState();
            }
            catch (error) {
                await dclSleep(3000);
                if (error?.code === 4212) {
                    error4212 = true;
                }
                console.log("error reconnecting", error);
            }
        }
    };
    const inLocalStage = (stage) => state.gameStage === stage;
    const inRoomStage = (stage) => room.state.gameStage === stage;
    const diffStage = (stage) => inLocalStage(stage) !== inRoomStage(stage);
    const roomOnStateChange = () => {
        console.log("roomOnStateChange.");
        logStates();
        handlePlayersSendingReady();
        handleStageChange(GAME_STAGE.IDLE, handleLobbyScreenState);
        handleStageChange(GAME_STAGE.SHOWING_INSTRUCTIONS, showInstructions, hideInstructions);
        handleStageChange(GAME_STAGE.PLAYING_MINIGAME, startMiniGame);
        handleStageChange(GAME_STAGE.TIE_BREAKER, showTieBreaker);
        handleStageChange(GAME_STAGE.SHOWING_SCORE_TRANSITION, handleScoreTransition);
        handleStageChange(GAME_STAGE.SHOWING_END, handleEndTrack);
        if (room.state.players.filter((p) => p.instructionsReady).length === 1) {
            instructionsPanel.setTimeout(INSTRUCTION_READY_TIMEOUT);
            if (getPlayerIndex() >= 0 && !room.state.players[getPlayerIndex()].instructionsReady) {
                timers.setTimeout(() => {
                    if (!state.sentInstructionsReady) {
                        state.sentInstructionsReady = true;
                        room.send("INSTRUCTIONS_READY", { playerIndex: getPlayerIndex(), foo: 2 });
                    }
                }, INSTRUCTION_READY_TIMEOUT);
            }
        }
        state.gameStage = room.state.gameStage;
        handleLobbyScreenState();
        function handleEndTrack() {
            const trackWinnerIndex = getGlobalWinner();
            scoreTransition.showFinalSprite(trackWinnerIndex);
            callbacks.onEvent.forEach(e => e({
                type: EVENT.END_TRACK,
                data: {
                    trackWinnerIndex
                }
            }));
            resetTrackState();
            disposeInputListener && disposeInputListener();
            function resetTrackState() {
                scoreTransition.reset();
                Object.assign(state, {
                    sentReady: false,
                    sentInstructionsReady: false
                });
            }
        }
        function handlePlayersSendingReady() {
            const playerIndex = getPlayerIndex();
            if (playerIndex >= 0
                && !state.sentReady
                && room.state.players.length === 2
                && inRoomStage(GAME_STAGE.WAITING_PLAYERS_READY)) {
                state.sentReady = true;
                console.log("SEND READY");
                room.send("READY", { playerIndex });
                setInputListener();
            }
            else if (!inRoomStage(GAME_STAGE.WAITING_PLAYERS_READY) && state.sentReady) {
                state.sentReady = false;
            }
        }
        async function handleStageChange(gameStage, fn, elseFn) {
            if (diffStage(gameStage)) {
                if (inRoomStage(gameStage)) {
                    fn();
                }
                else if (elseFn) {
                    elseFn();
                }
            }
        }
        function showTieBreaker() {
            console.log("showTieBreaker", room.state.tieBreakerWinner);
            if (getPlayerIndex() !== 0) {
                screenRunners[0].runtime.reproduce();
            }
            screenRunners[0].runtime.tieBreaker({
                winnerIndex: room.state.tieBreakerWinner
            });
        }
        function showInstructions() {
            const nextMiniGameIndex = room.state.miniGameResults.length;
            const nextGameId = room.state.miniGameTrack[nextMiniGameIndex];
            console.log("showInstructions", nextMiniGameIndex, nextGameId, getGame(nextGameId).definition.alias);
            lobbyScreen.show();
            state.sentInstructionsReady = false;
            instructionsPanel = createInstructionScreen({
                transform: {
                    parent: lobbyScreen.getEntity(),
                    position: Vector3.create(0, 0, -0.05),
                    scale: Vector3.One(),
                    rotation: Quaternion.Zero()
                },
                gameAlias: getGame(nextGameId).definition.alias,
                gameInstructions: getGame(nextGameId).definition.instructions,
                playerIndex: getPlayerIndex(),
                baseInstructionVideoURL
            });
            instructionsPanel.setTimeout(INSTRUCTION_TOTAL_TIMEOUT);
            timers.setTimeout(() => {
                if (!state.sentInstructionsReady) {
                    state.sentInstructionsReady = true;
                    room.send("INSTRUCTIONS_READY", { playerIndex: getPlayerIndex(), foo: 2 });
                }
            }, 30000);
        }
        function hideInstructions() {
            instructionsPanel?.destroy();
        }
    };
    let room = await connectRoom();
    addRoomHandlers();
    disconnectionText.hide();
    reconnectionToken = room.reconnectionToken;
    console.log("reconnectionToken", reconnectionToken);
    const createButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 0, y: 387, w: 47, h: 25,
            metadata: { name: "createButton" }
        },
        pixelPosition: [-47, 80],
        layer: 1,
        onClick: onClickCreate,
        hoverText: "Start new game",
        klass: "CreateButton"
    });
    const joinButton = lobbyScreen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 49, y: 387, w: 47, h: 25,
            metadata: { name: "joinButton" }
        },
        pixelPosition: [192, 80],
        layer: 1,
        onClick: onClickJoin,
        hoverText: "Join game",
        klass: "JoinButton"
    });
    joinButton.hide();
    createButton.hide();
    let playerScreens = [], screenRunners = [];
    let instructionsPanel;
    const handleScoreTransition = async () => {
        console.log("handleScoreTransition");
        const winnerIndex = room.state.miniGameResults[room.state.miniGameResults.length - 1];
        const finalize = getGlobalWinner() !== -1;
        const miniGameResults = room.state.miniGameResults;
        playerScreens.forEach((s) => s.destroy());
        screenRunners.forEach(sr => sr.runtime.stop());
        screenRunners.forEach(sr => sr.runtime.destroy());
        playerScreens = [];
        screenRunners = [];
        lobbyScreen.show();
        lobbyScreen.setBackgroundSprite({
            spriteDefinition: TRANSITION_SCREEN_SPRITE_DEFINITION
        });
        const previousScores = room.state.miniGameResults.reduce((acc, winnerIndex) => {
            acc[winnerIndex]++;
            return acc;
        }, [0, 0]);
        previousScores[winnerIndex] -= 1;
        const isFinal = !!finalize;
        const trackWinnerIndex = getTrackWinnerFromMiniGameResults(miniGameResults);
        console.log("trackWinnerIndex", trackWinnerIndex);
        await scoreTransition.showTransition({
            winnerIndex,
            previousScores,
            isFinal,
            displayName1: room.state.players[0].displayName,
            displayName2: room.state.players[1].displayName,
            trackWinnerIndex
        });
        scoreTransition.hide();
        state.sentInstructionsReady = false;
        function getTrackWinnerFromMiniGameResults(miniGameResults) {
            let scores = [0, 0];
            miniGameResults.forEach(winnerIndex => {
                scores[winnerIndex]++;
            });
            console.log("scores", scores);
            if (scores[0] > scores[1]) {
                return 0;
            }
            else {
                return 1;
            }
        }
    };
    function getPlayingMiniGameId() {
        let index;
        if (inRoomStage(GAME_STAGE.IDLE))
            return;
        index = room.state.miniGameResults.length;
        return room.state.miniGameTrack[index];
    }
    const startMiniGame = async () => {
        lobbyScreen.hide();
        const miniGameId = getPlayingMiniGameId();
        console.log("START_GAME", miniGameId);
        const GameFactory = getGame(miniGameId);
        console.log("GameFactory.definition", GameFactory.definition);
        if (GameFactory.definition.split) {
            playerScreens = new Array(2).fill(null).map((_, playerIndex) => createSpriteScreen({
                transform: {
                    position: Vector3.create(playerIndex ? 0.25 : -0.25, 0, 0),
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
                screen,
                timers,
                GameFactory,
                playerIndex,
                serverRoom: undefined,
                clientRoom: room,
                isClientPlayer: playerIndex === getPlayerIndex(),
                velocityMultiplier: 1,
                seed: room.state.seed
            }));
            screenRunners.forEach((runner, playerIndex) => {
                if (playerIndex === getPlayerIndex()) {
                    startPlayerRunner(runner);
                }
                else {
                    runner.runtime.start(false);
                }
            });
        }
        else {
            const screen = createSpriteScreen({
                transform: {
                    position: Vector3.Zero(),
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
                    screen,
                    timers,
                    GameFactory,
                    playerIndex: getPlayerIndex(),
                    serverRoom: undefined,
                    clientRoom: room,
                    isClientPlayer: true,
                    sharedScreen: true,
                    velocityMultiplier: 1
                })];
            startPlayerRunner(screenRunners[0]);
        }
        function startPlayerRunner(runner) {
            runner.runtime.start(true);
            let disposeOnFrame;
            const throttleSendPlayerFrame = throttle(() => {
                if (!runner || runner.runtime.getState().destroyed) {
                    if (disposeOnFrame)
                        disposeOnFrame();
                    return;
                }
                const playerFrameData = {
                    playerIndex: getPlayerIndex(),
                    n: runner.runtime.getState().lastReproducedFrame
                };
                room.send("PLAYER_FRAME", playerFrameData);
            }, 100);
            disposeOnFrame = runner.onFrame(throttleSendPlayerFrame);
        }
    };
    function logStates() {
        console.log("local state", cloneDeep(state));
        console.log("room state", room.state.toJSON());
    }
    function addRoomHandlers() {
        console.log("addRoomHandlers");
        room.onMessage("INPUT_FRAME", roomOnInputFrame);
        room.onMessage("MINI_GAME_TRACK", onMiniGameTrack);
        room.onMessage("*", (...args) => {
            console.log("any message", args);
        });
        room.onLeave(reconnect);
        room.onStateChange(roomOnStateChange);
    }
    function setInputListener() {
        const playerIndex = getPlayerIndex();
        if (playerIndex < 0)
            return;
        disposeInputListener = onInputKeyEvent((inputActionKey, isPressed) => {
            console.log("input", inputActionKey, isPressed);
            if (inLocalStage(GAME_STAGE.SHOWING_INSTRUCTIONS) && !state.sentInstructionsReady) {
                state.sentInstructionsReady = true;
                console.log("sending INSTRUCTIONS_READY");
                room.send("INSTRUCTIONS_READY", { playerIndex, foo: 1 });
                instructionsPanel.showWaitingForOtherPlayer({ timeout: INSTRUCTION_READY_TIMEOUT });
            }
            else if (inRoomStage(GAME_STAGE.PLAYING_MINIGAME)) {
                const gameId = room.state.miniGameTrack[room.state.miniGameResults.length];
                const split = getGame(gameId).definition.split;
                const runner = screenRunners[split ? playerIndex : 0];
                const inputFrame = runner.runtime.pushInputEvent({
                    time: Date.now() - runner.runtime.getState().startTime,
                    frameNumber: runner.runtime.getState().lastReproducedFrame,
                    inputActionKey,
                    isPressed,
                    playerIndex
                });
                room.send("INPUT_FRAME", { frame: inputFrame, playerIndex });
            }
        });
    }
    let disposeInputListener;
    function handleLobbyScreenState() {
        console.log("handleLobbyScreenState", room.state.toJSON(), cloneDeep(state));
        logStates();
        handleWaitText();
        handleDisconnectText();
        handleCreateButtonVisibility();
        handleJoinButtonVisibility();
        function handleWaitText() {
            if (inRoomStage(GAME_STAGE.WAITING_PLAYER_JOIN)) {
                waitingTextBackground.show();
                waitingTextEntity.show();
                waitingTextEntity.setText(`<color=${NAME_COLOR}>${room.state.players[0]?.user?.displayName}</color> is waiting someone to join the game...`);
            }
            else {
                waitingTextBackground.hide();
                waitingTextEntity.hide();
            }
        }
        function handleDisconnectText() {
            if (!state.connected) {
                disconnectionText.show();
            }
            else {
                disconnectionText.hide();
            }
        }
        function handleCreateButtonVisibility() {
            if (inRoomStage(GAME_STAGE.IDLE)
                && state.connected) {
                createButton.show();
                lobbyScreen.setBackgroundSprite({
                    spriteDefinition: COVER_SPRITE_DEFINITION
                });
            }
            if (!inRoomStage(GAME_STAGE.IDLE)
                || !state.connected
                || room.state.players.some((p) => p?.user.userId === user?.userId)) {
                createButton.hide();
            }
        }
        function handleJoinButtonVisibility() {
            if (inRoomStage(GAME_STAGE.WAITING_PLAYER_JOIN)
                && state.connected) {
                joinButton.show();
            }
            if (!inRoomStage(GAME_STAGE.WAITING_PLAYER_JOIN)
                || !state.connected
                || room.state.players.some((p) => p?.user.userId === user?.userId)) {
                joinButton.hide();
            }
        }
    }
    function getPlayerIndex() {
        return room.state.players.findIndex((p) => p?.user?.userId === user?.userId);
    }
    return {
        onEvent: (fn) => {
            callbacks.onEvent.push(fn);
            return () => callbacks.onEvent.splice(callbacks.onEvent.indexOf(fn), 1);
        },
        getState: () => ({ ...state, ...room.state.toJSON() })
    };
    function onClickJoin() {
        console.log("onClick join");
        logStates();
        room.send("JOIN_GAME", { user });
    }
    function onClickCreate() {
        console.log("onClick create");
        logStates();
        room.send("CREATE_GAME", { user });
    }
    function getPlayerGlobalScore(playerIndex) {
        return room.state.miniGameResults
            .reduce((acc, current) => current === playerIndex ? (acc + 1) : acc, 0);
    }
    function getGlobalWinner() {
        const player1GlobalScore = getPlayerGlobalScore(0);
        const player2GlobalScore = getPlayerGlobalScore(1);
        if (((player1GlobalScore >= 3 || player2GlobalScore >= 3) && player1GlobalScore !== player2GlobalScore)
            || room.state.miniGameResults.length === 5) {
            return player1GlobalScore > player2GlobalScore ? 0 : 1;
        }
        return -1;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtbWljaC1zY3JlZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vc2FtbWljaC1zY3JlZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNILE1BQU0sRUFRTixTQUFTLEVBQ1osTUFBTSxjQUFjLENBQUM7QUFDdEIsT0FBTyxZQUFZLENBQUM7QUFFcEIsT0FBTyxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDbkQsT0FBTyxFQUFnQixlQUFlLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RixPQUFPLEVBQUMsY0FBYyxFQUFjLE1BQU0saUJBQWlCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV0QyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUM5RCxPQUFPLEVBQ0gsa0JBQWtCLEVBQ2xCLFVBQVUsRUFDVixtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLHNCQUFzQixFQUN6QixNQUFNLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQy9ELE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDcEMsT0FBTyxFQUFDLE9BQU8sRUFBRSxtQkFBbUIsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUFDLFVBQVUsRUFBQyxN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QUMsRUFDN0MsQ0FBQztZQUNFLE9BQU8sa0JBQWtCLEdBQUMsa0JBQWtCLENBQUEsQ0FBQyxDQUFBLENBQUMsQ0FBQSxDQUFDLENBQUEsQ0FBQyxDQUFBO1FBQ3BELENBQUM7UUFDRCxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2QsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIGVuZ2luZSxcbiAgICBFbnRpdHksXG4gICAgTWF0ZXJpYWwsXG4gICAgTWF0ZXJpYWxUcmFuc3BhcmVuY3lNb2RlLFxuICAgIFRleHRBbGlnbk1vZGUsXG4gICAgVGV4dFNoYXBlLFxuICAgIFRleHR1cmVGaWx0ZXJNb2RlLFxuICAgIFRleHR1cmVXcmFwTW9kZSxcbiAgICBUcmFuc2Zvcm1cbn0gZnJvbSBcIkBkY2wvc2RrL2Vjc1wiO1xuaW1wb3J0IFwiLi9wb2x5ZmlsbFwiO1xuXG5pbXBvcnQge0NvbG9yMywgUXVhdGVybmlvbiwgVmVjdG9yM30gZnJvbSBcIkBkY2wvc2RrL21hdGhcIjtcbmltcG9ydCB7Q2xpZW50fSBmcm9tIFwiY29seXNldXMuanNcIjtcbmltcG9ydCB7Y3JlYXRlU3ByaXRlU2NyZWVufSBmcm9tIFwiLi9zcHJpdGUtc2NyZWVuXCI7XG5pbXBvcnQge2dldElucHV0U3RhdGUsIG9uSW5wdXRLZXlFdmVudCwgc2V0dXBJbnB1dENvbnRyb2xsZXJ9IGZyb20gXCIuL2lucHV0LWNvbnRyb2xsZXJcIjtcbmltcG9ydCB7Z2V0TWluVXNlckRhdGEsIE1pblVzZXJEYXRhfSBmcm9tIFwiLi9taW4tdXNlci1kYXRhXCI7XG5pbXBvcnQge2NyZWF0ZVNjcmVlblJ1bm5lcn0gZnJvbSBcIi4vZ2FtZS1ydW5uZXJcIjtcbmltcG9ydCB7dGltZXJzfSBmcm9tIFwiQGRjbC1zZGsvdXRpbHNcIjtcbmltcG9ydCB7VHJhbnNmb3JtVHlwZVdpdGhPcHRpb25hbHN9IGZyb20gXCJAZGNsL2Vjcy9kaXN0L2NvbXBvbmVudHMvbWFudWFsL1RyYW5zZm9ybVwiO1xuaW1wb3J0IHtjcmVhdGVJbnN0cnVjdGlvblNjcmVlbn0gZnJvbSBcIi4vaW5zdHJ1Y3Rpb25zLXNjcmVlblwiO1xuaW1wb3J0IHtcbiAgICBERUZBVUxUX1NQUklURV9ERUYsXG4gICAgTkFNRV9DT0xPUixcbiAgICBTSEFSRURfU0NSRUVOX1NDQUxFLFxuICAgIFNQTElUX1NDUkVFTl9TQ0FMRSxcbiAgICBTUFJJVEVfU0hFRVRfRElNRU5TSU9OXG59IGZyb20gXCIuLi8uLi8uLi9zcHJpdGUtY29uc3RhbnRzXCI7XG5pbXBvcnQge2NyZWF0ZUdsb2JhbFNjb3JlVHJhbnNpdGlvbn0gZnJvbSBcIi4vc2NvcmUtdHJhbnNpdGlvblwiO1xuaW1wb3J0IHt0aHJvdHRsZX0gZnJvbSBcIi4vdGhyb3R0bGVcIjtcbmltcG9ydCB7Z2V0R2FtZSwgc2V0dXBHYW1lUmVwb3NpdG9yeX0gZnJvbSBcIi4uLy4uLy4uL2dhbWUtcmVwb3NpdG9yeVwiO1xuaW1wb3J0IHtkY2xTbGVlcH0gZnJvbSBcIi4vZGNsLXNsZWVwXCI7XG5pbXBvcnQge0dBTUVfU1RBR0V9IGZyb20gXCIuLi8uLi8uLi9nYW1lLXN0YWdlc1wiO1xuaW1wb3J0IHtjbG9uZURlZXB9IGZyb20gXCIuLi8uLi8uLi9saWItdXRpbFwiO1xuaW1wb3J0IHtFVkVOVH0gZnJvbSBcIi4vZXZlbnRzXCI7XG5pbXBvcnQge2dldFRleHR1cmV9IGZyb20gXCIuL3RleHR1cmUtcmVwb3NpdG9yeVwiO1xuXG5jb25zdCBJTlNUUlVDVElPTl9SRUFEWV9USU1FT1VUID0gNzAwMDtcbmNvbnN0IElOU1RSVUNUSU9OX1RPVEFMX1RJTUVPVVQgPSAzMDAwMDtcbmNvbnN0IERFRkFVTFRfU0NSRUVOX1NQUklURV9ERUZJTklUSU9OID0ge1xuICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICB4OiA1NzYsIHk6IDEyOCwgdzogMTkyLCBoOiAxMjgsXG59XG5jb25zdCBXQUlUSU5HX1RFWFRfWSA9IDEwNDtcbmNvbnN0IEZPTlRfU0laRSA9IDAuMzU7XG5jb25zdCBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgeDogMCxcbiAgICB5OiAwLFxuICAgIHc6IDE5MixcbiAgICBoOiAxMjgsXG59XG5jb25zdCBUUkFOU0lUSU9OX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICB4OjU3NixcbiAgICB5OjEyOCxcbiAgICB3OjE5MixcbiAgICBoOjEyOCxcbiAgICAuLi5TUFJJVEVfU0hFRVRfRElNRU5TSU9OXG59XG5leHBvcnQgdHlwZSBTYW1taWNoU2NyZWVuT3B0aW9ucyA9IHtcbiAgICBkZWZhdWx0VGV4dHVyZVNyYz86c3RyaW5nLFxuICAgIGJhc2VJbnN0cnVjdGlvblZpZGVvVVJMPzpzdHJpbmcsXG4gICAgY29seXNldXNTZXJ2ZXJVUkw/OnN0cmluZ1xufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNhbW1pY2hTY3JlZW4ocGFyZW50OiBFbnRpdHksIHtcbiAgICBwb3NpdGlvbixcbiAgICByb3RhdGlvbixcbiAgICBzY2FsZSxcbiAgICBkZWZhdWx0VGV4dHVyZVNyYyA9IFwiaHR0cHM6Ly9zYW1taWNoLnByby9pbWFnZXMvc3ByaXRlc2hlZXQucG5nXCIsXG4gICAgYmFzZUluc3RydWN0aW9uVmlkZW9VUkwgPSBcImh0dHBzOi8vc2FtbWljaC5wcm8vaW5zdHJ1Y3Rpb24tdmlkZW9zXCIsXG4gICAgY29seXNldXNTZXJ2ZXJVUkwgPSBcIndzczovL3NhbW1pY2gucHJvL2NvbHlzZXVzXCJcbn06IFRyYW5zZm9ybVR5cGVXaXRoT3B0aW9uYWxzICYgU2FtbWljaFNjcmVlbk9wdGlvbnMsIF9nYW1lSW5zdGFuY2VJZD86c3RyaW5nKSB7XG4gICAgY29uc3QgZ2FtZUluc3RhbmNlSWQgPSBfZ2FtZUluc3RhbmNlSWQgfHwgXCJkZWZhdWx0XCI7XG5cbiAgICBzZXR1cElucHV0Q29udHJvbGxlcigpO1xuICAgIHNldHVwR2FtZVJlcG9zaXRvcnkoKTtcblxuICAgIGNvbnNvbGUubG9nKFwiU0FNTUlDSF9TQ1JFRU5cIilcbiAgICBsZXQgcmVjb25uZWN0aW9uVG9rZW46YW55O1xuICAgIGNvbnN0IGNhbGxiYWNrczogeyBvbkV2ZW50OiBGdW5jdGlvbltdIH0gPSB7XG4gICAgICAgIG9uRXZlbnQ6IFtdXG4gICAgfTtcbiAgICBjb25zdCBzdGF0ZSA9IHtcbiAgICAgICAgY29ubmVjdGVkOmZhbHNlLFxuICAgICAgICBnYW1lU3RhZ2U6R0FNRV9TVEFHRS5OT1RfQ09OTkVDVEVELFxuICAgICAgICBzZW50SW5zdHJ1Y3Rpb25zUmVhZHk6ZmFsc2UsXG4gICAgICAgIHNlbnRSZWFkeTpmYWxzZVxuICAgIH07XG5cbiAgICBjb25zdCB1c2VyOiBNaW5Vc2VyRGF0YSA9IGF3YWl0IGdldE1pblVzZXJEYXRhKCk7XG4gICAgY29uc3QgZW50aXR5ID0gZW5naW5lLmFkZEVudGl0eSgpO1xuXG4gICAgVHJhbnNmb3JtLmNyZWF0ZShlbnRpdHksIHtcbiAgICAgICAgcGFyZW50LFxuICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgcm90YXRpb24sXG4gICAgICAgIHNjYWxlXG4gICAgfSk7XG5cbiAgICBjb25zdCBzcHJpdGVUZXh0dXJlID0gZ2V0VGV4dHVyZShkZWZhdWx0VGV4dHVyZVNyYyk7XG4gICAgY29uc3Qgc3ByaXRlTWF0ZXJpYWw6YW55ID0ge1xuICAgICAgICB0ZXh0dXJlOiBzcHJpdGVUZXh0dXJlLFxuICAgICAgICBlbWlzc2l2ZVRleHR1cmU6IHNwcml0ZVRleHR1cmUsXG4gICAgICAgIGVtaXNzaXZlSW50ZW5zaXR5OiAwLjYsXG4gICAgICAgIGVtaXNzaXZlQ29sb3I6IENvbG9yMy5jcmVhdGUoMSwgMSwgMSksXG4gICAgICAgIHNwZWN1bGFySW50ZW5zaXR5OiAwLFxuICAgICAgICByb3VnaG5lc3M6IDEsXG4gICAgICAgIGFscGhhVGVzdDogMSxcbiAgICAgICAgdHJhbnNwYXJlbmN5TW9kZTogTWF0ZXJpYWxUcmFuc3BhcmVuY3lNb2RlLk1UTV9BTFBIQV9URVNUXG4gICAgfTtcbiAgICBjb25zdCBsb2JieVNjcmVlblRyYW5zZm9ybSA9IHsvL1RPRE8gY2FuIGJlIGRpZmZlcmVudCBmb3IgZWFjaCBwbGF5ZXIgc2NyZWVuXG4gICAgICAgIHBvc2l0aW9uOiBWZWN0b3IzLmNyZWF0ZSgwLCAwLCAwKSxcbiAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICB9O1xuXG4gICAgY29uc3QgbG9iYnlTY3JlZW4gPSBjcmVhdGVTcHJpdGVTY3JlZW4oe1xuICAgICAgICB0cmFuc2Zvcm06IGxvYmJ5U2NyZWVuVHJhbnNmb3JtLFxuICAgICAgICBzcHJpdGVNYXRlcmlhbCxcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjogQ09WRVJfU1BSSVRFX0RFRklOSVRJT05cbiAgICB9KTtcbiAgICBjb25zdCB3YWl0aW5nVGV4dEVudGl0eSA9IGxvYmJ5U2NyZWVuLmFkZFRleHQoe1xuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbMTkyLzIsIFdBSVRJTkdfVEVYVF9ZICsgNF0sXG4gICAgICAgIHRleHRBbGlnbjpUZXh0QWxpZ25Nb2RlLlRBTV9UT1BfQ0VOVEVSLFxuICAgICAgICB0ZXh0OmAgICAgPGNvbG9yPSR7TkFNRV9DT0xPUn0+R2VzdDwvY29sb3I+IGlzIHdhaXRpbmcgc29tYCxcbiAgICAgICAgdGV4dENvbG9yOlsxLDEsMSwxXSxcbiAgICAgICAgZm9udFNpemU6Rk9OVF9TSVpFLFxuICAgICAgICBsYXllcjoyXG4gICAgfSk7XG4gICAgY29uc3Qgd2FpdGluZ1RleHRCYWNrZ3JvdW5kID0gbG9iYnlTY3JlZW4uYWRkU3ByaXRlKHtcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDogMzg0LCB5OiAyMTgsIHc6IDE5MiwgaDogMjUsXG4gICAgICAgICAgICBtZXRhZGF0YToge25hbWU6IFwidGV4dC1iYWNrZ3JvdW5kXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFswLCBXQUlUSU5HX1RFWFRfWV0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBrbGFzczpcIlRleHRCYWNrZ3JvdW5kXCJcbiAgICB9KVxuICAgIHdhaXRpbmdUZXh0RW50aXR5LmhpZGUoKTtcbiAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuaGlkZSgpO1xuXG4gICAgY29uc3QgZGlzY29ubmVjdGlvblRleHQgPSBsb2JieVNjcmVlbi5hZGRUZXh0KHt0ZXh0OlwiRElTQ09OTkVDVEVEXCIsIHRleHRDb2xvcjpbMSwwLDAsMV0sIHBpeGVsUG9zaXRpb246WzE5Mi8yLDExMF0sIGxheWVyOjEwLCB0ZXh0QWxpZ246VGV4dEFsaWduTW9kZS5UQU1fVE9QX0NFTlRFUiwgZm9udFNpemU6MX0pO1xuICAgIGNvbnN0IHNjb3JlVHJhbnNpdGlvbiA9IGNyZWF0ZUdsb2JhbFNjb3JlVHJhbnNpdGlvbihsb2JieVNjcmVlbik7XG4gICAgY29uc3QgY29seXNldXNDbGllbnQ6IENsaWVudCA9IG5ldyBDbGllbnQoY29seXNldXNTZXJ2ZXJVUkwpO1xuXG4gICAgY29uc3QgY29ubmVjdFJvb20gPSBhc3luYyAoKT0+e1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbm5lY3RSb29tXCIpO1xuICAgICAgICBsZXQgX3Jvb207XG4gICAgICAgIHdoaWxlKCFzdGF0ZS5jb25uZWN0ZWQpe1xuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIF9yb29tID0gYXdhaXQgY29seXNldXNDbGllbnQuam9pbk9yQ3JlYXRlKGBHYW1lUm9vbWAsIHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgICAgICAgICAgZ2FtZUluc3RhbmNlSWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNPTk5FQ1RFRFwiLCBfcm9vbT8ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfWNhdGNoKGVycm9yOmFueSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvciBjb25uZWN0aW5nXCIsIGVycm9yPy5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBkY2xTbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jvb207XG4gICAgfTtcbiAgICBjb25zdCBvbk1pbmlHYW1lVHJhY2sgPSBhc3luYyAobWluaUdhbWVUcmFjazphbnkpID0+IHtcbiAgICAgICAgLy9UT0RPIHNob3cgaW5zdHJ1Y3Rpb25zIG9mIHRoZSBnYW1lIDBcbiAgICAgICAgY29uc29sZS5sb2coXCJNSU5JX0dBTUVfVFJBQ0tcIiwgbWluaUdhbWVUcmFjayk7XG4gICAgfTtcbiAgICBjb25zdCByb29tT25JbnB1dEZyYW1lID0gKHtwbGF5ZXJJbmRleCwgZnJhbWV9OmFueSk9PntcbiAgICAgICAgLy9UT0RPIHJldmlldyBpZiBiZXN0IGFwcHJvYWNoLCBmb3Igbm93IHRvIHJlcHJlc2VudCBvdGhlciBwbGF5ZXIgU3RhdGVcbiAgICAgICAgaWYocGxheWVySW5kZXggIT09IGdldFBsYXllckluZGV4KCkpe1xuICAgICAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHJ1bm5lciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5wdXREYXRhID0gZnJhbWUuZXZlbnRzW2ZyYW1lLmV2ZW50cy5sZW5ndGgtMV0uZGF0YVxuICAgICAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnB1c2hJbnB1dEV2ZW50KHtcbiAgICAgICAgICAgICAgICAgICAgLi4uaW5wdXREYXRhLFxuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCByZWNvbm5lY3QgPSBhc3luYyAoY29kZTpudW1iZXIpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJsZWF2ZSBjb2RlXCIsIGNvZGUpO1xuICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5zaG93KCk7XG4gICAgICAgIHN0YXRlLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgICAgZXJyb3I0MjEyID0gZmFsc2U7XG4gICAgICAgIHdoaWxlKCFzdGF0ZS5jb25uZWN0ZWQpe1xuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVjb25uZWN0aW5nLi4uXCIpXG4gICAgICAgICAgICAgICAgcm9vbSA9IGVycm9yNDIxMj9hd2FpdCBjb25uZWN0Um9vbSgpOiBhd2FpdCBjb2x5c2V1c0NsaWVudC5yZWNvbm5lY3QocmVjb25uZWN0aW9uVG9rZW4pO1xuICAgICAgICAgICAgICAgIGVycm9yNDIxMiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY29ubmVjdGlvbiBET05FIVwiLCByb29tLCByb29tPy5yZWNvbm5lY3Rpb25Ub2tlbik7XG5cbiAgICAgICAgICAgICAgICByZWNvbm5lY3Rpb25Ub2tlbiA9IHJvb20ucmVjb25uZWN0aW9uVG9rZW47XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgYWRkUm9vbUhhbmRsZXJzKCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpO1xuICAgICAgICAgICAgfWNhdGNoKGVycm9yOmFueSl7XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBkY2xTbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgICBpZihlcnJvcj8uY29kZSA9PT0gNDIxMil7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yNDIxMiA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3IgcmVjb25uZWN0aW5nXCIsIGVycm9yKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbkxvY2FsU3RhZ2UgPSAoc3RhZ2U6R0FNRV9TVEFHRSkgPT4gc3RhdGUuZ2FtZVN0YWdlID09PSBzdGFnZTtcbiAgICBjb25zdCBpblJvb21TdGFnZSA9IChzdGFnZTpHQU1FX1NUQUdFKSA9PiByb29tLnN0YXRlLmdhbWVTdGFnZSA9PT0gc3RhZ2U7XG4gICAgY29uc3QgZGlmZlN0YWdlID0gKHN0YWdlOkdBTUVfU1RBR0UpPT4gaW5Mb2NhbFN0YWdlKHN0YWdlKSAhPT0gaW5Sb29tU3RhZ2Uoc3RhZ2UpO1xuICAgIGNvbnN0IHJvb21PblN0YXRlQ2hhbmdlID0gKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcInJvb21PblN0YXRlQ2hhbmdlLlwiKTtcbiAgICAgICAgbG9nU3RhdGVzKCk7XG5cbiAgICAgICAgaGFuZGxlUGxheWVyc1NlbmRpbmdSZWFkeSgpO1xuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5JRExFLCBoYW5kbGVMb2JieVNjcmVlblN0YXRlKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuU0hPV0lOR19JTlNUUlVDVElPTlMsIHNob3dJbnN0cnVjdGlvbnMsIGhpZGVJbnN0cnVjdGlvbnMpO1xuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5QTEFZSU5HX01JTklHQU1FLCBzdGFydE1pbmlHYW1lKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuVElFX0JSRUFLRVIsIHNob3dUaWVCcmVha2VyKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuU0hPV0lOR19TQ09SRV9UUkFOU0lUSU9OLCBoYW5kbGVTY29yZVRyYW5zaXRpb24pXG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfRU5ELCBoYW5kbGVFbmRUcmFjayk7XG4gICAgICAgIGlmKHJvb20uc3RhdGUucGxheWVycy5maWx0ZXIoKHA6YW55KT0+cC5pbnN0cnVjdGlvbnNSZWFkeSkubGVuZ3RoID09PSAxKXtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNldFRpbWVvdXQoSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCk7XG4gICAgICAgICAgICBpZihnZXRQbGF5ZXJJbmRleCgpID49IDAgJiYgIXJvb20uc3RhdGUucGxheWVyc1tnZXRQbGF5ZXJJbmRleCgpXS5pbnN0cnVjdGlvbnNSZWFkeSl7XG4gICAgICAgICAgICAgICAgdGltZXJzLnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZighc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5KXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwgeyBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSwgZm9vOiAyIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5nYW1lU3RhZ2UgPSByb29tLnN0YXRlLmdhbWVTdGFnZTtcbiAgICAgICAgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZUVuZFRyYWNrKCl7XG4gICAgICAgICAgICBjb25zdCB0cmFja1dpbm5lckluZGV4ID0gZ2V0R2xvYmFsV2lubmVyKCk7XG4gICAgICAgICAgICBzY29yZVRyYW5zaXRpb24uc2hvd0ZpbmFsU3ByaXRlKHRyYWNrV2lubmVySW5kZXgpO1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRXZlbnQuZm9yRWFjaChlPT5lKHtcbiAgICAgICAgICAgICAgICB0eXBlOkVWRU5ULkVORF9UUkFDSyxcbiAgICAgICAgICAgICAgICBkYXRhOntcbiAgICAgICAgICAgICAgICAgICAgdHJhY2tXaW5uZXJJbmRleFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmVzZXRUcmFja1N0YXRlKCk7XG4gICAgICAgICAgICBkaXNwb3NlSW5wdXRMaXN0ZW5lciAmJiBkaXNwb3NlSW5wdXRMaXN0ZW5lcigpO1xuXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHJlc2V0VHJhY2tTdGF0ZSgpe1xuICAgICAgICAgICAgICAgIHNjb3JlVHJhbnNpdGlvbi5yZXNldCgpO1xuICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oc3RhdGUsIHtcbiAgICAgICAgICAgICAgICAgICAgc2VudFJlYWR5OmZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzZW50SW5zdHJ1Y3Rpb25zUmVhZHk6ZmFsc2VcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVQbGF5ZXJzU2VuZGluZ1JlYWR5KCl7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXJJbmRleCA9IGdldFBsYXllckluZGV4KCk7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXggPj0gMFxuICAgICAgICAgICAgICAgICYmICFzdGF0ZS5zZW50UmVhZHlcbiAgICAgICAgICAgICAgICAmJiByb29tLnN0YXRlLnBsYXllcnMubGVuZ3RoID09PSAyXG4gICAgICAgICAgICAgICAgJiYgaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUlNfUkVBRFkpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zZW50UmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiU0VORCBSRUFEWVwiKVxuICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIlJFQURZXCIsIHtwbGF5ZXJJbmRleH0pO1xuICAgICAgICAgICAgICAgIHNldElucHV0TGlzdGVuZXIoKTtcbiAgICAgICAgICAgIH1lbHNlIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSU19SRUFEWSkgJiYgc3RhdGUuc2VudFJlYWR5KXtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zZW50UmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVN0YWdlQ2hhbmdlKGdhbWVTdGFnZTpHQU1FX1NUQUdFLCBmbjpGdW5jdGlvbiwgZWxzZUZuPzpGdW5jdGlvbil7XG4gICAgICAgICAgICBpZihkaWZmU3RhZ2UoZ2FtZVN0YWdlKSl7XG4gICAgICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoZ2FtZVN0YWdlKSl7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoZWxzZUZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VGbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dUaWVCcmVha2VyKCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNob3dUaWVCcmVha2VyXCIsIHJvb20uc3RhdGUudGllQnJlYWtlcldpbm5lcilcbiAgICAgICAgICAgIGlmKGdldFBsYXllckluZGV4KCkgIT09IDApe1xuICAgICAgICAgICAgICAgIHNjcmVlblJ1bm5lcnNbMF0ucnVudGltZS5yZXByb2R1Y2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnNbMF0ucnVudGltZS50aWVCcmVha2VyKHtcbiAgICAgICAgICAgICAgICB3aW5uZXJJbmRleDpyb29tLnN0YXRlLnRpZUJyZWFrZXJXaW5uZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd0luc3RydWN0aW9ucygpe1xuICAgICAgICAgICAgY29uc3QgbmV4dE1pbmlHYW1lSW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCBuZXh0R2FtZUlkID0gcm9vbS5zdGF0ZS5taW5pR2FtZVRyYWNrW25leHRNaW5pR2FtZUluZGV4XTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2hvd0luc3RydWN0aW9uc1wiLCBuZXh0TWluaUdhbWVJbmRleCwgbmV4dEdhbWVJZCwgZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmFsaWFzKVxuICAgICAgICAgICAgbG9iYnlTY3JlZW4uc2hvdygpO1xuICAgICAgICAgICAgc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5ID0gZmFsc2VcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsID0gY3JlYXRlSW5zdHJ1Y3Rpb25TY3JlZW4oe1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybToge1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGxvYmJ5U2NyZWVuLmdldEVudGl0eSgpLFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogVmVjdG9yMy5jcmVhdGUoMCwgMCwgLTAuMDUpLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogVmVjdG9yMy5PbmUoKSxcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IFF1YXRlcm5pb24uWmVybygpXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnYW1lQWxpYXM6IGdldEdhbWUobmV4dEdhbWVJZCkuZGVmaW5pdGlvbi5hbGlhcyxcbiAgICAgICAgICAgICAgICBnYW1lSW5zdHJ1Y3Rpb25zOiBnZXRHYW1lKG5leHRHYW1lSWQpLmRlZmluaXRpb24uaW5zdHJ1Y3Rpb25zLFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4OmdldFBsYXllckluZGV4KCksXG4gICAgICAgICAgICAgICAgYmFzZUluc3RydWN0aW9uVmlkZW9VUkxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zUGFuZWwuc2V0VGltZW91dChJTlNUUlVDVElPTl9UT1RBTF9USU1FT1VUKTtcbiAgICAgICAgICAgIHRpbWVycy5zZXRUaW1lb3V0KCgpPT57XG4gICAgICAgICAgICAgICAgaWYoIXN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSl7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIklOU1RSVUNUSU9OU19SRUFEWVwiLCB7IHBsYXllckluZGV4OiBnZXRQbGF5ZXJJbmRleCgpLCBmb286IDIgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMzAwMDApO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGlkZUluc3RydWN0aW9ucygpe1xuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zUGFuZWw/LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgcm9vbTogYW55ID0gYXdhaXQgY29ubmVjdFJvb20oKTtcblxuICAgIGFkZFJvb21IYW5kbGVycygpO1xuXG4gICAgZGlzY29ubmVjdGlvblRleHQuaGlkZSgpO1xuICAgIHJlY29ubmVjdGlvblRva2VuID0gcm9vbS5yZWNvbm5lY3Rpb25Ub2tlbjtcbmNvbnNvbGUubG9nKFwicmVjb25uZWN0aW9uVG9rZW5cIixyZWNvbm5lY3Rpb25Ub2tlbik7XG4gICAgY29uc3QgY3JlYXRlQnV0dG9uID0gbG9iYnlTY3JlZW4uYWRkU3ByaXRlKHtcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDogMCwgeTogMzg3LCB3OiA0NywgaDogMjUsXG4gICAgICAgICAgICBtZXRhZGF0YToge25hbWU6IFwiY3JlYXRlQnV0dG9uXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFstNDcsIDgwXSxcbiAgICAgICAgbGF5ZXI6IDEsXG4gICAgICAgIG9uQ2xpY2s6IG9uQ2xpY2tDcmVhdGUsXG4gICAgICAgIGhvdmVyVGV4dDogXCJTdGFydCBuZXcgZ2FtZVwiLFxuICAgICAgICBrbGFzczpcIkNyZWF0ZUJ1dHRvblwiXG4gICAgfSk7XG5cbiAgICBjb25zdCBqb2luQnV0dG9uID0gbG9iYnlTY3JlZW4uYWRkU3ByaXRlKHtcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDogNDksIHk6IDM4NywgdzogNDcsIGg6IDI1LFxuICAgICAgICAgICAgbWV0YWRhdGE6IHtuYW1lOiBcImpvaW5CdXR0b25cIn1cbiAgICAgICAgfSxcbiAgICAgICAgcGl4ZWxQb3NpdGlvbjogWzE5MiAsIDgwXSxcbiAgICAgICAgbGF5ZXI6IDEsXG4gICAgICAgIG9uQ2xpY2s6IG9uQ2xpY2tKb2luLFxuICAgICAgICBob3ZlclRleHQ6IFwiSm9pbiBnYW1lXCIsXG4gICAgICAgIGtsYXNzOlwiSm9pbkJ1dHRvblwiXG4gICAgfSk7XG5cbiAgICBqb2luQnV0dG9uLmhpZGUoKTtcbiAgICBjcmVhdGVCdXR0b24uaGlkZSgpO1xuXG4gICAgbGV0IHBsYXllclNjcmVlbnM6YW55W10gPSBbXSwgc2NyZWVuUnVubmVyczphbnlbXSA9IFtdO1xuICAgIGxldCBpbnN0cnVjdGlvbnNQYW5lbDphbnk7XG5cbiAgICBjb25zdCBoYW5kbGVTY29yZVRyYW5zaXRpb24gPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiaGFuZGxlU2NvcmVUcmFuc2l0aW9uXCIpO1xuICAgICAgICBjb25zdCB3aW5uZXJJbmRleCA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzW3Jvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLmxlbmd0aC0xXTtcbiAgICAgICAgY29uc3QgZmluYWxpemUgPSBnZXRHbG9iYWxXaW5uZXIoKSAhPT0gLTE7XG4gICAgICAgIGNvbnN0IG1pbmlHYW1lUmVzdWx0cyA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzO1xuICAgICAgICAvL1RPRE8gZXN0byBkZXNwdWVzIGRlIFRJRV9CUkVBS0VSXG4gICAgICAgIHBsYXllclNjcmVlbnMuZm9yRWFjaCgoczphbnkpPT5zLmRlc3Ryb3koKSk7XG4gICAgICAgIHNjcmVlblJ1bm5lcnMuZm9yRWFjaChzcj0+c3IucnVudGltZS5zdG9wKCkpO1xuICAgICAgICBzY3JlZW5SdW5uZXJzLmZvckVhY2goc3I9PnNyLnJ1bnRpbWUuZGVzdHJveSgpKTtcbiAgICAgICAgcGxheWVyU2NyZWVucyA9IFtdO1xuICAgICAgICBzY3JlZW5SdW5uZXJzID0gW107XG5cbiAgICAgICAgbG9iYnlTY3JlZW4uc2hvdygpO1xuICAgICAgICBsb2JieVNjcmVlbi5zZXRCYWNrZ3JvdW5kU3ByaXRlKHtcbiAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246VFJBTlNJVElPTl9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT05cbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHByZXZpb3VzU2NvcmVzID0gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMucmVkdWNlKChhY2M6bnVtYmVyW10sIHdpbm5lckluZGV4Om51bWJlcik9PntcbiAgICAgICAgICAgIGFjY1t3aW5uZXJJbmRleF0rKztcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sWzAsMF0pO1xuICAgICAgICBwcmV2aW91c1Njb3Jlc1t3aW5uZXJJbmRleF0gLT0gMTtcbiAgICAgICAgY29uc3QgaXNGaW5hbCA9ICEhZmluYWxpemU7XG4gICAgICAgIGNvbnN0IHRyYWNrV2lubmVySW5kZXggPSBnZXRUcmFja1dpbm5lckZyb21NaW5pR2FtZVJlc3VsdHMobWluaUdhbWVSZXN1bHRzKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJ0cmFja1dpbm5lckluZGV4XCIsdHJhY2tXaW5uZXJJbmRleClcblxuXG4gICAgICAgIGF3YWl0IHNjb3JlVHJhbnNpdGlvbi5zaG93VHJhbnNpdGlvbih7XG4gICAgICAgICAgICB3aW5uZXJJbmRleCxcbiAgICAgICAgICAgIHByZXZpb3VzU2NvcmVzLFxuICAgICAgICAgICAgaXNGaW5hbCxcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lMTpyb29tLnN0YXRlLnBsYXllcnNbMF0uZGlzcGxheU5hbWUsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTI6cm9vbS5zdGF0ZS5wbGF5ZXJzWzFdLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgdHJhY2tXaW5uZXJJbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgc2NvcmVUcmFuc2l0aW9uLmhpZGUoKTtcbiAgICAgICAgc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5ID0gZmFsc2U7XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VHJhY2tXaW5uZXJGcm9tTWluaUdhbWVSZXN1bHRzKG1pbmlHYW1lUmVzdWx0czpudW1iZXJbXSl7XG4gICAgICAgICAgICBsZXQgc2NvcmVzOm51bWJlcltdID0gWzAsMF07XG4gICAgICAgICAgICBtaW5pR2FtZVJlc3VsdHMuZm9yRWFjaCh3aW5uZXJJbmRleCA9PiB7XG4gICAgICAgICAgICAgICAgc2NvcmVzW3dpbm5lckluZGV4XSsrXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2NvcmVzXCIsIHNjb3Jlcyk7XG4gICAgICAgICAgICBpZihzY29yZXNbMF0gPiBzY29yZXNbMV0pe1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWluZ01pbmlHYW1lSWQoKXtcbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBpZihpblJvb21TdGFnZShHQU1FX1NUQUdFLklETEUpKSByZXR1cm47XG4gICAgICAgIGluZGV4ID0gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoO1xuICAgICAgICByZXR1cm4gcm9vbS5zdGF0ZS5taW5pR2FtZVRyYWNrW2luZGV4XTtcbiAgICB9XG4gICAgY29uc3Qgc3RhcnRNaW5pR2FtZSA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgbG9iYnlTY3JlZW4uaGlkZSgpO1xuICAgICAgICBjb25zdCBtaW5pR2FtZUlkID0gZ2V0UGxheWluZ01pbmlHYW1lSWQoKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTVEFSVF9HQU1FXCIsIG1pbmlHYW1lSWQpO1xuICAgICAgICBjb25zdCBHYW1lRmFjdG9yeSA9IGdldEdhbWUobWluaUdhbWVJZCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiR2FtZUZhY3RvcnkuZGVmaW5pdGlvblwiLEdhbWVGYWN0b3J5LmRlZmluaXRpb24pO1xuICAgICAgICBpZihHYW1lRmFjdG9yeS5kZWZpbml0aW9uLnNwbGl0KXtcbiAgICAgICAgICAgIHBsYXllclNjcmVlbnMgPSBuZXcgQXJyYXkoMikuZmlsbChudWxsKS5tYXAoKF8sIHBsYXllckluZGV4KT0+Y3JlYXRlU3ByaXRlU2NyZWVuKHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246VmVjdG9yMy5jcmVhdGUocGxheWVySW5kZXg/MC4yNTotMC4yNSwgMCwgMCksXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiBTUExJVF9TQ1JFRU5fU0NBTEUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogZW50aXR5XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzcHJpdGVNYXRlcmlhbCxcbiAgICAgICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLkRFRkFVTFRfU0NSRUVOX1NQUklURV9ERUZJTklUSU9OLFxuICAgICAgICAgICAgICAgICAgICB3OiAxOTIgLyAyLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgc2NyZWVuUnVubmVycyA9IHBsYXllclNjcmVlbnMubWFwKChzY3JlZW4sIHBsYXllckluZGV4KSA9PiBjcmVhdGVTY3JlZW5SdW5uZXIoe1xuICAgICAgICAgICAgICAgIHNjcmVlbiwgLy9UT0RPIFJFVklFVzsgd2UgcmVhbGx5IHNob3VsZCB1c2UgYW5vdGhlciBzY3JlZW4sIGFuZCBkZWNvdXBsZSB0aGUgbG9iYnkgc2NyZWVuIGZyb20gdGhlIGdhbWVcbiAgICAgICAgICAgICAgICB0aW1lcnMsXG4gICAgICAgICAgICAgICAgR2FtZUZhY3RvcnksXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXgsXG4gICAgICAgICAgICAgICAgc2VydmVyUm9vbTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGNsaWVudFJvb206IHJvb20sXG4gICAgICAgICAgICAgICAgaXNDbGllbnRQbGF5ZXI6IHBsYXllckluZGV4ID09PSBnZXRQbGF5ZXJJbmRleCgpLFxuICAgICAgICAgICAgICAgIHZlbG9jaXR5TXVsdGlwbGllcjoxLFxuICAgICAgICAgICAgICAgIHNlZWQ6cm9vbS5zdGF0ZS5zZWVkXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBzY3JlZW5SdW5uZXJzLmZvckVhY2goKHJ1bm5lciwgcGxheWVySW5kZXgpPT57XG4gICAgICAgICAgICAgICAgaWYocGxheWVySW5kZXggPT09IGdldFBsYXllckluZGV4KCkpe1xuICAgICAgICAgICAgICAgICAgICAvL3J1bm5lci5ydW50aW1lLmF0dGFjaERlYnVnUGFuZWwoZ2V0RGVidWdQYW5lbCgpKTtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRQbGF5ZXJSdW5uZXIocnVubmVyKTtcbiAgICAgICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgcnVubmVyLnJ1bnRpbWUuc3RhcnQoZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1lbHNley8vc2hhcmVkIHNjcmVlblxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuID0gY3JlYXRlU3ByaXRlU2NyZWVuKHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246VmVjdG9yMy5aZXJvKCksXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiBTSEFSRURfU0NSRUVOX1NDQUxFLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGVudGl0eVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3ByaXRlTWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAuLi5ERUZBVUxUX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGxheWVyU2NyZWVucyA9IFtzY3JlZW5dO1xuXG4gICAgICAgICAgICBzY3JlZW5SdW5uZXJzID0gW2NyZWF0ZVNjcmVlblJ1bm5lcih7XG4gICAgICAgICAgICAgICAgc2NyZWVuLCAvL1RPRE8gUkVWSUVXOyB3ZSByZWFsbHkgc2hvdWxkIHVzZSBhbm90aGVyIHNjcmVlbiwgYW5kIGRlY291cGxlIHRoZSBsb2JieSBzY3JlZW4gZnJvbSB0aGUgZ2FtZVxuICAgICAgICAgICAgICAgIHRpbWVycyxcbiAgICAgICAgICAgICAgICBHYW1lRmFjdG9yeSxcbiAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICBzZXJ2ZXJSb29tOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgY2xpZW50Um9vbTogcm9vbSxcbiAgICAgICAgICAgICAgICBpc0NsaWVudFBsYXllcjp0cnVlLC8vVE9ETyBmb3Igc2hhcmVkLXNjcmVlbiAsIGlzIHJlYWxseSBhIGNsaWVudFBsYXllciwgaXQgb3d1bGQgYmUgYmV0dGVyIHRvIGRlZmluZSBpZiBpdCdzIHNoYXJlZCBzY3JlZW5cbiAgICAgICAgICAgICAgICBzaGFyZWRTY3JlZW46dHJ1ZSwvL1RPRE8gb3IgbWF5YmU6IHJlYWN0VG9OZXR3b3JrU3ByaXRlc1xuICAgICAgICAgICAgICAgIHZlbG9jaXR5TXVsdGlwbGllcjoxXG4gICAgICAgICAgICB9KV07XG5cbiAgICAgICAgICAgIHN0YXJ0UGxheWVyUnVubmVyKHNjcmVlblJ1bm5lcnNbMF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc3RhcnRQbGF5ZXJSdW5uZXIocnVubmVyOmFueSl7XG4gICAgICAgICAgICBydW5uZXIucnVudGltZS5zdGFydCh0cnVlKTtcbiAgICAgICAgICAgIGxldCBkaXNwb3NlT25GcmFtZTphbnk7XG4gICAgICAgICAgICBjb25zdCB0aHJvdHRsZVNlbmRQbGF5ZXJGcmFtZSA9IHRocm90dGxlKCgpID0+IHsgLy9UT0RPIFJFVklFVywgbGVhayB8IGRpc3Bvc2VcbiAgICAgICAgICAgICAgICBpZighcnVubmVyIHx8IHJ1bm5lci5ydW50aW1lLmdldFN0YXRlKCkuZGVzdHJveWVkKXtcbiAgICAgICAgICAgICAgICAgICAgaWYoZGlzcG9zZU9uRnJhbWUpIGRpc3Bvc2VPbkZyYW1lKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGxheWVyRnJhbWVEYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleDpnZXRQbGF5ZXJJbmRleCgpLFxuICAgICAgICAgICAgICAgICAgICBuOiBydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmxhc3RSZXByb2R1Y2VkRnJhbWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiUExBWUVSX0ZSQU1FXCIsIHBsYXllckZyYW1lRGF0YSk7XG4gICAgICAgICAgICB9LDEwMCk7XG4gICAgICAgICAgICBkaXNwb3NlT25GcmFtZSA9IHJ1bm5lci5vbkZyYW1lKHRocm90dGxlU2VuZFBsYXllckZyYW1lKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBsb2dTdGF0ZXMoKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJsb2NhbCBzdGF0ZVwiLCBjbG9uZURlZXAoc3RhdGUpKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJyb29tIHN0YXRlXCIsIHJvb20uc3RhdGUudG9KU09OKCkpO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gYWRkUm9vbUhhbmRsZXJzKCl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiYWRkUm9vbUhhbmRsZXJzXCIpO1xuICAgICAgICByb29tLm9uTWVzc2FnZShcIklOUFVUX0ZSQU1FXCIsIHJvb21PbklucHV0RnJhbWUpO1xuICAgICAgICByb29tLm9uTWVzc2FnZShcIk1JTklfR0FNRV9UUkFDS1wiLCBvbk1pbmlHYW1lVHJhY2spO1xuICAgICAgICByb29tLm9uTWVzc2FnZShcIipcIiwgKC4uLmFyZ3M6YW55W10pPT57XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImFueSBtZXNzYWdlXCIsIGFyZ3MpXG4gICAgICAgIH0pO1xuICAgICAgICByb29tLm9uTGVhdmUocmVjb25uZWN0KTtcbiAgICAgICAgcm9vbS5vblN0YXRlQ2hhbmdlKHJvb21PblN0YXRlQ2hhbmdlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRJbnB1dExpc3RlbmVyKCl7XG4gICAgICAgIGNvbnN0IHBsYXllckluZGV4ID0gZ2V0UGxheWVySW5kZXgoKTtcbiAgICAgICAgaWYocGxheWVySW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGRpc3Bvc2VJbnB1dExpc3RlbmVyID0gb25JbnB1dEtleUV2ZW50KChpbnB1dEFjdGlvbktleTogYW55LCBpc1ByZXNzZWQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJpbnB1dFwiLCBpbnB1dEFjdGlvbktleSwgaXNQcmVzc2VkKVxuICAgICAgICAgICAgICAgIGlmKGluTG9jYWxTdGFnZShHQU1FX1NUQUdFLlNIT1dJTkdfSU5TVFJVQ1RJT05TKSAmJiAhc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5KXtcblxuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNlbmRpbmcgSU5TVFJVQ1RJT05TX1JFQURZXCIpO1xuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwge3BsYXllckluZGV4LCBmb286MX0pO1xuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbC5zaG93V2FpdGluZ0Zvck90aGVyUGxheWVyKHt0aW1lb3V0OklOU1RSVUNUSU9OX1JFQURZX1RJTUVPVVR9KTtcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihpblJvb21TdGFnZShHQU1FX1NUQUdFLlBMQVlJTkdfTUlOSUdBTUUpKXtcbiAgICAgICAgICAgICAgICAgICAgLy9nZXREZWJ1Z1BhbmVsKCkuc2V0U3RhdGUoZ2V0SW5wdXRTdGF0ZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2FtZUlkID0gcm9vbS5zdGF0ZS5taW5pR2FtZVRyYWNrW3Jvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLmxlbmd0aF07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwbGl0ID0gZ2V0R2FtZShnYW1lSWQpLmRlZmluaXRpb24uc3BsaXQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJ1bm5lciA9IHNjcmVlblJ1bm5lcnNbc3BsaXQ/cGxheWVySW5kZXg6MF07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0RnJhbWUgPSBydW5uZXIucnVudGltZS5wdXNoSW5wdXRFdmVudCh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lOkRhdGUubm93KCkgLSBydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLnN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lTnVtYmVyOnJ1bm5lci5ydW50aW1lLmdldFN0YXRlKCkubGFzdFJlcHJvZHVjZWRGcmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0QWN0aW9uS2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNQcmVzc2VkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXhcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9UT0RPIHNldCB0aW1lXG4gICAgICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIklOUFVUX0ZSQU1FXCIsIHtmcmFtZTogaW5wdXRGcmFtZSwgcGxheWVySW5kZXh9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGxldCBkaXNwb3NlSW5wdXRMaXN0ZW5lcjphbnk7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVMb2JieVNjcmVlblN0YXRlKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImhhbmRsZUxvYmJ5U2NyZWVuU3RhdGVcIiwgcm9vbS5zdGF0ZS50b0pTT04oKSwgY2xvbmVEZWVwKHN0YXRlKSk7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuICAgICAgICBoYW5kbGVXYWl0VGV4dCgpO1xuICAgICAgICBoYW5kbGVEaXNjb25uZWN0VGV4dCgpO1xuICAgICAgICBoYW5kbGVDcmVhdGVCdXR0b25WaXNpYmlsaXR5KCk7XG4gICAgICAgIGhhbmRsZUpvaW5CdXR0b25WaXNpYmlsaXR5KCk7XG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlV2FpdFRleHQoKXtcbiAgICAgICAgICAgIGlmIChpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSX0pPSU4pKXtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0RW50aXR5LnNob3coKTtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEVudGl0eS5zZXRUZXh0KGA8Y29sb3I9JHtOQU1FX0NPTE9SfT4ke3Jvb20uc3RhdGUucGxheWVyc1swXT8udXNlcj8uZGlzcGxheU5hbWV9PC9jb2xvcj4gaXMgd2FpdGluZyBzb21lb25lIHRvIGpvaW4gdGhlIGdhbWUuLi5gKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0QmFja2dyb3VuZC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRFbnRpdHkuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlRGlzY29ubmVjdFRleHQoKXtcbiAgICAgICAgICAgIGlmKCFzdGF0ZS5jb25uZWN0ZWQpe1xuICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3Rpb25UZXh0LnNob3coKVxuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgZGlzY29ubmVjdGlvblRleHQuaGlkZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVDcmVhdGVCdXR0b25WaXNpYmlsaXR5KCl7XG4gICAgICAgICAgICBpZihpblJvb21TdGFnZShHQU1FX1NUQUdFLklETEUpXG4gICAgICAgICAgICAgICAgJiYgc3RhdGUuY29ubmVjdGVkXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1dHRvbi5zaG93KCk7XG4gICAgICAgICAgICAgICAgbG9iYnlTY3JlZW4uc2V0QmFja2dyb3VuZFNwcml0ZSh7XG4gICAgICAgICAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246IENPVkVSX1NQUklURV9ERUZJTklUSU9OXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZighaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKVxuICAgICAgICAgICAgICAgIHx8ICFzdGF0ZS5jb25uZWN0ZWRcbiAgICAgICAgICAgICAgICB8fCByb29tLnN0YXRlLnBsYXllcnMuc29tZSgocDphbnkpPT5wPy51c2VyLnVzZXJJZCA9PT0gdXNlcj8udXNlcklkKSl7XG4gICAgICAgICAgICAgICAgY3JlYXRlQnV0dG9uLmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZUpvaW5CdXR0b25WaXNpYmlsaXR5KCl7XG4gICAgICAgICAgICBpZihpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSX0pPSU4pXG4gICAgICAgICAgICAgICAgJiYgc3RhdGUuY29ubmVjdGVkXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIGpvaW5CdXR0b24uc2hvdygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoIWluUm9vbVN0YWdlKEdBTUVfU1RBR0UuV0FJVElOR19QTEFZRVJfSk9JTilcbiAgICAgICAgICAgICAgICB8fCAhc3RhdGUuY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5wbGF5ZXJzLnNvbWUoKHA6YW55KT0+cD8udXNlci51c2VySWQgPT09IHVzZXI/LnVzZXJJZClcbiAgICAgICAgICAgICl7XG4gICAgICAgICAgICAgICAgam9pbkJ1dHRvbi5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRQbGF5ZXJJbmRleCgpIHtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUucGxheWVycy5maW5kSW5kZXgoKHA6IGFueSkgPT4gcD8udXNlcj8udXNlcklkID09PSB1c2VyPy51c2VySWQpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIG9uRXZlbnQ6IChmbjogRnVuY3Rpb24pID0+IHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vbkV2ZW50LnB1c2goZm4pO1xuICAgICAgICAgICAgcmV0dXJuICgpID0+IGNhbGxiYWNrcy5vbkV2ZW50LnNwbGljZShjYWxsYmFja3Mub25FdmVudC5pbmRleE9mKGZuKSwgMSlcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0U3RhdGU6KCk9Pih7Li4uc3RhdGUsIC4uLnJvb20uc3RhdGUudG9KU09OKCl9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ2xpY2tKb2luKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIm9uQ2xpY2sgam9pblwiKTtcbiAgICAgICAgbG9nU3RhdGVzKCk7XG4gICAgICAgIHJvb20uc2VuZChcIkpPSU5fR0FNRVwiLCB7dXNlcn0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbGlja0NyZWF0ZSgpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJvbkNsaWNrIGNyZWF0ZVwiKTtcbiAgICAgICAgbG9nU3RhdGVzKCk7XG5cbiAgICAgICAgcm9vbS5zZW5kKFwiQ1JFQVRFX0dBTUVcIiwge3VzZXJ9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRQbGF5ZXJHbG9iYWxTY29yZShwbGF5ZXJJbmRleDpudW1iZXIpe1xuICAgICAgICByZXR1cm4gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHNcbiAgICAgICAgICAgIC5yZWR1Y2UoKGFjYzphbnksIGN1cnJlbnQ6YW55KT0+Y3VycmVudCA9PT0gcGxheWVySW5kZXggPyAoYWNjKzEpOmFjYywwKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEdsb2JhbFdpbm5lcigpe1xuICAgICAgICBjb25zdCBwbGF5ZXIxR2xvYmFsU2NvcmUgPSBnZXRQbGF5ZXJHbG9iYWxTY29yZSgwKTtcbiAgICAgICAgY29uc3QgcGxheWVyMkdsb2JhbFNjb3JlID0gZ2V0UGxheWVyR2xvYmFsU2NvcmUoMSk7XG4gICAgICAgIGlmKFxuICAgICAgICAgICAgKChwbGF5ZXIxR2xvYmFsU2NvcmUgPj0gMyB8fCBwbGF5ZXIyR2xvYmFsU2NvcmUgPj0gMykgJiYgcGxheWVyMUdsb2JhbFNjb3JlICE9PSBwbGF5ZXIyR2xvYmFsU2NvcmUpXG4gICAgICAgICAgICB8fCByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGggPT09IDVcbiAgICAgICAgKXtcbiAgICAgICAgICAgIHJldHVybiBwbGF5ZXIxR2xvYmFsU2NvcmU+cGxheWVyMkdsb2JhbFNjb3JlPzA6MVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9XG59XG4iXX0=