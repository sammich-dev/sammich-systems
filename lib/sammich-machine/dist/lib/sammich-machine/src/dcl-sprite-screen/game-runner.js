import { createSpawner } from "../../../spawner";
import { seedGen } from "../../../seed-gen";
import { createSpriteEntityFactory } from "../../../sprite-entity-factory";
import { FrameEventType } from "../../../frame-util";
import { dclSleep } from "./dcl-sleep";
import { SPRITE_SHEET_DIMENSION } from "../../../sprite-constants";
let _rollbackDone = false;
const DEFAULT_FPS = 60;
const FRAMES_TO_TIE_BREAKER = 60 * 60 * 2;
export const createScreenRunner = ({ screen, timers, seed = 1, GameFactory, onFinish, clientRoom, serverRoom, isClientPlayer, playerIndex, recordFrames, velocityMultiplier = 1 }) => {
    if (serverRoom && clientRoom)
        throw Error("NOT CORRECT");
    const memoize = (fn) => {
        const cache = {};
        return (...args) => {
            let n = args[0];
            if (n in cache) {
                return cache[n];
            }
            else {
                let result = fn(n);
                cache[n] = result;
                return result;
            }
        };
    };
    const memSeedGenCreate = memoize(seedGen.create);
    const fps = GameFactory?.definition?.fps || DEFAULT_FPS;
    const frameMs = 1000 / fps / velocityMultiplier;
    let _debugPanel = null;
    const callbacks = {
        onStart: [],
        onInput: [],
        onFrame: [],
        onFinish: [],
        onDestroy: [],
        onWinner: null,
        onProposedWinner: null
    };
    const state = {
        frames: [],
        running: false,
        destroyed: false,
        startTime: 0,
        lastReproducedFrame: -1,
        tieBreaker: false,
        score: [0, 0]
    };
    if (clientRoom) {
        clientRoom.onStateChange(() => {
            if (clientRoom.state?.players?.length) {
                if (clientRoom.state?.players[0])
                    state.score[0] = clientRoom.state.players[0].miniGameScore;
                if (clientRoom.state?.players[1])
                    state.score[1] = clientRoom.state.players[1].miniGameScore;
            }
        });
    }
    const _snapshots = [{}];
    const spawners = [];
    const awaitingFrames = [];
    const triggerFrame = (n, frame) => {
        spawners.forEach(s => s.frame(n));
        callbacks.onFrame.forEach(f => f(n, frame));
        entityManager.checkColliders();
        if (frame) {
            for (let frameEvent of frame.events) {
                if (frameEvent.type === FrameEventType.INPUT) {
                    const { inputActionKey, isPressed, time, frameNumber } = frameEvent.data;
                    triggerInput(frameEvent.data.playerIndex !== undefined ? frameEvent.data.playerIndex : playerIndex, inputActionKey, isPressed, time, frameNumber);
                }
            }
        }
        const snapshot = {
            frameNumber: state.lastReproducedFrame,
            sprites: getSpriteEntities().map((s) => s.toJSON()),
        };
        _debugPanel?.setState({ "lastSnapshotPositions": getSpriteEntities().map((s) => s.toJSON().position[1]) });
        if (recordFrames)
            _snapshots.push(snapshot);
        let shouldSplitAwait = false;
        if (awaitingFrames?.length) {
            awaitingFrames.forEach(awaitingFrame => {
                const { startedFrame, waitN } = awaitingFrame;
                if ((n - startedFrame) >= waitN) {
                    awaitingFrames.splice(awaitingFrames.indexOf(awaitingFrame), 1);
                    shouldSplitAwait = true;
                    awaitingFrame.resolve();
                }
            });
        }
        if (serverRoom && n > FRAMES_TO_TIE_BREAKER && !state.tieBreaker) {
            console.log("SERVER RUNNER TIE_BREAKER", n, state, GameFactory.definition.alias);
            state.tieBreaker = true;
            const winnerIndex = game.randomInt(0, 1);
            serverRoom.tieBreaker({ winnerIndex });
        }
        return shouldSplitAwait;
    };
    const triggerInput = (playerIndex, inputActionKey, isPressed, time, frameNumber) => {
        callbacks.onInput.forEach(i => i({ inputActionKey, isPressed, time, playerIndex, frameNumber }));
    };
    const entityManager = createSpriteEntityFactory({
        screen,
        serverRoom,
        clientRoom,
        isClientPlayer,
        playerIndex
    });
    const getSpriteEntities = entityManager.getSpriteEntities;
    let frameInterval;
    function pushFrame(_frame) {
        if (_frame.index) {
        }
        const index = state.lastReproducedFrame + 1;
        const frame = {
            index,
            ..._frame
        };
        state.frames.push(frame);
        return frame;
    }
    function pushInputEvent(inputEventRepresentation) {
        const time = inputEventRepresentation.time || (Date.now() - state.startTime);
        const actualFrameNumber = state.lastReproducedFrame + 1;
        const frameNumber = inputEventRepresentation.frameNumber || actualFrameNumber;
        let frame = state.frames.find((f) => f.index === actualFrameNumber);
        const event = {
            type: FrameEventType.INPUT,
            data: {
                time,
                frameNumber,
                ...inputEventRepresentation
            }
        };
        if (frame) {
            frame.events.push(event);
        }
        else {
            frame = pushFrame({
                events: [event]
            });
        }
        return frame;
    }
    const destroy = () => {
        callbacks.onDestroy.forEach(d => d());
        state.destroyed = true;
        console.log("GAME RUNNER DESTROY");
        spawners.forEach(s => s && s.destroy());
        spawners.splice(0, spawners.length);
        entityManager.destroy();
        awaitingFrames.splice(0, awaitingFrames.length);
        _disposeWinnerFn && _disposeWinnerFn();
        stop();
    };
    let _disposeWinnerFn;
    const waitFrames = (n) => {
        const waitingFrame = {
            startedFrame: state.lastReproducedFrame,
            waitN: n,
        };
        const promise = new Promise((resolve, reject) => {
            Object.assign(waitingFrame, { resolve, reject });
        });
        awaitingFrames.push(waitingFrame);
        return promise;
    };
    const setScreenSprite = ({ spriteDefinition }) => screen.setBackgroundSprite({ spriteDefinition });
    const setPlayer1Score = (data) => {
        state.score[0] = data;
        if (serverRoom && serverRoom.state.players[0]) {
            return serverRoom.state.players[0].miniGameScore = data;
        }
    };
    const setPlayer2Score = (data) => {
        state.score[1] = data;
        if (serverRoom && serverRoom.state.players[1]) {
            return serverRoom.state.players[1].miniGameScore = data;
        }
    };
    const gameApi = {
        setScreenSprite,
        waitFrames,
        onStart: (fn) => {
            callbacks.onStart.push(fn);
            return () => callbacks.onStart.splice(callbacks.onStart.indexOf(fn), 1);
        },
        onInput: (fn) => {
            callbacks.onInput.push(fn);
            return () => callbacks.onInput.splice(callbacks.onInput.indexOf(fn), 1);
        },
        onFrame: (fn) => {
            callbacks.onFrame.push(fn);
            return () => callbacks.onFrame.splice(callbacks.onFrame.indexOf(fn), 1);
        },
        onFinish: (fn) => {
            callbacks.onFinish.push(fn);
            return () => callbacks.onFinish.splice(callbacks.onFinish.indexOf(fn), 1);
        },
        onDestroy: (fn) => {
            callbacks.onDestroy.push(fn);
            return () => callbacks.onDestroy.splice(callbacks.onDestroy.indexOf(fn), 1);
        },
        registerSpriteEntity: (options) => entityManager.registerSpriteEntity(options),
        getSpriteEntityKlasses: () => entityManager.getSpriteEntityKlasses(),
        createSpawner: (spriteEntity, options) => {
            const spawner = createSpawner(spriteEntity, options, game);
            spawners.push(spawner);
            return spawner;
        },
        addText: ({ text, pixelPosition, textAlign, fontSize, textColor, layer }) => screen.addText({
            text,
            pixelPosition,
            textAlign,
            fontSize,
            textColor,
            layer
        }),
        setWinnerFn: (fn) => {
            _disposeWinnerFn = serverRoom?.setWinnerFn(fn);
        },
        checkWinners: () => {
            console.log("checkWinners", !!serverRoom, !!clientRoom, playerIndex, state.lastReproducedFrame);
            if (state.tieBreaker)
                return;
            serverRoom?.checkWinners({ playerIndex, n: state.lastReproducedFrame });
        },
        getSpriteEntities,
        random,
        randomInt,
        getRandomFromList: (list) => list[Math.floor(random() * list.length)],
        shuffleList: (list) => {
            const listCopy = [...list];
            const result = [];
            while (listCopy.length) {
                result.push(listCopy.splice(Math.floor(game.random() * list.length), 1)[0]);
            }
            return result;
        },
        reproduceSpriteFrames: (sprite, { loop, stepsPerFrame }) => {
        },
        players: [{
                setPlayerScore: setPlayer1Score,
                getPlayerScore: () => (serverRoom || clientRoom)?.state.players[0]?.miniGameScore || state.score[0]
            }, {
                setPlayerScore: setPlayer2Score,
                getPlayerScore: () => (serverRoom || clientRoom)?.state.players[1]?.miniGameScore || state.score[1]
            }],
        setPlayerScore: (data) => {
            state.score[playerIndex] = data;
            if (serverRoom) {
                serverRoom.state.players[playerIndex].miniGameScore = data;
            }
        },
        getPlayerScore: () => (serverRoom || clientRoom)?.state.players[playerIndex]?.miniGameScore || state.score[playerIndex]
    };
    function random() {
        const _seed = seed;
        const result = memSeedGenCreate(_seed).random();
        return result;
    }
    function randomInt(min, max) {
        return min + Math.floor(game.random() * (max - min + 1));
    }
    const runtimeApi = {
        definition: GameFactory.definition,
        runtime: {
            tieBreaker,
            getPlayerIndex: () => playerIndex,
            onProposedWinner: (fn) => {
                callbacks.onProposedWinner = fn;
                return () => callbacks.onProposedWinner = null;
            },
            onWinner: (fn) => {
                callbacks.onWinner = fn;
                return () => callbacks.onWinner = null;
            },
            attachDebugPanel: (debugPanel) => _debugPanel = debugPanel,
            rollbackToFrame,
            getState: () => state,
            setState: (o) => Object.assign(state, o),
            getFps: () => fps,
            destroy,
            pushInputEvent,
            pushFrame,
            getCurrentFrameNumber: () => {
                return Math.floor((Date.now() - state.startTime) / frameMs);
            },
            reproduceFramesUntil,
            reproduce: (autoPlay = true) => {
                state.running = true;
                timers.clearInterval(frameInterval);
                frameInterval = timers.setInterval(() => reproduceFramesUntil(getFrameNumber(Date.now() - state.startTime)), Math.floor(frameMs));
            },
            start: (autoPlay = true) => {
                console.log("reproduce START__", autoPlay, playerIndex);
                state.running = true;
                state.startTime = Date.now();
                state.frames.push({ index: 0, events: [{ type: "start", time: 0 }] });
                state.lastReproducedFrame = 0;
                if (autoPlay) {
                    frameInterval = timers.setInterval(() => {
                        let currentFrame = getFrameNumber(Date.now() - state.startTime);
                        reproduceFramesUntil(currentFrame);
                        _debugPanel?.setState({
                            spriteEntities: "\n" + getSpriteEntities().map((s) => `${s.klassParams.klass}-${s.ID}-${s.getPixelPosition()[1]}`).join("\n")
                        });
                    }, frameMs);
                }
                callbacks.onStart.forEach(c => c({ seed }));
            },
            finish: () => {
            },
            stop,
            getScreen: () => screen
        }
    };
    async function tieBreaker({ winnerIndex }) {
        const BASE_LAYER = 90;
        const COIN_ANIMATION_FRAME_DELAY = 5;
        const text = game.addText({
            layer: BASE_LAYER + 4,
            pixelPosition: [192 / 2, 20],
            text: "TIE BREAKER\nThe winner is ...",
            fontSize: 0.8,
            textColor: [1, 1, 1, 1],
            textAlign: 1
        });
        const overlaySprite = game.registerSpriteEntity({
            klass: "Overlay",
            spriteDefinition: {
                x: 576,
                y: 128,
                w: 192,
                h: 128,
                ...SPRITE_SHEET_DIMENSION
            }
        }).create({
            pixelPosition: [0, 0],
            layer: BASE_LAYER + 1
        });
        const CoinSprite = game.registerSpriteEntity({
            klass: "Coin",
            spriteDefinition: {
                x: 0, y: 736, w: 32, h: 32, columns: 4, frames: 4,
                ...SPRITE_SHEET_DIMENSION,
            }
        });
        const CoinNumberSprite = game.registerSpriteEntity({
            klass: "CoinNumber",
            spriteDefinition: {
                x: 0, y: 711, w: 32, h: 28, columns: 6, frames: 6,
                ...SPRITE_SHEET_DIMENSION,
            }
        });
        const coinNumber = CoinNumberSprite.create({
            pixelPosition: [192 / 2 - 16, 62],
            layer: BASE_LAYER + 4
        });
        const coin = CoinSprite.create({
            pixelPosition: [192 / 2 - 16, 60],
            layer: BASE_LAYER + 2
        });
        const winnerRound = 6 + winnerIndex;
        const state = {
            round: 0
        };
        const COIN_NUMBER_FRAMES = [
            [3, 4, 5, 0, 1, 2],
            [0, 1, 2, 3, 4, 5],
        ];
        while (state.round < winnerRound) {
            await round();
        }
        text.setText("TIE BREAKER\nThe winner is...\nplayer " + (winnerIndex + 1));
        async function round() {
            const coinNumberFrames = COIN_NUMBER_FRAMES[winnerIndex];
            coin.applyFrame(0);
            coinNumber.applyFrame(coinNumberFrames[0]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            coin.applyFrame(1);
            coinNumber.applyFrame(coinNumberFrames[1]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            coin.applyFrame(2);
            coinNumber.applyFrame(coinNumberFrames[2]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            coin.applyFrame(3);
            coinNumber.hide();
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            coin.applyFrame(2);
            coinNumber.show();
            coinNumber.applyFrame(coinNumberFrames[3]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            coin.applyFrame(1);
            coinNumber.applyFrame(coinNumberFrames[4]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            coin.applyFrame(0);
            coinNumber.applyFrame(coinNumberFrames[3]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);
            state.round++;
        }
        return winnerIndex;
    }
    const game = {
        ...gameApi,
        ...runtimeApi,
    };
    const gameInstance = GameFactory.run({ game });
    return game;
    function stop() {
        state.running = false;
        timers.clearInterval(frameInterval);
    }
    async function reproduceFramesUntil(frameNumber) {
        if (state.destroyed) {
            console.error("//TODO review that reproduceFramesUntil shouldn't be called once destroyed");
            return;
        }
        while (frameNumber > state.lastReproducedFrame) {
            state.lastReproducedFrame++;
            const frame = findFrame(state.lastReproducedFrame);
            if (triggerFrame(state.lastReproducedFrame, frame)) {
                await dclSleep(0);
            }
        }
        if (serverRoom && serverRoom.state.players[playerIndex])
            serverRoom.state.players[playerIndex].lastReproducedFrame = frameNumber;
        _debugPanel?.setState({ _frame: state.lastReproducedFrame });
    }
    function rollbackToFrame(frameNumber) {
        console.log("gameRunner rollbackToFrame", frameNumber);
        const snapshotToRestoreIndex = _snapshots.findIndex(s => s.frameNumber === frameNumber);
        console.log("snapshotToRestoreIndex", snapshotToRestoreIndex);
        const snapshotToRestore = _snapshots[snapshotToRestoreIndex];
        console.log("snapshotToRestore", snapshotToRestore);
        console.log("snapshots", _snapshots);
        const rewindFrames = (state.lastReproducedFrame - frameNumber);
        entityManager.cleanSpriteEntities();
        state.lastReproducedFrame = frameNumber;
        const spriteKlasses = entityManager.getSpriteEntityKlasses();
        snapshotToRestore.sprites.forEach((spriteSnapshot) => {
            const spriteKlass = spriteKlasses.get(spriteSnapshot.klass);
            const createdSpriteEntity = spriteKlass.create({
                ID: spriteSnapshot.ID,
                pixelPosition: spriteSnapshot.position,
                frame: spriteSnapshot.frame,
                network: spriteSnapshot.network,
                layer: spriteSnapshot.layer,
                createParams: spriteSnapshot.createParams
            });
        });
        _debugPanel?.setState({ _frame: state.lastReproducedFrame });
        spawners.forEach(s => s.rollbackToFrame(frameNumber));
        _rollbackDone = true;
    }
    function findFrame(index) {
        return state.frames.find((f) => f.index === index);
    }
    function getFrameNumber(elapsedMs) {
        return Math.floor(elapsedMs / frameMs);
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1ydW5uZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vZ2FtZS1ydW5uZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLGFBQWEsRUFBaUIsTUFBTSxrQkFBa0IsQ0FBQztBQUMvRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFMUMsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDekUsT0FBTyxFQUFvQixjQUFjLEVBQTJCLE1BQU0scUJBQXFCLENBQUM7QUFHaEcsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUNyQyxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUVqRSxJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFVMUIsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3ZCLE1BQU0scUJBQXFCLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFMUMsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxFQUNJLE1BQU0sRUFDTixNQUFNLEVBQ04sSUFBSSxHQUFHLENBQUMsRUFDUixXQUFXLEVBQ1gsUUFBUSxFQUNSLFVBQVUsRUFDVixVQUFVLEVBQ1YsY0FBYyxFQUNkLFdBQVcsRUFDWCxZQUFZLEVBQ1osa0JBQWtCLEdBQUcsQ0FBQyxFQUNwQixFQUFFLEVBQUU7SUFDekMsSUFBSSxVQUFVLElBQUksVUFBVTtRQUFFLE1BQU0sS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRXpELE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBVyxFQUFFLEVBQUU7UUFDNUIsTUFBTSxLQUFLLEdBQU8sRUFBRSxDQUFDO1FBQ3JCLE9BQU8sQ0FBQyxHQUFHLElBQVUsRUFBRSxFQUFFO1lBQ3JCLElBQUksQ0FBQyxHQUFHLElBQUks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QUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsT0FBTyxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDdEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0IsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsT0FBTyxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDdEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0IsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsUUFBUSxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDdkIsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUIsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBQ0QsU0FBUyxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDeEIsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0IsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRixDQUFDO1FBQ0Qsb0JBQW9CLEVBQUUsQ0FBQyxPQUEwQixF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ZXNDb250ZW50IjpbImltcG9ydCB7Y3JlYXRlU3Bhd25lciwgU3Bhd25lck9wdGlvbnN9IGZyb20gXCIuLi8uLi8uLi9zcGF3bmVyXCI7XG5pbXBvcnQge3NlZWRHZW59IGZyb20gXCIuLi8uLi8uLi9zZWVkLWdlblwiO1xuaW1wb3J0IHtTcHJpdGVFbnRpdHksIFNwcml0ZUtsYXNzLCBTcHJpdGVLbGFzc1BhcmFtc30gZnJvbSBcIi4uLy4uLy4uL2dhbWUtZW50aXRpZXNcIjtcbmltcG9ydCB7Y3JlYXRlU3ByaXRlRW50aXR5RmFjdG9yeX0gZnJvbSBcIi4uLy4uLy4uL3Nwcml0ZS1lbnRpdHktZmFjdG9yeVwiO1xuaW1wb3J0IHtGcmFtZSwgRnJhbWVFdmVudCwgRnJhbWVFdmVudFR5cGUsIElucHV0RXZlbnRSZXByZXNlbnRhdGlvbn0gZnJvbSBcIi4uLy4uLy4uL2ZyYW1lLXV0aWxcIjtcbmltcG9ydCB7SW5wdXRBY3Rpb24sIFRleHRBbGlnbk1vZGV9IGZyb20gXCJAZGNsL3Nkay9lY3NcIjtcbmltcG9ydCB7U3ByaXRlRGVmaW5pdGlvblBhcmFtc30gZnJvbSBcIi4vc3ByaXRlLXV0aWxcIjtcbmltcG9ydCB7ZGNsU2xlZXB9IGZyb20gXCIuL2RjbC1zbGVlcFwiO1xuaW1wb3J0IHtTUFJJVEVfU0hFRVRfRElNRU5TSU9OfSBmcm9tIFwiLi4vLi4vLi4vc3ByaXRlLWNvbnN0YW50c1wiO1xuXG5sZXQgX3JvbGxiYWNrRG9uZSA9IGZhbHNlOyAvL1RPRE8gZGVsZXRlLCBvbmx5IGRldlxuZXhwb3J0IHR5cGUgR2FtZVJ1bm5lckNhbGxiYWNrID0ge1xuICAgIG9uU3RhcnQ6IEZ1bmN0aW9uW10sXG4gICAgb25JbnB1dDogRnVuY3Rpb25bXSxcbiAgICBvbkZyYW1lOiBGdW5jdGlvbltdLFxuICAgIG9uRmluaXNoOiBGdW5jdGlvbltdLFxuICAgIG9uRGVzdHJveTogRnVuY3Rpb25bXSxcbiAgICBvbldpbm5lcjpGdW5jdGlvbnxudWxsLFxuICAgIG9uUHJvcG9zZWRXaW5uZXI6IEZ1bmN0aW9uIHwgbnVsbFxufTtcbmNvbnN0IERFRkFVTFRfRlBTID0gNjA7XG5jb25zdCBGUkFNRVNfVE9fVElFX0JSRUFLRVIgPSA2MCAqIDYwICogMjsvLzIgbWludXRlcyBwZXIgZ2FtZSBtYXhpbXVtXG5cbmV4cG9ydCBjb25zdCBjcmVhdGVTY3JlZW5SdW5uZXIgPSAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NyZWVuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VlZCA9IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBHYW1lRmFjdG9yeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uRmluaXNoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpZW50Um9vbSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlclJvb20sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0NsaWVudFBsYXllcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYXllckluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVjb3JkRnJhbWVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHlNdWx0aXBsaWVyID0gMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9OiBhbnkpID0+IHtcbiAgICBpZiAoc2VydmVyUm9vbSAmJiBjbGllbnRSb29tKSB0aHJvdyBFcnJvcihcIk5PVCBDT1JSRUNUXCIpO1xuXG4gICAgY29uc3QgbWVtb2l6ZSA9IChmbjpGdW5jdGlvbikgPT4ge1xuICAgICAgICBjb25zdCBjYWNoZTphbnkgPSB7fTtcbiAgICAgICAgcmV0dXJuICguLi5hcmdzOmFueVtdKSA9PiB7XG4gICAgICAgICAgICBsZXQgbiA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAobiBpbiBjYWNoZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWNoZVtuXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGZuKG4pO1xuICAgICAgICAgICAgICAgIGNhY2hlW25dID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbWVtU2VlZEdlbkNyZWF0ZSA9IG1lbW9pemUoc2VlZEdlbi5jcmVhdGUpOy8vVE9ETyByZXZpZXcgdG8gbWVtb2l6ZSwgYnV0IGNhdXRpb24gd2hlbiBzZXZlcmFsIGluc3RhbmNlcywgYmVjYXVzZSBpdCBzaG91bGQgdXNlIGRpZmZlcmVudCBzZWVkR2VuIG1lbW9pemVlZCBiYXNlZCBvbiBpbnN0YW5jZSBpbmRleFxuICAgIGNvbnN0IGZwcyA9IEdhbWVGYWN0b3J5Py5kZWZpbml0aW9uPy5mcHMgfHwgREVGQVVMVF9GUFM7XG4gICAgY29uc3QgZnJhbWVNcyA9IDEwMDAgLyBmcHMgLyB2ZWxvY2l0eU11bHRpcGxpZXI7XG4gICAgbGV0IF9kZWJ1Z1BhbmVsOiBhbnkgPSBudWxsO1xuXG4gICAgY29uc3QgY2FsbGJhY2tzOiBHYW1lUnVubmVyQ2FsbGJhY2sgPSB7XG4gICAgICAgIG9uU3RhcnQ6IFtdLFxuICAgICAgICBvbklucHV0OiBbXSxcbiAgICAgICAgb25GcmFtZTogW10sXG4gICAgICAgIG9uRmluaXNoOiBbXSxcbiAgICAgICAgb25EZXN0cm95OltdLFxuICAgICAgICBvbldpbm5lcjogbnVsbCxcbiAgICAgICAgb25Qcm9wb3NlZFdpbm5lcjogbnVsbFxuICAgIH07XG5cbiAgICBjb25zdCBzdGF0ZTogYW55ID0ge1xuICAgICAgICBmcmFtZXM6IFtdLFxuICAgICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgICAgZGVzdHJveWVkOiBmYWxzZSxcbiAgICAgICAgc3RhcnRUaW1lOiAwLFxuICAgICAgICBsYXN0UmVwcm9kdWNlZEZyYW1lOiAtMSxcbiAgICAgICAgdGllQnJlYWtlcjpmYWxzZSxcbiAgICAgICAgc2NvcmU6WzAsMF1cbiAgICB9O1xuXG4gICAgaWYoY2xpZW50Um9vbSl7XG4gICAgICAgIGNsaWVudFJvb20ub25TdGF0ZUNoYW5nZSgoKT0+ey8vVE9ETyA/IFJFVklFVyBPUFRJTUlaRSA/XG4gICAgICAgICAgICBpZihjbGllbnRSb29tLnN0YXRlPy5wbGF5ZXJzPy5sZW5ndGgpe1xuICAgICAgICAgICAgICAgIGlmKGNsaWVudFJvb20uc3RhdGU/LnBsYXllcnNbMF0pIHN0YXRlLnNjb3JlWzBdID0gY2xpZW50Um9vbS5zdGF0ZS5wbGF5ZXJzWzBdLm1pbmlHYW1lU2NvcmU7XG4gICAgICAgICAgICAgICAgaWYoY2xpZW50Um9vbS5zdGF0ZT8ucGxheWVyc1sxXSkgc3RhdGUuc2NvcmVbMV0gPSBjbGllbnRSb29tLnN0YXRlLnBsYXllcnNbMV0ubWluaUdhbWVTY29yZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgX3NuYXBzaG90czogYW55W10gPSBbe31dO1xuXG5cbiAgICBjb25zdCBzcGF3bmVyczogYW55W10gPSBbXTtcbiAgICBjb25zdCBhd2FpdGluZ0ZyYW1lczogYW55W10gPSBbXTtcblxuICAgIGNvbnN0IHRyaWdnZXJGcmFtZSA9IChuOiBudW1iZXIsIGZyYW1lOiBhbnkpID0+IHtcbiAgICAgICAgc3Bhd25lcnMuZm9yRWFjaChzID0+IHMuZnJhbWUobikpO1xuICAgICAgICBjYWxsYmFja3Mub25GcmFtZS5mb3JFYWNoKGYgPT4gZihuLCBmcmFtZSkpO1xuICAgICAgICBlbnRpdHlNYW5hZ2VyLmNoZWNrQ29sbGlkZXJzKCk7XG5cbiAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBmcmFtZUV2ZW50IG9mIGZyYW1lLmV2ZW50cykge1xuICAgICAgICAgICAgICAgIGlmIChmcmFtZUV2ZW50LnR5cGUgPT09IEZyYW1lRXZlbnRUeXBlLklOUFVUKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHtpbnB1dEFjdGlvbktleSwgaXNQcmVzc2VkLCB0aW1lLCBmcmFtZU51bWJlcn0gPSBmcmFtZUV2ZW50LmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHRyaWdnZXJJbnB1dChcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRXZlbnQuZGF0YS5wbGF5ZXJJbmRleCE9PXVuZGVmaW5lZD9mcmFtZUV2ZW50LmRhdGEucGxheWVySW5kZXg6cGxheWVySW5kZXggLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRBY3Rpb25LZXksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1ByZXNzZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVOdW1iZXJcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGNvbnN0IHNuYXBzaG90ID0ge1xuICAgICAgICAgICAgZnJhbWVOdW1iZXI6IHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUsXG4gICAgICAgICAgICBzcHJpdGVzOiBnZXRTcHJpdGVFbnRpdGllcygpLm1hcCgoczogU3ByaXRlRW50aXR5KSA9PiBzLnRvSlNPTigpKSxcbiAgICAgICAgfTtcbiAgICAgICAgX2RlYnVnUGFuZWw/LnNldFN0YXRlKHtcImxhc3RTbmFwc2hvdFBvc2l0aW9uc1wiOiBnZXRTcHJpdGVFbnRpdGllcygpLm1hcCgoczogU3ByaXRlRW50aXR5KSA9PiBzLnRvSlNPTigpLnBvc2l0aW9uWzFdKX0pXG5cbiAgICAgICAgaWYgKHJlY29yZEZyYW1lcykgX3NuYXBzaG90cy5wdXNoKHNuYXBzaG90KTtcbiAgICAgICAgbGV0IHNob3VsZFNwbGl0QXdhaXQgPSBmYWxzZTtcbiAgICAgICAgaWYgKGF3YWl0aW5nRnJhbWVzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGF3YWl0aW5nRnJhbWVzLmZvckVhY2goYXdhaXRpbmdGcmFtZSA9PiB7Ly9UT0RPIEZJWCBJVFxuICAgICAgICAgICAgICAgIGNvbnN0IHtzdGFydGVkRnJhbWUsIHdhaXROfSA9IGF3YWl0aW5nRnJhbWU7XG4gICAgICAgICAgICAgICAgaWYgKChuIC0gc3RhcnRlZEZyYW1lKSA+PSB3YWl0Tikge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdGluZ0ZyYW1lcy5zcGxpY2UoYXdhaXRpbmdGcmFtZXMuaW5kZXhPZihhd2FpdGluZ0ZyYW1lKSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHNob3VsZFNwbGl0QXdhaXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdGluZ0ZyYW1lLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHNlcnZlclJvb20gJiYgbiA+IEZSQU1FU19UT19USUVfQlJFQUtFUiAmJiAhc3RhdGUudGllQnJlYWtlcil7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIlNFUlZFUiBSVU5ORVIgVElFX0JSRUFLRVJcIiwgbiwgc3RhdGUsIEdhbWVGYWN0b3J5LmRlZmluaXRpb24uYWxpYXMpO1xuICAgICAgICAgICAgc3RhdGUudGllQnJlYWtlciA9IHRydWU7XG4gICAgICAgICAgICBjb25zdCB3aW5uZXJJbmRleCA9IGdhbWUucmFuZG9tSW50KDAsMSk7XG4gICAgICAgICAgICBzZXJ2ZXJSb29tLnRpZUJyZWFrZXIoe3dpbm5lckluZGV4fSk7Ly9UT0RPIGNoYW5nZSBtZXRob2QgbmFtZSBzZXJ2ZXJSb29tLnRpZUJyZWFrZXI6IHNlcnZlciBicm9hZGNhc3QgVElFX0JSRUFLRVIgd2l0aCB0aGUgd2lubmVyLCBzbyB0aGF0IGNsaWVudCBjYW4gcmVwcm9kdWNlIHRoZSBhbmltYXRpb25cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2hvdWxkU3BsaXRBd2FpdDtcbiAgICB9O1xuXG4gICAgY29uc3QgdHJpZ2dlcklucHV0ID0gKHBsYXllckluZGV4Om51bWJlciwgaW5wdXRBY3Rpb25LZXk6IG51bWJlciwgaXNQcmVzc2VkOiBmYWxzZSB8IG51bWJlciwgdGltZT86IG51bWJlciwgZnJhbWVOdW1iZXI/Om51bWJlcikgPT4ge1xuICAgICAgICBjYWxsYmFja3Mub25JbnB1dC5mb3JFYWNoKGkgPT4gaSh7aW5wdXRBY3Rpb25LZXksIGlzUHJlc3NlZCwgdGltZSwgcGxheWVySW5kZXgsIGZyYW1lTnVtYmVyfSkpO1xuICAgIH1cblxuICAgIGNvbnN0IGVudGl0eU1hbmFnZXIgPSBjcmVhdGVTcHJpdGVFbnRpdHlGYWN0b3J5KHtcbiAgICAgICAgc2NyZWVuLFxuICAgICAgICBzZXJ2ZXJSb29tLFxuICAgICAgICBjbGllbnRSb29tLFxuICAgICAgICBpc0NsaWVudFBsYXllcixcbiAgICAgICAgcGxheWVySW5kZXhcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFNwcml0ZUVudGl0aWVzID0gZW50aXR5TWFuYWdlci5nZXRTcHJpdGVFbnRpdGllcztcblxuICAgIGxldCBmcmFtZUludGVydmFsOiBhbnk7XG5cbiAgICBmdW5jdGlvbiBwdXNoRnJhbWUoX2ZyYW1lOiBhbnkpIHtcbiAgICAgICAgaWYgKF9mcmFtZS5pbmRleCkge1xuICAgICAgICAgICAgLy9UT0RPIFJFVklFVzogTkVYVCBDT01NRU5UUyBNQVlCRSBPUiBOT1RcbiAgICAgICAgICAgIC8vVE9ETyBjaGVjayBhbGwgZXhpc3RlbnQgZnJhbWVzLCB3ZSBzaG91bGQgcHVzaCB0aGUgZnJhbWUgaW4gdGhlIGFwcHJvcHJpYXRlIHBvc2l0aW9uXG4gICAgICAgICAgICAvL1RPRE8gZmluZCBhbnkgZnJhbWVJbmRleCBsb3dlciB0aGFuIHRoZSBuZXcgb25lXG4gICAgICAgICAgICAvL1RPRE8gVE9ETyBmaW5kIGFueSBmcmFtZUluZGV4IGltbWVkaWF0ZWxseSBoaWdoZXIgdGhhbiBuZXcgb25lXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW5kZXggPSBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lICsgMTtcbiAgICAgICAgY29uc3QgZnJhbWU6IEZyYW1lID0ge1xuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICAuLi5fZnJhbWVcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5mcmFtZXMucHVzaChmcmFtZSk7XG4gICAgICAgIHJldHVybiBmcmFtZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwdXNoSW5wdXRFdmVudChpbnB1dEV2ZW50UmVwcmVzZW50YXRpb246IElucHV0RXZlbnRSZXByZXNlbnRhdGlvbik6IEZyYW1lIHtcbiAgICAgICAgY29uc3QgdGltZSA9IGlucHV0RXZlbnRSZXByZXNlbnRhdGlvbi50aW1lIHx8IChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRUaW1lKTtcbiAgICAgICAgY29uc3QgYWN0dWFsRnJhbWVOdW1iZXIgPSBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lICsgMTtcbiAgICAgICAgY29uc3QgZnJhbWVOdW1iZXIgPSBpbnB1dEV2ZW50UmVwcmVzZW50YXRpb24uZnJhbWVOdW1iZXIgfHwgYWN0dWFsRnJhbWVOdW1iZXI7XG5cbiAgICAgICAgbGV0IGZyYW1lOiBGcmFtZSA9IHN0YXRlLmZyYW1lcy5maW5kKChmOiBGcmFtZSkgPT4gZi5pbmRleCA9PT0gYWN0dWFsRnJhbWVOdW1iZXIpO1xuXG4gICAgICAgIGNvbnN0IGV2ZW50OiBGcmFtZUV2ZW50ID0ge1xuICAgICAgICAgICAgdHlwZTogRnJhbWVFdmVudFR5cGUuSU5QVVQsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgdGltZSxcbiAgICAgICAgICAgICAgICBmcmFtZU51bWJlcixcbiAgICAgICAgICAgICAgICAuLi5pbnB1dEV2ZW50UmVwcmVzZW50YXRpb25cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgIGZyYW1lLmV2ZW50cy5wdXNoKGV2ZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyYW1lID0gcHVzaEZyYW1lKHtcbiAgICAgICAgICAgICAgICBldmVudHM6IFtldmVudF1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZyYW1lO1xuICAgIH1cblxuICAgIGNvbnN0IGRlc3Ryb3kgPSAoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrcy5vbkRlc3Ryb3kuZm9yRWFjaChkPT5kKCkpO1xuICAgICAgICBzdGF0ZS5kZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkdBTUUgUlVOTkVSIERFU1RST1lcIik7XG4gICAgICAgIHNwYXduZXJzLmZvckVhY2gocyA9PiBzICYmIHMuZGVzdHJveSgpKTtcbiAgICAgICAgc3Bhd25lcnMuc3BsaWNlKDAsIHNwYXduZXJzLmxlbmd0aClcbiAgICAgICAgZW50aXR5TWFuYWdlci5kZXN0cm95KCk7XG4gICAgICAgIGF3YWl0aW5nRnJhbWVzLnNwbGljZSgwLCBhd2FpdGluZ0ZyYW1lcy5sZW5ndGgpO1xuICAgICAgICBfZGlzcG9zZVdpbm5lckZuICYmIF9kaXNwb3NlV2lubmVyRm4oKTtcbiAgICAgICAgc3RvcCgpO1xuICAgIH07XG4gICAgbGV0IF9kaXNwb3NlV2lubmVyRm46IGFueTtcblxuICAgIGNvbnN0IHdhaXRGcmFtZXMgPSAobjogbnVtYmVyKSA9PiB7XG4gICAgICAgIGNvbnN0IHdhaXRpbmdGcmFtZSA9IHtcbiAgICAgICAgICAgIHN0YXJ0ZWRGcmFtZTogc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSxcbiAgICAgICAgICAgIHdhaXROOiBuLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbih3YWl0aW5nRnJhbWUsIHtyZXNvbHZlLCByZWplY3R9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXRpbmdGcmFtZXMucHVzaCh3YWl0aW5nRnJhbWUpO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH07XG4gICAgY29uc3Qgc2V0U2NyZWVuU3ByaXRlID0gKHtzcHJpdGVEZWZpbml0aW9ufTogU3ByaXRlRGVmaW5pdGlvblBhcmFtcykgPT4gc2NyZWVuLnNldEJhY2tncm91bmRTcHJpdGUoe3Nwcml0ZURlZmluaXRpb259KTtcbiAgICBjb25zdCBzZXRQbGF5ZXIxU2NvcmUgPSAoZGF0YTpudW1iZXIpID0+IHtcbiAgICAgICAgc3RhdGUuc2NvcmVbMF0gPSBkYXRhO1xuICAgICAgICBpZiAoc2VydmVyUm9vbSAmJiBzZXJ2ZXJSb29tLnN0YXRlLnBsYXllcnNbMF0pe1xuICAgICAgICAgICAgcmV0dXJuIHNlcnZlclJvb20uc3RhdGUucGxheWVyc1swXS5taW5pR2FtZVNjb3JlID0gZGF0YTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3Qgc2V0UGxheWVyMlNjb3JlID0gKGRhdGE6bnVtYmVyKSA9PiB7XG4gICAgICAgIHN0YXRlLnNjb3JlWzFdID0gZGF0YTtcbiAgICAgICAgaWYgKHNlcnZlclJvb20gJiYgc2VydmVyUm9vbS5zdGF0ZS5wbGF5ZXJzWzFdKXtcbiAgICAgICAgICAgIHJldHVybiBzZXJ2ZXJSb29tLnN0YXRlLnBsYXllcnNbMV0ubWluaUdhbWVTY29yZSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IGdhbWVBcGkgPSB7XG4gICAgICAgIHNldFNjcmVlblNwcml0ZSxcbiAgICAgICAgd2FpdEZyYW1lcyxcbiAgICAgICAgb25TdGFydDogKGZuOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uU3RhcnQucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gY2FsbGJhY2tzLm9uU3RhcnQuc3BsaWNlKGNhbGxiYWNrcy5vblN0YXJ0LmluZGV4T2YoZm4pLCAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25JbnB1dDogKGZuOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uSW5wdXQucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gY2FsbGJhY2tzLm9uSW5wdXQuc3BsaWNlKGNhbGxiYWNrcy5vbklucHV0LmluZGV4T2YoZm4pLCAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25GcmFtZTogKGZuOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRnJhbWUucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gY2FsbGJhY2tzLm9uRnJhbWUuc3BsaWNlKGNhbGxiYWNrcy5vbkZyYW1lLmluZGV4T2YoZm4pLCAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25GaW5pc2g6IChmbjogRnVuY3Rpb24pID0+IHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vbkZpbmlzaC5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25GaW5pc2guc3BsaWNlKGNhbGxiYWNrcy5vbkZpbmlzaC5pbmRleE9mKGZuKSwgMSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uRGVzdHJveTogKGZuOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRGVzdHJveS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25EZXN0cm95LnNwbGljZShjYWxsYmFja3Mub25EZXN0cm95LmluZGV4T2YoZm4pLCAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVnaXN0ZXJTcHJpdGVFbnRpdHk6IChvcHRpb25zOiBTcHJpdGVLbGFzc1BhcmFtcykgPT4gZW50aXR5TWFuYWdlci5yZWdpc3RlclNwcml0ZUVudGl0eShvcHRpb25zKSxcbiAgICAgICAgZ2V0U3ByaXRlRW50aXR5S2xhc3NlczogKCkgPT4gZW50aXR5TWFuYWdlci5nZXRTcHJpdGVFbnRpdHlLbGFzc2VzKCksXG4gICAgICAgIGNyZWF0ZVNwYXduZXI6IChzcHJpdGVFbnRpdHk6IFNwcml0ZUtsYXNzLCBvcHRpb25zOiBTcGF3bmVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3Bhd25lciA9IGNyZWF0ZVNwYXduZXIoc3ByaXRlRW50aXR5LCBvcHRpb25zLCBnYW1lKTtcbiAgICAgICAgICAgIHNwYXduZXJzLnB1c2goc3Bhd25lcik7XG4gICAgICAgICAgICByZXR1cm4gc3Bhd25lcjtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkVGV4dDogKFxuICAgICAgICAgICAge3RleHQsIHBpeGVsUG9zaXRpb24sIHRleHRBbGlnbiwgZm9udFNpemUsIHRleHRDb2xvciwgbGF5ZXJ9XG4gICAgICAgICAgICAgICAgOiB7IHRleHQ6IHN0cmluZywgdGV4dENvbG9yPzogbnVtYmVyW10sIGZvbnRTaXplPzogbnVtYmVyLCB0ZXh0QWxpZ24/OiBUZXh0QWxpZ25Nb2RlLCBwaXhlbFBvc2l0aW9uOiBudW1iZXJbXSwgbGF5ZXI/OiBudW1iZXIgfSkgPT5cbiAgICAgICAgICAgIHNjcmVlbi5hZGRUZXh0KHtcbiAgICAgICAgICAgICAgICB0ZXh0LFxuICAgICAgICAgICAgICAgIHBpeGVsUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgdGV4dEFsaWduLFxuICAgICAgICAgICAgICAgIGZvbnRTaXplLFxuICAgICAgICAgICAgICAgIHRleHRDb2xvcixcbiAgICAgICAgICAgICAgICBsYXllclxuICAgICAgICAgICAgfSksXG4gICAgICAgIHNldFdpbm5lckZuOiAoZm46IFdpbm5lckZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBfZGlzcG9zZVdpbm5lckZuID0gc2VydmVyUm9vbT8uc2V0V2lubmVyRm4oZm4pO1xuICAgICAgICB9LFxuICAgICAgICBjaGVja1dpbm5lcnM6ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2hlY2tXaW5uZXJzXCIsICEhc2VydmVyUm9vbSwgISFjbGllbnRSb29tLCBwbGF5ZXJJbmRleCwgc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSk7XG4gICAgICAgICAgICBpZihzdGF0ZS50aWVCcmVha2VyKSByZXR1cm47XG4gICAgICAgICAgICBzZXJ2ZXJSb29tPy5jaGVja1dpbm5lcnMoe3BsYXllckluZGV4LCBuOiBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lfSk7Ly9UT0RPIFJFVklFVzogdGhpcyBjYW4gYmUgZXhlY3V0ZWQgZG91YmxlIGR1ZSB0byBib3RoIHNjcmVlblJ1bm5lcnNcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0U3ByaXRlRW50aXRpZXMsXG4gICAgICAgIHJhbmRvbSxcbiAgICAgICAgcmFuZG9tSW50LFxuICAgICAgICBnZXRSYW5kb21Gcm9tTGlzdDogKGxpc3Q6IGFueVtdKSA9PiBsaXN0W01hdGguZmxvb3IocmFuZG9tKCkgKiBsaXN0Lmxlbmd0aCldLFxuICAgICAgICBzaHVmZmxlTGlzdDogKGxpc3Q6IGFueVtdKSA9PiB7Ly9pbW11dGFibGUsIHJldHVybnMgbmV3IGxpc3RcbiAgICAgICAgICAgIGNvbnN0IGxpc3RDb3B5ID0gWy4uLmxpc3RdO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICAgICAgICAgIHdoaWxlIChsaXN0Q29weS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChcbiAgICAgICAgICAgICAgICAgICAgbGlzdENvcHkuc3BsaWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5mbG9vcihnYW1lLnJhbmRvbSgpICogbGlzdC5sZW5ndGgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgMSlbMF1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuICAgICAgICByZXByb2R1Y2VTcHJpdGVGcmFtZXM6KHNwcml0ZTpTcHJpdGVFbnRpdHksIHtsb29wLCBzdGVwc1BlckZyYW1lfTphbnkpPT57Ly9UT0RPXG5cbiAgICAgICAgfSxcbiAgICAgICAgcGxheWVyczogW3svL1RPRE8gb25seSBmb3IgdXNlIHdpdGggc2hhcmVkIHNjcmVlbiwgc2hvdWxkIG5vdCBiZSBpbXBsZW1lbnRlZCBoZXJlLCBidXQgaW4gc2hhcmVkLXNjcmVlbi1ydW5uZXIgP1xuICAgICAgICAgICAgc2V0UGxheWVyU2NvcmU6c2V0UGxheWVyMVNjb3JlLFxuICAgICAgICAgICAgZ2V0UGxheWVyU2NvcmU6KCk9PihzZXJ2ZXJSb29tfHxjbGllbnRSb29tKT8uc3RhdGUucGxheWVyc1swXT8ubWluaUdhbWVTY29yZSB8fCBzdGF0ZS5zY29yZVswXVxuICAgICAgICB9LHtcbiAgICAgICAgICAgIHNldFBsYXllclNjb3JlOnNldFBsYXllcjJTY29yZSxcbiAgICAgICAgICAgIGdldFBsYXllclNjb3JlOigpPT4gKHNlcnZlclJvb218fGNsaWVudFJvb20pPy5zdGF0ZS5wbGF5ZXJzWzFdPy5taW5pR2FtZVNjb3JlIHx8IHN0YXRlLnNjb3JlWzFdXG4gICAgICAgIH1dLFxuICAgICAgICBzZXRQbGF5ZXJTY29yZTogKGRhdGE6IG51bWJlcikgPT4gey8vVE9ETyB0aGlzIHNtZWxscywgc2hvdWxkIG5vdCBiZSB1c2VkIGJ5IHNoYXJlZC1zY3JlZW4sIHNob3VsZCBub3QgYmUgaW1wbGVtZW50ZWQgaGVyZSwgYnV0IGluIHNoYXJlZC1zY3JlZW4tcnVubmVyID9cbiAgICAgICAgICAgIHN0YXRlLnNjb3JlW3BsYXllckluZGV4XSA9IGRhdGE7XG4gICAgICAgICAgICBpZiAoc2VydmVyUm9vbSkge1xuICAgICAgICAgICAgICAgIHNlcnZlclJvb20uc3RhdGUucGxheWVyc1twbGF5ZXJJbmRleF0ubWluaUdhbWVTY29yZSA9IGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldFBsYXllclNjb3JlOiAoKSA9PiAoc2VydmVyUm9vbSB8fCBjbGllbnRSb29tKT8uc3RhdGUucGxheWVyc1twbGF5ZXJJbmRleF0/Lm1pbmlHYW1lU2NvcmUgfHwgc3RhdGUuc2NvcmVbcGxheWVySW5kZXhdXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJhbmRvbSgpIHtcbiAgICAgICAgLy9yYW5kb21UT0RPIFJFVklFVyA6IGxhc3RGcmFtZSBmb3Igc2VlZCB3YXMgZm9yIHJvbGxiYWNrIGZlYXR1cmUsIGNoZWNrIGlmIHN0aWxsIG5lY2Vzc2FyeSBldmVuIHdoZW4gZmVhdHVyZSBpcyBub3QgcmVhZHlcbiAgICAgICAgY29uc3QgX3NlZWQgPSBzZWVkOy8vICsgcnVudGltZUFwaS5ydW50aW1lLmdldFN0YXRlKCkubGFzdFJlcHJvZHVjZWRGcmFtZTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gbWVtU2VlZEdlbkNyZWF0ZShfc2VlZCkucmFuZG9tKCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmFuZG9tSW50KG1pbjpudW1iZXIsIG1heDpudW1iZXIpe1xuICAgICAgICByZXR1cm4gbWluICsgTWF0aC5mbG9vcihnYW1lLnJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKTtcbiAgICB9XG5cbiAgICBjb25zdCBydW50aW1lQXBpID0ge1xuICAgICAgICBkZWZpbml0aW9uOkdhbWVGYWN0b3J5LmRlZmluaXRpb24sXG4gICAgICAgIHJ1bnRpbWU6IHtcbiAgICAgICAgICAgIHRpZUJyZWFrZXIsXG4gICAgICAgICAgICBnZXRQbGF5ZXJJbmRleDogKCkgPT4gcGxheWVySW5kZXgsXG4gICAgICAgICAgICBvblByb3Bvc2VkV2lubmVyOiAoZm46IEZ1bmN0aW9uKTogRnVuY3Rpb24gPT4ge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5vblByb3Bvc2VkV2lubmVyID0gZm47XG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25Qcm9wb3NlZFdpbm5lciA9IG51bGw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25XaW5uZXI6IChmbjogRnVuY3Rpb24pOiBGdW5jdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLm9uV2lubmVyID0gZm47XG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25XaW5uZXIgPSBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGF0dGFjaERlYnVnUGFuZWw6IChkZWJ1Z1BhbmVsOiBhbnkpID0+IF9kZWJ1Z1BhbmVsID0gZGVidWdQYW5lbCxcbiAgICAgICAgICAgIHJvbGxiYWNrVG9GcmFtZSxcbiAgICAgICAgICAgIGdldFN0YXRlOiAoKSA9PiBzdGF0ZSxcbiAgICAgICAgICAgIHNldFN0YXRlOihvOmFueSk9Pk9iamVjdC5hc3NpZ24oc3RhdGUsbyksXG4gICAgICAgICAgICBnZXRGcHM6ICgpID0+IGZwcyxcbiAgICAgICAgICAgIGRlc3Ryb3ksXG4gICAgICAgICAgICBwdXNoSW5wdXRFdmVudCxcbiAgICAgICAgICAgIHB1c2hGcmFtZSxcbiAgICAgICAgICAgIGdldEN1cnJlbnRGcmFtZU51bWJlcjogKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vVE9ETyBSRVZJRVcgQUxMIFVTRVMgRGF0ZS5ub3coKSBkb2VzbnQgd29yayB3ZWxsIHdoZW4gdGhlcmUgaXMgbm90IGF1dG9wbGF5IGFuZC9vciBmcmFtZXMgYXJlIHJlcHJvZHVjZWQgcHJvZ3JhbW1hdGljYWxseVxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRUaW1lKSAvIGZyYW1lTXMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcHJvZHVjZUZyYW1lc1VudGlsLFxuICAgICAgICAgICAgcmVwcm9kdWNlOihhdXRvUGxheSA9IHRydWUpPT57XG4gICAgICAgICAgICAgICAgc3RhdGUucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGltZXJzLmNsZWFySW50ZXJ2YWwoZnJhbWVJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgZnJhbWVJbnRlcnZhbCA9IHRpbWVycy5zZXRJbnRlcnZhbCgoKSA9PiByZXByb2R1Y2VGcmFtZXNVbnRpbChnZXRGcmFtZU51bWJlcihEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRUaW1lKSksTWF0aC5mbG9vcihmcmFtZU1zKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhcnQ6IChhdXRvUGxheTogYm9vbGVhbiA9IHRydWUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlcHJvZHVjZSBTVEFSVF9fXCIsYXV0b1BsYXksIHBsYXllckluZGV4KTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5zdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIHN0YXRlLmZyYW1lcy5wdXNoKHtpbmRleDogMCwgZXZlbnRzOiBbe3R5cGU6IFwic3RhcnRcIiwgdGltZTogMH1dfSk7XG4gICAgICAgICAgICAgICAgc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGF1dG9QbGF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGZyYW1lSW50ZXJ2YWwgPSB0aW1lcnMuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRGcmFtZSA9IGdldEZyYW1lTnVtYmVyKERhdGUubm93KCkgLSBzdGF0ZS5zdGFydFRpbWUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXByb2R1Y2VGcmFtZXNVbnRpbChjdXJyZW50RnJhbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX2RlYnVnUGFuZWw/LnNldFN0YXRlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcHJpdGVFbnRpdGllczogXCJcXG5cIiArIGdldFNwcml0ZUVudGl0aWVzKCkubWFwKChzOiBTcHJpdGVFbnRpdHkpID0+IGAke3Mua2xhc3NQYXJhbXMua2xhc3N9LSR7cy5JRH0tJHtzLmdldFBpeGVsUG9zaXRpb24oKVsxXX1gKS5qb2luKFwiXFxuXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICB9LCBmcmFtZU1zKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjYWxsYmFja3Mub25TdGFydC5mb3JFYWNoKGMgPT4gYyh7c2VlZH0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmaW5pc2g6ICgpID0+IHtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdG9wLFxuICAgICAgICAgICAgZ2V0U2NyZWVuOiAoKSA9PiBzY3JlZW5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIHRpZUJyZWFrZXIoe3dpbm5lckluZGV4fTp7d2lubmVySW5kZXg6bnVtYmVyfSl7XG4gICAgICAgIGNvbnN0IEJBU0VfTEFZRVIgPSA5MDtcbiAgICAgICAgY29uc3QgQ09JTl9BTklNQVRJT05fRlJBTUVfREVMQVkgPSA1O1xuICAgICAgICBjb25zdCB0ZXh0ID0gZ2FtZS5hZGRUZXh0KHtcbiAgICAgICAgICAgIGxheWVyOkJBU0VfTEFZRVIrNCxcbiAgICAgICAgICAgIHBpeGVsUG9zaXRpb246WzE5Mi8yLDIwXSxcbiAgICAgICAgICAgIHRleHQ6XCJUSUUgQlJFQUtFUlxcblRoZSB3aW5uZXIgaXMgLi4uXCIsXG4gICAgICAgICAgICBmb250U2l6ZTowLjgsXG4gICAgICAgICAgICB0ZXh0Q29sb3I6WzEsMSwxLDFdLFxuICAgICAgICAgICAgdGV4dEFsaWduOlRleHRBbGlnbk1vZGUuVEFNX1RPUF9DRU5URVJcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG92ZXJsYXlTcHJpdGUgPSBnYW1lLnJlZ2lzdGVyU3ByaXRlRW50aXR5KHtcbiAgICAgICAgICAgIGtsYXNzOlwiT3ZlcmxheVwiLFxuICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjp7XG4gICAgICAgICAgICAgICAgeDo1NzYsXG4gICAgICAgICAgICAgICAgeToxMjgsXG4gICAgICAgICAgICAgICAgdzoxOTIsXG4gICAgICAgICAgICAgICAgaDoxMjgsXG4gICAgICAgICAgICAgICAgLi4uU1BSSVRFX1NIRUVUX0RJTUVOU0lPTlxuICAgICAgICAgICAgfVxuICAgICAgICB9KS5jcmVhdGUoe1xuICAgICAgICAgICAgcGl4ZWxQb3NpdGlvbjpbMCwwXSxcbiAgICAgICAgICAgIGxheWVyOkJBU0VfTEFZRVIrMVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgQ29pblNwcml0ZSA9IGdhbWUucmVnaXN0ZXJTcHJpdGVFbnRpdHkoe1xuICAgICAgICAgICAga2xhc3M6XCJDb2luXCIsXG4gICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOntcbiAgICAgICAgICAgICAgICB4OjAseTo3MzYsIHc6MzIsIGg6MzIsIGNvbHVtbnM6NCxmcmFtZXM6NCxcbiAgICAgICAgICAgICAgICAuLi5TUFJJVEVfU0hFRVRfRElNRU5TSU9OLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgQ29pbk51bWJlclNwcml0ZSA9IGdhbWUucmVnaXN0ZXJTcHJpdGVFbnRpdHkoe1xuXG4gICAgICAgICAgICBrbGFzczpcIkNvaW5OdW1iZXJcIixcbiAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246e1xuICAgICAgICAgICAgICAgIHg6MCx5OjcxMSwgdzozMiwgaDoyOCwgY29sdW1uczo2LGZyYW1lczo2LFxuICAgICAgICAgICAgICAgIC4uLlNQUklURV9TSEVFVF9ESU1FTlNJT04sXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBjb2luTnVtYmVyID0gQ29pbk51bWJlclNwcml0ZS5jcmVhdGUoe1xuICAgICAgICAgICAgcGl4ZWxQb3NpdGlvbjpbMTkyLzIgLSAxNiwgNjJdLFxuICAgICAgICAgICAgbGF5ZXI6QkFTRV9MQVlFUis0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNvaW4gPSBDb2luU3ByaXRlLmNyZWF0ZSh7XG4gICAgICAgICAgICBwaXhlbFBvc2l0aW9uOlsxOTIvMiAtMTYsNjBdLFxuICAgICAgICAgICAgbGF5ZXI6QkFTRV9MQVlFUisyXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHdpbm5lclJvdW5kID0gNit3aW5uZXJJbmRleDtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICAgICAgICByb3VuZDowXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgQ09JTl9OVU1CRVJfRlJBTUVTID0gW1xuICAgICAgICAgICAgWzMsNCw1LDAsMSwyXSxcbiAgICAgICAgICAgIFswLDEsMiwzLDQsNV0sXG4gICAgICAgIF07XG5cbiAgICAgICAgd2hpbGUoc3RhdGUucm91bmQgPCB3aW5uZXJSb3VuZCl7XG4gICAgICAgICAgICBhd2FpdCByb3VuZCgpO1xuICAgICAgICB9XG4gICAgICAgIHRleHQuc2V0VGV4dChcIlRJRSBCUkVBS0VSXFxuVGhlIHdpbm5lciBpcy4uLlxcbnBsYXllciBcIisod2lubmVySW5kZXgrMSkpXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHJvdW5kKCl7XG4gICAgICAgICAgICBjb25zdCBjb2luTnVtYmVyRnJhbWVzID0gQ09JTl9OVU1CRVJfRlJBTUVTW3dpbm5lckluZGV4XTtcblxuICAgICAgICAgICAgY29pbi5hcHBseUZyYW1lKDApO1xuICAgICAgICAgICAgY29pbk51bWJlci5hcHBseUZyYW1lKGNvaW5OdW1iZXJGcmFtZXNbMF0pO1xuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcblxuXG4gICAgICAgICAgICBjb2luLmFwcGx5RnJhbWUoMSk7XG4gICAgICAgICAgICBjb2luTnVtYmVyLmFwcGx5RnJhbWUoY29pbk51bWJlckZyYW1lc1sxXSk7Ly9UT0RPIE5PVCBXT1JLSU5HIFdFTEwsIFNQUklURSBOT1QgVklTSUIgTEVcblxuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcblxuICAgICAgICAgICAgY29pbi5hcHBseUZyYW1lKDIpO1xuICAgICAgICAgICAgY29pbk51bWJlci5hcHBseUZyYW1lKGNvaW5OdW1iZXJGcmFtZXNbMl0pO1xuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcblxuICAgICAgICAgICAgY29pbi5hcHBseUZyYW1lKDMpO1xuICAgICAgICAgICAgY29pbk51bWJlci5oaWRlKCk7XG5cbiAgICAgICAgICAgIGF3YWl0IGdhbWUud2FpdEZyYW1lcyhDT0lOX0FOSU1BVElPTl9GUkFNRV9ERUxBWSk7XG4gICAgICAgICAgICBjb2luLmFwcGx5RnJhbWUoMik7XG4gICAgICAgICAgICBjb2luTnVtYmVyLnNob3coKTtcbiAgICAgICAgICAgIGNvaW5OdW1iZXIuYXBwbHlGcmFtZShjb2luTnVtYmVyRnJhbWVzWzNdKTtcblxuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcbiAgICAgICAgICAgIGNvaW4uYXBwbHlGcmFtZSgxKTtcbiAgICAgICAgICAgIGNvaW5OdW1iZXIuYXBwbHlGcmFtZShjb2luTnVtYmVyRnJhbWVzWzRdKTtcbiAgICAgICAgICAgIGF3YWl0IGdhbWUud2FpdEZyYW1lcyhDT0lOX0FOSU1BVElPTl9GUkFNRV9ERUxBWSk7XG5cbiAgICAgICAgICAgIGNvaW4uYXBwbHlGcmFtZSgwKTtcbiAgICAgICAgICAgIGNvaW5OdW1iZXIuYXBwbHlGcmFtZShjb2luTnVtYmVyRnJhbWVzWzNdKTtcblxuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcbiAgICAgICAgICAgIHN0YXRlLnJvdW5kKys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gd2lubmVySW5kZXg7XG4gICAgfVxuICAgIGNvbnN0IGdhbWUgPSB7XG4gICAgICAgIC4uLmdhbWVBcGksXG4gICAgICAgIC4uLnJ1bnRpbWVBcGksXG4gICAgfTtcblxuICAgIGNvbnN0IGdhbWVJbnN0YW5jZSA9IEdhbWVGYWN0b3J5LnJ1bih7Z2FtZX0pO1xuXG4gICAgcmV0dXJuIGdhbWU7XG5cbiAgICBmdW5jdGlvbiBzdG9wKCkge1xuICAgICAgICBzdGF0ZS5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRpbWVycy5jbGVhckludGVydmFsKGZyYW1lSW50ZXJ2YWwpO1xuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIHJlcHJvZHVjZUZyYW1lc1VudGlsKGZyYW1lTnVtYmVyOiBudW1iZXIpIHtcbiAgICAgICAgaWYoc3RhdGUuZGVzdHJveWVkKSB7XG4gICAgICAgICAgICAvL1RPRE8gcmV2aWV3IHRoYXQgcmVwcm9kdWNlRnJhbWVzVW50aWwgc2hvdWxkbid0IGJlIGNhbGxlZCBvbmNlIGRlc3Ryb3llZFxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIi8vVE9ETyByZXZpZXcgdGhhdCByZXByb2R1Y2VGcmFtZXNVbnRpbCBzaG91bGRuJ3QgYmUgY2FsbGVkIG9uY2UgZGVzdHJveWVkXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChmcmFtZU51bWJlciA+IHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUpIHtcbiAgICAgICAgICAgIHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUrKztcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lID0gZmluZEZyYW1lKHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodHJpZ2dlckZyYW1lKHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUsIGZyYW1lKSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IGRjbFNsZWVwKDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzZXJ2ZXJSb29tICAmJiBzZXJ2ZXJSb29tLnN0YXRlLnBsYXllcnNbcGxheWVySW5kZXhdKSBzZXJ2ZXJSb29tLnN0YXRlLnBsYXllcnNbcGxheWVySW5kZXhdLmxhc3RSZXByb2R1Y2VkRnJhbWUgPSBmcmFtZU51bWJlcjtcblxuICAgICAgICBfZGVidWdQYW5lbD8uc2V0U3RhdGUoe19mcmFtZTogc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZX0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJvbGxiYWNrVG9GcmFtZShmcmFtZU51bWJlcjogbnVtYmVyKSB7Ly9UT0RPIGJ1Z2d5XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZ2FtZVJ1bm5lciByb2xsYmFja1RvRnJhbWVcIiwgZnJhbWVOdW1iZXIpO1xuICAgICAgICBjb25zdCBzbmFwc2hvdFRvUmVzdG9yZUluZGV4ID0gX3NuYXBzaG90cy5maW5kSW5kZXgocyA9PiBzLmZyYW1lTnVtYmVyID09PSBmcmFtZU51bWJlcik7XG4gICAgICAgIGNvbnNvbGUubG9nKFwic25hcHNob3RUb1Jlc3RvcmVJbmRleFwiLCBzbmFwc2hvdFRvUmVzdG9yZUluZGV4KTtcbiAgICAgICAgY29uc3Qgc25hcHNob3RUb1Jlc3RvcmUgPSBfc25hcHNob3RzW3NuYXBzaG90VG9SZXN0b3JlSW5kZXhdO1xuICAgICAgICBjb25zb2xlLmxvZyhcInNuYXBzaG90VG9SZXN0b3JlXCIsIHNuYXBzaG90VG9SZXN0b3JlKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJzbmFwc2hvdHNcIiwgX3NuYXBzaG90cylcbiAgICAgICAgY29uc3QgcmV3aW5kRnJhbWVzID0gKHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUgLSBmcmFtZU51bWJlcik7XG4gICAgICAgIGVudGl0eU1hbmFnZXIuY2xlYW5TcHJpdGVFbnRpdGllcygpO1xuICAgICAgICAvLyAgc3RhdGUuc3RhcnRUaW1lID0gc3RhdGUuc3RhcnRUaW1lICsgTWF0aC5mbG9vcihyZXdpbmRGcmFtZXMgKiBmcmFtZU1zKTtcblxuICAgICAgICBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lID0gZnJhbWVOdW1iZXI7XG5cbiAgICAgICAgY29uc3Qgc3ByaXRlS2xhc3NlcyA9IGVudGl0eU1hbmFnZXIuZ2V0U3ByaXRlRW50aXR5S2xhc3NlcygpO1xuXG4gICAgICAgIC8vVE9ETyByZWNyZWF0ZSBhbGwgc3ByaXRlcyBzYXZlZCBpbiB0aGUgc25hcHNob3RcbiAgICAgICAgc25hcHNob3RUb1Jlc3RvcmUuc3ByaXRlcy5mb3JFYWNoKChzcHJpdGVTbmFwc2hvdDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzcHJpdGVLbGFzcyA9IHNwcml0ZUtsYXNzZXMuZ2V0KHNwcml0ZVNuYXBzaG90LmtsYXNzKTtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWRTcHJpdGVFbnRpdHkgPSBzcHJpdGVLbGFzcy5jcmVhdGUoe1xuICAgICAgICAgICAgICAgIElEOiBzcHJpdGVTbmFwc2hvdC5JRCxcbiAgICAgICAgICAgICAgICBwaXhlbFBvc2l0aW9uOiBzcHJpdGVTbmFwc2hvdC5wb3NpdGlvbixcbiAgICAgICAgICAgICAgICBmcmFtZTogc3ByaXRlU25hcHNob3QuZnJhbWUsXG4gICAgICAgICAgICAgICAgbmV0d29yazogc3ByaXRlU25hcHNob3QubmV0d29yayxcbiAgICAgICAgICAgICAgICBsYXllcjogc3ByaXRlU25hcHNob3QubGF5ZXIsXG4gICAgICAgICAgICAgICAgY3JlYXRlUGFyYW1zOiBzcHJpdGVTbmFwc2hvdC5jcmVhdGVQYXJhbXNcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9kZWJ1Z1BhbmVsPy5zZXRTdGF0ZSh7X2ZyYW1lOiBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lfSk7XG5cbiAgICAgICAgc3Bhd25lcnMuZm9yRWFjaChzID0+IHMucm9sbGJhY2tUb0ZyYW1lKGZyYW1lTnVtYmVyKSk7XG5cbiAgICAgICAgX3JvbGxiYWNrRG9uZSA9IHRydWU7XG4vL3N0b3AoKVxuICAgICAgICAvLyByZS1jcmVhdGUgYWxsIHRoZSBzcHJpdGVzXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmluZEZyYW1lKGluZGV4OiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmZyYW1lcy5maW5kKChmOiBhbnkpID0+IGYuaW5kZXggPT09IGluZGV4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRGcmFtZU51bWJlcihlbGFwc2VkTXM6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcihlbGFwc2VkTXMgLyBmcmFtZU1zKVxuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgV2lubmVyRnVuY3Rpb24gPSAoKSA9PiB2b2lkIHwgdW5kZWZpbmVkIHwgeyB3aW5uZXJJbmRleDogbnVtYmVyIH07Il19