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
    const disconnectionText = lobbyScreen.addText({ text: "DISCONNECTED", textColor: [1, 0, 0, 1], pixelPosition: [192 / 2, 4], layer: 10, textAlign: 1, fontSize: 1 });
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
                velocityMultiplier: 1
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtbWljaC1zY3JlZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vc2FtbWljaC1zY3JlZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNILE1BQU0sRUFRTixTQUFTLEVBQ1osTUFBTSxjQUFjLENBQUM7QUFDdEIsT0FBTyxZQUFZLENBQUM7QUFFcEIsT0FBTyxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDbkQsT0FBTyxFQUFnQixlQUFlLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RixPQUFPLEVBQUMsY0FBYyxFQUFjLE1BQU0saUJBQWlCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV0QyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUM5RCxPQUFPLEVBQ0gsa0JBQWtCLEVBQ2xCLFVBQVUsRUFDVixtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLHNCQUFzQixFQUN6QixNQUFNLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQy9ELE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDcEMsT0FBTyxFQUFDLE9BQU8sRUFBRSxtQkFBbUIsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUFDLFVBQVUsRUFBQyxN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LENBQUEsQ0FBQyxDQUFBLENBQUMsQ0FBQSxDQUFDLENBQUEsQ0FBQyxDQUFBO1FBQ3BELENBQUM7UUFDRCxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2QsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIGVuZ2luZSxcbiAgICBFbnRpdHksXG4gICAgTWF0ZXJpYWwsXG4gICAgTWF0ZXJpYWxUcmFuc3BhcmVuY3lNb2RlLFxuICAgIFRleHRBbGlnbk1vZGUsXG4gICAgVGV4dFNoYXBlLFxuICAgIFRleHR1cmVGaWx0ZXJNb2RlLFxuICAgIFRleHR1cmVXcmFwTW9kZSxcbiAgICBUcmFuc2Zvcm1cbn0gZnJvbSBcIkBkY2wvc2RrL2Vjc1wiO1xuaW1wb3J0IFwiLi9wb2x5ZmlsbFwiO1xuXG5pbXBvcnQge0NvbG9yMywgUXVhdGVybmlvbiwgVmVjdG9yM30gZnJvbSBcIkBkY2wvc2RrL21hdGhcIjtcbmltcG9ydCB7Q2xpZW50fSBmcm9tIFwiY29seXNldXMuanNcIjtcbmltcG9ydCB7Y3JlYXRlU3ByaXRlU2NyZWVufSBmcm9tIFwiLi9zcHJpdGUtc2NyZWVuXCI7XG5pbXBvcnQge2dldElucHV0U3RhdGUsIG9uSW5wdXRLZXlFdmVudCwgc2V0dXBJbnB1dENvbnRyb2xsZXJ9IGZyb20gXCIuL2lucHV0LWNvbnRyb2xsZXJcIjtcbmltcG9ydCB7Z2V0TWluVXNlckRhdGEsIE1pblVzZXJEYXRhfSBmcm9tIFwiLi9taW4tdXNlci1kYXRhXCI7XG5pbXBvcnQge2NyZWF0ZVNjcmVlblJ1bm5lcn0gZnJvbSBcIi4vZ2FtZS1ydW5uZXJcIjtcbmltcG9ydCB7dGltZXJzfSBmcm9tIFwiQGRjbC1zZGsvdXRpbHNcIjtcbmltcG9ydCB7VHJhbnNmb3JtVHlwZVdpdGhPcHRpb25hbHN9IGZyb20gXCJAZGNsL2Vjcy9kaXN0L2NvbXBvbmVudHMvbWFudWFsL1RyYW5zZm9ybVwiO1xuaW1wb3J0IHtjcmVhdGVJbnN0cnVjdGlvblNjcmVlbn0gZnJvbSBcIi4vaW5zdHJ1Y3Rpb25zLXNjcmVlblwiO1xuaW1wb3J0IHtcbiAgICBERUZBVUxUX1NQUklURV9ERUYsXG4gICAgTkFNRV9DT0xPUixcbiAgICBTSEFSRURfU0NSRUVOX1NDQUxFLFxuICAgIFNQTElUX1NDUkVFTl9TQ0FMRSxcbiAgICBTUFJJVEVfU0hFRVRfRElNRU5TSU9OXG59IGZyb20gXCIuLi8uLi8uLi9zcHJpdGUtY29uc3RhbnRzXCI7XG5pbXBvcnQge2NyZWF0ZUdsb2JhbFNjb3JlVHJhbnNpdGlvbn0gZnJvbSBcIi4vc2NvcmUtdHJhbnNpdGlvblwiO1xuaW1wb3J0IHt0aHJvdHRsZX0gZnJvbSBcIi4vdGhyb3R0bGVcIjtcbmltcG9ydCB7Z2V0R2FtZSwgc2V0dXBHYW1lUmVwb3NpdG9yeX0gZnJvbSBcIi4uLy4uLy4uL2dhbWUtcmVwb3NpdG9yeVwiO1xuaW1wb3J0IHtkY2xTbGVlcH0gZnJvbSBcIi4vZGNsLXNsZWVwXCI7XG5pbXBvcnQge0dBTUVfU1RBR0V9IGZyb20gXCIuLi8uLi8uLi9nYW1lLXN0YWdlc1wiO1xuaW1wb3J0IHtjbG9uZURlZXB9IGZyb20gXCIuLi8uLi8uLi9saWItdXRpbFwiO1xuaW1wb3J0IHtFVkVOVH0gZnJvbSBcIi4vZXZlbnRzXCI7XG5pbXBvcnQge2dldFRleHR1cmV9IGZyb20gXCIuL3RleHR1cmUtcmVwb3NpdG9yeVwiO1xuXG5jb25zdCBJTlNUUlVDVElPTl9SRUFEWV9USU1FT1VUID0gNzAwMDtcbmNvbnN0IElOU1RSVUNUSU9OX1RPVEFMX1RJTUVPVVQgPSAzMDAwMDtcbmNvbnN0IERFRkFVTFRfU0NSRUVOX1NQUklURV9ERUZJTklUSU9OID0ge1xuICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICB4OiA1NzYsIHk6IDEyOCwgdzogMTkyLCBoOiAxMjgsXG59XG5jb25zdCBXQUlUSU5HX1RFWFRfWSA9IDEwNDtcbmNvbnN0IEZPTlRfU0laRSA9IDAuMzU7XG5jb25zdCBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgeDogMCxcbiAgICB5OiAwLFxuICAgIHc6IDE5MixcbiAgICBoOiAxMjgsXG59XG5jb25zdCBUUkFOU0lUSU9OX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICB4OjU3NixcbiAgICB5OjEyOCxcbiAgICB3OjE5MixcbiAgICBoOjEyOCxcbiAgICAuLi5TUFJJVEVfU0hFRVRfRElNRU5TSU9OXG59XG5leHBvcnQgdHlwZSBTYW1taWNoU2NyZWVuT3B0aW9ucyA9IHtcbiAgICBkZWZhdWx0VGV4dHVyZVNyYz86c3RyaW5nLFxuICAgIGJhc2VJbnN0cnVjdGlvblZpZGVvVVJMPzpzdHJpbmcsXG4gICAgY29seXNldXNTZXJ2ZXJVUkw/OnN0cmluZ1xufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNhbW1pY2hTY3JlZW4ocGFyZW50OiBFbnRpdHksIHtcbiAgICBwb3NpdGlvbixcbiAgICByb3RhdGlvbixcbiAgICBzY2FsZSxcbiAgICBkZWZhdWx0VGV4dHVyZVNyYyA9IFwiaHR0cHM6Ly9zYW1taWNoLnByby9pbWFnZXMvc3ByaXRlc2hlZXQucG5nXCIsXG4gICAgYmFzZUluc3RydWN0aW9uVmlkZW9VUkwgPSBcImh0dHBzOi8vc2FtbWljaC5wcm8vaW5zdHJ1Y3Rpb24tdmlkZW9zXCIsXG4gICAgY29seXNldXNTZXJ2ZXJVUkwgPSBcIndzczovL3NhbW1pY2gucHJvL2NvbHlzZXVzXCJcbn06IFRyYW5zZm9ybVR5cGVXaXRoT3B0aW9uYWxzICYgU2FtbWljaFNjcmVlbk9wdGlvbnMsIF9nYW1lSW5zdGFuY2VJZD86c3RyaW5nKSB7XG4gICAgY29uc3QgZ2FtZUluc3RhbmNlSWQgPSBfZ2FtZUluc3RhbmNlSWQgfHwgXCJkZWZhdWx0XCI7XG5cbiAgICBzZXR1cElucHV0Q29udHJvbGxlcigpO1xuICAgIHNldHVwR2FtZVJlcG9zaXRvcnkoKTtcblxuICAgIGNvbnNvbGUubG9nKFwiU0FNTUlDSF9TQ1JFRU5cIilcbiAgICBsZXQgcmVjb25uZWN0aW9uVG9rZW46YW55O1xuICAgIGNvbnN0IGNhbGxiYWNrczogeyBvbkV2ZW50OiBGdW5jdGlvbltdIH0gPSB7XG4gICAgICAgIG9uRXZlbnQ6IFtdXG4gICAgfTtcbiAgICBjb25zdCBzdGF0ZSA9IHtcbiAgICAgICAgY29ubmVjdGVkOmZhbHNlLFxuICAgICAgICBnYW1lU3RhZ2U6R0FNRV9TVEFHRS5OT1RfQ09OTkVDVEVELFxuICAgICAgICBzZW50SW5zdHJ1Y3Rpb25zUmVhZHk6ZmFsc2UsXG4gICAgICAgIHNlbnRSZWFkeTpmYWxzZVxuICAgIH07XG5cbiAgICBjb25zdCB1c2VyOiBNaW5Vc2VyRGF0YSA9IGF3YWl0IGdldE1pblVzZXJEYXRhKCk7XG4gICAgY29uc3QgZW50aXR5ID0gZW5naW5lLmFkZEVudGl0eSgpO1xuXG4gICAgVHJhbnNmb3JtLmNyZWF0ZShlbnRpdHksIHtcbiAgICAgICAgcGFyZW50LFxuICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgcm90YXRpb24sXG4gICAgICAgIHNjYWxlXG4gICAgfSk7XG5cbiAgICBjb25zdCBzcHJpdGVUZXh0dXJlID0gZ2V0VGV4dHVyZShkZWZhdWx0VGV4dHVyZVNyYyk7XG4gICAgY29uc3Qgc3ByaXRlTWF0ZXJpYWw6YW55ID0ge1xuICAgICAgICB0ZXh0dXJlOiBzcHJpdGVUZXh0dXJlLFxuICAgICAgICBlbWlzc2l2ZVRleHR1cmU6IHNwcml0ZVRleHR1cmUsXG4gICAgICAgIGVtaXNzaXZlSW50ZW5zaXR5OiAwLjYsXG4gICAgICAgIGVtaXNzaXZlQ29sb3I6IENvbG9yMy5jcmVhdGUoMSwgMSwgMSksXG4gICAgICAgIHNwZWN1bGFySW50ZW5zaXR5OiAwLFxuICAgICAgICByb3VnaG5lc3M6IDEsXG4gICAgICAgIGFscGhhVGVzdDogMSxcbiAgICAgICAgdHJhbnNwYXJlbmN5TW9kZTogTWF0ZXJpYWxUcmFuc3BhcmVuY3lNb2RlLk1UTV9BTFBIQV9URVNUXG4gICAgfTtcbiAgICBjb25zdCBsb2JieVNjcmVlblRyYW5zZm9ybSA9IHsvL1RPRE8gY2FuIGJlIGRpZmZlcmVudCBmb3IgZWFjaCBwbGF5ZXIgc2NyZWVuXG4gICAgICAgIHBvc2l0aW9uOiBWZWN0b3IzLmNyZWF0ZSgwLCAwLCAwKSxcbiAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICB9O1xuXG4gICAgY29uc3QgbG9iYnlTY3JlZW4gPSBjcmVhdGVTcHJpdGVTY3JlZW4oe1xuICAgICAgICB0cmFuc2Zvcm06IGxvYmJ5U2NyZWVuVHJhbnNmb3JtLFxuICAgICAgICBzcHJpdGVNYXRlcmlhbCxcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjogQ09WRVJfU1BSSVRFX0RFRklOSVRJT05cbiAgICB9KTtcbiAgICBjb25zdCB3YWl0aW5nVGV4dEVudGl0eSA9IGxvYmJ5U2NyZWVuLmFkZFRleHQoe1xuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbMTkyLzIsIFdBSVRJTkdfVEVYVF9ZICsgNF0sXG4gICAgICAgIHRleHRBbGlnbjpUZXh0QWxpZ25Nb2RlLlRBTV9UT1BfQ0VOVEVSLFxuICAgICAgICB0ZXh0OmAgICAgPGNvbG9yPSR7TkFNRV9DT0xPUn0+R2VzdDwvY29sb3I+IGlzIHdhaXRpbmcgc29tYCxcbiAgICAgICAgdGV4dENvbG9yOlsxLDEsMSwxXSxcbiAgICAgICAgZm9udFNpemU6Rk9OVF9TSVpFLFxuICAgICAgICBsYXllcjoyXG4gICAgfSk7XG4gICAgY29uc3Qgd2FpdGluZ1RleHRCYWNrZ3JvdW5kID0gbG9iYnlTY3JlZW4uYWRkU3ByaXRlKHtcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDogMzg0LCB5OiAyMTgsIHc6IDE5MiwgaDogMjUsXG4gICAgICAgICAgICBtZXRhZGF0YToge25hbWU6IFwidGV4dC1iYWNrZ3JvdW5kXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFswLCBXQUlUSU5HX1RFWFRfWV0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBrbGFzczpcIlRleHRCYWNrZ3JvdW5kXCJcbiAgICB9KVxuICAgIHdhaXRpbmdUZXh0RW50aXR5LmhpZGUoKTtcbiAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuaGlkZSgpO1xuXG4gICAgY29uc3QgZGlzY29ubmVjdGlvblRleHQgPSBsb2JieVNjcmVlbi5hZGRUZXh0KHt0ZXh0OlwiRElTQ09OTkVDVEVEXCIsIHRleHRDb2xvcjpbMSwwLDAsMV0sIHBpeGVsUG9zaXRpb246WzE5Mi8yLDRdLCBsYXllcjoxMCwgdGV4dEFsaWduOlRleHRBbGlnbk1vZGUuVEFNX1RPUF9DRU5URVIsIGZvbnRTaXplOjF9KTtcbiAgICBjb25zdCBzY29yZVRyYW5zaXRpb24gPSBjcmVhdGVHbG9iYWxTY29yZVRyYW5zaXRpb24obG9iYnlTY3JlZW4pO1xuICAgIGNvbnN0IGNvbHlzZXVzQ2xpZW50OiBDbGllbnQgPSBuZXcgQ2xpZW50KGNvbHlzZXVzU2VydmVyVVJMKTtcblxuICAgIGNvbnN0IGNvbm5lY3RSb29tID0gYXN5bmMgKCk9PntcbiAgICAgICAgY29uc29sZS5sb2coXCJjb25uZWN0Um9vbVwiKTtcbiAgICAgICAgbGV0IF9yb29tO1xuICAgICAgICB3aGlsZSghc3RhdGUuY29ubmVjdGVkKXtcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBfcm9vbSA9IGF3YWl0IGNvbHlzZXVzQ2xpZW50LmpvaW5PckNyZWF0ZShgR2FtZVJvb21gLCB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXIsXG4gICAgICAgICAgICAgICAgICAgIGdhbWVJbnN0YW5jZUlkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJDT05ORUNURURcIiwgX3Jvb20/LnJvb21JZCk7XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1jYXRjaChlcnJvcjphbnkpe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3IgY29ubmVjdGluZ1wiLCBlcnJvcj8ubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMzAwMCk7XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yb29tO1xuICAgIH07XG4gICAgY29uc3Qgb25NaW5pR2FtZVRyYWNrID0gYXN5bmMgKG1pbmlHYW1lVHJhY2s6YW55KSA9PiB7XG4gICAgICAgIC8vVE9ETyBzaG93IGluc3RydWN0aW9ucyBvZiB0aGUgZ2FtZSAwXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTUlOSV9HQU1FX1RSQUNLXCIsIG1pbmlHYW1lVHJhY2spO1xuICAgIH07XG4gICAgY29uc3Qgcm9vbU9uSW5wdXRGcmFtZSA9ICh7cGxheWVySW5kZXgsIGZyYW1lfTphbnkpPT57XG4gICAgICAgIC8vVE9ETyByZXZpZXcgaWYgYmVzdCBhcHByb2FjaCwgZm9yIG5vdyB0byByZXByZXNlbnQgb3RoZXIgcGxheWVyIFN0YXRlXG4gICAgICAgIGlmKHBsYXllckluZGV4ICE9PSBnZXRQbGF5ZXJJbmRleCgpKXtcbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMuZm9yRWFjaChydW5uZXIgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0RGF0YSA9IGZyYW1lLmV2ZW50c1tmcmFtZS5ldmVudHMubGVuZ3RoLTFdLmRhdGFcbiAgICAgICAgICAgICAgICBydW5uZXIucnVudGltZS5wdXNoSW5wdXRFdmVudCh7XG4gICAgICAgICAgICAgICAgICAgIC4uLmlucHV0RGF0YSxcbiAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXhcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgcmVjb25uZWN0ID0gYXN5bmMgKGNvZGU6bnVtYmVyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibGVhdmUgY29kZVwiLCBjb2RlKTtcbiAgICAgICAgZGlzY29ubmVjdGlvblRleHQuc2hvdygpO1xuICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgbGV0ICAgIGVycm9yNDIxMiA9IGZhbHNlO1xuICAgICAgICB3aGlsZSghc3RhdGUuY29ubmVjdGVkKXtcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlY29ubmVjdGluZy4uLlwiKVxuICAgICAgICAgICAgICAgIHJvb20gPSBlcnJvcjQyMTI/YXdhaXQgY29ubmVjdFJvb20oKTogYXdhaXQgY29seXNldXNDbGllbnQucmVjb25uZWN0KHJlY29ubmVjdGlvblRva2VuKTtcbiAgICAgICAgICAgICAgICBlcnJvcjQyMTIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvbm5lY3Rpb24gRE9ORSFcIiwgcm9vbSwgcm9vbT8ucmVjb25uZWN0aW9uVG9rZW4pO1xuXG4gICAgICAgICAgICAgICAgcmVjb25uZWN0aW9uVG9rZW4gPSByb29tLnJlY29ubmVjdGlvblRva2VuO1xuICAgICAgICAgICAgICAgIHN0YXRlLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZGlzY29ubmVjdGlvblRleHQuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGFkZFJvb21IYW5kbGVycygpO1xuICAgICAgICAgICAgICAgIGhhbmRsZUxvYmJ5U2NyZWVuU3RhdGUoKTtcbiAgICAgICAgICAgIH1jYXRjaChlcnJvcjphbnkpe1xuXG4gICAgICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMzAwMCk7XG4gICAgICAgICAgICAgICAgaWYoZXJyb3I/LmNvZGUgPT09IDQyMTIpe1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjQyMTIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yIHJlY29ubmVjdGluZ1wiLCBlcnJvcilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgaW5Mb2NhbFN0YWdlID0gKHN0YWdlOkdBTUVfU1RBR0UpID0+IHN0YXRlLmdhbWVTdGFnZSA9PT0gc3RhZ2U7XG4gICAgY29uc3QgaW5Sb29tU3RhZ2UgPSAoc3RhZ2U6R0FNRV9TVEFHRSkgPT4gcm9vbS5zdGF0ZS5nYW1lU3RhZ2UgPT09IHN0YWdlO1xuICAgIGNvbnN0IGRpZmZTdGFnZSA9IChzdGFnZTpHQU1FX1NUQUdFKT0+IGluTG9jYWxTdGFnZShzdGFnZSkgIT09IGluUm9vbVN0YWdlKHN0YWdlKTtcbiAgICBjb25zdCByb29tT25TdGF0ZUNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyb29tT25TdGF0ZUNoYW5nZS5cIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuXG4gICAgICAgIGhhbmRsZVBsYXllcnNTZW5kaW5nUmVhZHkoKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuSURMRSwgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSk7XG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfSU5TVFJVQ1RJT05TLCBzaG93SW5zdHJ1Y3Rpb25zLCBoaWRlSW5zdHJ1Y3Rpb25zKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuUExBWUlOR19NSU5JR0FNRSwgc3RhcnRNaW5pR2FtZSk7XG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlRJRV9CUkVBS0VSLCBzaG93VGllQnJlYWtlcik7XG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfU0NPUkVfVFJBTlNJVElPTiwgaGFuZGxlU2NvcmVUcmFuc2l0aW9uKVxuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5TSE9XSU5HX0VORCwgaGFuZGxlRW5kVHJhY2spO1xuICAgICAgICBpZihyb29tLnN0YXRlLnBsYXllcnMuZmlsdGVyKChwOmFueSk9PnAuaW5zdHJ1Y3Rpb25zUmVhZHkpLmxlbmd0aCA9PT0gMSl7XG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbC5zZXRUaW1lb3V0KElOU1RSVUNUSU9OX1JFQURZX1RJTUVPVVQpO1xuICAgICAgICAgICAgaWYoZ2V0UGxheWVySW5kZXgoKSA+PSAwICYmICFyb29tLnN0YXRlLnBsYXllcnNbZ2V0UGxheWVySW5kZXgoKV0uaW5zdHJ1Y3Rpb25zUmVhZHkpe1xuICAgICAgICAgICAgICAgIHRpbWVycy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYoIXN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5TVFJVQ1RJT05TX1JFQURZXCIsIHsgcGxheWVySW5kZXg6IGdldFBsYXllckluZGV4KCksIGZvbzogMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIElOU1RSVUNUSU9OX1JFQURZX1RJTUVPVVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGUuZ2FtZVN0YWdlID0gcm9vbS5zdGF0ZS5nYW1lU3RhZ2U7XG4gICAgICAgIGhhbmRsZUxvYmJ5U2NyZWVuU3RhdGUoKTtcblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVFbmRUcmFjaygpe1xuICAgICAgICAgICAgY29uc3QgdHJhY2tXaW5uZXJJbmRleCA9IGdldEdsb2JhbFdpbm5lcigpO1xuICAgICAgICAgICAgc2NvcmVUcmFuc2l0aW9uLnNob3dGaW5hbFNwcml0ZSh0cmFja1dpbm5lckluZGV4KTtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vbkV2ZW50LmZvckVhY2goZT0+ZSh7XG4gICAgICAgICAgICAgICAgdHlwZTpFVkVOVC5FTkRfVFJBQ0ssXG4gICAgICAgICAgICAgICAgZGF0YTp7XG4gICAgICAgICAgICAgICAgICAgIHRyYWNrV2lubmVySW5kZXhcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJlc2V0VHJhY2tTdGF0ZSgpO1xuICAgICAgICAgICAgZGlzcG9zZUlucHV0TGlzdGVuZXIgJiYgZGlzcG9zZUlucHV0TGlzdGVuZXIoKTtcblxuXG4gICAgICAgICAgICBmdW5jdGlvbiByZXNldFRyYWNrU3RhdGUoKXtcbiAgICAgICAgICAgICAgICBzY29yZVRyYW5zaXRpb24ucmVzZXQoKTtcbiAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKHN0YXRlLCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbnRSZWFkeTpmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgc2VudEluc3RydWN0aW9uc1JlYWR5OmZhbHNlXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlUGxheWVyc1NlbmRpbmdSZWFkeSgpe1xuICAgICAgICAgICAgY29uc3QgcGxheWVySW5kZXggPSBnZXRQbGF5ZXJJbmRleCgpO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4ID49IDBcbiAgICAgICAgICAgICAgICAmJiAhc3RhdGUuc2VudFJlYWR5XG4gICAgICAgICAgICAgICAgJiYgcm9vbS5zdGF0ZS5wbGF5ZXJzLmxlbmd0aCA9PT0gMlxuICAgICAgICAgICAgICAgICYmIGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuV0FJVElOR19QTEFZRVJTX1JFQURZKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUuc2VudFJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlNFTkQgUkVBRFlcIilcbiAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJSRUFEWVwiLCB7cGxheWVySW5kZXh9KTtcbiAgICAgICAgICAgICAgICBzZXRJbnB1dExpc3RlbmVyKCk7XG4gICAgICAgICAgICB9ZWxzZSBpZighaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUlNfUkVBRFkpICYmIHN0YXRlLnNlbnRSZWFkeSl7XG4gICAgICAgICAgICAgICAgc3RhdGUuc2VudFJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBoYW5kbGVTdGFnZUNoYW5nZShnYW1lU3RhZ2U6R0FNRV9TVEFHRSwgZm46RnVuY3Rpb24sIGVsc2VGbj86RnVuY3Rpb24pe1xuICAgICAgICAgICAgaWYoZGlmZlN0YWdlKGdhbWVTdGFnZSkpe1xuICAgICAgICAgICAgICAgIGlmKGluUm9vbVN0YWdlKGdhbWVTdGFnZSkpe1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGVsc2VGbikge1xuICAgICAgICAgICAgICAgICAgICBlbHNlRm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzaG93VGllQnJlYWtlcigpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJzaG93VGllQnJlYWtlclwiLCByb29tLnN0YXRlLnRpZUJyZWFrZXJXaW5uZXIpXG4gICAgICAgICAgICBpZihnZXRQbGF5ZXJJbmRleCgpICE9PSAwKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5SdW5uZXJzWzBdLnJ1bnRpbWUucmVwcm9kdWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzY3JlZW5SdW5uZXJzWzBdLnJ1bnRpbWUudGllQnJlYWtlcih7XG4gICAgICAgICAgICAgICAgd2lubmVySW5kZXg6cm9vbS5zdGF0ZS50aWVCcmVha2VyV2lubmVyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dJbnN0cnVjdGlvbnMoKXtcbiAgICAgICAgICAgIGNvbnN0IG5leHRNaW5pR2FtZUluZGV4ID0gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoO1xuICAgICAgICAgICAgY29uc3QgbmV4dEdhbWVJZCA9IHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tuZXh0TWluaUdhbWVJbmRleF07XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNob3dJbnN0cnVjdGlvbnNcIiwgbmV4dE1pbmlHYW1lSW5kZXgsIG5leHRHYW1lSWQsIGdldEdhbWUobmV4dEdhbWVJZCkuZGVmaW5pdGlvbi5hbGlhcylcbiAgICAgICAgICAgIGxvYmJ5U2NyZWVuLnNob3coKTtcbiAgICAgICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IGZhbHNlXG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbCA9IGNyZWF0ZUluc3RydWN0aW9uU2NyZWVuKHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBsb2JieVNjcmVlbi5nZXRFbnRpdHkoKSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IFZlY3RvcjMuY3JlYXRlKDAsIDAsIC0wLjA1KSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IFZlY3RvcjMuT25lKCksXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBRdWF0ZXJuaW9uLlplcm8oKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2FtZUFsaWFzOiBnZXRHYW1lKG5leHRHYW1lSWQpLmRlZmluaXRpb24uYWxpYXMsXG4gICAgICAgICAgICAgICAgZ2FtZUluc3RydWN0aW9uczogZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmluc3RydWN0aW9ucyxcbiAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleDpnZXRQbGF5ZXJJbmRleCgpLFxuICAgICAgICAgICAgICAgIGJhc2VJbnN0cnVjdGlvblZpZGVvVVJMXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNldFRpbWVvdXQoSU5TVFJVQ1RJT05fVE9UQUxfVElNRU9VVCk7XG4gICAgICAgICAgICB0aW1lcnMuc2V0VGltZW91dCgoKT0+e1xuICAgICAgICAgICAgICAgIGlmKCFzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkpe1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwgeyBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSwgZm9vOiAyIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDMwMDAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhpZGVJbnN0cnVjdGlvbnMoKXtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsPy5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgbGV0IHJvb206IGFueSA9IGF3YWl0IGNvbm5lY3RSb29tKCk7XG5cbiAgICBhZGRSb29tSGFuZGxlcnMoKTtcblxuICAgIGRpc2Nvbm5lY3Rpb25UZXh0LmhpZGUoKTtcbiAgICByZWNvbm5lY3Rpb25Ub2tlbiA9IHJvb20ucmVjb25uZWN0aW9uVG9rZW47XG5jb25zb2xlLmxvZyhcInJlY29ubmVjdGlvblRva2VuXCIscmVjb25uZWN0aW9uVG9rZW4pO1xuICAgIGNvbnN0IGNyZWF0ZUJ1dHRvbiA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDAsIHk6IDM4NywgdzogNDcsIGg6IDI1LFxuICAgICAgICAgICAgbWV0YWRhdGE6IHtuYW1lOiBcImNyZWF0ZUJ1dHRvblwifVxuICAgICAgICB9LFxuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbLTQ3LCA4MF0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBvbkNsaWNrOiBvbkNsaWNrQ3JlYXRlLFxuICAgICAgICBob3ZlclRleHQ6IFwiU3RhcnQgbmV3IGdhbWVcIixcbiAgICAgICAga2xhc3M6XCJDcmVhdGVCdXR0b25cIlxuICAgIH0pO1xuXG4gICAgY29uc3Qgam9pbkJ1dHRvbiA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDQ5LCB5OiAzODcsIHc6IDQ3LCBoOiAyNSxcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7bmFtZTogXCJqb2luQnV0dG9uXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFsxOTIgLCA4MF0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBvbkNsaWNrOiBvbkNsaWNrSm9pbixcbiAgICAgICAgaG92ZXJUZXh0OiBcIkpvaW4gZ2FtZVwiLFxuICAgICAgICBrbGFzczpcIkpvaW5CdXR0b25cIlxuICAgIH0pO1xuXG4gICAgam9pbkJ1dHRvbi5oaWRlKCk7XG4gICAgY3JlYXRlQnV0dG9uLmhpZGUoKTtcblxuICAgIGxldCBwbGF5ZXJTY3JlZW5zOmFueVtdID0gW10sIHNjcmVlblJ1bm5lcnM6YW55W10gPSBbXTtcbiAgICBsZXQgaW5zdHJ1Y3Rpb25zUGFuZWw6YW55O1xuXG4gICAgY29uc3QgaGFuZGxlU2NvcmVUcmFuc2l0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImhhbmRsZVNjb3JlVHJhbnNpdGlvblwiKTtcbiAgICAgICAgY29uc3Qgd2lubmVySW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0c1tyb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGgtMV07XG4gICAgICAgIGNvbnN0IGZpbmFsaXplID0gZ2V0R2xvYmFsV2lubmVyKCkgIT09IC0xO1xuICAgICAgICBjb25zdCBtaW5pR2FtZVJlc3VsdHMgPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cztcbiAgICAgICAgLy9UT0RPIGVzdG8gZGVzcHVlcyBkZSBUSUVfQlJFQUtFUlxuICAgICAgICBwbGF5ZXJTY3JlZW5zLmZvckVhY2goKHM6YW55KT0+cy5kZXN0cm95KCkpO1xuICAgICAgICBzY3JlZW5SdW5uZXJzLmZvckVhY2goc3I9PnNyLnJ1bnRpbWUuc3RvcCgpKTtcbiAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHNyPT5zci5ydW50aW1lLmRlc3Ryb3koKSk7XG4gICAgICAgIHBsYXllclNjcmVlbnMgPSBbXTtcbiAgICAgICAgc2NyZWVuUnVubmVycyA9IFtdO1xuXG4gICAgICAgIGxvYmJ5U2NyZWVuLnNob3coKTtcbiAgICAgICAgbG9iYnlTY3JlZW4uc2V0QmFja2dyb3VuZFNwcml0ZSh7XG4gICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOlRSQU5TSVRJT05fU0NSRUVOX1NQUklURV9ERUZJTklUSU9OXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBwcmV2aW91c1Njb3JlcyA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLnJlZHVjZSgoYWNjOm51bWJlcltdLCB3aW5uZXJJbmRleDpudW1iZXIpPT57XG4gICAgICAgICAgICBhY2Nbd2lubmVySW5kZXhdKys7XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICB9LFswLDBdKTtcbiAgICAgICAgcHJldmlvdXNTY29yZXNbd2lubmVySW5kZXhdIC09IDE7XG4gICAgICAgIGNvbnN0IGlzRmluYWwgPSAhIWZpbmFsaXplO1xuICAgICAgICBjb25zdCB0cmFja1dpbm5lckluZGV4ID0gZ2V0VHJhY2tXaW5uZXJGcm9tTWluaUdhbWVSZXN1bHRzKG1pbmlHYW1lUmVzdWx0cyk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidHJhY2tXaW5uZXJJbmRleFwiLHRyYWNrV2lubmVySW5kZXgpXG5cblxuICAgICAgICBhd2FpdCBzY29yZVRyYW5zaXRpb24uc2hvd1RyYW5zaXRpb24oe1xuICAgICAgICAgICAgd2lubmVySW5kZXgsXG4gICAgICAgICAgICBwcmV2aW91c1Njb3JlcyxcbiAgICAgICAgICAgIGlzRmluYWwsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTE6cm9vbS5zdGF0ZS5wbGF5ZXJzWzBdLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgZGlzcGxheU5hbWUyOnJvb20uc3RhdGUucGxheWVyc1sxXS5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIHRyYWNrV2lubmVySW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIHNjb3JlVHJhbnNpdGlvbi5oaWRlKCk7XG4gICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IGZhbHNlO1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRyYWNrV2lubmVyRnJvbU1pbmlHYW1lUmVzdWx0cyhtaW5pR2FtZVJlc3VsdHM6bnVtYmVyW10pe1xuICAgICAgICAgICAgbGV0IHNjb3JlczpudW1iZXJbXSA9IFswLDBdO1xuICAgICAgICAgICAgbWluaUdhbWVSZXN1bHRzLmZvckVhY2god2lubmVySW5kZXggPT4ge1xuICAgICAgICAgICAgICAgIHNjb3Jlc1t3aW5uZXJJbmRleF0rK1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNjb3Jlc1wiLCBzY29yZXMpO1xuICAgICAgICAgICAgaWYoc2NvcmVzWzBdID4gc2NvcmVzWzFdKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldFBsYXlpbmdNaW5pR2FtZUlkKCl7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKSkgcmV0dXJuO1xuICAgICAgICBpbmRleCA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tpbmRleF07XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0TWluaUdhbWUgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGxvYmJ5U2NyZWVuLmhpZGUoKTtcbiAgICAgICAgY29uc3QgbWluaUdhbWVJZCA9IGdldFBsYXlpbmdNaW5pR2FtZUlkKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1RBUlRfR0FNRVwiLCBtaW5pR2FtZUlkKTtcbiAgICAgICAgY29uc3QgR2FtZUZhY3RvcnkgPSBnZXRHYW1lKG1pbmlHYW1lSWQpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkdhbWVGYWN0b3J5LmRlZmluaXRpb25cIixHYW1lRmFjdG9yeS5kZWZpbml0aW9uKTtcbiAgICAgICAgaWYoR2FtZUZhY3RvcnkuZGVmaW5pdGlvbi5zcGxpdCl7XG4gICAgICAgICAgICBwbGF5ZXJTY3JlZW5zID0gbmV3IEFycmF5KDIpLmZpbGwobnVsbCkubWFwKChfLCBwbGF5ZXJJbmRleCk9PmNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOlZlY3RvcjMuY3JlYXRlKHBsYXllckluZGV4PzAuMjU6LTAuMjUsIDAsIDApLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogU1BMSVRfU0NSRUVOX1NDQUxFLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGVudGl0eVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3ByaXRlTWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAuLi5ERUZBVUxUX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTixcbiAgICAgICAgICAgICAgICAgICAgdzogMTkyIC8gMixcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMgPSBwbGF5ZXJTY3JlZW5zLm1hcCgoc2NyZWVuLCBwbGF5ZXJJbmRleCkgPT4gY3JlYXRlU2NyZWVuUnVubmVyKHtcbiAgICAgICAgICAgICAgICBzY3JlZW4sIC8vVE9ETyBSRVZJRVc7IHdlIHJlYWxseSBzaG91bGQgdXNlIGFub3RoZXIgc2NyZWVuLCBhbmQgZGVjb3VwbGUgdGhlIGxvYmJ5IHNjcmVlbiBmcm9tIHRoZSBnYW1lXG4gICAgICAgICAgICAgICAgdGltZXJzLFxuICAgICAgICAgICAgICAgIEdhbWVGYWN0b3J5LFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4LFxuICAgICAgICAgICAgICAgIHNlcnZlclJvb206IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBjbGllbnRSb29tOiByb29tLFxuICAgICAgICAgICAgICAgIGlzQ2xpZW50UGxheWVyOiBwbGF5ZXJJbmRleCA9PT0gZ2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXI6MVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKChydW5uZXIsIHBsYXllckluZGV4KT0+e1xuICAgICAgICAgICAgICAgIGlmKHBsYXllckluZGV4ID09PSBnZXRQbGF5ZXJJbmRleCgpKXtcbiAgICAgICAgICAgICAgICAgICAgLy9ydW5uZXIucnVudGltZS5hdHRhY2hEZWJ1Z1BhbmVsKGdldERlYnVnUGFuZWwoKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0UGxheWVyUnVubmVyKHJ1bm5lcik7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnN0YXJ0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9ZWxzZXsvL3NoYXJlZCBzY3JlZW5cbiAgICAgICAgICAgIGNvbnN0IHNjcmVlbiA9IGNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOlZlY3RvcjMuWmVybygpLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogU0hBUkVEX1NDUkVFTl9TQ0FMRSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNwcml0ZU1hdGVyaWFsLFxuICAgICAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uREVGQVVMVF9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT05cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHBsYXllclNjcmVlbnMgPSBbc2NyZWVuXTtcblxuICAgICAgICAgICAgc2NyZWVuUnVubmVycyA9IFtjcmVhdGVTY3JlZW5SdW5uZXIoe1xuICAgICAgICAgICAgICAgIHNjcmVlbiwgLy9UT0RPIFJFVklFVzsgd2UgcmVhbGx5IHNob3VsZCB1c2UgYW5vdGhlciBzY3JlZW4sIGFuZCBkZWNvdXBsZSB0aGUgbG9iYnkgc2NyZWVuIGZyb20gdGhlIGdhbWVcbiAgICAgICAgICAgICAgICB0aW1lcnMsXG4gICAgICAgICAgICAgICAgR2FtZUZhY3RvcnksXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXg6IGdldFBsYXllckluZGV4KCksXG4gICAgICAgICAgICAgICAgc2VydmVyUm9vbTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGNsaWVudFJvb206IHJvb20sXG4gICAgICAgICAgICAgICAgaXNDbGllbnRQbGF5ZXI6dHJ1ZSwvL1RPRE8gZm9yIHNoYXJlZC1zY3JlZW4gLCBpcyByZWFsbHkgYSBjbGllbnRQbGF5ZXIsIGl0IG93dWxkIGJlIGJldHRlciB0byBkZWZpbmUgaWYgaXQncyBzaGFyZWQgc2NyZWVuXG4gICAgICAgICAgICAgICAgc2hhcmVkU2NyZWVuOnRydWUsLy9UT0RPIG9yIG1heWJlOiByZWFjdFRvTmV0d29ya1Nwcml0ZXNcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXI6MVxuICAgICAgICAgICAgfSldO1xuXG4gICAgICAgICAgICBzdGFydFBsYXllclJ1bm5lcihzY3JlZW5SdW5uZXJzWzBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHN0YXJ0UGxheWVyUnVubmVyKHJ1bm5lcjphbnkpe1xuICAgICAgICAgICAgcnVubmVyLnJ1bnRpbWUuc3RhcnQodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgZGlzcG9zZU9uRnJhbWU6YW55O1xuICAgICAgICAgICAgY29uc3QgdGhyb3R0bGVTZW5kUGxheWVyRnJhbWUgPSB0aHJvdHRsZSgoKSA9PiB7IC8vVE9ETyBSRVZJRVcsIGxlYWsgfCBkaXNwb3NlXG4gICAgICAgICAgICAgICAgaWYoIXJ1bm5lciB8fCBydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmRlc3Ryb3llZCl7XG4gICAgICAgICAgICAgICAgICAgIGlmKGRpc3Bvc2VPbkZyYW1lKSBkaXNwb3NlT25GcmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXllckZyYW1lRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXg6Z2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICAgICAgbjogcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5sYXN0UmVwcm9kdWNlZEZyYW1lXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIlBMQVlFUl9GUkFNRVwiLCBwbGF5ZXJGcmFtZURhdGEpO1xuICAgICAgICAgICAgfSwxMDApO1xuICAgICAgICAgICAgZGlzcG9zZU9uRnJhbWUgPSBydW5uZXIub25GcmFtZSh0aHJvdHRsZVNlbmRQbGF5ZXJGcmFtZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbG9nU3RhdGVzKCl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9jYWwgc3RhdGVcIiwgY2xvbmVEZWVwKHN0YXRlKSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwicm9vbSBzdGF0ZVwiLCByb29tLnN0YXRlLnRvSlNPTigpKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGFkZFJvb21IYW5kbGVycygpe1xuICAgICAgICBjb25zb2xlLmxvZyhcImFkZFJvb21IYW5kbGVyc1wiKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCJJTlBVVF9GUkFNRVwiLCByb29tT25JbnB1dEZyYW1lKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCJNSU5JX0dBTUVfVFJBQ0tcIiwgb25NaW5pR2FtZVRyYWNrKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCIqXCIsICguLi5hcmdzOmFueVtdKT0+e1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJhbnkgbWVzc2FnZVwiLCBhcmdzKVxuICAgICAgICB9KTtcbiAgICAgICAgcm9vbS5vbkxlYXZlKHJlY29ubmVjdCk7XG4gICAgICAgIHJvb20ub25TdGF0ZUNoYW5nZShyb29tT25TdGF0ZUNoYW5nZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0SW5wdXRMaXN0ZW5lcigpe1xuICAgICAgICBjb25zdCBwbGF5ZXJJbmRleCA9IGdldFBsYXllckluZGV4KCk7XG4gICAgICAgIGlmKHBsYXllckluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBkaXNwb3NlSW5wdXRMaXN0ZW5lciA9IG9uSW5wdXRLZXlFdmVudCgoaW5wdXRBY3Rpb25LZXk6IGFueSwgaXNQcmVzc2VkOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiaW5wdXRcIiwgaW5wdXRBY3Rpb25LZXksIGlzUHJlc3NlZClcbiAgICAgICAgICAgICAgICBpZihpbkxvY2FsU3RhZ2UoR0FNRV9TVEFHRS5TSE9XSU5HX0lOU1RSVUNUSU9OUykgJiYgIXN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSl7XG5cbiAgICAgICAgICAgICAgICAgICAgc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZW5kaW5nIElOU1RSVUNUSU9OU19SRUFEWVwiKTtcbiAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5TVFJVQ1RJT05TX1JFQURZXCIsIHtwbGF5ZXJJbmRleCwgZm9vOjF9KTtcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zUGFuZWwuc2hvd1dhaXRpbmdGb3JPdGhlclBsYXllcih7dGltZW91dDpJTlNUUlVDVElPTl9SRUFEWV9USU1FT1VUfSk7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5QTEFZSU5HX01JTklHQU1FKSl7XG4gICAgICAgICAgICAgICAgICAgIC8vZ2V0RGVidWdQYW5lbCgpLnNldFN0YXRlKGdldElucHV0U3RhdGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdhbWVJZCA9IHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tyb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGhdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcGxpdCA9IGdldEdhbWUoZ2FtZUlkKS5kZWZpbml0aW9uLnNwbGl0O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBydW5uZXIgPSBzY3JlZW5SdW5uZXJzW3NwbGl0P3BsYXllckluZGV4OjBdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnB1dEZyYW1lID0gcnVubmVyLnJ1bnRpbWUucHVzaElucHV0RXZlbnQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZTpEYXRlLm5vdygpIC0gcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5zdGFydFRpbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZU51bWJlcjpydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmxhc3RSZXByb2R1Y2VkRnJhbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dEFjdGlvbktleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJlc3NlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXllckluZGV4XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vVE9ETyBzZXQgdGltZVxuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlBVVF9GUkFNRVwiLCB7ZnJhbWU6IGlucHV0RnJhbWUsIHBsYXllckluZGV4fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBsZXQgZGlzcG9zZUlucHV0TGlzdGVuZXI6YW55O1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJoYW5kbGVMb2JieVNjcmVlblN0YXRlXCIsIHJvb20uc3RhdGUudG9KU09OKCksIGNsb25lRGVlcChzdGF0ZSkpO1xuICAgICAgICBsb2dTdGF0ZXMoKTtcbiAgICAgICAgaGFuZGxlV2FpdFRleHQoKTtcbiAgICAgICAgaGFuZGxlRGlzY29ubmVjdFRleHQoKTtcbiAgICAgICAgaGFuZGxlQ3JlYXRlQnV0dG9uVmlzaWJpbGl0eSgpO1xuICAgICAgICBoYW5kbGVKb2luQnV0dG9uVmlzaWJpbGl0eSgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZVdhaXRUZXh0KCl7XG4gICAgICAgICAgICBpZiAoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKSl7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRCYWNrZ3JvdW5kLnNob3coKTtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEVudGl0eS5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRFbnRpdHkuc2V0VGV4dChgPGNvbG9yPSR7TkFNRV9DT0xPUn0+JHtyb29tLnN0YXRlLnBsYXllcnNbMF0/LnVzZXI/LmRpc3BsYXlOYW1lfTwvY29sb3I+IGlzIHdhaXRpbmcgc29tZW9uZSB0byBqb2luIHRoZSBnYW1lLi4uYCk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuaGlkZSgpO1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0RW50aXR5LmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZURpc2Nvbm5lY3RUZXh0KCl7XG4gICAgICAgICAgICBpZighc3RhdGUuY29ubmVjdGVkKXtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5zaG93KClcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3Rpb25UZXh0LmhpZGUoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlQ3JlYXRlQnV0dG9uVmlzaWJpbGl0eSgpe1xuICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKVxuICAgICAgICAgICAgICAgICYmIHN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXR0b24uc2hvdygpO1xuICAgICAgICAgICAgICAgIGxvYmJ5U2NyZWVuLnNldEJhY2tncm91bmRTcHJpdGUoe1xuICAgICAgICAgICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTlxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoIWluUm9vbVN0YWdlKEdBTUVfU1RBR0UuSURMRSlcbiAgICAgICAgICAgICAgICB8fCAhc3RhdGUuY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5wbGF5ZXJzLnNvbWUoKHA6YW55KT0+cD8udXNlci51c2VySWQgPT09IHVzZXI/LnVzZXJJZCkpe1xuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1dHRvbi5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVKb2luQnV0dG9uVmlzaWJpbGl0eSgpe1xuICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKVxuICAgICAgICAgICAgICAgICYmIHN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBqb2luQnV0dG9uLnNob3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSX0pPSU4pXG4gICAgICAgICAgICAgICAgfHwgIXN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgICAgIHx8IHJvb20uc3RhdGUucGxheWVycy5zb21lKChwOmFueSk9PnA/LnVzZXIudXNlcklkID09PSB1c2VyPy51c2VySWQpXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIGpvaW5CdXR0b24uaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWVySW5kZXgoKSB7XG4gICAgICAgIHJldHVybiByb29tLnN0YXRlLnBsYXllcnMuZmluZEluZGV4KChwOiBhbnkpID0+IHA/LnVzZXI/LnVzZXJJZCA9PT0gdXNlcj8udXNlcklkKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBvbkV2ZW50OiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25FdmVudC5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25FdmVudC5zcGxpY2UoY2FsbGJhY2tzLm9uRXZlbnQuaW5kZXhPZihmbiksIDEpXG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0YXRlOigpPT4oey4uLnN0YXRlLCAuLi5yb29tLnN0YXRlLnRvSlNPTigpfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsaWNrSm9pbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJvbkNsaWNrIGpvaW5cIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuICAgICAgICByb29tLnNlbmQoXCJKT0lOX0dBTUVcIiwge3VzZXJ9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ2xpY2tDcmVhdGUoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25DbGljayBjcmVhdGVcIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuXG4gICAgICAgIHJvb20uc2VuZChcIkNSRUFURV9HQU1FXCIsIHt1c2VyfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWVyR2xvYmFsU2NvcmUocGxheWVySW5kZXg6bnVtYmVyKXtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzXG4gICAgICAgICAgICAucmVkdWNlKChhY2M6YW55LCBjdXJyZW50OmFueSk9PmN1cnJlbnQgPT09IHBsYXllckluZGV4ID8gKGFjYysxKTphY2MsMClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRHbG9iYWxXaW5uZXIoKXtcbiAgICAgICAgY29uc3QgcGxheWVyMUdsb2JhbFNjb3JlID0gZ2V0UGxheWVyR2xvYmFsU2NvcmUoMCk7XG4gICAgICAgIGNvbnN0IHBsYXllcjJHbG9iYWxTY29yZSA9IGdldFBsYXllckdsb2JhbFNjb3JlKDEpO1xuICAgICAgICBpZihcbiAgICAgICAgICAgICgocGxheWVyMUdsb2JhbFNjb3JlID49IDMgfHwgcGxheWVyMkdsb2JhbFNjb3JlID49IDMpICYmIHBsYXllcjFHbG9iYWxTY29yZSAhPT0gcGxheWVyMkdsb2JhbFNjb3JlKVxuICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoID09PSA1XG4gICAgICAgICl7XG4gICAgICAgICAgICByZXR1cm4gcGxheWVyMUdsb2JhbFNjb3JlPnBsYXllcjJHbG9iYWxTY29yZT8wOjFcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxufVxuIl19