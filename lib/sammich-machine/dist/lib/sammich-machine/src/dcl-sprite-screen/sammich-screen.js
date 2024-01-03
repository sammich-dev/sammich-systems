import { engine, Material, Transform } from "@dcl/sdk/ecs";
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
export async function createSammichScreen(parent, { position, rotation, scale }, _gameInstanceId) {
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
    const spriteTexture = Material.Texture.Common({
        src: 'images/spritesheet.png',
        wrapMode: 0,
        filterMode: 0
    });
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
                playerIndex: getPlayerIndex()
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtbWljaC1zY3JlZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vc2FtbWljaC1zY3JlZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNILE1BQU0sRUFFTixRQUFRLEVBTVIsU0FBUyxFQUNaLE1BQU0sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sWUFBWSxDQUFDO0FBRXBCLE9BQU8sRUFBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ25DLE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBQ25ELE9BQU8sRUFBZ0IsZUFBZSxFQUFFLG9CQUFvQixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDeEYsT0FBTyxFQUFDLGNBQWMsRUFBYyxNQUFNLGlCQUFpQixDQUFDO0FBQzVELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNqRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFFdEMsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDOUQsT0FBTyxFQUNILGtCQUFrQixFQUNsQixVQUFVLEVBQ1YsbUJBQW1CLEVBQ25CLGtCQUFrQixFQUNsQixzQkFBc0IsRUFDekIsTUFBTSwyQkFBMkIsQ0FBQztBQUNuQyxPQUFPLEVBQUMsMkJBQTJCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMvRCxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3BDLE9BQU8sRUFBQyxPQUFPLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUN0RSxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0saUJBQWlCLENBQUE7QUFDeEMsT0FBTyxFQUFD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QUFDO1FBQ25ELElBQ0ksQ0FBQyxDQUFDLGtCQUFrQixJQUFJLENBQUMsSUFBSSxrQkFBa0IsSUFBSSxDQUFDLENBQUMsSUFBSSxrQkFBa0IsS0FBSyxrQkFBa0IsQ0FBQztlQUNoRyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUM3QyxDQUFDO1lBQ0UsT0FBTyxrQkFBa0IsR0FBQyxrQkFBa0IsQ0FBQSxDQUFDLENBQUEsQ0FBQyxDQUFBLENBQUMsQ0FBQSxDQUFDLENBQUE7UUFDcEQsQ0FBQztRQUNELE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDZCxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gICAgZW5naW5lLFxuICAgIEVudGl0eSxcbiAgICBNYXRlcmlhbCxcbiAgICBNYXRlcmlhbFRyYW5zcGFyZW5jeU1vZGUsXG4gICAgVGV4dEFsaWduTW9kZSxcbiAgICBUZXh0U2hhcGUsXG4gICAgVGV4dHVyZUZpbHRlck1vZGUsXG4gICAgVGV4dHVyZVdyYXBNb2RlLFxuICAgIFRyYW5zZm9ybVxufSBmcm9tIFwiQGRjbC9zZGsvZWNzXCI7XG5pbXBvcnQgXCIuL3BvbHlmaWxsXCI7XG5cbmltcG9ydCB7Q29sb3IzLCBRdWF0ZXJuaW9uLCBWZWN0b3IzfSBmcm9tIFwiQGRjbC9zZGsvbWF0aFwiO1xuaW1wb3J0IHtDbGllbnR9IGZyb20gXCJjb2x5c2V1cy5qc1wiO1xuaW1wb3J0IHtjcmVhdGVTcHJpdGVTY3JlZW59IGZyb20gXCIuL3Nwcml0ZS1zY3JlZW5cIjtcbmltcG9ydCB7Z2V0SW5wdXRTdGF0ZSwgb25JbnB1dEtleUV2ZW50LCBzZXR1cElucHV0Q29udHJvbGxlcn0gZnJvbSBcIi4vaW5wdXQtY29udHJvbGxlclwiO1xuaW1wb3J0IHtnZXRNaW5Vc2VyRGF0YSwgTWluVXNlckRhdGF9IGZyb20gXCIuL21pbi11c2VyLWRhdGFcIjtcbmltcG9ydCB7Y3JlYXRlU2NyZWVuUnVubmVyfSBmcm9tIFwiLi9nYW1lLXJ1bm5lclwiO1xuaW1wb3J0IHt0aW1lcnN9IGZyb20gXCJAZGNsLXNkay91dGlsc1wiO1xuaW1wb3J0IHtUcmFuc2Zvcm1UeXBlV2l0aE9wdGlvbmFsc30gZnJvbSBcIkBkY2wvZWNzL2Rpc3QvY29tcG9uZW50cy9tYW51YWwvVHJhbnNmb3JtXCI7XG5pbXBvcnQge2NyZWF0ZUluc3RydWN0aW9uU2NyZWVufSBmcm9tIFwiLi9pbnN0cnVjdGlvbnMtc2NyZWVuXCI7XG5pbXBvcnQge1xuICAgIERFRkFVTFRfU1BSSVRFX0RFRixcbiAgICBOQU1FX0NPTE9SLFxuICAgIFNIQVJFRF9TQ1JFRU5fU0NBTEUsXG4gICAgU1BMSVRfU0NSRUVOX1NDQUxFLFxuICAgIFNQUklURV9TSEVFVF9ESU1FTlNJT05cbn0gZnJvbSBcIi4uLy4uLy4uL3Nwcml0ZS1jb25zdGFudHNcIjtcbmltcG9ydCB7Y3JlYXRlR2xvYmFsU2NvcmVUcmFuc2l0aW9ufSBmcm9tIFwiLi9zY29yZS10cmFuc2l0aW9uXCI7XG5pbXBvcnQge3Rocm90dGxlfSBmcm9tIFwiLi90aHJvdHRsZVwiO1xuaW1wb3J0IHtnZXRHYW1lLCBzZXR1cEdhbWVSZXBvc2l0b3J5fSBmcm9tIFwiLi4vLi4vLi4vZ2FtZS1yZXBvc2l0b3J5XCI7XG5pbXBvcnQge2dldFJlYWxtfSBmcm9tICd+c3lzdGVtL1J1bnRpbWUnXG5pbXBvcnQge2RjbFNsZWVwfSBmcm9tIFwiLi9kY2wtc2xlZXBcIjtcbmltcG9ydCB7R0FNRV9TVEFHRX0gZnJvbSBcIi4uLy4uLy4uL2dhbWUtc3RhZ2VzXCI7XG5pbXBvcnQge2Nsb25lRGVlcH0gZnJvbSBcIi4uLy4uLy4uL2xpYi11dGlsXCI7XG5pbXBvcnQge0VWRU5UfSBmcm9tIFwiLi9ldmVudHNcIjtcblxuY29uc3QgSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCA9IDcwMDA7XG5jb25zdCBJTlNUUlVDVElPTl9UT1RBTF9USU1FT1VUID0gMzAwMDA7XG5jb25zdCBERUZBVUxUX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTiA9IHtcbiAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgeDogNTc2LCB5OiAxMjgsIHc6IDE5MiwgaDogMTI4LFxufVxuY29uc3QgV0FJVElOR19URVhUX1kgPSAxMDQ7XG5jb25zdCBGT05UX1NJWkUgPSAwLjM1O1xuY29uc3QgQ09WRVJfU1BSSVRFX0RFRklOSVRJT04gPSB7XG4gICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgIHg6IDAsXG4gICAgeTogMCxcbiAgICB3OiAxOTIsXG4gICAgaDogMTI4LFxufVxuY29uc3QgVFJBTlNJVElPTl9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT04gPSB7XG4gICAgeDo1NzYsXG4gICAgeToxMjgsXG4gICAgdzoxOTIsXG4gICAgaDoxMjgsXG4gICAgLi4uU1BSSVRFX1NIRUVUX0RJTUVOU0lPTlxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2FtbWljaFNjcmVlbihwYXJlbnQ6IEVudGl0eSwge3Bvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGV9OiBUcmFuc2Zvcm1UeXBlV2l0aE9wdGlvbmFscywgX2dhbWVJbnN0YW5jZUlkPzpzdHJpbmcpIHtcbiAgICBjb25zdCBnYW1lSW5zdGFuY2VJZCA9IF9nYW1lSW5zdGFuY2VJZCB8fCBcImRlZmF1bHRcIjtcblxuICAgIHNldHVwSW5wdXRDb250cm9sbGVyKCk7XG4gICAgc2V0dXBHYW1lUmVwb3NpdG9yeSgpO1xuXG4gICAgY29uc29sZS5sb2coXCJTQU1NSUNIX1NDUkVFTlwiKVxuICAgIGxldCByZWNvbm5lY3Rpb25Ub2tlbjphbnk7XG4gICAgY29uc3QgY2FsbGJhY2tzOiB7IG9uRXZlbnQ6IEZ1bmN0aW9uW10gfSA9IHtcbiAgICAgICAgb25FdmVudDogW11cbiAgICB9O1xuICAgIGNvbnN0IHN0YXRlID0ge1xuICAgICAgICBjb25uZWN0ZWQ6ZmFsc2UsXG4gICAgICAgIGdhbWVTdGFnZTpHQU1FX1NUQUdFLk5PVF9DT05ORUNURUQsXG4gICAgICAgIHNlbnRJbnN0cnVjdGlvbnNSZWFkeTpmYWxzZSxcbiAgICAgICAgc2VudFJlYWR5OmZhbHNlXG4gICAgfTtcbiAgICBjb25zdCB7cmVhbG1JbmZvfSA9IGF3YWl0IGdldFJlYWxtKHt9KTtcbiAgICBjb25zb2xlLmxvZyhcInJlYWxtSW5mb1wiLHJlYWxtSW5mbyk7XG5cbiAgICBjb25zdCB1c2VyOiBNaW5Vc2VyRGF0YSA9IGF3YWl0IGdldE1pblVzZXJEYXRhKCk7XG4gICAgY29uc3QgZW50aXR5ID0gZW5naW5lLmFkZEVudGl0eSgpO1xuXG4gICAgVHJhbnNmb3JtLmNyZWF0ZShlbnRpdHksIHtcbiAgICAgICAgcGFyZW50LFxuICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgcm90YXRpb24sXG4gICAgICAgIHNjYWxlXG4gICAgfSk7XG5cbiAgICBjb25zdCBzcHJpdGVUZXh0dXJlID0gTWF0ZXJpYWwuVGV4dHVyZS5Db21tb24oe1xuICAgICAgICBzcmM6ICdpbWFnZXMvc3ByaXRlc2hlZXQucG5nJyxcbiAgICAgICAgd3JhcE1vZGU6IFRleHR1cmVXcmFwTW9kZS5UV01fUkVQRUFULFxuICAgICAgICBmaWx0ZXJNb2RlOiBUZXh0dXJlRmlsdGVyTW9kZS5URk1fUE9JTlRcbiAgICB9KTtcbiAgICBjb25zdCBzcHJpdGVNYXRlcmlhbDphbnkgPSB7XG4gICAgICAgIHRleHR1cmU6IHNwcml0ZVRleHR1cmUsXG4gICAgICAgIGVtaXNzaXZlVGV4dHVyZTogc3ByaXRlVGV4dHVyZSxcbiAgICAgICAgZW1pc3NpdmVJbnRlbnNpdHk6IDAuNixcbiAgICAgICAgZW1pc3NpdmVDb2xvcjogQ29sb3IzLmNyZWF0ZSgxLCAxLCAxKSxcbiAgICAgICAgc3BlY3VsYXJJbnRlbnNpdHk6IDAsXG4gICAgICAgIHJvdWdobmVzczogMSxcbiAgICAgICAgYWxwaGFUZXN0OiAxLFxuICAgICAgICB0cmFuc3BhcmVuY3lNb2RlOiBNYXRlcmlhbFRyYW5zcGFyZW5jeU1vZGUuTVRNX0FMUEhBX1RFU1RcbiAgICB9O1xuICAgIGNvbnN0IGxvYmJ5U2NyZWVuVHJhbnNmb3JtID0gey8vVE9ETyBjYW4gYmUgZGlmZmVyZW50IGZvciBlYWNoIHBsYXllciBzY3JlZW5cbiAgICAgICAgcG9zaXRpb246IFZlY3RvcjMuY3JlYXRlKDAsIDAsIDApLFxuICAgICAgICBwYXJlbnQ6IGVudGl0eVxuICAgIH07XG5cbiAgICBjb25zdCBsb2JieVNjcmVlbiA9IGNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgIHRyYW5zZm9ybTogbG9iYnlTY3JlZW5UcmFuc2Zvcm0sXG4gICAgICAgIHNwcml0ZU1hdGVyaWFsLFxuICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTlxuICAgIH0pO1xuICAgIGNvbnN0IHdhaXRpbmdUZXh0RW50aXR5ID0gbG9iYnlTY3JlZW4uYWRkVGV4dCh7XG4gICAgICAgIHBpeGVsUG9zaXRpb246IFsxOTIvMiwgV0FJVElOR19URVhUX1kgKyA0XSxcbiAgICAgICAgdGV4dEFsaWduOlRleHRBbGlnbk1vZGUuVEFNX1RPUF9DRU5URVIsXG4gICAgICAgIHRleHQ6YCAgICA8Y29sb3I9JHtOQU1FX0NPTE9SfT5HZXN0PC9jb2xvcj4gaXMgd2FpdGluZyBzb21gLFxuICAgICAgICB0ZXh0Q29sb3I6WzEsMSwxLDFdLFxuICAgICAgICBmb250U2l6ZTpGT05UX1NJWkUsXG4gICAgICAgIGxheWVyOjJcbiAgICB9KTtcbiAgICBjb25zdCB3YWl0aW5nVGV4dEJhY2tncm91bmQgPSBsb2JieVNjcmVlbi5hZGRTcHJpdGUoe1xuICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiB7XG4gICAgICAgICAgICAuLi5ERUZBVUxUX1NQUklURV9ERUYsXG4gICAgICAgICAgICB4OiAzODQsIHk6IDIxOCwgdzogMTkyLCBoOiAyNSxcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7bmFtZTogXCJ0ZXh0LWJhY2tncm91bmRcIn1cbiAgICAgICAgfSxcbiAgICAgICAgcGl4ZWxQb3NpdGlvbjogWzAsIFdBSVRJTkdfVEVYVF9ZXSxcbiAgICAgICAgbGF5ZXI6IDEsXG4gICAgICAgIGtsYXNzOlwiVGV4dEJhY2tncm91bmRcIlxuICAgIH0pXG4gICAgd2FpdGluZ1RleHRFbnRpdHkuaGlkZSgpO1xuICAgIHdhaXRpbmdUZXh0QmFja2dyb3VuZC5oaWRlKCk7XG5cbiAgICBjb25zdCBkaXNjb25uZWN0aW9uVGV4dCA9IGxvYmJ5U2NyZWVuLmFkZFRleHQoe3RleHQ6XCJESVNDT05ORUNURURcIiwgdGV4dENvbG9yOlsxLDAsMCwxXSwgcGl4ZWxQb3NpdGlvbjpbMTkyLzIsNF0sIGxheWVyOjEwLCB0ZXh0QWxpZ246VGV4dEFsaWduTW9kZS5UQU1fVE9QX0NFTlRFUiwgZm9udFNpemU6MX0pO1xuICAgIGNvbnN0IHNjb3JlVHJhbnNpdGlvbiA9IGNyZWF0ZUdsb2JhbFNjb3JlVHJhbnNpdGlvbihsb2JieVNjcmVlbik7XG4gICAgY29uc3QgY29seXNldXNDbGllbnQ6IENsaWVudCA9IG5ldyBDbGllbnQofihyZWFsbUluZm8/LnJlYWxtTmFtZXx8XCJcIikudG9Mb3dlckNhc2UoKS5pbmRleE9mKFwibG9jYWxcIik/YHdzOi8vbG9jYWxob3N0OjI1NjdgOlwid3NzOi8vc2FtbWljaC5wcm8vY29seXNldXNcIik7XG5cbiAgICBjb25zdCBjb25uZWN0Um9vbSA9IGFzeW5jICgpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29ubmVjdFJvb21cIik7XG4gICAgICAgIGxldCBfcm9vbTtcbiAgICAgICAgd2hpbGUoIXN0YXRlLmNvbm5lY3RlZCl7XG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgX3Jvb20gPSBhd2FpdCBjb2x5c2V1c0NsaWVudC5qb2luKGBHYW1lUm9vbWAsIHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgICAgICAgICAgZ2FtZUluc3RhbmNlSWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNPTk5FQ1RFRFwiLCBfcm9vbT8ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfWNhdGNoKGVycm9yOmFueSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvciBjb25uZWN0aW5nXCIsIGVycm9yPy5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBkY2xTbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jvb207XG4gICAgfTtcbiAgICBjb25zdCBvbk1pbmlHYW1lVHJhY2sgPSBhc3luYyAobWluaUdhbWVUcmFjazphbnkpID0+IHtcbiAgICAgICAgLy9UT0RPIHNob3cgaW5zdHJ1Y3Rpb25zIG9mIHRoZSBnYW1lIDBcbiAgICAgICAgY29uc29sZS5sb2coXCJNSU5JX0dBTUVfVFJBQ0tcIiwgbWluaUdhbWVUcmFjayk7XG4gICAgfTtcbiAgICBjb25zdCByb29tT25JbnB1dEZyYW1lID0gKHtwbGF5ZXJJbmRleCwgZnJhbWV9OmFueSk9PntcbiAgICAgICAgLy9UT0RPIHJldmlldyBpZiBiZXN0IGFwcHJvYWNoLCBmb3Igbm93IHRvIHJlcHJlc2VudCBvdGhlciBwbGF5ZXIgU3RhdGVcbiAgICAgICAgaWYocGxheWVySW5kZXggIT09IGdldFBsYXllckluZGV4KCkpe1xuICAgICAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHJ1bm5lciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5wdXREYXRhID0gZnJhbWUuZXZlbnRzW2ZyYW1lLmV2ZW50cy5sZW5ndGgtMV0uZGF0YVxuICAgICAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnB1c2hJbnB1dEV2ZW50KHtcbiAgICAgICAgICAgICAgICAgICAgLi4uaW5wdXREYXRhLFxuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCByZWNvbm5lY3QgPSBhc3luYyAoY29kZTpudW1iZXIpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJsZWF2ZSBjb2RlXCIsIGNvZGUpO1xuICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5zaG93KCk7XG4gICAgICAgIHN0YXRlLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgICAgZXJyb3I0MjEyID0gZmFsc2U7XG4gICAgICAgIHdoaWxlKCFzdGF0ZS5jb25uZWN0ZWQpe1xuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVjb25uZWN0aW5nLi4uXCIpXG4gICAgICAgICAgICAgICAgcm9vbSA9IGVycm9yNDIxMj9hd2FpdCBjb25uZWN0Um9vbSgpOiBhd2FpdCBjb2x5c2V1c0NsaWVudC5yZWNvbm5lY3QocmVjb25uZWN0aW9uVG9rZW4pO1xuICAgICAgICAgICAgICAgIGVycm9yNDIxMiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY29ubmVjdGlvbiBET05FIVwiLCByb29tLCByb29tPy5yZWNvbm5lY3Rpb25Ub2tlbik7XG5cbiAgICAgICAgICAgICAgICByZWNvbm5lY3Rpb25Ub2tlbiA9IHJvb20ucmVjb25uZWN0aW9uVG9rZW47XG4gICAgICAgICAgICAgICAgc3RhdGUuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgYWRkUm9vbUhhbmRsZXJzKCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpO1xuICAgICAgICAgICAgfWNhdGNoKGVycm9yOmFueSl7XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBkY2xTbGVlcCgzMDAwKTtcbiAgICAgICAgICAgICAgICBpZihlcnJvcj8uY29kZSA9PT0gNDIxMil7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yNDIxMiA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3IgcmVjb25uZWN0aW5nXCIsIGVycm9yKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbkxvY2FsU3RhZ2UgPSAoc3RhZ2U6R0FNRV9TVEFHRSkgPT4gc3RhdGUuZ2FtZVN0YWdlID09PSBzdGFnZTtcbiAgICBjb25zdCBpblJvb21TdGFnZSA9IChzdGFnZTpHQU1FX1NUQUdFKSA9PiByb29tLnN0YXRlLmdhbWVTdGFnZSA9PT0gc3RhZ2U7XG4gICAgY29uc3QgZGlmZlN0YWdlID0gKHN0YWdlOkdBTUVfU1RBR0UpPT4gaW5Mb2NhbFN0YWdlKHN0YWdlKSAhPT0gaW5Sb29tU3RhZ2Uoc3RhZ2UpO1xuICAgIGNvbnN0IHJvb21PblN0YXRlQ2hhbmdlID0gKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcInJvb21PblN0YXRlQ2hhbmdlLlwiKTtcbiAgICAgICAgbG9nU3RhdGVzKCk7XG5cbiAgICAgICAgaGFuZGxlUGxheWVyc1NlbmRpbmdSZWFkeSgpO1xuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5JRExFLCBoYW5kbGVMb2JieVNjcmVlblN0YXRlKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuU0hPV0lOR19JTlNUUlVDVElPTlMsIHNob3dJbnN0cnVjdGlvbnMsIGhpZGVJbnN0cnVjdGlvbnMpO1xuICAgICAgICBoYW5kbGVTdGFnZUNoYW5nZSggR0FNRV9TVEFHRS5QTEFZSU5HX01JTklHQU1FLCBzdGFydE1pbmlHYW1lKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuVElFX0JSRUFLRVIsIHNob3dUaWVCcmVha2VyKTtcbiAgICAgICAgaGFuZGxlU3RhZ2VDaGFuZ2UoIEdBTUVfU1RBR0UuU0hPV0lOR19TQ09SRV9UUkFOU0lUSU9OLCBoYW5kbGVTY29yZVRyYW5zaXRpb24pXG4gICAgICAgIGhhbmRsZVN0YWdlQ2hhbmdlKCBHQU1FX1NUQUdFLlNIT1dJTkdfRU5ELCBoYW5kbGVFbmRUcmFjayk7XG4gICAgICAgIGlmKHJvb20uc3RhdGUucGxheWVycy5maWx0ZXIoKHA6YW55KT0+cC5pbnN0cnVjdGlvbnNSZWFkeSkubGVuZ3RoID09PSAxKXtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNldFRpbWVvdXQoSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCk7XG4gICAgICAgICAgICBpZihnZXRQbGF5ZXJJbmRleCgpID49IDAgJiYgIXJvb20uc3RhdGUucGxheWVyc1tnZXRQbGF5ZXJJbmRleCgpXS5pbnN0cnVjdGlvbnNSZWFkeSl7XG4gICAgICAgICAgICAgICAgdGltZXJzLnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZighc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5KXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwgeyBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSwgZm9vOiAyIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgSU5TVFJVQ1RJT05fUkVBRFlfVElNRU9VVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5nYW1lU3RhZ2UgPSByb29tLnN0YXRlLmdhbWVTdGFnZTtcbiAgICAgICAgaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZUVuZFRyYWNrKCl7XG4gICAgICAgICAgICBjb25zdCB0cmFja1dpbm5lckluZGV4ID0gZ2V0R2xvYmFsV2lubmVyKCk7XG4gICAgICAgICAgICBzY29yZVRyYW5zaXRpb24uc2hvd0ZpbmFsU3ByaXRlKHRyYWNrV2lubmVySW5kZXgpO1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRXZlbnQuZm9yRWFjaChlPT5lKHtcbiAgICAgICAgICAgICAgICB0eXBlOkVWRU5ULkVORF9UUkFDSyxcbiAgICAgICAgICAgICAgICBkYXRhOntcbiAgICAgICAgICAgICAgICAgICAgdHJhY2tXaW5uZXJJbmRleFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmVzZXRUcmFja1N0YXRlKCk7XG4gICAgICAgICAgICBkaXNwb3NlSW5wdXRMaXN0ZW5lciAmJiBkaXNwb3NlSW5wdXRMaXN0ZW5lcigpO1xuXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHJlc2V0VHJhY2tTdGF0ZSgpe1xuICAgICAgICAgICAgICAgIHNjb3JlVHJhbnNpdGlvbi5yZXNldCgpO1xuICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oc3RhdGUsIHtcbiAgICAgICAgICAgICAgICAgICAgc2VudFJlYWR5OmZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzZW50SW5zdHJ1Y3Rpb25zUmVhZHk6ZmFsc2VcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVQbGF5ZXJzU2VuZGluZ1JlYWR5KCl7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXJJbmRleCA9IGdldFBsYXllckluZGV4KCk7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXggPj0gMFxuICAgICAgICAgICAgICAgICYmICFzdGF0ZS5zZW50UmVhZHlcbiAgICAgICAgICAgICAgICAmJiByb29tLnN0YXRlLnBsYXllcnMubGVuZ3RoID09PSAyXG4gICAgICAgICAgICAgICAgJiYgaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUlNfUkVBRFkpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zZW50UmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiU0VORCBSRUFEWVwiKVxuICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIlJFQURZXCIsIHtwbGF5ZXJJbmRleH0pO1xuICAgICAgICAgICAgICAgIHNldElucHV0TGlzdGVuZXIoKTtcbiAgICAgICAgICAgIH1lbHNlIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSU19SRUFEWSkgJiYgc3RhdGUuc2VudFJlYWR5KXtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zZW50UmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVN0YWdlQ2hhbmdlKGdhbWVTdGFnZTpHQU1FX1NUQUdFLCBmbjpGdW5jdGlvbiwgZWxzZUZuPzpGdW5jdGlvbil7XG4gICAgICAgICAgICBpZihkaWZmU3RhZ2UoZ2FtZVN0YWdlKSl7XG4gICAgICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoZ2FtZVN0YWdlKSl7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoZWxzZUZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VGbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dUaWVCcmVha2VyKCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNob3dUaWVCcmVha2VyXCIsIHJvb20uc3RhdGUudGllQnJlYWtlcldpbm5lcilcbiAgICAgICAgICAgIGlmKGdldFBsYXllckluZGV4KCkgIT09IDApe1xuICAgICAgICAgICAgICAgIHNjcmVlblJ1bm5lcnNbMF0ucnVudGltZS5yZXByb2R1Y2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnNbMF0ucnVudGltZS50aWVCcmVha2VyKHtcbiAgICAgICAgICAgICAgICB3aW5uZXJJbmRleDpyb29tLnN0YXRlLnRpZUJyZWFrZXJXaW5uZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd0luc3RydWN0aW9ucygpe1xuICAgICAgICAgICAgY29uc3QgbmV4dE1pbmlHYW1lSW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCBuZXh0R2FtZUlkID0gcm9vbS5zdGF0ZS5taW5pR2FtZVRyYWNrW25leHRNaW5pR2FtZUluZGV4XTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2hvd0luc3RydWN0aW9uc1wiLCBuZXh0TWluaUdhbWVJbmRleCwgbmV4dEdhbWVJZCwgZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmFsaWFzKVxuICAgICAgICAgICAgbG9iYnlTY3JlZW4uc2hvdygpO1xuXG4gICAgICAgICAgICBpbnN0cnVjdGlvbnNQYW5lbCA9IGNyZWF0ZUluc3RydWN0aW9uU2NyZWVuKHtcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBsb2JieVNjcmVlbi5nZXRFbnRpdHkoKSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IFZlY3RvcjMuY3JlYXRlKDAsIDAsIC0wLjA1KSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IFZlY3RvcjMuT25lKCksXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBRdWF0ZXJuaW9uLlplcm8oKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2FtZUFsaWFzOiBnZXRHYW1lKG5leHRHYW1lSWQpLmRlZmluaXRpb24uYWxpYXMsXG4gICAgICAgICAgICAgICAgZ2FtZUluc3RydWN0aW9uczogZ2V0R2FtZShuZXh0R2FtZUlkKS5kZWZpbml0aW9uLmluc3RydWN0aW9ucyxcbiAgICAgICAgICAgICAgICBwbGF5ZXJJbmRleDpnZXRQbGF5ZXJJbmRleCgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsLnNldFRpbWVvdXQoSU5TVFJVQ1RJT05fVE9UQUxfVElNRU9VVCk7XG4gICAgICAgICAgICB0aW1lcnMuc2V0VGltZW91dCgoKT0+e1xuICAgICAgICAgICAgICAgIGlmKCFzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkpe1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5zZW50SW5zdHJ1Y3Rpb25zUmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlNUUlVDVElPTlNfUkVBRFlcIiwgeyBwbGF5ZXJJbmRleDogZ2V0UGxheWVySW5kZXgoKSwgZm9vOiAyIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDMwMDAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhpZGVJbnN0cnVjdGlvbnMoKXtcbiAgICAgICAgICAgIGluc3RydWN0aW9uc1BhbmVsPy5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgbGV0IHJvb206IGFueSA9IGF3YWl0IGNvbm5lY3RSb29tKCk7XG5cbiAgICBhZGRSb29tSGFuZGxlcnMoKTtcblxuICAgIGRpc2Nvbm5lY3Rpb25UZXh0LmhpZGUoKTtcbiAgICByZWNvbm5lY3Rpb25Ub2tlbiA9IHJvb20ucmVjb25uZWN0aW9uVG9rZW47XG5jb25zb2xlLmxvZyhcInJlY29ubmVjdGlvblRva2VuXCIscmVjb25uZWN0aW9uVG9rZW4pO1xuICAgIGNvbnN0IGNyZWF0ZUJ1dHRvbiA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDAsIHk6IDM4NywgdzogNDcsIGg6IDI1LFxuICAgICAgICAgICAgbWV0YWRhdGE6IHtuYW1lOiBcImNyZWF0ZUJ1dHRvblwifVxuICAgICAgICB9LFxuICAgICAgICBwaXhlbFBvc2l0aW9uOiBbLTQ3LCA4MF0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBvbkNsaWNrOiBvbkNsaWNrQ3JlYXRlLFxuICAgICAgICBob3ZlclRleHQ6IFwiU3RhcnQgbmV3IGdhbWVcIixcbiAgICAgICAga2xhc3M6XCJDcmVhdGVCdXR0b25cIlxuICAgIH0pO1xuXG4gICAgY29uc3Qgam9pbkJ1dHRvbiA9IGxvYmJ5U2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6IDQ5LCB5OiAzODcsIHc6IDQ3LCBoOiAyNSxcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7bmFtZTogXCJqb2luQnV0dG9uXCJ9XG4gICAgICAgIH0sXG4gICAgICAgIHBpeGVsUG9zaXRpb246IFsxOTIgLCA4MF0sXG4gICAgICAgIGxheWVyOiAxLFxuICAgICAgICBvbkNsaWNrOiBvbkNsaWNrSm9pbixcbiAgICAgICAgaG92ZXJUZXh0OiBcIkpvaW4gZ2FtZVwiLFxuICAgICAgICBrbGFzczpcIkpvaW5CdXR0b25cIlxuICAgIH0pO1xuXG4gICAgam9pbkJ1dHRvbi5oaWRlKCk7XG4gICAgY3JlYXRlQnV0dG9uLmhpZGUoKTtcblxuICAgIGxldCBwbGF5ZXJTY3JlZW5zOmFueVtdID0gW10sIHNjcmVlblJ1bm5lcnM6YW55W10gPSBbXTtcbiAgICBsZXQgaW5zdHJ1Y3Rpb25zUGFuZWw6YW55O1xuXG4gICAgY29uc3QgaGFuZGxlU2NvcmVUcmFuc2l0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImhhbmRsZVNjb3JlVHJhbnNpdGlvblwiKTtcbiAgICAgICAgY29uc3Qgd2lubmVySW5kZXggPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0c1tyb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGgtMV07XG4gICAgICAgIGNvbnN0IGZpbmFsaXplID0gZ2V0R2xvYmFsV2lubmVyKCkgIT09IC0xO1xuICAgICAgICBjb25zdCBtaW5pR2FtZVJlc3VsdHMgPSByb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cztcbiAgICAgICAgLy9UT0RPIGVzdG8gZGVzcHVlcyBkZSBUSUVfQlJFQUtFUlxuICAgICAgICBwbGF5ZXJTY3JlZW5zLmZvckVhY2goKHM6YW55KT0+cy5kZXN0cm95KCkpO1xuICAgICAgICBzY3JlZW5SdW5uZXJzLmZvckVhY2goc3I9PnNyLnJ1bnRpbWUuc3RvcCgpKTtcbiAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKHNyPT5zci5ydW50aW1lLmRlc3Ryb3koKSk7XG4gICAgICAgIHBsYXllclNjcmVlbnMgPSBbXTtcbiAgICAgICAgc2NyZWVuUnVubmVycyA9IFtdO1xuXG4gICAgICAgIGxvYmJ5U2NyZWVuLnNob3coKTtcbiAgICAgICAgbG9iYnlTY3JlZW4uc2V0QmFja2dyb3VuZFNwcml0ZSh7XG4gICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOlRSQU5TSVRJT05fU0NSRUVOX1NQUklURV9ERUZJTklUSU9OXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBwcmV2aW91c1Njb3JlcyA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLnJlZHVjZSgoYWNjOm51bWJlcltdLCB3aW5uZXJJbmRleDpudW1iZXIpPT57XG4gICAgICAgICAgICBhY2Nbd2lubmVySW5kZXhdKys7XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICB9LFswLDBdKTtcbiAgICAgICAgcHJldmlvdXNTY29yZXNbd2lubmVySW5kZXhdIC09IDE7XG4gICAgICAgIGNvbnN0IGlzRmluYWwgPSAhIWZpbmFsaXplO1xuICAgICAgICBjb25zdCB0cmFja1dpbm5lckluZGV4ID0gZ2V0VHJhY2tXaW5uZXJGcm9tTWluaUdhbWVSZXN1bHRzKG1pbmlHYW1lUmVzdWx0cyk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidHJhY2tXaW5uZXJJbmRleFwiLHRyYWNrV2lubmVySW5kZXgpXG5cblxuICAgICAgICBhd2FpdCBzY29yZVRyYW5zaXRpb24uc2hvd1RyYW5zaXRpb24oe1xuICAgICAgICAgICAgd2lubmVySW5kZXgsXG4gICAgICAgICAgICBwcmV2aW91c1Njb3JlcyxcbiAgICAgICAgICAgIGlzRmluYWwsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTE6cm9vbS5zdGF0ZS5wbGF5ZXJzWzBdLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgZGlzcGxheU5hbWUyOnJvb20uc3RhdGUucGxheWVyc1sxXS5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIHRyYWNrV2lubmVySW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIHNjb3JlVHJhbnNpdGlvbi5oaWRlKCk7XG4gICAgICAgIHN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSA9IGZhbHNlO1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRyYWNrV2lubmVyRnJvbU1pbmlHYW1lUmVzdWx0cyhtaW5pR2FtZVJlc3VsdHM6bnVtYmVyW10pe1xuICAgICAgICAgICAgbGV0IHNjb3JlczpudW1iZXJbXSA9IFswLDBdO1xuICAgICAgICAgICAgbWluaUdhbWVSZXN1bHRzLmZvckVhY2god2lubmVySW5kZXggPT4ge1xuICAgICAgICAgICAgICAgIHNjb3Jlc1t3aW5uZXJJbmRleF0rK1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInNjb3Jlc1wiLCBzY29yZXMpO1xuICAgICAgICAgICAgaWYoc2NvcmVzWzBdID4gc2NvcmVzWzFdKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldFBsYXlpbmdNaW5pR2FtZUlkKCl7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKSkgcmV0dXJuO1xuICAgICAgICBpbmRleCA9IHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzLmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tpbmRleF07XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0TWluaUdhbWUgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGxvYmJ5U2NyZWVuLmhpZGUoKTtcbiAgICAgICAgY29uc3QgbWluaUdhbWVJZCA9IGdldFBsYXlpbmdNaW5pR2FtZUlkKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1RBUlRfR0FNRVwiLCBtaW5pR2FtZUlkKTtcbiAgICAgICAgY29uc3QgR2FtZUZhY3RvcnkgPSBnZXRHYW1lKG1pbmlHYW1lSWQpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkdhbWVGYWN0b3J5LmRlZmluaXRpb25cIixHYW1lRmFjdG9yeS5kZWZpbml0aW9uKTtcbiAgICAgICAgaWYoR2FtZUZhY3RvcnkuZGVmaW5pdGlvbi5zcGxpdCl7XG4gICAgICAgICAgICBwbGF5ZXJTY3JlZW5zID0gbmV3IEFycmF5KDIpLmZpbGwobnVsbCkubWFwKChfLCBwbGF5ZXJJbmRleCk9PmNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOlZlY3RvcjMuY3JlYXRlKHBsYXllckluZGV4PzAuMjU6LTAuMjUsIDAsIDApLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogU1BMSVRfU0NSRUVOX1NDQUxFLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGVudGl0eVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3ByaXRlTWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAuLi5ERUZBVUxUX1NDUkVFTl9TUFJJVEVfREVGSU5JVElPTixcbiAgICAgICAgICAgICAgICAgICAgdzogMTkyIC8gMixcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHNjcmVlblJ1bm5lcnMgPSBwbGF5ZXJTY3JlZW5zLm1hcCgoc2NyZWVuLCBwbGF5ZXJJbmRleCkgPT4gY3JlYXRlU2NyZWVuUnVubmVyKHtcbiAgICAgICAgICAgICAgICBzY3JlZW4sIC8vVE9ETyBSRVZJRVc7IHdlIHJlYWxseSBzaG91bGQgdXNlIGFub3RoZXIgc2NyZWVuLCBhbmQgZGVjb3VwbGUgdGhlIGxvYmJ5IHNjcmVlbiBmcm9tIHRoZSBnYW1lXG4gICAgICAgICAgICAgICAgdGltZXJzLFxuICAgICAgICAgICAgICAgIEdhbWVGYWN0b3J5LFxuICAgICAgICAgICAgICAgIHBsYXllckluZGV4LFxuICAgICAgICAgICAgICAgIHNlcnZlclJvb206IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBjbGllbnRSb29tOiByb29tLFxuICAgICAgICAgICAgICAgIGlzQ2xpZW50UGxheWVyOiBwbGF5ZXJJbmRleCA9PT0gZ2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXI6MVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgc2NyZWVuUnVubmVycy5mb3JFYWNoKChydW5uZXIsIHBsYXllckluZGV4KT0+e1xuICAgICAgICAgICAgICAgIGlmKHBsYXllckluZGV4ID09PSBnZXRQbGF5ZXJJbmRleCgpKXtcbiAgICAgICAgICAgICAgICAgICAgLy9ydW5uZXIucnVudGltZS5hdHRhY2hEZWJ1Z1BhbmVsKGdldERlYnVnUGFuZWwoKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0UGxheWVyUnVubmVyKHJ1bm5lcik7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIHJ1bm5lci5ydW50aW1lLnN0YXJ0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9ZWxzZXsvL3NoYXJlZCBzY3JlZW5cbiAgICAgICAgICAgIGNvbnN0IHNjcmVlbiA9IGNyZWF0ZVNwcml0ZVNjcmVlbih7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOlZlY3RvcjMuWmVybygpLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogU0hBUkVEX1NDUkVFTl9TQ0FMRSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBlbnRpdHlcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNwcml0ZU1hdGVyaWFsLFxuICAgICAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uREVGQVVMVF9TQ1JFRU5fU1BSSVRFX0RFRklOSVRJT05cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHBsYXllclNjcmVlbnMgPSBbc2NyZWVuXTtcblxuICAgICAgICAgICAgc2NyZWVuUnVubmVycyA9IFtjcmVhdGVTY3JlZW5SdW5uZXIoe1xuICAgICAgICAgICAgICAgIHNjcmVlbiwgLy9UT0RPIFJFVklFVzsgd2UgcmVhbGx5IHNob3VsZCB1c2UgYW5vdGhlciBzY3JlZW4sIGFuZCBkZWNvdXBsZSB0aGUgbG9iYnkgc2NyZWVuIGZyb20gdGhlIGdhbWVcbiAgICAgICAgICAgICAgICB0aW1lcnMsXG4gICAgICAgICAgICAgICAgR2FtZUZhY3RvcnksXG4gICAgICAgICAgICAgICAgcGxheWVySW5kZXg6IGdldFBsYXllckluZGV4KCksXG4gICAgICAgICAgICAgICAgc2VydmVyUm9vbTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGNsaWVudFJvb206IHJvb20sXG4gICAgICAgICAgICAgICAgaXNDbGllbnRQbGF5ZXI6dHJ1ZSwvL1RPRE8gZm9yIHNoYXJlZC1zY3JlZW4gLCBpcyByZWFsbHkgYSBjbGllbnRQbGF5ZXIsIGl0IG93dWxkIGJlIGJldHRlciB0byBkZWZpbmUgaWYgaXQncyBzaGFyZWQgc2NyZWVuXG4gICAgICAgICAgICAgICAgc2hhcmVkU2NyZWVuOnRydWUsLy9UT0RPIG9yIG1heWJlOiByZWFjdFRvTmV0d29ya1Nwcml0ZXNcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXI6MVxuICAgICAgICAgICAgfSldO1xuXG4gICAgICAgICAgICBzdGFydFBsYXllclJ1bm5lcihzY3JlZW5SdW5uZXJzWzBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHN0YXJ0UGxheWVyUnVubmVyKHJ1bm5lcjphbnkpe1xuICAgICAgICAgICAgcnVubmVyLnJ1bnRpbWUuc3RhcnQodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgZGlzcG9zZU9uRnJhbWU6YW55O1xuICAgICAgICAgICAgY29uc3QgdGhyb3R0bGVTZW5kUGxheWVyRnJhbWUgPSB0aHJvdHRsZSgoKSA9PiB7IC8vVE9ETyBSRVZJRVcsIGxlYWsgfCBkaXNwb3NlXG4gICAgICAgICAgICAgICAgaWYoIXJ1bm5lciB8fCBydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmRlc3Ryb3llZCl7XG4gICAgICAgICAgICAgICAgICAgIGlmKGRpc3Bvc2VPbkZyYW1lKSBkaXNwb3NlT25GcmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXllckZyYW1lRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXg6Z2V0UGxheWVySW5kZXgoKSxcbiAgICAgICAgICAgICAgICAgICAgbjogcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5sYXN0UmVwcm9kdWNlZEZyYW1lXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJvb20uc2VuZChcIlBMQVlFUl9GUkFNRVwiLCBwbGF5ZXJGcmFtZURhdGEpO1xuICAgICAgICAgICAgfSwxMDApO1xuICAgICAgICAgICAgZGlzcG9zZU9uRnJhbWUgPSBydW5uZXIub25GcmFtZSh0aHJvdHRsZVNlbmRQbGF5ZXJGcmFtZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbG9nU3RhdGVzKCl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9jYWwgc3RhdGVcIiwgY2xvbmVEZWVwKHN0YXRlKSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwicm9vbSBzdGF0ZVwiLCByb29tLnN0YXRlLnRvSlNPTigpKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGFkZFJvb21IYW5kbGVycygpe1xuICAgICAgICBjb25zb2xlLmxvZyhcImFkZFJvb21IYW5kbGVyc1wiKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCJJTlBVVF9GUkFNRVwiLCByb29tT25JbnB1dEZyYW1lKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCJNSU5JX0dBTUVfVFJBQ0tcIiwgb25NaW5pR2FtZVRyYWNrKTtcbiAgICAgICAgcm9vbS5vbk1lc3NhZ2UoXCIqXCIsICguLi5hcmdzOmFueVtdKT0+e1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJhbnkgbWVzc2FnZVwiLCBhcmdzKVxuICAgICAgICB9KTtcbiAgICAgICAgcm9vbS5vbkxlYXZlKHJlY29ubmVjdCk7XG4gICAgICAgIHJvb20ub25TdGF0ZUNoYW5nZShyb29tT25TdGF0ZUNoYW5nZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0SW5wdXRMaXN0ZW5lcigpe1xuICAgICAgICBjb25zdCBwbGF5ZXJJbmRleCA9IGdldFBsYXllckluZGV4KCk7XG4gICAgICAgIGlmKHBsYXllckluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBkaXNwb3NlSW5wdXRMaXN0ZW5lciA9IG9uSW5wdXRLZXlFdmVudCgoaW5wdXRBY3Rpb25LZXk6IGFueSwgaXNQcmVzc2VkOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiaW5wdXRcIiwgaW5wdXRBY3Rpb25LZXksIGlzUHJlc3NlZClcbiAgICAgICAgICAgICAgICBpZihpbkxvY2FsU3RhZ2UoR0FNRV9TVEFHRS5TSE9XSU5HX0lOU1RSVUNUSU9OUykgJiYgIXN0YXRlLnNlbnRJbnN0cnVjdGlvbnNSZWFkeSl7XG5cbiAgICAgICAgICAgICAgICAgICAgc3RhdGUuc2VudEluc3RydWN0aW9uc1JlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZW5kaW5nIElOU1RSVUNUSU9OU19SRUFEWVwiKTtcbiAgICAgICAgICAgICAgICAgICAgcm9vbS5zZW5kKFwiSU5TVFJVQ1RJT05TX1JFQURZXCIsIHtwbGF5ZXJJbmRleCwgZm9vOjF9KTtcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zUGFuZWwuc2hvd1dhaXRpbmdGb3JPdGhlclBsYXllcih7dGltZW91dDpJTlNUUlVDVElPTl9SRUFEWV9USU1FT1VUfSk7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5QTEFZSU5HX01JTklHQU1FKSl7XG4gICAgICAgICAgICAgICAgICAgIC8vZ2V0RGVidWdQYW5lbCgpLnNldFN0YXRlKGdldElucHV0U3RhdGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdhbWVJZCA9IHJvb20uc3RhdGUubWluaUdhbWVUcmFja1tyb29tLnN0YXRlLm1pbmlHYW1lUmVzdWx0cy5sZW5ndGhdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcGxpdCA9IGdldEdhbWUoZ2FtZUlkKS5kZWZpbml0aW9uLnNwbGl0O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBydW5uZXIgPSBzY3JlZW5SdW5uZXJzW3NwbGl0P3BsYXllckluZGV4OjBdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnB1dEZyYW1lID0gcnVubmVyLnJ1bnRpbWUucHVzaElucHV0RXZlbnQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZTpEYXRlLm5vdygpIC0gcnVubmVyLnJ1bnRpbWUuZ2V0U3RhdGUoKS5zdGFydFRpbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZU51bWJlcjpydW5uZXIucnVudGltZS5nZXRTdGF0ZSgpLmxhc3RSZXByb2R1Y2VkRnJhbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dEFjdGlvbktleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJlc3NlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXllckluZGV4XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vVE9ETyBzZXQgdGltZVxuICAgICAgICAgICAgICAgICAgICByb29tLnNlbmQoXCJJTlBVVF9GUkFNRVwiLCB7ZnJhbWU6IGlucHV0RnJhbWUsIHBsYXllckluZGV4fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBsZXQgZGlzcG9zZUlucHV0TGlzdGVuZXI6YW55O1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlTG9iYnlTY3JlZW5TdGF0ZSgpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJoYW5kbGVMb2JieVNjcmVlblN0YXRlXCIsIHJvb20uc3RhdGUudG9KU09OKCksIGNsb25lRGVlcChzdGF0ZSkpO1xuICAgICAgICBsb2dTdGF0ZXMoKTtcbiAgICAgICAgaGFuZGxlV2FpdFRleHQoKTtcbiAgICAgICAgaGFuZGxlRGlzY29ubmVjdFRleHQoKTtcbiAgICAgICAgaGFuZGxlQ3JlYXRlQnV0dG9uVmlzaWJpbGl0eSgpO1xuICAgICAgICBoYW5kbGVKb2luQnV0dG9uVmlzaWJpbGl0eSgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZVdhaXRUZXh0KCl7XG4gICAgICAgICAgICBpZiAoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKSl7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRCYWNrZ3JvdW5kLnNob3coKTtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEVudGl0eS5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2FpdGluZ1RleHRFbnRpdHkuc2V0VGV4dChgPGNvbG9yPSR7TkFNRV9DT0xPUn0+JHtyb29tLnN0YXRlLnBsYXllcnNbMF0/LnVzZXI/LmRpc3BsYXlOYW1lfTwvY29sb3I+IGlzIHdhaXRpbmcgc29tZW9uZSB0byBqb2luIHRoZSBnYW1lLi4uYCk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICB3YWl0aW5nVGV4dEJhY2tncm91bmQuaGlkZSgpO1xuICAgICAgICAgICAgICAgIHdhaXRpbmdUZXh0RW50aXR5LmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZURpc2Nvbm5lY3RUZXh0KCl7XG4gICAgICAgICAgICBpZighc3RhdGUuY29ubmVjdGVkKXtcbiAgICAgICAgICAgICAgICBkaXNjb25uZWN0aW9uVGV4dC5zaG93KClcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3Rpb25UZXh0LmhpZGUoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlQ3JlYXRlQnV0dG9uVmlzaWJpbGl0eSgpe1xuICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5JRExFKVxuICAgICAgICAgICAgICAgICYmIHN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBjcmVhdGVCdXR0b24uc2hvdygpO1xuICAgICAgICAgICAgICAgIGxvYmJ5U2NyZWVuLnNldEJhY2tncm91bmRTcHJpdGUoe1xuICAgICAgICAgICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOiBDT1ZFUl9TUFJJVEVfREVGSU5JVElPTlxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoIWluUm9vbVN0YWdlKEdBTUVfU1RBR0UuSURMRSlcbiAgICAgICAgICAgICAgICB8fCAhc3RhdGUuY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5wbGF5ZXJzLnNvbWUoKHA6YW55KT0+cD8udXNlci51c2VySWQgPT09IHVzZXI/LnVzZXJJZCkpe1xuICAgICAgICAgICAgICAgIGNyZWF0ZUJ1dHRvbi5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVKb2luQnV0dG9uVmlzaWJpbGl0eSgpe1xuICAgICAgICAgICAgaWYoaW5Sb29tU3RhZ2UoR0FNRV9TVEFHRS5XQUlUSU5HX1BMQVlFUl9KT0lOKVxuICAgICAgICAgICAgICAgICYmIHN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBqb2luQnV0dG9uLnNob3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKCFpblJvb21TdGFnZShHQU1FX1NUQUdFLldBSVRJTkdfUExBWUVSX0pPSU4pXG4gICAgICAgICAgICAgICAgfHwgIXN0YXRlLmNvbm5lY3RlZFxuICAgICAgICAgICAgICAgIHx8IHJvb20uc3RhdGUucGxheWVycy5zb21lKChwOmFueSk9PnA/LnVzZXIudXNlcklkID09PSB1c2VyPy51c2VySWQpXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIGpvaW5CdXR0b24uaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWVySW5kZXgoKSB7XG4gICAgICAgIHJldHVybiByb29tLnN0YXRlLnBsYXllcnMuZmluZEluZGV4KChwOiBhbnkpID0+IHA/LnVzZXI/LnVzZXJJZCA9PT0gdXNlcj8udXNlcklkKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBvbkV2ZW50OiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25FdmVudC5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25FdmVudC5zcGxpY2UoY2FsbGJhY2tzLm9uRXZlbnQuaW5kZXhPZihmbiksIDEpXG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0YXRlOigpPT4oey4uLnN0YXRlLCAuLi5yb29tLnN0YXRlLnRvSlNPTigpfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbkNsaWNrSm9pbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJvbkNsaWNrIGpvaW5cIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuICAgICAgICByb29tLnNlbmQoXCJKT0lOX0dBTUVcIiwge3VzZXJ9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ2xpY2tDcmVhdGUoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25DbGljayBjcmVhdGVcIik7XG4gICAgICAgIGxvZ1N0YXRlcygpO1xuXG4gICAgICAgIHJvb20uc2VuZChcIkNSRUFURV9HQU1FXCIsIHt1c2VyfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGxheWVyR2xvYmFsU2NvcmUocGxheWVySW5kZXg6bnVtYmVyKXtcbiAgICAgICAgcmV0dXJuIHJvb20uc3RhdGUubWluaUdhbWVSZXN1bHRzXG4gICAgICAgICAgICAucmVkdWNlKChhY2M6YW55LCBjdXJyZW50OmFueSk9PmN1cnJlbnQgPT09IHBsYXllckluZGV4ID8gKGFjYysxKTphY2MsMClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRHbG9iYWxXaW5uZXIoKXtcbiAgICAgICAgY29uc3QgcGxheWVyMUdsb2JhbFNjb3JlID0gZ2V0UGxheWVyR2xvYmFsU2NvcmUoMCk7XG4gICAgICAgIGNvbnN0IHBsYXllcjJHbG9iYWxTY29yZSA9IGdldFBsYXllckdsb2JhbFNjb3JlKDEpO1xuICAgICAgICBpZihcbiAgICAgICAgICAgICgocGxheWVyMUdsb2JhbFNjb3JlID49IDMgfHwgcGxheWVyMkdsb2JhbFNjb3JlID49IDMpICYmIHBsYXllcjFHbG9iYWxTY29yZSAhPT0gcGxheWVyMkdsb2JhbFNjb3JlKVxuICAgICAgICAgICAgfHwgcm9vbS5zdGF0ZS5taW5pR2FtZVJlc3VsdHMubGVuZ3RoID09PSA1XG4gICAgICAgICl7XG4gICAgICAgICAgICByZXR1cm4gcGxheWVyMUdsb2JhbFNjb3JlPnBsYXllcjJHbG9iYWxTY29yZT8wOjFcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxufVxuIl19