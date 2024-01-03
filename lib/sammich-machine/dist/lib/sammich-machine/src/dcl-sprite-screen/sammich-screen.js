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
import { getRealm } from '~system/Runtime';
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
export async function createSammichScreen(parent, { position, rotation, scale, defaultTextureSrc = "https://sammich.pro/images/spritesheet.png", baseInstructionVideoURL = "https://sammich.pro/instruction-videos" }, _gameInstanceId) {
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
    const { realmInfo } = await getRealm({});
    console.log("realmInfo", realmInfo);
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
    const colyseusClient = new Client(~(realmInfo?.realmName || "").toLowerCase().indexOf("local") ? `ws://localhost:2567` : "wss://sammich.pro/colyseus");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtbWljaC1zY3JlZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vc2FtbWljaC1zY3JlZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNILE1BQU0sRUFRTixTQUFTLEVBQ1osTUFBTSxjQUFjLENBQUM7QUFDdEIsT0FBTyxZQUFZLENBQUM7QUFFcEIsT0FBTyxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDbkQsT0FBTyxFQUFnQixlQUFlLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RixPQUFPLEVBQUMsY0FBYyxFQUFjLE1BQU0saUJBQWlCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV0QyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUM5RCxPQUFPLEVBQ0gsa0JBQWtCLEVBQ2xCLFVBQVUsRUFDVixtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLHNCQUFzQixFQUN6QixNQUFNLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQy9ELE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDcEMsT0FBTyxFQUFDLE9BQU8sRUFBRSxtQkFBbUIsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQTtBQUN4QyxPQUFPLEVBQUMsUUFBUSxFQUFD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QkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUNJLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLElBQUksa0JBQWtCLElBQUksQ0FBQyxDQUFDLElBQUksa0JBQWtCLEtBQUssa0JBQWtCLENBQUM7ZUFDaEcsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsRUFDN0MsQ0FBQztZQUNFLE9BQU8sa0JBQWtCLEdBQUMsa0JBQWtCLENBQUEsQ0FBQyxDQUFBLENBQUMsQ0FBQSxDQUFDLENBQUEsQ0FBQyxDQUFBO1FBQ3BELENBQUM7UUFDRCxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2QsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIGVuZ2luZSxcbiAgICBFbnRpdHksXG4gICAgTWF0ZXJpYWwsXG4gICAgTWF0ZXJpYWxUcmFuc3BhcmVuY3lNb2RlLFxuICAgIFRleHRBbGlnbk1vZGUsXG4gICAgVGV4dFNoYXBlLFxuICAgIFRleHR1cmVGaWx0ZXJNb2RlLFxuICAgIFRleHR1cmVXcmFwTW9kZSxcbiAgICBUcmFuc2Zvcm1cbn0gZnJvbSBcIkBkY2wvc2RrL2Vjc1wiO1xuaW1wb3J0IFwiLi9wb2x5ZmlsbFwiO1xuXG5pbXBvcnQge0NvbG9yMywgUXVhdGVybmlvbiwgVmVjdG9yM30gZnJvbSBcIkBkY2wvc2RrL21hdGhcIjtcbmltcG9ydCB7Q2xpZW50fSBmcm9tIFwiY29seXNldXMuanNcIjtcbmltcG9ydCB7Y3JlYXRlU3ByaXRlU2NyZWVufSBmcm9tIFwiLi9zcHJpdGUtc2NyZWVuXCI7XG5pbXBvcnQge2dldElucHV0U3RhdGUsIG9uSW5wdXRLZXlFdmVudCwgc2V0dXBJbnB1dENvbnRyb2xsZXJ9IGZyb20gXCIuL2lucHV0LWNvbnRyb2xsZXJcIjtcbmltcG9ydCB7Z2V0TWluVXNlckRhdGEsIE1pblVzZXJEYXRhfSBmcm9tIFwiLi9taW4tdXNlci1kYXRhXCI7XG5pbXBvcnQge2NyZWF0ZVNjcmVlblJ1bm5lcn0gZnJvbSBcIi4vZ2FtZS1ydW5uZXJcIjtcbmltcG9ydCB7dGltZXJzfSBmcm9tIFwiQGRjbC1zZGsvdXRpbHNcIjtcbmltcG9ydCB7VHJhbnNmb3JtVHlwZVdpdGhPcHRpb25hbHN9IGZyb20gXCJAZGNsL2Vjcy9kaXN0L2NvbXBvbmVudHMvbWFudWFsL1RyYW5zZm9ybVwiO1xuaW1wb3J0IHtjcmVhdGVJbnN0cnVjdGlvblNjcmVlbn0gZnJvbSBcIi4vaW5zdHJ1Y3Rpb25zLXNjcmVlblwiO1xuaW1wb3J0IHtcbiAgICBERUZBVUxUX1NQUklURV9ERUYsXG4gICAgTkFNRV9DT0xPUixcbiAgICBTSEFSRURfU0NSRUVOX1NDQUxFLFxuICAgIFNQTElUX1NDUkVFTl9TQ0FMRSxcbiAgICBTUFJJVEVfU0hFRVRfRElNRU5TSU9OXG59IGZyb20gXCIuLi8uLi8uLi9zcHJpdGUtY29uc3RhbnRzXCI7XG5pbXBvcnQge2NyZWF0ZUdsb2JhbFNjb3JlVHJhbnNpdGlvbn0gZnJvbSBcIi4vc2NvcmUtdHJhbnNpdGlvblwiO1xuaW1wb3J0IHt0aHJvdHRsZX0gZnJvbSBcIi4vdGhyb3R0bGVcIjtcbmltcG9ydCB7Z2V0R2FtZSwgc2V0dXBHYW1lUmVwb3NpdG9yeX0gZnJvbSBcIi4uLy4uLy4uL2dhbWUtcmVwb3NpdG9yeVwiO1xuaW1wb3J0IHtnZXRSZWFsbX0gZnJvbSAnfnN5c3RlbS9SdW50aW1lJ1xuaW1wb3J0IHtkY2xTbGVlcH0gZnJvbSBcIi4vZGNsLXNsZWVwXCI7XG5pbXBvcnQge0dBTUVfU1RBR0V9IGZyb20gXCIuLi8uLi8uLi9nYW1lLXN0YWdlc1wiO1xuaW1wb3J0IHtjbG9uZURlZXB9IGZyb20gXCIuLi8uLi8uLi9saWItdXRpbFwiO1xuaW1wb3J0IHtFVkVOVH0gZnJvbSBcIi4vZXZlbnRzXCI7XG5pbXBvcnQge2dldFRleHR1cmV9IGZyb20gXCIuL3RleHR1cmUtcmVwb3NpdG9yeVwiO1xuXG5jb25zdCBJTlNUUlVDVElPTl9SRUFEWV9USU1FT1VUID0gNzAwMDtcbmNvbnN0IElOU1RSVUNUSU9OX1RPVEFMX1RJTUVPVVQgPSAzMDAwMDtcbmNvbnN0IERFRkFVTFRfU0NSRUVOX1NQUklURV9ERUZJTklUSU9OID0ge1xuICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICB4OiA1NzYsIHk6IDEyOCwgdzogMTkyLCBoOiAxMjgsXG59XG5jb25zdCBXQUlUSU5HX1RFWFRfWSA9IDEwNDtcbmNvbnN0IEZPTlRfU0laRSA9IDAuMzU7XG5jb25zdCBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgeDogMCxcbiAgICB5OiAwLFxuICAgIHc6IDE5MixcbiAgICBoOiAxMjgsXG59XG5jb25zdCBUUkFOU0lUSU9OX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICB4OjU3NixcbiAgICB5OjEyOCxcbiAgICB3OjE5MixcbiAgICBoOjEyOCxcbiAgICAuLi5TUFJJVEVfU0hFRVRfRElNRU5TSU9OXG59XG5leHBvcnQgdHlwZSBTYW1taWNoU2NyZWVuT3B0aW9ucyA9IHtcbiAgICBkZWZhdWx0VGV4dHVyZVNyYzpzdHJpbmcsXG4gICAgYmFzZUluc3RydWN0aW9uVmlkZW9VUkw6c3RyaW5nXG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2FtbWljaFNjcmVlbihwYXJlbnQ6IEVudGl0eSwge1xuICAgIHBvc2l0aW9uLFxuICAgIHJvdGF0aW9uLFxuICAgIHNjYWxlLFxuICAgIGRlZmF1bHRUZXh0dXJlU3JjID0gXCJodHRwczovL3NhbW1pY2gucHJvL2ltYWdlcy9zcHJpdGVzaGVldC5wbmdcIixcbiAgICBiYXNlSW5zdHJ1Y3Rpb25WaWRlb1VSTCA9IFwiaHR0cHM6Ly9zYW1taWNoLnByby9pbnN0cnVjdGlvbi12aWRlb3NcIlxufTogVHJhbnNmb3JtVHlwZVdpdGhPcHRpb25hbHMgJiBTYW1taWNoU2NyZWVuT3B0aW9ucywgX2dhbWVJbnN0YW5jZUlkPzpzdHJpbmcpIHtcbiAgICBjb25zdCBnYW1lSW5zdGFuY2VJZCA9IF9nYW1lSW5zdGFuY2VJZCB8fCBcImRlZmF1bHRcIjtcblxuICAgIHNldHVwSW5wdXRDb250cm9sbGVyKCk7XG4gICAgc2V0dXBHYW1lUmVwb3NpdG9yeSgpO1xuXG4gICAgY29uc29sZS5sb2coXCJTQU1NSUNIX1NDUkVFTlwiKVxuICAgIGxldCByZWNvbm5lY3Rpb25Ub2tlbjphbnk7XG4gICAgY29uc3QgY2FsbGJhY2tzOiB7IG9uRXZlbnQ6IEZ1bmN0aW9uW10gfSA9IHtcbiAgICAgICAgb25FdmVudDogW11cbiAgICB9O1xuICAgIGNvbnN0IHN0YXRlID0ge1xuICAgICAgICBjb25uZWN0ZWQ6ZmFsc2UsXG4gICAgICAgIGdhbWVTdGFnZTpHQU1FX1NUQUdFLk5PVF9DT05ORUNURUQsXG4gICAgICAgIHNlbnRJbnN0cnVjdGlvbnNSZWFkeTpmYWxzZSxcbiAgICAgICAgc2VudFJlYWR5OmZhbHNlXG4gICAgfTtcbiAgICBjb25zdCB7cmVhbG1JbmZvfSA9IGF3YWl0IGdldFJlYWxtKHt9KTtcbiAgICBjb25zb2xlLmxvZyhcInJlYWxtSW5mb1wiLHJlYWxtSW5mbyk7XG5cbiAgICBjb25zdCB1c2VyOiBNaW5Vc2VyRGF0YSA9IGF3YWl0IGdldE1pblVzZXJEYXRhKCk7XG4gICAgY29uc3QgZW50aXR5ID0gZW5naW5lLmFkZEVudGl0eSgpO1xuXG4gICAgVHJhbnNmb3JtLmNyZWF0ZShlbnRpdHksIHtcbiAgICAgICAgcGFyZW50LFxuICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgcm90YXRpb24sXG4gICAgICAgIHNjYWxlXG4gICAgfSk7XG5cbiAgICBjb25zdCBzcHJpdGVUZXh0dXJlID0gZ2V0VGV4dHVyZShkZWZhdWx0VGV4dHVyZVNyYyk7XG4gICAgY29uc3Qgc3ByaXRlTWF0ZXJpYWw6YW55ID0ge1xuICAgICAgICB0ZXh0dXJlOiBzcHJpdGVUZXh0dXJlLFxuICAgICAgICBlbWlzc2l2ZVRleHR1cmU6IHNwcml0ZVRleHR1cmUsXG4gICAgICAgIGVtaXNzaXZlSW50ZW5zaXR5OiAwLjYsXG4gICAgICAgIGVtaXNzaXZlQ29sb3I6IENvbG9yMy5jcmVhdGUoMSwgMSwgMSksXG4gICAgICAgIHNwZWN1bGFySW50ZW5zaXR5OiAwLFxuICAgICAgICByb3VnaG5lc3M6IDEsXG4gICAgICAgIGFscGhhVGVzdDogMSxcbiAgICAgICAgdHJhbnNwYXJlbmN5TW9kZTogTWF0ZXJpYWxUcmFuc3BhcmVuY3lNb2RlLk1UTV9BTFBIQV9URVNUXG4gICAgfTtcbiAgICBjb25zdCBsb2JieVNjcmVlblRyYW5zZm9ybSA9IHsvL1RPRE8gY2FuIGJlIGRpZmZlcmVudCBmb3IgZWFjaCBwbGF5ZXIgc2NyZWVuXG4gICAgICAgIHBvc2l0aW9uOiBWZWN0b3IzLmNyZWF0ZSgwLCAwLCAwKSxcbiAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICB9O1xuXG4gICAgY29uc3QgbG9iYnlTY3JlZW4gPSBjcmVhdGVTcHJpdGVTY3JlZW4oe1xuICAgICAgICB0cmFuc2Zvcm06IGxvYmJ5U2NyZWVuVHJhbnNmb3JtLFxuICAgICAgICBzcHJpdGVNYXRlcmlhbCxcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjogQ09WRVJfU1BSSVRFX0RFRklOSVRJT05cbiAgICB9KTtcbiAgICBjb25zdCB3YWl0aW5nVGV4dEVudGl0eSA9IGxvYmJ5U2NyZWVuLmFkZFRleHQoe1xuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbMTkyLzIsIFdBSVRJTkdfVEVYVF9ZICsgNF0sXG4gICAgICAgIHRleHRBbGlnbjpUZXh0QWxpZ25Nb2RlLlRBTV9UT1BfQ0VOVEVSLFxuICAgICAgICB0ZXh0OmAgICAgPGNvbG9yPSR7TkFNRV9DT0xPUn0+R2VzdDwvY29sb3I+IGlzIHdhaXRpbmcgc29tYCxcbiAgICAgICAgdGV4dENvbG9yOlsxLDEsMSwxXSxcbiAgICAgICAgZm9udFNpemU6Rk9OVF9TSVpFLFxuICAgICAgICBsYXllcjoyXG4gICAgfSk7XG4gICAgY29uc3Qgd2FpdGluZ1RleHRCYWNrZ3JvdW5kID0gbG9iYnlTY3JlZW4uYWRkU3ByaXRlKHtcbiAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDogMzg0LCB5OiAyMTgsIHc6IDE5MiwgaDogMjUsXG4gICAgICAgICAgICBtZXRhZGF0YToge25hbWU6IFwidGV4dC1iYWNrZ3JvdW5kXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFswLCBXQUlUSU5HX1RFWFRfWV0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBrbGFzczpcIlRleHRCYWNrZ3JvdW5kXCJcbiAgICB9KVxuICAgIHdhaXRpbmdUZXh0RW50aXR5LmhpZGUoKTtcbiAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuaGlkZSgpO1xuXG4gICAgY29uc3QgZGlzY29ubmVjdGlvblRleHQgPSBsb2JieVNjcmVlbi5hZGRUZXh0KHt0ZXh0OlwiRElTQ09OTkVDVEVEXCIsIHRleHRDb2xvcjpbMSwwLDAsMV0sIHBpeGVsUG9zaXRpb246WzE5Mi8yLDRdLCBsYXllcjoxMCwgdGV4dEFsaWduOlRleHRBbGlnbk1vZGUuVEFNX1RPUF9DRU5URVIsIGZvbnRTaXplOjF9KTtcbiAgICBjb25zdCBzY29yZVRyYW5zaXRpb24gPSBjcmVhdGVHbG9iYWxTY29yZVRyYW5zaXRpb24obG9iYnlTY3JlZW4pO1xuICAgIGNvbnN0IGNvbHlzZXVzQ2xpZW50OiBDbGllbnQgPSBuZXcgQ2xpZW50KH4ocmVhbG1JbmZvPy5yZWFsbU5hbWV8fFwiXCIpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihcImxvY2FsXCIpP2B3czovL2xvY2FsaG9zdDoyNTY3YDpcIndzczovL3NhbW1pY2gucHJvL2NvbHlzZXVzXCIpO1xuXG4gICAgY29uc3QgY29ubmVjdFJvb20gPSBhc3luYyAoKT0+e1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbm5lY3RSb29tXCIpO1xuICAgICAgICBsZXQgX3Jvb207XG4gICAgICAgIHdoaWxlKCFzdGF0ZS5jb25uZWN0ZWQpe1xuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIF9yb29tID0gYXdhaXQgY29seXNldXNDbGllbnQuam9pbihgR2FtZVJvb21gLCB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXIsXG4gICAgICAgICAgICAgICAgICAgIGdhbWVJbnN0YW5jZUlkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJDT05ORUNURURcIiwgX3Jvb20/LnJvb21JZCk7XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1jYXRjaChlcnJvcjphbnkpe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3IgY29ubmVjdGluZ1wiLCBlcnJvcj8ubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMzAwMCk7XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yb29tO1xuICAgIH07XG4gICAgY29uc3Qgb25NaW5pR2FtZVRyYWNrID0gYXN5bmMgKG1pbmlHYW1lVHJhY2s6YW55KSA9PiB7XG4gICAgICAgIC8vVE9ETyBzaG93IGluc3RydWN0aW9ucyBvZiB0aGUgZ2FtZSAwXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTUlOSV9HQU1FX1RSQUNLXCIsIG1pbmlHYW1lVHJhY2spO1xuICAgIH07XG4gICAgY29uc3Qgcm9vbU9uSW5wdXRGcmFtZSA9ICh7cGxheWVySW5kZXgsIGZyYW1lfTphbnkpPT57XG4gICAgICAgIC8vVE9ETyByZXZpZXcgaWYgYmVzdCBhcHByb2FjaCwgZm9yIG5vdyB0byByZXByZXNlbnQgb3RoZXIgcGxheWVyIFN0YXRlXG4gICAgICAgIGlmKHBsYXllckluZGV4ICE9PSBnZXRQbGF5ZXJJbmRleCgpKXtcbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMuZm9yRWFjaChydW5uZXIgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0RGF0YSA9IGZyYW1lLmV2ZW50c1tmcmFtZS5ldmVudHMubGVuZ3RoLTFdLmRhdGFcbiAgICAgICAgICAgICAgICBydW5uZXIucnVudGltZS5wdXNoSW5wdXRFdmVudCh7XG4gICAgICAgICAgICAgICAgICAgIC4uLmlucHV0RGF0YSxcbiAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXhcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgcmVjb25uZWN0ID0gYXN5bmMgKGNvZGU6bnVtYmVyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibGVhdmUgY29kZVwiLCBjb2RlKTtcbiAgICAgICAgZGlzY29ubmVjdGlvblRleHQuc2hvdygpO1xuICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgbGV0ICAgIGVycm9yNDIxMiA9IGZhbHNlO1xuICAgICAgICB3aGlsZSghc3RhdGUuY29ubmVjdGVkKXtcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlY29ubmVjdGluZy4uLlwiKVxuICAgICAgICAgICAgICAgIHJvb20gPSBlcnJvcjQyMTI/YXdhaXQgY29ubmVjdFJvb20oKTogYXdhaXQgY29seXNldXNDbGllbnQucmVjb25uZWN0KHJlY29ubmVjdGlvblRva2VuKTtcbiAgICAgICAgICAgICAgICBlcnJvcjQyMTIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvbm5lY3Rpb24gRE9ORSFcIiwgcm9vbSwgcm9vbT8ucmVjb25uZWN0aW9uVG9rZW4pO1xuXG4gICAgICAgICAgICAgICAgcmVjb25uZWN0aW9uVG9rZW4gPSByb29tLnJlY29ubmVjdGlvblRva2VuO1xuICAgICAgICAgICAgICAgIHN0YXRlLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZGlzY29ubmVjdGlvblRleHQuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGFkZFJvb21IYW5kbGVycygpO1xuICAgICAgICAgICAgICAgIGhhbmRsZUxvYmJ5U2NyZWVuU3RhdGUoKTtcbiAgICAgICAgICAgIH1jYXRjaChlcnJvcjphbnkpe1xuXG4gICAgICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMzAwMCk7XG4gICAgICAgICAgICAgICAgaWYoZXJyb3I/LmNvZGUgPT09IDQyMTIpe1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjQyMTIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yIHJlY29ubmVjdGluZ1wiLCBlcnJvcilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgaW5Mb2NhbFN0YWdlID0gKHN0YWdlOkdBTUVfU1RBR0UpID0+IHN0YXRlLmdhbWVTdGFnZSA9PT0gc3RhZ2U7XG4gICAgY29uc3QgaW5Sb29tU3RhZ2UgPSAoc3RhZ2U6R0FNRV9TVEFHRSkgPT4gcm9vbS5zdGF0ZS5nYW1lU3RhZ2UgPT09IHN0YWdlO1xuICAgIGNvbnN0IGRpZmZTdGFnZSA9IChzdGFnZTpHQU1FX1NUQUdFKT0+IGluTG9jYWxTdGFnZShzdGFnZSkgIT09IGluUm9vbVN0YWdlKHN0YWdlKTtcbiAgICBjb25zdCByb29tT25TdGF0ZUNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyb29tT25TdGF0ZUNoYW5nZS5cIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuXG4gICAgICAgIGhhbmRsZVBsYXllcnNTZW5kaW5nUmVhZHkoKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuSURMRSwgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSk7XG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfSU5TVFJVQ1RJT05TLCBzaG93SW5zdHJ1Y3Rpb25zLCBoaWRlSW5zdHJ1Y3Rpb25zKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuUExBWUlOR19NSU5JR0FNRSwgc3RhcnRNaW5pR2FtZSk7XG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlRJRV9CUkVBS0VSLCBzaG93VGllQnJlYWtlcik7XG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfU0NPUkVfVFJBTlNJVElPTiwgaGFuZGxlU2NvcmVUcmFuc2l0aW9uKVxuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5TSE9XSU5HX0VORCwgaGFuZGxlRW5kVHJhY2spO1xuICAgICAgICBpZihyb29tLnN0YXRlLnBsYXllcnMuZmlsdGVyKChwOmFueSk9PnAuaW5zdHJ1Y3Rpb25zUmVhZHkpLmxlbmd0aCA9PT0gMSl7XG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbC5zZXRUaW1lb3V0KElOU1RSVUNUSU9OX1JFQURZX1RJTUVPVVQpO1xuICAgICAgICAgICAgaWYoZ2V0UGxheWVySW5kZXgoKSA+PSAwICYmICFyb29tLnN0YXRlLnBsYXllcnNbZ2V0UGxheWVySW5kZXgoKV0uaW5zdHJ1Y3Rpb25zUmVhZHkpe1xuICAgICAgICAgICAgICAgIHRpbWVycy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYoIXN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5TVFJVQ1RJT05TX1JFQURZXCIsIHsgcGxheWVySW5kZXg6IGdldFBsYXllckluZGV4KCksIGZvbzogMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIElOU1RSVUNUSU9OX1JFQURZX1RJTUVPVVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGUuZ2FtZVN0YWdlID0gcm9vbS5zdGF0ZS5nYW1lU3RhZ2U7XG4gICAgICAgIGhhbmRsZUxvYmJ5U2NyZWVuU3RhdGUoKTtcblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVFbmRUcmFjaygpe1xuICAgICAgICAgICAgY29uc3QgdHJhY2tXaW5uZXJJbmRleCA9IGdldEdsb2JhbFdpbm5lcigpO1xuICAgICAgICAgICAgc2NvcmVUcmFuc2l0aW9uLnNob3dGaW5hbFNwcml0ZSh0cmFja1dpbm5lckluZGV4KTtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vbkV2ZW50LmZvckVhY2goZT0+ZSh7XG4gICAgICAgICAgICAgICAgdHlwZTpFVkVOVC5FTkRfVFJBQ0ssXG4gICAgICAgICAgICAgICAgZGF0YTp7XG4gICAgICAgICAgICAgICAgICAgIHRyYWNrV2lubmVySW5kZXhcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJlc2V0VHJhY2tTdGF0ZSgpO1xuICAgICAgICAgICAgZGlzcG9zZUlucHV0TGlzdGVuZXIgJiYgZGlzcG9zZUlucHV0TGlzdGVuZXIoKTtcblxuXG4gICAgICAgICAgICBmdW5jdGlvbiByZXNldFRyYWNrU3RhdGUoKXtcbiAgICAgICAgICAgICAgICBzY29yZVRyYW5zaXRpb24ucmVzZXQoKTtcbiAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKHN0YXRlLCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbnRSZWFkeTpmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgc2VudEluc3RydWN0aW9uc1JlYWR5OmZhbHNlXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlUGxheWVyc1NlbmRpbmdSZWFkeSgpe1xuICAgICAgICAgICAgY29uc3QgcGxheWVySW5kZXggPSBnZXRQbGF5ZXJJbmRleCgpO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4ID49IDBcbiAgICAgICAgICAgICAgICAmJiAhc3RhdGUuc2VudFJlYWR5XG4gICAgICAgICAgICAgICAgJiYgcm9vbS5zdGF0ZS5wbGF5ZXJzLmxlbmd0aCA9PT0gMlxuICAgICAgICAgICAgICAgICYmIGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuV0FJVElOR19QTEFZRVJTX1JFQURZKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUuc2VudFJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlNFTkQgUkVBRFlcIilcbiAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJSRUFEWVwiLCB7cGxheWVySW5kZXh9KTtcbiAgICAgICAgICAgICAgICBzZXRJbnB1dExpc3RlbmVyKCk7XG4gICAgICAgICAgICB9ZWxzZSBpZighaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUlNfUkVBRFkpICYmIHN0YXRlLnNlbnRSZWFkeSl7XG4gICAgICAgICAgICAgICAgc3RhdGUuc2VudFJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBoYW5kbGVTdGFnZUNoYW5nZShnYW1lU3RhZ2U6R0FNRV9TVEFHRSwgZm46RnVuY3Rpb24sIGVsc2VGbj86RnVuY3Rpb24pe1xuICAgICAgICAgICAgaWYoZGlmZlN0YWdlKGdhbWVTdGFnZSkpe1xuICAgICAgICAgICAgICAgIGlmKGluUm9vbVN0YWdlKGdhbWVTdGFnZSkpe1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGVsc2VGbikge1xuICAgICAgICAgICAgICAgICAgICBlbHNlRm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzaG93VGllQnJlYWtlcigpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJzaG93VGllQnJlYWtlclwiLCByb29tLnN0YXRlLnRpZUJyZWFrZXJXaW5uZXIpXG4gICAgICAgICAgICBpZihnZXRQbGF5ZXJJbmRleCgpICE9PSAwKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5SdW5uZXJzWzBdLnJ1bnRpbWUucmVwcm9kdWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzY3JlZW5SdW5uZXJzWzBdLnJ1bnRpbWUudGllQnJlYWtlcih7XG4gICAgICAgICAgICAgICAgd2lubmVySW5kZXg6cm9vbS5zdGF0ZS50aWVCcmVha2VyV2lubmVyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dJbnN0cnVjdGlvbnMoKXtcbiAgICAgICAgICAgIGNvbnN0IG5leHRNaW5pR2FtZUluZGV4ID0gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoO1xuICAgICAgICAgICAgY29uc3QgbmV4dEdhbWVJZCA9IHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tuZXh0TWluaUdhbWVJbmRleF07XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNob3dJbnN0cnVjdGlvbnNcIiwgbmV4dE1pbmlHYW1lSW5kZXgsIG5leHRHYW1lSWQsIGdldEdhbWUobmV4dEdhbWVJZCkuZGVmaW5pdGlvbi5hbGlhcylcbiAgICAgICAgICAgIGxvYmJ5U2NyZWVuLnNob3coKTtcblxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zUGFuZWwgPSBjcmVhdGVJbnN0cnVjdGlvblNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbG9iYnlTY3JlZW4uZ2V0RW50aXR5KCksXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBWZWN0b3IzLmNyZWF0ZSgwLCAwLCAtMC4wNSksXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiBWZWN0b3IzLk9uZSgpLFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogUXVhdGVybmlvbi5aZXJvKClcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdhbWVBbGlhczogZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmFsaWFzLFxuICAgICAgICAgICAgICAgIGdhbWVJbnN0cnVjdGlvbnM6IGdldEdhbWUobmV4dEdhbWVJZCkuZGVmaW5pdGlvbi5pbnN0cnVjdGlvbnMsXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXg6Z2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICBiYXNlSW5zdHJ1Y3Rpb25WaWRlb1VSTFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbC5zZXRUaW1lb3V0KElOU1RSVUNUSU9OX1RPVEFMX1RJTUVPVVQpO1xuICAgICAgICAgICAgdGltZXJzLnNldFRpbWVvdXQoKCk9PntcbiAgICAgICAgICAgICAgICBpZighc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5KXtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5TVFJVQ1RJT05TX1JFQURZXCIsIHsgcGxheWVySW5kZXg6IGdldFBsYXllckluZGV4KCksIGZvbzogMiB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCAzMDAwMCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoaWRlSW5zdHJ1Y3Rpb25zKCl7XG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbD8uZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxldCByb29tOiBhbnkgPSBhd2FpdCBjb25uZWN0Um9vbSgpO1xuXG4gICAgYWRkUm9vbUhhbmRsZXJzKCk7XG5cbiAgICBkaXNjb25uZWN0aW9uVGV4dC5oaWRlKCk7XG4gICAgcmVjb25uZWN0aW9uVG9rZW4gPSByb29tLnJlY29ubmVjdGlvblRva2VuO1xuY29uc29sZS5sb2coXCJyZWNvbm5lY3Rpb25Ub2tlblwiLHJlY29ubmVjdGlvblRva2VuKTtcbiAgICBjb25zdCBjcmVhdGVCdXR0b24gPSBsb2JieVNjcmVlbi5hZGRTcHJpdGUoe1xuICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiB7XG4gICAgICAgICAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgICAgICAgICB4OiAwLCB5OiAzODcsIHc6IDQ3LCBoOiAyNSxcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7bmFtZTogXCJjcmVhdGVCdXR0b25cIn1cbiAgICAgICAgfSxcbiAgICAgICAgcGl4ZWxQb3NpdGlvbjogWy00NywgODBdLFxuICAgICAgICBsYXllcjogMSxcbiAgICAgICAgb25DbGljazogb25DbGlja0NyZWF0ZSxcbiAgICAgICAgaG92ZXJUZXh0OiBcIlN0YXJ0IG5ldyBnYW1lXCIsXG4gICAgICAgIGtsYXNzOlwiQ3JlYXRlQnV0dG9uXCJcbiAgICB9KTtcblxuICAgIGNvbnN0IGpvaW5CdXR0b24gPSBsb2JieVNjcmVlbi5hZGRTcHJpdGUoe1xuICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiB7XG4gICAgICAgICAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgICAgICAgICB4OiA0OSwgeTogMzg3LCB3OiA0NywgaDogMjUsXG4gICAgICAgICAgICBtZXRhZGF0YToge25hbWU6IFwiam9pbkJ1dHRvblwifVxuICAgICAgICB9LFxuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbMTkyICwgODBdLFxuICAgICAgICBsYXllcjogMSxcbiAgICAgICAgb25DbGljazogb25DbGlja0pvaW4sXG4gICAgICAgIGhvdmVyVGV4dDogXCJKb2luIGdhbWVcIixcbiAgICAgICAga2xhc3M6XCJKb2luQnV0dG9uXCJcbiAgICB9KTtcblxuICAgIGpvaW5CdXR0b24uaGlkZSgpO1xuICAgIGNyZWF0ZUJ1dHRvbi5oaWRlKCk7XG5cbiAgICBsZXQgcGxheWVyU2NyZWVuczphbnlbXSA9IFtdLCBzY3JlZW5SdW5uZXJzOmFueVtdID0gW107XG4gICAgbGV0IGluc3RydWN0aW9uc1BhbmVsOmFueTtcblxuICAgIGNvbnN0IGhhbmRsZVNjb3JlVHJhbnNpdGlvbiA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJoYW5kbGVTY29yZVRyYW5zaXRpb25cIik7XG4gICAgICAgIGNvbnN0IHdpbm5lckluZGV4ID0gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHNbcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoLTFdO1xuICAgICAgICBjb25zdCBmaW5hbGl6ZSA9IGdldEdsb2JhbFdpbm5lcigpICE9PSAtMTtcbiAgICAgICAgY29uc3QgbWluaUdhbWVSZXN1bHRzID0gcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHM7XG4gICAgICAgIC8vVE9ETyBlc3RvIGRlc3B1ZXMgZGUgVElFX0JSRUFLRVJcbiAgICAgICAgcGxheWVyU2NyZWVucy5mb3JFYWNoKChzOmFueSk9PnMuZGVzdHJveSgpKTtcbiAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHNyPT5zci5ydW50aW1lLnN0b3AoKSk7XG4gICAgICAgIHNjcmVlblJ1bm5lcnMuZm9yRWFjaChzcj0+c3IucnVudGltZS5kZXN0cm95KCkpO1xuICAgICAgICBwbGF5ZXJTY3JlZW5zID0gW107XG4gICAgICAgIHNjcmVlblJ1bm5lcnMgPSBbXTtcblxuICAgICAgICBsb2JieVNjcmVlbi5zaG93KCk7XG4gICAgICAgIGxvYmJ5U2NyZWVuLnNldEJhY2tncm91bmRTcHJpdGUoe1xuICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjpUUkFOU0lUSU9OX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTlxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgcHJldmlvdXNTY29yZXMgPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5yZWR1Y2UoKGFjYzpudW1iZXJbXSwgd2lubmVySW5kZXg6bnVtYmVyKT0+e1xuICAgICAgICAgICAgYWNjW3dpbm5lckluZGV4XSsrO1xuICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgfSxbMCwwXSk7XG4gICAgICAgIHByZXZpb3VzU2NvcmVzW3dpbm5lckluZGV4XSAtPSAxO1xuICAgICAgICBjb25zdCBpc0ZpbmFsID0gISFmaW5hbGl6ZTtcbiAgICAgICAgY29uc3QgdHJhY2tXaW5uZXJJbmRleCA9IGdldFRyYWNrV2lubmVyRnJvbU1pbmlHYW1lUmVzdWx0cyhtaW5pR2FtZVJlc3VsdHMpO1xuICAgICAgICBjb25zb2xlLmxvZyhcInRyYWNrV2lubmVySW5kZXhcIix0cmFja1dpbm5lckluZGV4KVxuXG5cbiAgICAgICAgYXdhaXQgc2NvcmVUcmFuc2l0aW9uLnNob3dUcmFuc2l0aW9uKHtcbiAgICAgICAgICAgIHdpbm5lckluZGV4LFxuICAgICAgICAgICAgcHJldmlvdXNTY29yZXMsXG4gICAgICAgICAgICBpc0ZpbmFsLFxuICAgICAgICAgICAgZGlzcGxheU5hbWUxOnJvb20uc3RhdGUucGxheWVyc1swXS5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lMjpyb29tLnN0YXRlLnBsYXllcnNbMV0uZGlzcGxheU5hbWUsXG4gICAgICAgICAgICB0cmFja1dpbm5lckluZGV4XG4gICAgICAgIH0pO1xuICAgICAgICBzY29yZVRyYW5zaXRpb24uaGlkZSgpO1xuICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSBmYWxzZTtcblxuICAgICAgICBmdW5jdGlvbiBnZXRUcmFja1dpbm5lckZyb21NaW5pR2FtZVJlc3VsdHMobWluaUdhbWVSZXN1bHRzOm51bWJlcltdKXtcbiAgICAgICAgICAgIGxldCBzY29yZXM6bnVtYmVyW10gPSBbMCwwXTtcbiAgICAgICAgICAgIG1pbmlHYW1lUmVzdWx0cy5mb3JFYWNoKHdpbm5lckluZGV4ID0+IHtcbiAgICAgICAgICAgICAgICBzY29yZXNbd2lubmVySW5kZXhdKytcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJzY29yZXNcIiwgc2NvcmVzKTtcbiAgICAgICAgICAgIGlmKHNjb3Jlc1swXSA+IHNjb3Jlc1sxXSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBnZXRQbGF5aW5nTWluaUdhbWVJZCgpe1xuICAgICAgICBsZXQgaW5kZXg7XG4gICAgICAgIGlmKGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuSURMRSkpIHJldHVybjtcbiAgICAgICAgaW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGg7XG4gICAgICAgIHJldHVybiByb29tLnN0YXRlLm1pbmlHYW1lVHJhY2tbaW5kZXhdO1xuICAgIH1cbiAgICBjb25zdCBzdGFydE1pbmlHYW1lID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBsb2JieVNjcmVlbi5oaWRlKCk7XG4gICAgICAgIGNvbnN0IG1pbmlHYW1lSWQgPSBnZXRQbGF5aW5nTWluaUdhbWVJZCgpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNUQVJUX0dBTUVcIiwgbWluaUdhbWVJZCk7XG4gICAgICAgIGNvbnN0IEdhbWVGYWN0b3J5ID0gZ2V0R2FtZShtaW5pR2FtZUlkKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJHYW1lRmFjdG9yeS5kZWZpbml0aW9uXCIsR2FtZUZhY3RvcnkuZGVmaW5pdGlvbik7XG4gICAgICAgIGlmKEdhbWVGYWN0b3J5LmRlZmluaXRpb24uc3BsaXQpe1xuICAgICAgICAgICAgcGxheWVyU2NyZWVucyA9IG5ldyBBcnJheSgyKS5maWxsKG51bGwpLm1hcCgoXywgcGxheWVySW5kZXgpPT5jcmVhdGVTcHJpdGVTY3JlZW4oe1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybToge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjpWZWN0b3IzLmNyZWF0ZShwbGF5ZXJJbmRleD8wLjI1Oi0wLjI1LCAwLCAwKSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IFNQTElUX1NDUkVFTl9TQ0FMRSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNwcml0ZU1hdGVyaWFsLFxuICAgICAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uREVGQVVMVF9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT04sXG4gICAgICAgICAgICAgICAgICAgIHc6IDE5MiAvIDIsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICBzY3JlZW5SdW5uZXJzID0gcGxheWVyU2NyZWVucy5tYXAoKHNjcmVlbiwgcGxheWVySW5kZXgpID0+IGNyZWF0ZVNjcmVlblJ1bm5lcih7XG4gICAgICAgICAgICAgICAgc2NyZWVuLCAvL1RPRE8gUkVWSUVXOyB3ZSByZWFsbHkgc2hvdWxkIHVzZSBhbm90aGVyIHNjcmVlbiwgYW5kIGRlY291cGxlIHRoZSBsb2JieSBzY3JlZW4gZnJvbSB0aGUgZ2FtZVxuICAgICAgICAgICAgICAgIHRpbWVycyxcbiAgICAgICAgICAgICAgICBHYW1lRmFjdG9yeSxcbiAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleCxcbiAgICAgICAgICAgICAgICBzZXJ2ZXJSb29tOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgY2xpZW50Um9vbTogcm9vbSxcbiAgICAgICAgICAgICAgICBpc0NsaWVudFBsYXllcjogcGxheWVySW5kZXggPT09IGdldFBsYXllckluZGV4KCksXG4gICAgICAgICAgICAgICAgdmVsb2NpdHlNdWx0aXBsaWVyOjFcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMuZm9yRWFjaCgocnVubmVyLCBwbGF5ZXJJbmRleCk9PntcbiAgICAgICAgICAgICAgICBpZihwbGF5ZXJJbmRleCA9PT0gZ2V0UGxheWVySW5kZXgoKSl7XG4gICAgICAgICAgICAgICAgICAgIC8vcnVubmVyLnJ1bnRpbWUuYXR0YWNoRGVidWdQYW5lbChnZXREZWJ1Z1BhbmVsKCkpO1xuICAgICAgICAgICAgICAgICAgICBzdGFydFBsYXllclJ1bm5lcihydW5uZXIpO1xuICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICBydW5uZXIucnVudGltZS5zdGFydChmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfWVsc2V7Ly9zaGFyZWQgc2NyZWVuXG4gICAgICAgICAgICBjb25zdCBzY3JlZW4gPSBjcmVhdGVTcHJpdGVTY3JlZW4oe1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybToge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjpWZWN0b3IzLlplcm8oKSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IFNIQVJFRF9TQ1JFRU5fU0NBTEUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogZW50aXR5XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzcHJpdGVNYXRlcmlhbCxcbiAgICAgICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLkRFRkFVTFRfU0NSRUVOX1NQUklURV9ERUZJTklUSU9OXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwbGF5ZXJTY3JlZW5zID0gW3NjcmVlbl07XG5cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMgPSBbY3JlYXRlU2NyZWVuUnVubmVyKHtcbiAgICAgICAgICAgICAgICBzY3JlZW4sIC8vVE9ETyBSRVZJRVc7IHdlIHJlYWxseSBzaG91bGQgdXNlIGFub3RoZXIgc2NyZWVuLCBhbmQgZGVjb3VwbGUgdGhlIGxvYmJ5IHNjcmVlbiBmcm9tIHRoZSBnYW1lXG4gICAgICAgICAgICAgICAgdGltZXJzLFxuICAgICAgICAgICAgICAgIEdhbWVGYWN0b3J5LFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4OiBnZXRQbGF5ZXJJbmRleCgpLFxuICAgICAgICAgICAgICAgIHNlcnZlclJvb206IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBjbGllbnRSb29tOiByb29tLFxuICAgICAgICAgICAgICAgIGlzQ2xpZW50UGxheWVyOnRydWUsLy9UT0RPIGZvciBzaGFyZWQtc2NyZWVuICwgaXMgcmVhbGx5IGEgY2xpZW50UGxheWVyLCBpdCBvd3VsZCBiZSBiZXR0ZXIgdG8gZGVmaW5lIGlmIGl0J3Mgc2hhcmVkIHNjcmVlblxuICAgICAgICAgICAgICAgIHNoYXJlZFNjcmVlbjp0cnVlLC8vVE9ETyBvciBtYXliZTogcmVhY3RUb05ldHdvcmtTcHJpdGVzXG4gICAgICAgICAgICAgICAgdmVsb2NpdHlNdWx0aXBsaWVyOjFcbiAgICAgICAgICAgIH0pXTtcblxuICAgICAgICAgICAgc3RhcnRQbGF5ZXJSdW5uZXIoc2NyZWVuUnVubmVyc1swXSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzdGFydFBsYXllclJ1bm5lcihydW5uZXI6YW55KXtcbiAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnN0YXJ0KHRydWUpO1xuICAgICAgICAgICAgbGV0IGRpc3Bvc2VPbkZyYW1lOmFueTtcbiAgICAgICAgICAgIGNvbnN0IHRocm90dGxlU2VuZFBsYXllckZyYW1lID0gdGhyb3R0bGUoKCkgPT4geyAvL1RPRE8gUkVWSUVXLCBsZWFrIHwgZGlzcG9zZVxuICAgICAgICAgICAgICAgIGlmKCFydW5uZXIgfHwgcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5kZXN0cm95ZWQpe1xuICAgICAgICAgICAgICAgICAgICBpZihkaXNwb3NlT25GcmFtZSkgZGlzcG9zZU9uRnJhbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwbGF5ZXJGcmFtZURhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIHBsYXllckluZGV4OmdldFBsYXllckluZGV4KCksXG4gICAgICAgICAgICAgICAgICAgIG46IHJ1bm5lci5ydW50aW1lLmdldFN0YXRlKCkubGFzdFJlcHJvZHVjZWRGcmFtZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJQTEFZRVJfRlJBTUVcIiwgcGxheWVyRnJhbWVEYXRhKTtcbiAgICAgICAgICAgIH0sMTAwKTtcbiAgICAgICAgICAgIGRpc3Bvc2VPbkZyYW1lID0gcnVubmVyLm9uRnJhbWUodGhyb3R0bGVTZW5kUGxheWVyRnJhbWUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGxvZ1N0YXRlcygpe1xuICAgICAgICBjb25zb2xlLmxvZyhcImxvY2FsIHN0YXRlXCIsIGNsb25lRGVlcChzdGF0ZSkpO1xuICAgICAgICBjb25zb2xlLmxvZyhcInJvb20gc3RhdGVcIiwgcm9vbS5zdGF0ZS50b0pTT04oKSk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBhZGRSb29tSGFuZGxlcnMoKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJhZGRSb29tSGFuZGxlcnNcIik7XG4gICAgICAgIHJvb20ub25NZXNzYWdlKFwiSU5QVVRfRlJBTUVcIiwgcm9vbU9uSW5wdXRGcmFtZSk7XG4gICAgICAgIHJvb20ub25NZXNzYWdlKFwiTUlOSV9HQU1FX1RSQUNLXCIsIG9uTWluaUdhbWVUcmFjayk7XG4gICAgICAgIHJvb20ub25NZXNzYWdlKFwiKlwiLCAoLi4uYXJnczphbnlbXSk9PntcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYW55IG1lc3NhZ2VcIiwgYXJncylcbiAgICAgICAgfSk7XG4gICAgICAgIHJvb20ub25MZWF2ZShyZWNvbm5lY3QpO1xuICAgICAgICByb29tLm9uU3RhdGVDaGFuZ2Uocm9vbU9uU3RhdGVDaGFuZ2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldElucHV0TGlzdGVuZXIoKXtcbiAgICAgICAgY29uc3QgcGxheWVySW5kZXggPSBnZXRQbGF5ZXJJbmRleCgpO1xuICAgICAgICBpZihwbGF5ZXJJbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgZGlzcG9zZUlucHV0TGlzdGVuZXIgPSBvbklucHV0S2V5RXZlbnQoKGlucHV0QWN0aW9uS2V5OiBhbnksIGlzUHJlc3NlZDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImlucHV0XCIsIGlucHV0QWN0aW9uS2V5LCBpc1ByZXNzZWQpXG4gICAgICAgICAgICAgICAgaWYoaW5Mb2NhbFN0YWdlKEdBTUVfU1RBR0UuU0hPV0lOR19JTlNUUlVDVElPTlMpICYmICFzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkpe1xuXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2VuZGluZyBJTlNUUlVDVElPTlNfUkVBRFlcIik7XG4gICAgICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIklOU1RSVUNUSU9OU19SRUFEWVwiLCB7cGxheWVySW5kZXgsIGZvbzoxfSk7XG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNob3dXYWl0aW5nRm9yT3RoZXJQbGF5ZXIoe3RpbWVvdXQ6SU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVH0pO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuUExBWUlOR19NSU5JR0FNRSkpe1xuICAgICAgICAgICAgICAgICAgICAvL2dldERlYnVnUGFuZWwoKS5zZXRTdGF0ZShnZXRJbnB1dFN0YXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBnYW1lSWQgPSByb29tLnN0YXRlLm1pbmlHYW1lVHJhY2tbcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3BsaXQgPSBnZXRHYW1lKGdhbWVJZCkuZGVmaW5pdGlvbi5zcGxpdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnVubmVyID0gc2NyZWVuUnVubmVyc1tzcGxpdD9wbGF5ZXJJbmRleDowXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5wdXRGcmFtZSA9IHJ1bm5lci5ydW50aW1lLnB1c2hJbnB1dEV2ZW50KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWU6RGF0ZS5ub3coKSAtIHJ1bm5lci5ydW50aW1lLmdldFN0YXRlKCkuc3RhcnRUaW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVOdW1iZXI6cnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5sYXN0UmVwcm9kdWNlZEZyYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRBY3Rpb25LZXksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1ByZXNzZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleFxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAvL1RPRE8gc2V0IHRpbWVcbiAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5QVVRfRlJBTUVcIiwge2ZyYW1lOiBpbnB1dEZyYW1lLCBwbGF5ZXJJbmRleH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgbGV0IGRpc3Bvc2VJbnB1dExpc3RlbmVyOmFueTtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZUxvYmJ5U2NyZWVuU3RhdGUoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZVwiLCByb29tLnN0YXRlLnRvSlNPTigpLCBjbG9uZURlZXAoc3RhdGUpKTtcbiAgICAgICAgbG9nU3RhdGVzKCk7XG4gICAgICAgIGhhbmRsZVdhaXRUZXh0KCk7XG4gICAgICAgIGhhbmRsZURpc2Nvbm5lY3RUZXh0KCk7XG4gICAgICAgIGhhbmRsZUNyZWF0ZUJ1dHRvblZpc2liaWxpdHkoKTtcbiAgICAgICAgaGFuZGxlSm9pbkJ1dHRvblZpc2liaWxpdHkoKTtcblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVXYWl0VGV4dCgpe1xuICAgICAgICAgICAgaWYgKGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuV0FJVElOR19QTEFZRVJfSk9JTikpe1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0QmFja2dyb3VuZC5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRFbnRpdHkuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0RW50aXR5LnNldFRleHQoYDxjb2xvcj0ke05BTUVfQ09MT1J9PiR7cm9vbS5zdGF0ZS5wbGF5ZXJzWzBdPy51c2VyPy5kaXNwbGF5TmFtZX08L2NvbG9yPiBpcyB3YWl0aW5nIHNvbWVvbmUgdG8gam9pbiB0aGUgZ2FtZS4uLmApO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRCYWNrZ3JvdW5kLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEVudGl0eS5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVEaXNjb25uZWN0VGV4dCgpe1xuICAgICAgICAgICAgaWYoIXN0YXRlLmNvbm5lY3RlZCl7XG4gICAgICAgICAgICAgICAgZGlzY29ubmVjdGlvblRleHQuc2hvdygpXG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5oaWRlKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZUNyZWF0ZUJ1dHRvblZpc2liaWxpdHkoKXtcbiAgICAgICAgICAgIGlmKGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuSURMRSlcbiAgICAgICAgICAgICAgICAmJiBzdGF0ZS5jb25uZWN0ZWRcbiAgICAgICAgICAgICl7XG4gICAgICAgICAgICAgICAgY3JlYXRlQnV0dG9uLnNob3coKTtcbiAgICAgICAgICAgICAgICBsb2JieVNjcmVlbi5zZXRCYWNrZ3JvdW5kU3ByaXRlKHtcbiAgICAgICAgICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjogQ09WRVJfU1BSSVRFX0RFRklOSVRJT05cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLklETEUpXG4gICAgICAgICAgICAgICAgfHwgIXN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgICAgIHx8IHJvb20uc3RhdGUucGxheWVycy5zb21lKChwOmFueSk9PnA/LnVzZXIudXNlcklkID09PSB1c2VyPy51c2VySWQpKXtcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXR0b24uaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlSm9pbkJ1dHRvblZpc2liaWxpdHkoKXtcbiAgICAgICAgICAgIGlmKGluUm9vbVN0YWdlKEdBTUVfU1RBR0UuV0FJVElOR19QTEFZRVJfSk9JTilcbiAgICAgICAgICAgICAgICAmJiBzdGF0ZS5jb25uZWN0ZWRcbiAgICAgICAgICAgICl7XG4gICAgICAgICAgICAgICAgam9pbkJ1dHRvbi5zaG93KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZighaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKVxuICAgICAgICAgICAgICAgIHx8ICFzdGF0ZS5jb25uZWN0ZWRcbiAgICAgICAgICAgICAgICB8fCByb29tLnN0YXRlLnBsYXllcnMuc29tZSgocDphbnkpPT5wPy51c2VyLnVzZXJJZCA9PT0gdXNlcj8udXNlcklkKVxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBqb2luQnV0dG9uLmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFBsYXllckluZGV4KCkge1xuICAgICAgICByZXR1cm4gcm9vbS5zdGF0ZS5wbGF5ZXJzLmZpbmRJbmRleCgocDogYW55KSA9PiBwPy51c2VyPy51c2VySWQgPT09IHVzZXI/LnVzZXJJZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgb25FdmVudDogKGZuOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRXZlbnQucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gY2FsbGJhY2tzLm9uRXZlbnQuc3BsaWNlKGNhbGxiYWNrcy5vbkV2ZW50LmluZGV4T2YoZm4pLCAxKVxuICAgICAgICB9LFxuICAgICAgICBnZXRTdGF0ZTooKT0+KHsuLi5zdGF0ZSwgLi4ucm9vbS5zdGF0ZS50b0pTT04oKX0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25DbGlja0pvaW4oKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25DbGljayBqb2luXCIpO1xuICAgICAgICBsb2dTdGF0ZXMoKTtcbiAgICAgICAgcm9vbS5zZW5kKFwiSk9JTl9HQU1FXCIsIHt1c2VyfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsaWNrQ3JlYXRlKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIm9uQ2xpY2sgY3JlYXRlXCIpO1xuICAgICAgICBsb2dTdGF0ZXMoKTtcblxuICAgICAgICByb29tLnNlbmQoXCJDUkVBVEVfR0FNRVwiLCB7dXNlcn0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFBsYXllckdsb2JhbFNjb3JlKHBsYXllckluZGV4Om51bWJlcil7XG4gICAgICAgIHJldHVybiByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0c1xuICAgICAgICAgICAgLnJlZHVjZSgoYWNjOmFueSwgY3VycmVudDphbnkpPT5jdXJyZW50ID09PSBwbGF5ZXJJbmRleCA/IChhY2MrMSk6YWNjLDApXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0R2xvYmFsV2lubmVyKCl7XG4gICAgICAgIGNvbnN0IHBsYXllcjFHbG9iYWxTY29yZSA9IGdldFBsYXllckdsb2JhbFNjb3JlKDApO1xuICAgICAgICBjb25zdCBwbGF5ZXIyR2xvYmFsU2NvcmUgPSBnZXRQbGF5ZXJHbG9iYWxTY29yZSgxKTtcbiAgICAgICAgaWYoXG4gICAgICAgICAgICAoKHBsYXllcjFHbG9iYWxTY29yZSA+PSAzIHx8IHBsYXllcjJHbG9iYWxTY29yZSA+PSAzKSAmJiBwbGF5ZXIxR2xvYmFsU2NvcmUgIT09IHBsYXllcjJHbG9iYWxTY29yZSlcbiAgICAgICAgICAgIHx8IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLmxlbmd0aCA9PT0gNVxuICAgICAgICApe1xuICAgICAgICAgICAgcmV0dXJuIHBsYXllcjFHbG9iYWxTY29yZT5wbGF5ZXIyR2xvYmFsU2NvcmU/MDoxXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbn1cbiJdfQ==