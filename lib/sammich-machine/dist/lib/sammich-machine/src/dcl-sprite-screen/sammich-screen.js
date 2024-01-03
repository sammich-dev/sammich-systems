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
                _room = await colyseusClient.join(`GameRoom`, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtbWljaC1zY3JlZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vc2FtbWljaC1zY3JlZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNILE1BQU0sRUFRTixTQUFTLEVBQ1osTUFBTSxjQUFjLENBQUM7QUFDdEIsT0FBTyxZQUFZLENBQUM7QUFFcEIsT0FBTyxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDbkQsT0FBTyxFQUFnQixlQUFlLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RixPQUFPLEVBQUMsY0FBYyxFQUFjLE1BQU0saUJBQWlCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV0QyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUM5RCxPQUFPLEVBQ0gsa0JBQWtCLEVBQ2xCLFVBQVUsRUFDVixtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLHNCQUFzQixFQUN6QixNQUFNLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQy9ELE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDcEMsT0FBTyxFQUFDLE9BQU8sRUFBRSxtQkFBbUIsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUFDLFVBQVUsRUFBQyxN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QUMsQ0FBQTtRQUNwRCxDQUFDO1FBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNkLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBlbmdpbmUsXG4gICAgRW50aXR5LFxuICAgIE1hdGVyaWFsLFxuICAgIE1hdGVyaWFsVHJhbnNwYXJlbmN5TW9kZSxcbiAgICBUZXh0QWxpZ25Nb2RlLFxuICAgIFRleHRTaGFwZSxcbiAgICBUZXh0dXJlRmlsdGVyTW9kZSxcbiAgICBUZXh0dXJlV3JhcE1vZGUsXG4gICAgVHJhbnNmb3JtXG59IGZyb20gXCJAZGNsL3Nkay9lY3NcIjtcbmltcG9ydCBcIi4vcG9seWZpbGxcIjtcblxuaW1wb3J0IHtDb2xvcjMsIFF1YXRlcm5pb24sIFZlY3RvcjN9IGZyb20gXCJAZGNsL3Nkay9tYXRoXCI7XG5pbXBvcnQge0NsaWVudH0gZnJvbSBcImNvbHlzZXVzLmpzXCI7XG5pbXBvcnQge2NyZWF0ZVNwcml0ZVNjcmVlbn0gZnJvbSBcIi4vc3ByaXRlLXNjcmVlblwiO1xuaW1wb3J0IHtnZXRJbnB1dFN0YXRlLCBvbklucHV0S2V5RXZlbnQsIHNldHVwSW5wdXRDb250cm9sbGVyfSBmcm9tIFwiLi9pbnB1dC1jb250cm9sbGVyXCI7XG5pbXBvcnQge2dldE1pblVzZXJEYXRhLCBNaW5Vc2VyRGF0YX0gZnJvbSBcIi4vbWluLXVzZXItZGF0YVwiO1xuaW1wb3J0IHtjcmVhdGVTY3JlZW5SdW5uZXJ9IGZyb20gXCIuL2dhbWUtcnVubmVyXCI7XG5pbXBvcnQge3RpbWVyc30gZnJvbSBcIkBkY2wtc2RrL3V0aWxzXCI7XG5pbXBvcnQge1RyYW5zZm9ybVR5cGVXaXRoT3B0aW9uYWxzfSBmcm9tIFwiQGRjbC9lY3MvZGlzdC9jb21wb25lbnRzL21hbnVhbC9UcmFuc2Zvcm1cIjtcbmltcG9ydCB7Y3JlYXRlSW5zdHJ1Y3Rpb25TY3JlZW59IGZyb20gXCIuL2luc3RydWN0aW9ucy1zY3JlZW5cIjtcbmltcG9ydCB7XG4gICAgREVGQVVMVF9TUFJJVEVfREVGLFxuICAgIE5BTUVfQ09MT1IsXG4gICAgU0hBUkVEX1NDUkVFTl9TQ0FMRSxcbiAgICBTUExJVF9TQ1JFRU5fU0NBTEUsXG4gICAgU1BSSVRFX1NIRUVUX0RJTUVOU0lPTlxufSBmcm9tIFwiLi4vLi4vLi4vc3ByaXRlLWNvbnN0YW50c1wiO1xuaW1wb3J0IHtjcmVhdGVHbG9iYWxTY29yZVRyYW5zaXRpb259IGZyb20gXCIuL3Njb3JlLXRyYW5zaXRpb25cIjtcbmltcG9ydCB7dGhyb3R0bGV9IGZyb20gXCIuL3Rocm90dGxlXCI7XG5pbXBvcnQge2dldEdhbWUsIHNldHVwR2FtZVJlcG9zaXRvcnl9IGZyb20gXCIuLi8uLi8uLi9nYW1lLXJlcG9zaXRvcnlcIjtcbmltcG9ydCB7ZGNsU2xlZXB9IGZyb20gXCIuL2RjbC1zbGVlcFwiO1xuaW1wb3J0IHtHQU1FX1NUQUdFfSBmcm9tIFwiLi4vLi4vLi4vZ2FtZS1zdGFnZXNcIjtcbmltcG9ydCB7Y2xvbmVEZWVwfSBmcm9tIFwiLi4vLi4vLi4vbGliLXV0aWxcIjtcbmltcG9ydCB7RVZFTlR9IGZyb20gXCIuL2V2ZW50c1wiO1xuaW1wb3J0IHtnZXRUZXh0dXJlfSBmcm9tIFwiLi90ZXh0dXJlLXJlcG9zaXRvcnlcIjtcblxuY29uc3QgSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCA9IDcwMDA7XG5jb25zdCBJTlNUUlVDVElPTl9UT1RBTF9USU1FT1VUID0gMzAwMDA7XG5jb25zdCBERUZBVUxUX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgeDogNTc2LCB5OiAxMjgsIHc6IDE5MiwgaDogMTI4LFxufVxuY29uc3QgV0FJVElOR19URVhUX1kgPSAxMDQ7XG5jb25zdCBGT05UX1NJWkUgPSAwLjM1O1xuY29uc3QgQ09WRVJfU1BSSVRFX0RFRklOSVRJT04gPSB7XG4gICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgIHg6IDAsXG4gICAgeTogMCxcbiAgICB3OiAxOTIsXG4gICAgaDogMTI4LFxufVxuY29uc3QgVFJBTlNJVElPTl9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT04gPSB7XG4gICAgeDo1NzYsXG4gICAgeToxMjgsXG4gICAgdzoxOTIsXG4gICAgaDoxMjgsXG4gICAgLi4uU1BSSVRFX1NIRUVUX0RJTUVOU0lPTlxufVxuZXhwb3J0IHR5cGUgU2FtbWljaFNjcmVlbk9wdGlvbnMgPSB7XG4gICAgZGVmYXVsdFRleHR1cmVTcmM/OnN0cmluZyxcbiAgICBiYXNlSW5zdHJ1Y3Rpb25WaWRlb1VSTD86c3RyaW5nLFxuICAgIGNvbHlzZXVzU2VydmVyVVJMPzpzdHJpbmdcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVTYW1taWNoU2NyZWVuKHBhcmVudDogRW50aXR5LCB7XG4gICAgcG9zaXRpb24sXG4gICAgcm90YXRpb24sXG4gICAgc2NhbGUsXG4gICAgZGVmYXVsdFRleHR1cmVTcmMgPSBcImh0dHBzOi8vc2FtbWljaC5wcm8vaW1hZ2VzL3Nwcml0ZXNoZWV0LnBuZ1wiLFxuICAgIGJhc2VJbnN0cnVjdGlvblZpZGVvVVJMID0gXCJodHRwczovL3NhbW1pY2gucHJvL2luc3RydWN0aW9uLXZpZGVvc1wiLFxuICAgIGNvbHlzZXVzU2VydmVyVVJMID0gXCJ3c3M6Ly9zYW1taWNoLnByby9jb2x5c2V1c1wiXG59OiBUcmFuc2Zvcm1UeXBlV2l0aE9wdGlvbmFscyAmIFNhbW1pY2hTY3JlZW5PcHRpb25zLCBfZ2FtZUluc3RhbmNlSWQ/OnN0cmluZykge1xuICAgIGNvbnN0IGdhbWVJbnN0YW5jZUlkID0gX2dhbWVJbnN0YW5jZUlkIHx8IFwiZGVmYXVsdFwiO1xuXG4gICAgc2V0dXBJbnB1dENvbnRyb2xsZXIoKTtcbiAgICBzZXR1cEdhbWVSZXBvc2l0b3J5KCk7XG5cbiAgICBjb25zb2xlLmxvZyhcIlNBTU1JQ0hfU0NSRUVOXCIpXG4gICAgbGV0IHJlY29ubmVjdGlvblRva2VuOmFueTtcbiAgICBjb25zdCBjYWxsYmFja3M6IHsgb25FdmVudDogRnVuY3Rpb25bXSB9ID0ge1xuICAgICAgICBvbkV2ZW50OiBbXVxuICAgIH07XG4gICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICAgIGNvbm5lY3RlZDpmYWxzZSxcbiAgICAgICAgZ2FtZVN0YWdlOkdBTUVfU1RBR0UuTk9UX0NPTk5FQ1RFRCxcbiAgICAgICAgc2VudEluc3RydWN0aW9uc1JlYWR5OmZhbHNlLFxuICAgICAgICBzZW50UmVhZHk6ZmFsc2VcbiAgICB9O1xuXG4gICAgY29uc3QgdXNlcjogTWluVXNlckRhdGEgPSBhd2FpdCBnZXRNaW5Vc2VyRGF0YSgpO1xuICAgIGNvbnN0IGVudGl0eSA9IGVuZ2luZS5hZGRFbnRpdHkoKTtcblxuICAgIFRyYW5zZm9ybS5jcmVhdGUoZW50aXR5LCB7XG4gICAgICAgIHBhcmVudCxcbiAgICAgICAgcG9zaXRpb24sXG4gICAgICAgIHJvdGF0aW9uLFxuICAgICAgICBzY2FsZVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3ByaXRlVGV4dHVyZSA9IGdldFRleHR1cmUoZGVmYXVsdFRleHR1cmVTcmMpO1xuICAgIGNvbnN0IHNwcml0ZU1hdGVyaWFsOmFueSA9IHtcbiAgICAgICAgdGV4dHVyZTogc3ByaXRlVGV4dHVyZSxcbiAgICAgICAgZW1pc3NpdmVUZXh0dXJlOiBzcHJpdGVUZXh0dXJlLFxuICAgICAgICBlbWlzc2l2ZUludGVuc2l0eTogMC42LFxuICAgICAgICBlbWlzc2l2ZUNvbG9yOiBDb2xvcjMuY3JlYXRlKDEsIDEsIDEpLFxuICAgICAgICBzcGVjdWxhckludGVuc2l0eTogMCxcbiAgICAgICAgcm91Z2huZXNzOiAxLFxuICAgICAgICBhbHBoYVRlc3Q6IDEsXG4gICAgICAgIHRyYW5zcGFyZW5jeU1vZGU6IE1hdGVyaWFsVHJhbnNwYXJlbmN5TW9kZS5NVE1fQUxQSEFfVEVTVFxuICAgIH07XG4gICAgY29uc3QgbG9iYnlTY3JlZW5UcmFuc2Zvcm0gPSB7Ly9UT0RPIGNhbiBiZSBkaWZmZXJlbnQgZm9yIGVhY2ggcGxheWVyIHNjcmVlblxuICAgICAgICBwb3NpdGlvbjogVmVjdG9yMy5jcmVhdGUoMCwgMCwgMCksXG4gICAgICAgIHBhcmVudDogZW50aXR5XG4gICAgfTtcblxuICAgIGNvbnN0IGxvYmJ5U2NyZWVuID0gY3JlYXRlU3ByaXRlU2NyZWVuKHtcbiAgICAgICAgdHJhbnNmb3JtOiBsb2JieVNjcmVlblRyYW5zZm9ybSxcbiAgICAgICAgc3ByaXRlTWF0ZXJpYWwsXG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IENPVkVSX1NQUklURV9ERUZJTklUSU9OXG4gICAgfSk7XG4gICAgY29uc3Qgd2FpdGluZ1RleHRFbnRpdHkgPSBsb2JieVNjcmVlbi5hZGRUZXh0KHtcbiAgICAgICAgcGl4ZWxQb3NpdGlvbjogWzE5Mi8yLCBXQUlUSU5HX1RFWFRfWSArIDRdLFxuICAgICAgICB0ZXh0QWxpZ246VGV4dEFsaWduTW9kZS5UQU1fVE9QX0NFTlRFUixcbiAgICAgICAgdGV4dDpgICAgIDxjb2xvcj0ke05BTUVfQ09MT1J9Pkdlc3Q8L2NvbG9yPiBpcyB3YWl0aW5nIHNvbWAsXG4gICAgICAgIHRleHRDb2xvcjpbMSwxLDEsMV0sXG4gICAgICAgIGZvbnRTaXplOkZPTlRfU0laRSxcbiAgICAgICAgbGF5ZXI6MlxuICAgIH0pO1xuICAgIGNvbnN0IHdhaXRpbmdUZXh0QmFja2dyb3VuZCA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDM4NCwgeTogMjE4LCB3OiAxOTIsIGg6IDI1LFxuICAgICAgICAgICAgbWV0YWRhdGE6IHtuYW1lOiBcInRleHQtYmFja2dyb3VuZFwifVxuICAgICAgICB9LFxuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbMCwgV0FJVElOR19URVhUX1ldLFxuICAgICAgICBsYXllcjogMSxcbiAgICAgICAga2xhc3M6XCJUZXh0QmFja2dyb3VuZFwiXG4gICAgfSlcbiAgICB3YWl0aW5nVGV4dEVudGl0eS5oaWRlKCk7XG4gICAgd2FpdGluZ1RleHRCYWNrZ3JvdW5kLmhpZGUoKTtcblxuICAgIGNvbnN0IGRpc2Nvbm5lY3Rpb25UZXh0ID0gbG9iYnlTY3JlZW4uYWRkVGV4dCh7dGV4dDpcIkRJU0NPTk5FQ1RFRFwiLCB0ZXh0Q29sb3I6WzEsMCwwLDFdLCBwaXhlbFBvc2l0aW9uOlsxOTIvMiw0XSwgbGF5ZXI6MTAsIHRleHRBbGlnbjpUZXh0QWxpZ25Nb2RlLlRBTV9UT1BfQ0VOVEVSLCBmb250U2l6ZToxfSk7XG4gICAgY29uc3Qgc2NvcmVUcmFuc2l0aW9uID0gY3JlYXRlR2xvYmFsU2NvcmVUcmFuc2l0aW9uKGxvYmJ5U2NyZWVuKTtcbiAgICBjb25zdCBjb2x5c2V1c0NsaWVudDogQ2xpZW50ID0gbmV3IENsaWVudChjb2x5c2V1c1NlcnZlclVSTCk7XG5cbiAgICBjb25zdCBjb25uZWN0Um9vbSA9IGFzeW5jICgpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29ubmVjdFJvb21cIik7XG4gICAgICAgIGxldCBfcm9vbTtcbiAgICAgICAgd2hpbGUoIXN0YXRlLmNvbm5lY3RlZCl7XG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgX3Jvb20gPSBhd2FpdCBjb2x5c2V1c0NsaWVudC5qb2luKGBHYW1lUm9vbWAsIHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgICAgICAgICAgZ2FtZUluc3RhbmNlSWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNPTk5FQ1RFRFwiLCBfcm9vbT8ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfWNhdGNoKGVycm9yOmFueSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvciBjb25uZWN0aW5nXCIsIGVycm9yPy5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBkY2xTbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jvb207XG4gICAgfTtcbiAgICBjb25zdCBvbk1pbmlHYW1lVHJhY2sgPSBhc3luYyAobWluaUdhbWVUcmFjazphbnkpID0+IHtcbiAgICAgICAgLy9UT0RPIHNob3cgaW5zdHJ1Y3Rpb25zIG9mIHRoZSBnYW1lIDBcbiAgICAgICAgY29uc29sZS5sb2coXCJNSU5JX0dBTUVfVFJBQ0tcIiwgbWluaUdhbWVUcmFjayk7XG4gICAgfTtcbiAgICBjb25zdCByb29tT25JbnB1dEZyYW1lID0gKHtwbGF5ZXJJbmRleCwgZnJhbWV9OmFueSk9PntcbiAgICAgICAgLy9UT0RPIHJldmlldyBpZiBiZXN0IGFwcHJvYWNoLCBmb3Igbm93IHRvIHJlcHJlc2VudCBvdGhlciBwbGF5ZXIgU3RhdGVcbiAgICAgICAgaWYocGxheWVySW5kZXggIT09IGdldFBsYXllckluZGV4KCkpe1xuICAgICAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHJ1bm5lciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5wdXREYXRhID0gZnJhbWUuZXZlbnRzW2ZyYW1lLmV2ZW50cy5sZW5ndGgtMV0uZGF0YVxuICAgICAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnB1c2hJbnB1dEV2ZW50KHtcbiAgICAgICAgICAgICAgICAgICAgLi4uaW5wdXREYXRhLFxuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCByZWNvbm5lY3QgPSBhc3luYyAoY29kZTpudW1iZXIpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJsZWF2ZSBjb2RlXCIsIGNvZGUpO1xuICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5zaG93KCk7XG4gICAgICAgIHN0YXRlLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgICAgZXJyb3I0MjEyID0gZmFsc2U7XG4gICAgICAgIHdoaWxlKCFzdGF0ZS5jb25uZWN0ZWQpe1xuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVjb25uZWN0aW5nLi4uXCIpXG4gICAgICAgICAgICAgICAgcm9vbSA9IGVycm9yNDIxMj9hd2FpdCBjb25uZWN0Um9vbSgpOiBhd2FpdCBjb2x5c2V1c0NsaWVudC5yZWNvbm5lY3QocmVjb25uZWN0aW9uVG9rZW4pO1xuICAgICAgICAgICAgICAgIGVycm9yNDIxMiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY29ubmVjdGlvbiBET05FIVwiLCByb29tLCByb29tPy5yZWNvbm5lY3Rpb25Ub2tlbik7XG5cbiAgICAgICAgICAgICAgICByZWNvbm5lY3Rpb25Ub2tlbiA9IHJvb20ucmVjb25uZWN0aW9uVG9rZW47XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgYWRkUm9vbUhhbmRsZXJzKCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpO1xuICAgICAgICAgICAgfWNhdGNoKGVycm9yOmFueSl7XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBkY2xTbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgICBpZihlcnJvcj8uY29kZSA9PT0gNDIxMil7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yNDIxMiA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3IgcmVjb25uZWN0aW5nXCIsIGVycm9yKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbkxvY2FsU3RhZ2UgPSAoc3RhZ2U6R0FNRV9TVEFHRSkgPT4gc3RhdGUuZ2FtZVN0YWdlID09PSBzdGFnZTtcbiAgICBjb25zdCBpblJvb21TdGFnZSA9IChzdGFnZTpHQU1FX1NUQUdFKSA9PiByb29tLnN0YXRlLmdhbWVTdGFnZSA9PT0gc3RhZ2U7XG4gICAgY29uc3QgZGlmZlN0YWdlID0gKHN0YWdlOkdBTUVfU1RBR0UpPT4gaW5Mb2NhbFN0YWdlKHN0YWdlKSAhPT0gaW5Sb29tU3RhZ2Uoc3RhZ2UpO1xuICAgIGNvbnN0IHJvb21PblN0YXRlQ2hhbmdlID0gKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcInJvb21PblN0YXRlQ2hhbmdlLlwiKTtcbiAgICAgICAgbG9nU3RhdGVzKCk7XG5cbiAgICAgICAgaGFuZGxlUGxheWVyc1NlbmRpbmdSZWFkeSgpO1xuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5JRExFLCBoYW5kbGVMb2JieVNjcmVlblN0YXRlKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuU0hPV0lOR19JTlNUUlVDVElPTlMsIHNob3dJbnN0cnVjdGlvbnMsIGhpZGVJbnN0cnVjdGlvbnMpO1xuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5QTEFZSU5HX01JTklHQU1FLCBzdGFydE1pbmlHYW1lKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuVElFX0JSRUFLRVIsIHNob3dUaWVCcmVha2VyKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuU0hPV0lOR19TQ09SRV9UUkFOU0lUSU9OLCBoYW5kbGVTY29yZVRyYW5zaXRpb24pXG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfRU5ELCBoYW5kbGVFbmRUcmFjayk7XG4gICAgICAgIGlmKHJvb20uc3RhdGUucGxheWVycy5maWx0ZXIoKHA6YW55KT0+cC5pbnN0cnVjdGlvbnNSZWFkeSkubGVuZ3RoID09PSAxKXtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNldFRpbWVvdXQoSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCk7XG4gICAgICAgICAgICBpZihnZXRQbGF5ZXJJbmRleCgpID49IDAgJiYgIXJvb20uc3RhdGUucGxheWVyc1tnZXRQbGF5ZXJJbmRleCgpXS5pbnN0cnVjdGlvbnNSZWFkeSl7XG4gICAgICAgICAgICAgICAgdGltZXJzLnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZighc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5KXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwgeyBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSwgZm9vOiAyIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5nYW1lU3RhZ2UgPSByb29tLnN0YXRlLmdhbWVTdGFnZTtcbiAgICAgICAgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZUVuZFRyYWNrKCl7XG4gICAgICAgICAgICBjb25zdCB0cmFja1dpbm5lckluZGV4ID0gZ2V0R2xvYmFsV2lubmVyKCk7XG4gICAgICAgICAgICBzY29yZVRyYW5zaXRpb24uc2hvd0ZpbmFsU3ByaXRlKHRyYWNrV2lubmVySW5kZXgpO1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRXZlbnQuZm9yRWFjaChlPT5lKHtcbiAgICAgICAgICAgICAgICB0eXBlOkVWRU5ULkVORF9UUkFDSyxcbiAgICAgICAgICAgICAgICBkYXRhOntcbiAgICAgICAgICAgICAgICAgICAgdHJhY2tXaW5uZXJJbmRleFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmVzZXRUcmFja1N0YXRlKCk7XG4gICAgICAgICAgICBkaXNwb3NlSW5wdXRMaXN0ZW5lciAmJiBkaXNwb3NlSW5wdXRMaXN0ZW5lcigpO1xuXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHJlc2V0VHJhY2tTdGF0ZSgpe1xuICAgICAgICAgICAgICAgIHNjb3JlVHJhbnNpdGlvbi5yZXNldCgpO1xuICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oc3RhdGUsIHtcbiAgICAgICAgICAgICAgICAgICAgc2VudFJlYWR5OmZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzZW50SW5zdHJ1Y3Rpb25zUmVhZHk6ZmFsc2VcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVQbGF5ZXJzU2VuZGluZ1JlYWR5KCl7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXJJbmRleCA9IGdldFBsYXllckluZGV4KCk7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXggPj0gMFxuICAgICAgICAgICAgICAgICYmICFzdGF0ZS5zZW50UmVhZHlcbiAgICAgICAgICAgICAgICAmJiByb29tLnN0YXRlLnBsYXllcnMubGVuZ3RoID09PSAyXG4gICAgICAgICAgICAgICAgJiYgaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUlNfUkVBRFkpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zZW50UmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiU0VORCBSRUFEWVwiKVxuICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIlJFQURZXCIsIHtwbGF5ZXJJbmRleH0pO1xuICAgICAgICAgICAgICAgIHNldElucHV0TGlzdGVuZXIoKTtcbiAgICAgICAgICAgIH1lbHNlIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSU19SRUFEWSkgJiYgc3RhdGUuc2VudFJlYWR5KXtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zZW50UmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVN0YWdlQ2hhbmdlKGdhbWVTdGFnZTpHQU1FX1NUQUdFLCBmbjpGdW5jdGlvbiwgZWxzZUZuPzpGdW5jdGlvbil7XG4gICAgICAgICAgICBpZihkaWZmU3RhZ2UoZ2FtZVN0YWdlKSl7XG4gICAgICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoZ2FtZVN0YWdlKSl7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoZWxzZUZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VGbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dUaWVCcmVha2VyKCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNob3dUaWVCcmVha2VyXCIsIHJvb20uc3RhdGUudGllQnJlYWtlcldpbm5lcilcbiAgICAgICAgICAgIGlmKGdldFBsYXllckluZGV4KCkgIT09IDApe1xuICAgICAgICAgICAgICAgIHNjcmVlblJ1bm5lcnNbMF0ucnVudGltZS5yZXByb2R1Y2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnNbMF0ucnVudGltZS50aWVCcmVha2VyKHtcbiAgICAgICAgICAgICAgICB3aW5uZXJJbmRleDpyb29tLnN0YXRlLnRpZUJyZWFrZXJXaW5uZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd0luc3RydWN0aW9ucygpe1xuICAgICAgICAgICAgY29uc3QgbmV4dE1pbmlHYW1lSW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCBuZXh0R2FtZUlkID0gcm9vbS5zdGF0ZS5taW5pR2FtZVRyYWNrW25leHRNaW5pR2FtZUluZGV4XTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2hvd0luc3RydWN0aW9uc1wiLCBuZXh0TWluaUdhbWVJbmRleCwgbmV4dEdhbWVJZCwgZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmFsaWFzKVxuICAgICAgICAgICAgbG9iYnlTY3JlZW4uc2hvdygpO1xuXG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbCA9IGNyZWF0ZUluc3RydWN0aW9uU2NyZWVuKHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBsb2JieVNjcmVlbi5nZXRFbnRpdHkoKSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IFZlY3RvcjMuY3JlYXRlKDAsIDAsIC0wLjA1KSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IFZlY3RvcjMuT25lKCksXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBRdWF0ZXJuaW9uLlplcm8oKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2FtZUFsaWFzOiBnZXRHYW1lKG5leHRHYW1lSWQpLmRlZmluaXRpb24uYWxpYXMsXG4gICAgICAgICAgICAgICAgZ2FtZUluc3RydWN0aW9uczogZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmluc3RydWN0aW9ucyxcbiAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleDpnZXRQbGF5ZXJJbmRleCgpLFxuICAgICAgICAgICAgICAgIGJhc2VJbnN0cnVjdGlvblZpZGVvVVJMXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNldFRpbWVvdXQoSU5TVFJVQ1RJT05fVE9UQUxfVElNRU9VVCk7XG4gICAgICAgICAgICB0aW1lcnMuc2V0VGltZW91dCgoKT0+e1xuICAgICAgICAgICAgICAgIGlmKCFzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkpe1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwgeyBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSwgZm9vOiAyIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDMwMDAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhpZGVJbnN0cnVjdGlvbnMoKXtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsPy5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgbGV0IHJvb206IGFueSA9IGF3YWl0IGNvbm5lY3RSb29tKCk7XG5cbiAgICBhZGRSb29tSGFuZGxlcnMoKTtcblxuICAgIGRpc2Nvbm5lY3Rpb25UZXh0LmhpZGUoKTtcbiAgICByZWNvbm5lY3Rpb25Ub2tlbiA9IHJvb20ucmVjb25uZWN0aW9uVG9rZW47XG5jb25zb2xlLmxvZyhcInJlY29ubmVjdGlvblRva2VuXCIscmVjb25uZWN0aW9uVG9rZW4pO1xuICAgIGNvbnN0IGNyZWF0ZUJ1dHRvbiA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDAsIHk6IDM4NywgdzogNDcsIGg6IDI1LFxuICAgICAgICAgICAgbWV0YWRhdGE6IHtuYW1lOiBcImNyZWF0ZUJ1dHRvblwifVxuICAgICAgICB9LFxuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbLTQ3LCA4MF0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBvbkNsaWNrOiBvbkNsaWNrQ3JlYXRlLFxuICAgICAgICBob3ZlclRleHQ6IFwiU3RhcnQgbmV3IGdhbWVcIixcbiAgICAgICAga2xhc3M6XCJDcmVhdGVCdXR0b25cIlxuICAgIH0pO1xuXG4gICAgY29uc3Qgam9pbkJ1dHRvbiA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDQ5LCB5OiAzODcsIHc6IDQ3LCBoOiAyNSxcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7bmFtZTogXCJqb2luQnV0dG9uXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFsxOTIgLCA4MF0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBvbkNsaWNrOiBvbkNsaWNrSm9pbixcbiAgICAgICAgaG92ZXJUZXh0OiBcIkpvaW4gZ2FtZVwiLFxuICAgICAgICBrbGFzczpcIkpvaW5CdXR0b25cIlxuICAgIH0pO1xuXG4gICAgam9pbkJ1dHRvbi5oaWRlKCk7XG4gICAgY3JlYXRlQnV0dG9uLmhpZGUoKTtcblxuICAgIGxldCBwbGF5ZXJTY3JlZW5zOmFueVtdID0gW10sIHNjcmVlblJ1bm5lcnM6YW55W10gPSBbXTtcbiAgICBsZXQgaW5zdHJ1Y3Rpb25zUGFuZWw6YW55O1xuXG4gICAgY29uc3QgaGFuZGxlU2NvcmVUcmFuc2l0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImhhbmRsZVNjb3JlVHJhbnNpdGlvblwiKTtcbiAgICAgICAgY29uc3Qgd2lubmVySW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0c1tyb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGgtMV07XG4gICAgICAgIGNvbnN0IGZpbmFsaXplID0gZ2V0R2xvYmFsV2lubmVyKCkgIT09IC0xO1xuICAgICAgICBjb25zdCBtaW5pR2FtZVJlc3VsdHMgPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cztcbiAgICAgICAgLy9UT0RPIGVzdG8gZGVzcHVlcyBkZSBUSUVfQlJFQUtFUlxuICAgICAgICBwbGF5ZXJTY3JlZW5zLmZvckVhY2goKHM6YW55KT0+cy5kZXN0cm95KCkpO1xuICAgICAgICBzY3JlZW5SdW5uZXJzLmZvckVhY2goc3I9PnNyLnJ1bnRpbWUuc3RvcCgpKTtcbiAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHNyPT5zci5ydW50aW1lLmRlc3Ryb3koKSk7XG4gICAgICAgIHBsYXllclNjcmVlbnMgPSBbXTtcbiAgICAgICAgc2NyZWVuUnVubmVycyA9IFtdO1xuXG4gICAgICAgIGxvYmJ5U2NyZWVuLnNob3coKTtcbiAgICAgICAgbG9iYnlTY3JlZW4uc2V0QmFja2dyb3VuZFNwcml0ZSh7XG4gICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOlRSQU5TSVRJT05fU0NSRUVOX1NQUklURV9ERUZJTklUSU9OXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBwcmV2aW91c1Njb3JlcyA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLnJlZHVjZSgoYWNjOm51bWJlcltdLCB3aW5uZXJJbmRleDpudW1iZXIpPT57XG4gICAgICAgICAgICBhY2Nbd2lubmVySW5kZXhdKys7XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICB9LFswLDBdKTtcbiAgICAgICAgcHJldmlvdXNTY29yZXNbd2lubmVySW5kZXhdIC09IDE7XG4gICAgICAgIGNvbnN0IGlzRmluYWwgPSAhIWZpbmFsaXplO1xuICAgICAgICBjb25zdCB0cmFja1dpbm5lckluZGV4ID0gZ2V0VHJhY2tXaW5uZXJGcm9tTWluaUdhbWVSZXN1bHRzKG1pbmlHYW1lUmVzdWx0cyk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidHJhY2tXaW5uZXJJbmRleFwiLHRyYWNrV2lubmVySW5kZXgpXG5cblxuICAgICAgICBhd2FpdCBzY29yZVRyYW5zaXRpb24uc2hvd1RyYW5zaXRpb24oe1xuICAgICAgICAgICAgd2lubmVySW5kZXgsXG4gICAgICAgICAgICBwcmV2aW91c1Njb3JlcyxcbiAgICAgICAgICAgIGlzRmluYWwsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTE6cm9vbS5zdGF0ZS5wbGF5ZXJzWzBdLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgZGlzcGxheU5hbWUyOnJvb20uc3RhdGUucGxheWVyc1sxXS5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIHRyYWNrV2lubmVySW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIHNjb3JlVHJhbnNpdGlvbi5oaWRlKCk7XG4gICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IGZhbHNlO1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRyYWNrV2lubmVyRnJvbU1pbmlHYW1lUmVzdWx0cyhtaW5pR2FtZVJlc3VsdHM6bnVtYmVyW10pe1xuICAgICAgICAgICAgbGV0IHNjb3JlczpudW1iZXJbXSA9IFswLDBdO1xuICAgICAgICAgICAgbWluaUdhbWVSZXN1bHRzLmZvckVhY2god2lubmVySW5kZXggPT4ge1xuICAgICAgICAgICAgICAgIHNjb3Jlc1t3aW5uZXJJbmRleF0rK1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNjb3Jlc1wiLCBzY29yZXMpO1xuICAgICAgICAgICAgaWYoc2NvcmVzWzBdID4gc2NvcmVzWzFdKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldFBsYXlpbmdNaW5pR2FtZUlkKCl7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKSkgcmV0dXJuO1xuICAgICAgICBpbmRleCA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tpbmRleF07XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0TWluaUdhbWUgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGxvYmJ5U2NyZWVuLmhpZGUoKTtcbiAgICAgICAgY29uc3QgbWluaUdhbWVJZCA9IGdldFBsYXlpbmdNaW5pR2FtZUlkKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1RBUlRfR0FNRVwiLCBtaW5pR2FtZUlkKTtcbiAgICAgICAgY29uc3QgR2FtZUZhY3RvcnkgPSBnZXRHYW1lKG1pbmlHYW1lSWQpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkdhbWVGYWN0b3J5LmRlZmluaXRpb25cIixHYW1lRmFjdG9yeS5kZWZpbml0aW9uKTtcbiAgICAgICAgaWYoR2FtZUZhY3RvcnkuZGVmaW5pdGlvbi5zcGxpdCl7XG4gICAgICAgICAgICBwbGF5ZXJTY3JlZW5zID0gbmV3IEFycmF5KDIpLmZpbGwobnVsbCkubWFwKChfLCBwbGF5ZXJJbmRleCk9PmNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOlZlY3RvcjMuY3JlYXRlKHBsYXllckluZGV4PzAuMjU6LTAuMjUsIDAsIDApLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogU1BMSVRfU0NSRUVOX1NDQUxFLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGVudGl0eVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3ByaXRlTWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAuLi5ERUZBVUxUX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTixcbiAgICAgICAgICAgICAgICAgICAgdzogMTkyIC8gMixcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMgPSBwbGF5ZXJTY3JlZW5zLm1hcCgoc2NyZWVuLCBwbGF5ZXJJbmRleCkgPT4gY3JlYXRlU2NyZWVuUnVubmVyKHtcbiAgICAgICAgICAgICAgICBzY3JlZW4sIC8vVE9ETyBSRVZJRVc7IHdlIHJlYWxseSBzaG91bGQgdXNlIGFub3RoZXIgc2NyZWVuLCBhbmQgZGVjb3VwbGUgdGhlIGxvYmJ5IHNjcmVlbiBmcm9tIHRoZSBnYW1lXG4gICAgICAgICAgICAgICAgdGltZXJzLFxuICAgICAgICAgICAgICAgIEdhbWVGYWN0b3J5LFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4LFxuICAgICAgICAgICAgICAgIHNlcnZlclJvb206IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBjbGllbnRSb29tOiByb29tLFxuICAgICAgICAgICAgICAgIGlzQ2xpZW50UGxheWVyOiBwbGF5ZXJJbmRleCA9PT0gZ2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXI6MVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKChydW5uZXIsIHBsYXllckluZGV4KT0+e1xuICAgICAgICAgICAgICAgIGlmKHBsYXllckluZGV4ID09PSBnZXRQbGF5ZXJJbmRleCgpKXtcbiAgICAgICAgICAgICAgICAgICAgLy9ydW5uZXIucnVudGltZS5hdHRhY2hEZWJ1Z1BhbmVsKGdldERlYnVnUGFuZWwoKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0UGxheWVyUnVubmVyKHJ1bm5lcik7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnN0YXJ0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9ZWxzZXsvL3NoYXJlZCBzY3JlZW5cbiAgICAgICAgICAgIGNvbnN0IHNjcmVlbiA9IGNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOlZlY3RvcjMuWmVybygpLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogU0hBUkVEX1NDUkVFTl9TQ0FMRSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNwcml0ZU1hdGVyaWFsLFxuICAgICAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uREVGQVVMVF9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT05cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHBsYXllclNjcmVlbnMgPSBbc2NyZWVuXTtcblxuICAgICAgICAgICAgc2NyZWVuUnVubmVycyA9IFtjcmVhdGVTY3JlZW5SdW5uZXIoe1xuICAgICAgICAgICAgICAgIHNjcmVlbiwgLy9UT0RPIFJFVklFVzsgd2UgcmVhbGx5IHNob3VsZCB1c2UgYW5vdGhlciBzY3JlZW4sIGFuZCBkZWNvdXBsZSB0aGUgbG9iYnkgc2NyZWVuIGZyb20gdGhlIGdhbWVcbiAgICAgICAgICAgICAgICB0aW1lcnMsXG4gICAgICAgICAgICAgICAgR2FtZUZhY3RvcnksXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXg6IGdldFBsYXllckluZGV4KCksXG4gICAgICAgICAgICAgICAgc2VydmVyUm9vbTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGNsaWVudFJvb206IHJvb20sXG4gICAgICAgICAgICAgICAgaXNDbGllbnRQbGF5ZXI6dHJ1ZSwvL1RPRE8gZm9yIHNoYXJlZC1zY3JlZW4gLCBpcyByZWFsbHkgYSBjbGllbnRQbGF5ZXIsIGl0IG93dWxkIGJlIGJldHRlciB0byBkZWZpbmUgaWYgaXQncyBzaGFyZWQgc2NyZWVuXG4gICAgICAgICAgICAgICAgc2hhcmVkU2NyZWVuOnRydWUsLy9UT0RPIG9yIG1heWJlOiByZWFjdFRvTmV0d29ya1Nwcml0ZXNcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXI6MVxuICAgICAgICAgICAgfSldO1xuXG4gICAgICAgICAgICBzdGFydFBsYXllclJ1bm5lcihzY3JlZW5SdW5uZXJzWzBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHN0YXJ0UGxheWVyUnVubmVyKHJ1bm5lcjphbnkpe1xuICAgICAgICAgICAgcnVubmVyLnJ1bnRpbWUuc3RhcnQodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgZGlzcG9zZU9uRnJhbWU6YW55O1xuICAgICAgICAgICAgY29uc3QgdGhyb3R0bGVTZW5kUGxheWVyRnJhbWUgPSB0aHJvdHRsZSgoKSA9PiB7IC8vVE9ETyBSRVZJRVcsIGxlYWsgfCBkaXNwb3NlXG4gICAgICAgICAgICAgICAgaWYoIXJ1bm5lciB8fCBydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmRlc3Ryb3llZCl7XG4gICAgICAgICAgICAgICAgICAgIGlmKGRpc3Bvc2VPbkZyYW1lKSBkaXNwb3NlT25GcmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXllckZyYW1lRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXg6Z2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICAgICAgbjogcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5sYXN0UmVwcm9kdWNlZEZyYW1lXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIlBMQVlFUl9GUkFNRVwiLCBwbGF5ZXJGcmFtZURhdGEpO1xuICAgICAgICAgICAgfSwxMDApO1xuICAgICAgICAgICAgZGlzcG9zZU9uRnJhbWUgPSBydW5uZXIub25GcmFtZSh0aHJvdHRsZVNlbmRQbGF5ZXJGcmFtZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbG9nU3RhdGVzKCl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9jYWwgc3RhdGVcIiwgY2xvbmVEZWVwKHN0YXRlKSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwicm9vbSBzdGF0ZVwiLCByb29tLnN0YXRlLnRvSlNPTigpKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGFkZFJvb21IYW5kbGVycygpe1xuICAgICAgICBjb25zb2xlLmxvZyhcImFkZFJvb21IYW5kbGVyc1wiKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCJJTlBVVF9GUkFNRVwiLCByb29tT25JbnB1dEZyYW1lKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCJNSU5JX0dBTUVfVFJBQ0tcIiwgb25NaW5pR2FtZVRyYWNrKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCIqXCIsICguLi5hcmdzOmFueVtdKT0+e1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJhbnkgbWVzc2FnZVwiLCBhcmdzKVxuICAgICAgICB9KTtcbiAgICAgICAgcm9vbS5vbkxlYXZlKHJlY29ubmVjdCk7XG4gICAgICAgIHJvb20ub25TdGF0ZUNoYW5nZShyb29tT25TdGF0ZUNoYW5nZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0SW5wdXRMaXN0ZW5lcigpe1xuICAgICAgICBjb25zdCBwbGF5ZXJJbmRleCA9IGdldFBsYXllckluZGV4KCk7XG4gICAgICAgIGlmKHBsYXllckluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBkaXNwb3NlSW5wdXRMaXN0ZW5lciA9IG9uSW5wdXRLZXlFdmVudCgoaW5wdXRBY3Rpb25LZXk6IGFueSwgaXNQcmVzc2VkOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiaW5wdXRcIiwgaW5wdXRBY3Rpb25LZXksIGlzUHJlc3NlZClcbiAgICAgICAgICAgICAgICBpZihpbkxvY2FsU3RhZ2UoR0FNRV9TVEFHRS5TSE9XSU5HX0lOU1RSVUNUSU9OUykgJiYgIXN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSl7XG5cbiAgICAgICAgICAgICAgICAgICAgc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZW5kaW5nIElOU1RSVUNUSU9OU19SRUFEWVwiKTtcbiAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5TVFJVQ1RJT05TX1JFQURZXCIsIHtwbGF5ZXJJbmRleCwgZm9vOjF9KTtcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zUGFuZWwuc2hvd1dhaXRpbmdGb3JPdGhlclBsYXllcih7dGltZW91dDpJTlNUUlVDVElPTl9SRUFEWV9USU1FT1VUfSk7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5QTEFZSU5HX01JTklHQU1FKSl7XG4gICAgICAgICAgICAgICAgICAgIC8vZ2V0RGVidWdQYW5lbCgpLnNldFN0YXRlKGdldElucHV0U3RhdGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdhbWVJZCA9IHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tyb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGhdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcGxpdCA9IGdldEdhbWUoZ2FtZUlkKS5kZWZpbml0aW9uLnNwbGl0O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBydW5uZXIgPSBzY3JlZW5SdW5uZXJzW3NwbGl0P3BsYXllckluZGV4OjBdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnB1dEZyYW1lID0gcnVubmVyLnJ1bnRpbWUucHVzaElucHV0RXZlbnQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZTpEYXRlLm5vdygpIC0gcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5zdGFydFRpbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZU51bWJlcjpydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmxhc3RSZXByb2R1Y2VkRnJhbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dEFjdGlvbktleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJlc3NlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXllckluZGV4XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vVE9ETyBzZXQgdGltZVxuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlBVVF9GUkFNRVwiLCB7ZnJhbWU6IGlucHV0RnJhbWUsIHBsYXllckluZGV4fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBsZXQgZGlzcG9zZUlucHV0TGlzdGVuZXI6YW55O1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJoYW5kbGVMb2JieVNjcmVlblN0YXRlXCIsIHJvb20uc3RhdGUudG9KU09OKCksIGNsb25lRGVlcChzdGF0ZSkpO1xuICAgICAgICBsb2dTdGF0ZXMoKTtcbiAgICAgICAgaGFuZGxlV2FpdFRleHQoKTtcbiAgICAgICAgaGFuZGxlRGlzY29ubmVjdFRleHQoKTtcbiAgICAgICAgaGFuZGxlQ3JlYXRlQnV0dG9uVmlzaWJpbGl0eSgpO1xuICAgICAgICBoYW5kbGVKb2luQnV0dG9uVmlzaWJpbGl0eSgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZVdhaXRUZXh0KCl7XG4gICAgICAgICAgICBpZiAoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKSl7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRCYWNrZ3JvdW5kLnNob3coKTtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEVudGl0eS5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRFbnRpdHkuc2V0VGV4dChgPGNvbG9yPSR7TkFNRV9DT0xPUn0+JHtyb29tLnN0YXRlLnBsYXllcnNbMF0/LnVzZXI/LmRpc3BsYXlOYW1lfTwvY29sb3I+IGlzIHdhaXRpbmcgc29tZW9uZSB0byBqb2luIHRoZSBnYW1lLi4uYCk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuaGlkZSgpO1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0RW50aXR5LmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZURpc2Nvbm5lY3RUZXh0KCl7XG4gICAgICAgICAgICBpZighc3RhdGUuY29ubmVjdGVkKXtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5zaG93KClcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3Rpb25UZXh0LmhpZGUoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlQ3JlYXRlQnV0dG9uVmlzaWJpbGl0eSgpe1xuICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKVxuICAgICAgICAgICAgICAgICYmIHN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXR0b24uc2hvdygpO1xuICAgICAgICAgICAgICAgIGxvYmJ5U2NyZWVuLnNldEJhY2tncm91bmRTcHJpdGUoe1xuICAgICAgICAgICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTlxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoIWluUm9vbVN0YWdlKEdBTUVfU1RBR0UuSURMRSlcbiAgICAgICAgICAgICAgICB8fCAhc3RhdGUuY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5wbGF5ZXJzLnNvbWUoKHA6YW55KT0+cD8udXNlci51c2VySWQgPT09IHVzZXI/LnVzZXJJZCkpe1xuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1dHRvbi5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVKb2luQnV0dG9uVmlzaWJpbGl0eSgpe1xuICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKVxuICAgICAgICAgICAgICAgICYmIHN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBqb2luQnV0dG9uLnNob3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSX0pPSU4pXG4gICAgICAgICAgICAgICAgfHwgIXN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgICAgIHx8IHJvb20uc3RhdGUucGxheWVycy5zb21lKChwOmFueSk9PnA/LnVzZXIudXNlcklkID09PSB1c2VyPy51c2VySWQpXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIGpvaW5CdXR0b24uaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWVySW5kZXgoKSB7XG4gICAgICAgIHJldHVybiByb29tLnN0YXRlLnBsYXllcnMuZmluZEluZGV4KChwOiBhbnkpID0+IHA/LnVzZXI/LnVzZXJJZCA9PT0gdXNlcj8udXNlcklkKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBvbkV2ZW50OiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25FdmVudC5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25FdmVudC5zcGxpY2UoY2FsbGJhY2tzLm9uRXZlbnQuaW5kZXhPZihmbiksIDEpXG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0YXRlOigpPT4oey4uLnN0YXRlLCAuLi5yb29tLnN0YXRlLnRvSlNPTigpfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsaWNrSm9pbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJvbkNsaWNrIGpvaW5cIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuICAgICAgICByb29tLnNlbmQoXCJKT0lOX0dBTUVcIiwge3VzZXJ9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ2xpY2tDcmVhdGUoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25DbGljayBjcmVhdGVcIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuXG4gICAgICAgIHJvb20uc2VuZChcIkNSRUFURV9HQU1FXCIsIHt1c2VyfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWVyR2xvYmFsU2NvcmUocGxheWVySW5kZXg6bnVtYmVyKXtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzXG4gICAgICAgICAgICAucmVkdWNlKChhY2M6YW55LCBjdXJyZW50OmFueSk9PmN1cnJlbnQgPT09IHBsYXllckluZGV4ID8gKGFjYysxKTphY2MsMClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRHbG9iYWxXaW5uZXIoKXtcbiAgICAgICAgY29uc3QgcGxheWVyMUdsb2JhbFNjb3JlID0gZ2V0UGxheWVyR2xvYmFsU2NvcmUoMCk7XG4gICAgICAgIGNvbnN0IHBsYXllcjJHbG9iYWxTY29yZSA9IGdldFBsYXllckdsb2JhbFNjb3JlKDEpO1xuICAgICAgICBpZihcbiAgICAgICAgICAgICgocGxheWVyMUdsb2JhbFNjb3JlID49IDMgfHwgcGxheWVyMkdsb2JhbFNjb3JlID49IDMpICYmIHBsYXllcjFHbG9iYWxTY29yZSAhPT0gcGxheWVyMkdsb2JhbFNjb3JlKVxuICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoID09PSA1XG4gICAgICAgICl7XG4gICAgICAgICAgICByZXR1cm4gcGxheWVyMUdsb2JhbFNjb3JlPnBsYXllcjJHbG9iYWxTY29yZT8wOjFcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxufVxuIl19