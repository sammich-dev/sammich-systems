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
                frameInterval = timers.setInterval(() => {
                    let currentFrame = getFrameNumber(Date.now() - state.startTime);
                    reproduceFramesUntil(currentFrame);
                    _debugPanel?.setState({
                        spriteEntities: "\n" + getSpriteEntities().map((s) => `${s.klassParams.klass}-${s.ID}-${s.getPixelPosition()[1]}`).join("\n")
                    });
                }, frameMs);
            },
            start: (autoPlay = true) => {
                console.log("START__", playerIndex);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1ydW5uZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZGNsLXNwcml0ZS1zY3JlZW4vZ2FtZS1ydW5uZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLGFBQWEsRUFBaUIsTUFBTSxrQkFBa0IsQ0FBQztBQUMvRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFMUMsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDekUsT0FBTyxFQUFvQixjQUFjLEVBQTJCLE1BQU0scUJBQXFCLENBQUM7QUFHaEcsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUNyQyxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUVqRSxJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFVMUIsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3ZCLE1BQU0scUJBQXFCLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFMUMsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxFQUNJLE1BQU0sRUFDTixNQUFNLEVBQ04sSUFBSSxHQUFHLENBQUMsRUFDUixXQUFXLEVBQ1gsUUFBUSxFQUNSLFVBQVUsRUFDVixVQUFVLEVBQ1YsY0FBYyxFQUNkLFdBQVcsRUFDWCxZQUFZLEVBQ1osa0JBQWtCLEdBQUcsQ0FBQyxFQUNwQixFQUFFLEVBQUU7SUFDekMsSUFBSSxVQUFVLElBQUksVUFBVTtRQUFFLE1BQU0sS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRXpELE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBVyxFQUFFLEVBQUU7UUFDNUIsTUFBTSxLQUFLLEdBQU8sRUFBRSxDQUFDO1FBQ3JCLE9BQU8sQ0FBQyxHQUFHLElBQVUsRUFBRSxFQUFFO1lBQ3JCLElBQUksQ0FBQyxHQUFHLElBQUks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QUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsT0FBTyxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDdEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0IsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsT0FBTyxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDdEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0IsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsUUFBUSxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDdkIsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUIsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBQ0QsU0FBUyxFQUFFLENBQUMsRUFBWSxFQUFFLEVBQUU7WUFDeEIsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0IsT0FBTyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRixDQUFDO1FBQ0Qsb0JBQW9CLEVBQUUsQ0FBQyxPQUEwQixF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SUFHekIsQ0FBQztJQUVELFNBQVMsU0FBUyxDQUFDLEtBQWE7UUFDNUIsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsU0FBUyxjQUFjLENBQUMsU0FBaUI7UUFDckMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsQ0FBQTtJQUMxQyxDQUFDO0FBQ0wsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtjcmVhdGVTcGF3bmVyLCBTcGF3bmVyT3B0aW9uc30gZnJvbSBcIi4uLy4uLy4uL3NwYXduZXJcIjtcbmltcG9ydCB7c2VlZEdlbn0gZnJvbSBcIi4uLy4uLy4uL3NlZWQtZ2VuXCI7XG5pbXBvcnQge1Nwcml0ZUVudGl0eSwgU3ByaXRlS2xhc3MsIFNwcml0ZUtsYXNzUGFyYW1zfSBmcm9tIFwiLi4vLi4vLi4vZ2FtZS1lbnRpdGllc1wiO1xuaW1wb3J0IHtjcmVhdGVTcHJpdGVFbnRpdHlGYWN0b3J5fSBmcm9tIFwiLi4vLi4vLi4vc3ByaXRlLWVudGl0eS1mYWN0b3J5XCI7XG5pbXBvcnQge0ZyYW1lLCBGcmFtZUV2ZW50LCBGcmFtZUV2ZW50VHlwZSwgSW5wdXRFdmVudFJlcHJlc2VudGF0aW9ufSBmcm9tIFwiLi4vLi4vLi4vZnJhbWUtdXRpbFwiO1xuaW1wb3J0IHtJbnB1dEFjdGlvbiwgVGV4dEFsaWduTW9kZX0gZnJvbSBcIkBkY2wvc2RrL2Vjc1wiO1xuaW1wb3J0IHtTcHJpdGVEZWZpbml0aW9uUGFyYW1zfSBmcm9tIFwiLi9zcHJpdGUtdXRpbFwiO1xuaW1wb3J0IHtkY2xTbGVlcH0gZnJvbSBcIi4vZGNsLXNsZWVwXCI7XG5pbXBvcnQge1NQUklURV9TSEVFVF9ESU1FTlNJT059IGZyb20gXCIuLi8uLi8uLi9zcHJpdGUtY29uc3RhbnRzXCI7XG5cbmxldCBfcm9sbGJhY2tEb25lID0gZmFsc2U7IC8vVE9ETyBkZWxldGUsIG9ubHkgZGV2XG5leHBvcnQgdHlwZSBHYW1lUnVubmVyQ2FsbGJhY2sgPSB7XG4gICAgb25TdGFydDogRnVuY3Rpb25bXSxcbiAgICBvbklucHV0OiBGdW5jdGlvbltdLFxuICAgIG9uRnJhbWU6IEZ1bmN0aW9uW10sXG4gICAgb25GaW5pc2g6IEZ1bmN0aW9uW10sXG4gICAgb25EZXN0cm95OiBGdW5jdGlvbltdLFxuICAgIG9uV2lubmVyOkZ1bmN0aW9ufG51bGwsXG4gICAgb25Qcm9wb3NlZFdpbm5lcjogRnVuY3Rpb24gfCBudWxsXG59O1xuY29uc3QgREVGQVVMVF9GUFMgPSA2MDtcbmNvbnN0IEZSQU1FU19UT19USUVfQlJFQUtFUiA9IDYwICogNjAgKiAyOy8vMiBtaW51dGVzIHBlciBnYW1lIG1heGltdW1cblxuZXhwb3J0IGNvbnN0IGNyZWF0ZVNjcmVlblJ1bm5lciA9ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY3JlZW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWVkID0gMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEdhbWVGYWN0b3J5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GaW5pc2gsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGllbnRSb29tLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyUm9vbSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzQ2xpZW50UGxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxheWVySW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWNvcmRGcmFtZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZWxvY2l0eU11bHRpcGxpZXIgPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH06IGFueSkgPT4ge1xuICAgIGlmIChzZXJ2ZXJSb29tICYmIGNsaWVudFJvb20pIHRocm93IEVycm9yKFwiTk9UIENPUlJFQ1RcIik7XG5cbiAgICBjb25zdCBtZW1vaXplID0gKGZuOkZ1bmN0aW9uKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhY2hlOmFueSA9IHt9O1xuICAgICAgICByZXR1cm4gKC4uLmFyZ3M6YW55W10pID0+IHtcbiAgICAgICAgICAgIGxldCBuID0gYXJnc1swXTtcbiAgICAgICAgICAgIGlmIChuIGluIGNhY2hlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlW25dO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gZm4obik7XG4gICAgICAgICAgICAgICAgY2FjaGVbbl0gPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBtZW1TZWVkR2VuQ3JlYXRlID0gbWVtb2l6ZShzZWVkR2VuLmNyZWF0ZSk7Ly9UT0RPIHJldmlldyB0byBtZW1vaXplLCBidXQgY2F1dGlvbiB3aGVuIHNldmVyYWwgaW5zdGFuY2VzLCBiZWNhdXNlIGl0IHNob3VsZCB1c2UgZGlmZmVyZW50IHNlZWRHZW4gbWVtb2l6ZWVkIGJhc2VkIG9uIGluc3RhbmNlIGluZGV4XG4gICAgY29uc3QgZnBzID0gR2FtZUZhY3Rvcnk/LmRlZmluaXRpb24/LmZwcyB8fCBERUZBVUxUX0ZQUztcbiAgICBjb25zdCBmcmFtZU1zID0gMTAwMCAvIGZwcyAvIHZlbG9jaXR5TXVsdGlwbGllcjtcbiAgICBsZXQgX2RlYnVnUGFuZWw6IGFueSA9IG51bGw7XG5cbiAgICBjb25zdCBjYWxsYmFja3M6IEdhbWVSdW5uZXJDYWxsYmFjayA9IHtcbiAgICAgICAgb25TdGFydDogW10sXG4gICAgICAgIG9uSW5wdXQ6IFtdLFxuICAgICAgICBvbkZyYW1lOiBbXSxcbiAgICAgICAgb25GaW5pc2g6IFtdLFxuICAgICAgICBvbkRlc3Ryb3k6W10sXG4gICAgICAgIG9uV2lubmVyOiBudWxsLFxuICAgICAgICBvblByb3Bvc2VkV2lubmVyOiBudWxsXG4gICAgfTtcblxuICAgIGNvbnN0IHN0YXRlOiBhbnkgPSB7XG4gICAgICAgIGZyYW1lczogW10sXG4gICAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICBkZXN0cm95ZWQ6IGZhbHNlLFxuICAgICAgICBzdGFydFRpbWU6IDAsXG4gICAgICAgIGxhc3RSZXByb2R1Y2VkRnJhbWU6IC0xLFxuICAgICAgICB0aWVCcmVha2VyOmZhbHNlLFxuICAgICAgICBzY29yZTpbMCwwXVxuICAgIH07XG5cbiAgICBpZihjbGllbnRSb29tKXtcbiAgICAgICAgY2xpZW50Um9vbS5vblN0YXRlQ2hhbmdlKCgpPT57Ly9UT0RPID8gUkVWSUVXIE9QVElNSVpFID9cbiAgICAgICAgICAgIGlmKGNsaWVudFJvb20uc3RhdGU/LnBsYXllcnM/Lmxlbmd0aCl7XG4gICAgICAgICAgICAgICAgaWYoY2xpZW50Um9vbS5zdGF0ZT8ucGxheWVyc1swXSkgc3RhdGUuc2NvcmVbMF0gPSBjbGllbnRSb29tLnN0YXRlLnBsYXllcnNbMF0ubWluaUdhbWVTY29yZTtcbiAgICAgICAgICAgICAgICBpZihjbGllbnRSb29tLnN0YXRlPy5wbGF5ZXJzWzFdKSBzdGF0ZS5zY29yZVsxXSA9IGNsaWVudFJvb20uc3RhdGUucGxheWVyc1sxXS5taW5pR2FtZVNjb3JlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBfc25hcHNob3RzOiBhbnlbXSA9IFt7fV07XG5cblxuICAgIGNvbnN0IHNwYXduZXJzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGF3YWl0aW5nRnJhbWVzOiBhbnlbXSA9IFtdO1xuXG4gICAgY29uc3QgdHJpZ2dlckZyYW1lID0gKG46IG51bWJlciwgZnJhbWU6IGFueSkgPT4ge1xuICAgICAgICBzcGF3bmVycy5mb3JFYWNoKHMgPT4gcy5mcmFtZShuKSk7XG4gICAgICAgIGNhbGxiYWNrcy5vbkZyYW1lLmZvckVhY2goZiA9PiBmKG4sIGZyYW1lKSk7XG4gICAgICAgIGVudGl0eU1hbmFnZXIuY2hlY2tDb2xsaWRlcnMoKTtcblxuICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGZyYW1lRXZlbnQgb2YgZnJhbWUuZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lRXZlbnQudHlwZSA9PT0gRnJhbWVFdmVudFR5cGUuSU5QVVQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qge2lucHV0QWN0aW9uS2V5LCBpc1ByZXNzZWQsIHRpbWUsIGZyYW1lTnVtYmVyfSA9IGZyYW1lRXZlbnQuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgdHJpZ2dlcklucHV0KFxuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVFdmVudC5kYXRhLnBsYXllckluZGV4IT09dW5kZWZpbmVkP2ZyYW1lRXZlbnQuZGF0YS5wbGF5ZXJJbmRleDpwbGF5ZXJJbmRleCAsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dEFjdGlvbktleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJlc3NlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZU51bWJlclxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgY29uc3Qgc25hcHNob3QgPSB7XG4gICAgICAgICAgICBmcmFtZU51bWJlcjogc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSxcbiAgICAgICAgICAgIHNwcml0ZXM6IGdldFNwcml0ZUVudGl0aWVzKCkubWFwKChzOiBTcHJpdGVFbnRpdHkpID0+IHMudG9KU09OKCkpLFxuICAgICAgICB9O1xuICAgICAgICBfZGVidWdQYW5lbD8uc2V0U3RhdGUoe1wibGFzdFNuYXBzaG90UG9zaXRpb25zXCI6IGdldFNwcml0ZUVudGl0aWVzKCkubWFwKChzOiBTcHJpdGVFbnRpdHkpID0+IHMudG9KU09OKCkucG9zaXRpb25bMV0pfSlcblxuICAgICAgICBpZiAocmVjb3JkRnJhbWVzKSBfc25hcHNob3RzLnB1c2goc25hcHNob3QpO1xuICAgICAgICBsZXQgc2hvdWxkU3BsaXRBd2FpdCA9IGZhbHNlO1xuICAgICAgICBpZiAoYXdhaXRpbmdGcmFtZXM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgYXdhaXRpbmdGcmFtZXMuZm9yRWFjaChhd2FpdGluZ0ZyYW1lID0+IHsvL1RPRE8gRklYIElUXG4gICAgICAgICAgICAgICAgY29uc3Qge3N0YXJ0ZWRGcmFtZSwgd2FpdE59ID0gYXdhaXRpbmdGcmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoKG4gLSBzdGFydGVkRnJhbWUpID49IHdhaXROKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0aW5nRnJhbWVzLnNwbGljZShhd2FpdGluZ0ZyYW1lcy5pbmRleE9mKGF3YWl0aW5nRnJhbWUpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgc2hvdWxkU3BsaXRBd2FpdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0aW5nRnJhbWUucmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoc2VydmVyUm9vbSAmJiBuID4gRlJBTUVTX1RPX1RJRV9CUkVBS0VSICYmICFzdGF0ZS50aWVCcmVha2VyKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiU0VSVkVSIFJVTk5FUiBUSUVfQlJFQUtFUlwiLCBuLCBzdGF0ZSwgR2FtZUZhY3RvcnkuZGVmaW5pdGlvbi5hbGlhcyk7XG4gICAgICAgICAgICBzdGF0ZS50aWVCcmVha2VyID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnN0IHdpbm5lckluZGV4ID0gZ2FtZS5yYW5kb21JbnQoMCwxKTtcbiAgICAgICAgICAgIHNlcnZlclJvb20udGllQnJlYWtlcih7d2lubmVySW5kZXh9KTsvL1RPRE8gY2hhbmdlIG1ldGhvZCBuYW1lIHNlcnZlclJvb20udGllQnJlYWtlcjogc2VydmVyIGJyb2FkY2FzdCBUSUVfQlJFQUtFUiB3aXRoIHRoZSB3aW5uZXIsIHNvIHRoYXQgY2xpZW50IGNhbiByZXByb2R1Y2UgdGhlIGFuaW1hdGlvblxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzaG91bGRTcGxpdEF3YWl0O1xuICAgIH07XG5cbiAgICBjb25zdCB0cmlnZ2VySW5wdXQgPSAocGxheWVySW5kZXg6bnVtYmVyLCBpbnB1dEFjdGlvbktleTogbnVtYmVyLCBpc1ByZXNzZWQ6IGZhbHNlIHwgbnVtYmVyLCB0aW1lPzogbnVtYmVyLCBmcmFtZU51bWJlcj86bnVtYmVyKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrcy5vbklucHV0LmZvckVhY2goaSA9PiBpKHtpbnB1dEFjdGlvbktleSwgaXNQcmVzc2VkLCB0aW1lLCBwbGF5ZXJJbmRleCwgZnJhbWVOdW1iZXJ9KSk7XG4gICAgfVxuXG4gICAgY29uc3QgZW50aXR5TWFuYWdlciA9IGNyZWF0ZVNwcml0ZUVudGl0eUZhY3Rvcnkoe1xuICAgICAgICBzY3JlZW4sXG4gICAgICAgIHNlcnZlclJvb20sXG4gICAgICAgIGNsaWVudFJvb20sXG4gICAgICAgIGlzQ2xpZW50UGxheWVyLFxuICAgICAgICBwbGF5ZXJJbmRleFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0U3ByaXRlRW50aXRpZXMgPSBlbnRpdHlNYW5hZ2VyLmdldFNwcml0ZUVudGl0aWVzO1xuXG4gICAgbGV0IGZyYW1lSW50ZXJ2YWw6IGFueTtcblxuICAgIGZ1bmN0aW9uIHB1c2hGcmFtZShfZnJhbWU6IGFueSkge1xuICAgICAgICBpZiAoX2ZyYW1lLmluZGV4KSB7XG4gICAgICAgICAgICAvL1RPRE8gUkVWSUVXOiBORVhUIENPTU1FTlRTIE1BWUJFIE9SIE5PVFxuICAgICAgICAgICAgLy9UT0RPIGNoZWNrIGFsbCBleGlzdGVudCBmcmFtZXMsIHdlIHNob3VsZCBwdXNoIHRoZSBmcmFtZSBpbiB0aGUgYXBwcm9wcmlhdGUgcG9zaXRpb25cbiAgICAgICAgICAgIC8vVE9ETyBmaW5kIGFueSBmcmFtZUluZGV4IGxvd2VyIHRoYW4gdGhlIG5ldyBvbmVcbiAgICAgICAgICAgIC8vVE9ETyBUT0RPIGZpbmQgYW55IGZyYW1lSW5kZXggaW1tZWRpYXRlbGx5IGhpZ2hlciB0aGFuIG5ldyBvbmVcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpbmRleCA9IHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUgKyAxO1xuICAgICAgICBjb25zdCBmcmFtZTogRnJhbWUgPSB7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIC4uLl9mcmFtZVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmZyYW1lcy5wdXNoKGZyYW1lKTtcbiAgICAgICAgcmV0dXJuIGZyYW1lO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHB1c2hJbnB1dEV2ZW50KGlucHV0RXZlbnRSZXByZXNlbnRhdGlvbjogSW5wdXRFdmVudFJlcHJlc2VudGF0aW9uKTogRnJhbWUge1xuICAgICAgICBjb25zdCB0aW1lID0gaW5wdXRFdmVudFJlcHJlc2VudGF0aW9uLnRpbWUgfHwgKERhdGUubm93KCkgLSBzdGF0ZS5zdGFydFRpbWUpO1xuICAgICAgICBjb25zdCBhY3R1YWxGcmFtZU51bWJlciA9IHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUgKyAxO1xuICAgICAgICBjb25zdCBmcmFtZU51bWJlciA9IGlucHV0RXZlbnRSZXByZXNlbnRhdGlvbi5mcmFtZU51bWJlciB8fCBhY3R1YWxGcmFtZU51bWJlcjtcblxuICAgICAgICBsZXQgZnJhbWU6IEZyYW1lID0gc3RhdGUuZnJhbWVzLmZpbmQoKGY6IEZyYW1lKSA9PiBmLmluZGV4ID09PSBhY3R1YWxGcmFtZU51bWJlcik7XG5cbiAgICAgICAgY29uc3QgZXZlbnQ6IEZyYW1lRXZlbnQgPSB7XG4gICAgICAgICAgICB0eXBlOiBGcmFtZUV2ZW50VHlwZS5JTlBVVCxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICB0aW1lLFxuICAgICAgICAgICAgICAgIGZyYW1lTnVtYmVyLFxuICAgICAgICAgICAgICAgIC4uLmlucHV0RXZlbnRSZXByZXNlbnRhdGlvblxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgZnJhbWUuZXZlbnRzLnB1c2goZXZlbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWUgPSBwdXNoRnJhbWUoe1xuICAgICAgICAgICAgICAgIGV2ZW50czogW2V2ZW50XVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnJhbWU7XG4gICAgfVxuXG4gICAgY29uc3QgZGVzdHJveSA9ICgpID0+IHtcbiAgICAgICAgY2FsbGJhY2tzLm9uRGVzdHJveS5mb3JFYWNoKGQ9PmQoKSk7XG4gICAgICAgIHN0YXRlLmRlc3Ryb3llZCA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiR0FNRSBSVU5ORVIgREVTVFJPWVwiKTtcbiAgICAgICAgc3Bhd25lcnMuZm9yRWFjaChzID0+IHMgJiYgcy5kZXN0cm95KCkpO1xuICAgICAgICBzcGF3bmVycy5zcGxpY2UoMCwgc3Bhd25lcnMubGVuZ3RoKVxuICAgICAgICBlbnRpdHlNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgYXdhaXRpbmdGcmFtZXMuc3BsaWNlKDAsIGF3YWl0aW5nRnJhbWVzLmxlbmd0aCk7XG4gICAgICAgIF9kaXNwb3NlV2lubmVyRm4gJiYgX2Rpc3Bvc2VXaW5uZXJGbigpO1xuICAgICAgICBzdG9wKCk7XG4gICAgfTtcbiAgICBsZXQgX2Rpc3Bvc2VXaW5uZXJGbjogYW55O1xuXG4gICAgY29uc3Qgd2FpdEZyYW1lcyA9IChuOiBudW1iZXIpID0+IHtcbiAgICAgICAgY29uc3Qgd2FpdGluZ0ZyYW1lID0ge1xuICAgICAgICAgICAgc3RhcnRlZEZyYW1lOiBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lLFxuICAgICAgICAgICAgd2FpdE46IG4sXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKHdhaXRpbmdGcmFtZSwge3Jlc29sdmUsIHJlamVjdH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBhd2FpdGluZ0ZyYW1lcy5wdXNoKHdhaXRpbmdGcmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfTtcbiAgICBjb25zdCBzZXRTY3JlZW5TcHJpdGUgPSAoe3Nwcml0ZURlZmluaXRpb259OiBTcHJpdGVEZWZpbml0aW9uUGFyYW1zKSA9PiBzY3JlZW4uc2V0QmFja2dyb3VuZFNwcml0ZSh7c3ByaXRlRGVmaW5pdGlvbn0pO1xuICAgIGNvbnN0IHNldFBsYXllcjFTY29yZSA9IChkYXRhOm51bWJlcikgPT4ge1xuICAgICAgICBzdGF0ZS5zY29yZVswXSA9IGRhdGE7XG4gICAgICAgIGlmIChzZXJ2ZXJSb29tICYmIHNlcnZlclJvb20uc3RhdGUucGxheWVyc1swXSl7XG4gICAgICAgICAgICByZXR1cm4gc2VydmVyUm9vbS5zdGF0ZS5wbGF5ZXJzWzBdLm1pbmlHYW1lU2NvcmUgPSBkYXRhO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBzZXRQbGF5ZXIyU2NvcmUgPSAoZGF0YTpudW1iZXIpID0+IHtcbiAgICAgICAgc3RhdGUuc2NvcmVbMV0gPSBkYXRhO1xuICAgICAgICBpZiAoc2VydmVyUm9vbSAmJiBzZXJ2ZXJSb29tLnN0YXRlLnBsYXllcnNbMV0pe1xuICAgICAgICAgICAgcmV0dXJuIHNlcnZlclJvb20uc3RhdGUucGxheWVyc1sxXS5taW5pR2FtZVNjb3JlID0gZGF0YTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgZ2FtZUFwaSA9IHtcbiAgICAgICAgc2V0U2NyZWVuU3ByaXRlLFxuICAgICAgICB3YWl0RnJhbWVzLFxuICAgICAgICBvblN0YXJ0OiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25TdGFydC5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25TdGFydC5zcGxpY2UoY2FsbGJhY2tzLm9uU3RhcnQuaW5kZXhPZihmbiksIDEpO1xuICAgICAgICB9LFxuICAgICAgICBvbklucHV0OiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25JbnB1dC5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25JbnB1dC5zcGxpY2UoY2FsbGJhY2tzLm9uSW5wdXQuaW5kZXhPZihmbiksIDEpO1xuICAgICAgICB9LFxuICAgICAgICBvbkZyYW1lOiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25GcmFtZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiBjYWxsYmFja3Mub25GcmFtZS5zcGxpY2UoY2FsbGJhY2tzLm9uRnJhbWUuaW5kZXhPZihmbiksIDEpO1xuICAgICAgICB9LFxuICAgICAgICBvbkZpbmlzaDogKGZuOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRmluaXNoLnB1c2goZm4pO1xuICAgICAgICAgICAgcmV0dXJuICgpID0+IGNhbGxiYWNrcy5vbkZpbmlzaC5zcGxpY2UoY2FsbGJhY2tzLm9uRmluaXNoLmluZGV4T2YoZm4pLCAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25EZXN0cm95OiAoZm46IEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25EZXN0cm95LnB1c2goZm4pO1xuICAgICAgICAgICAgcmV0dXJuICgpID0+IGNhbGxiYWNrcy5vbkRlc3Ryb3kuc3BsaWNlKGNhbGxiYWNrcy5vbkRlc3Ryb3kuaW5kZXhPZihmbiksIDEpO1xuICAgICAgICB9LFxuICAgICAgICByZWdpc3RlclNwcml0ZUVudGl0eTogKG9wdGlvbnM6IFNwcml0ZUtsYXNzUGFyYW1zKSA9PiBlbnRpdHlNYW5hZ2VyLnJlZ2lzdGVyU3ByaXRlRW50aXR5KG9wdGlvbnMpLFxuICAgICAgICBnZXRTcHJpdGVFbnRpdHlLbGFzc2VzOiAoKSA9PiBlbnRpdHlNYW5hZ2VyLmdldFNwcml0ZUVudGl0eUtsYXNzZXMoKSxcbiAgICAgICAgY3JlYXRlU3Bhd25lcjogKHNwcml0ZUVudGl0eTogU3ByaXRlS2xhc3MsIG9wdGlvbnM6IFNwYXduZXJPcHRpb25zKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzcGF3bmVyID0gY3JlYXRlU3Bhd25lcihzcHJpdGVFbnRpdHksIG9wdGlvbnMsIGdhbWUpO1xuICAgICAgICAgICAgc3Bhd25lcnMucHVzaChzcGF3bmVyKTtcbiAgICAgICAgICAgIHJldHVybiBzcGF3bmVyO1xuICAgICAgICB9LFxuICAgICAgICBhZGRUZXh0OiAoXG4gICAgICAgICAgICB7dGV4dCwgcGl4ZWxQb3NpdGlvbiwgdGV4dEFsaWduLCBmb250U2l6ZSwgdGV4dENvbG9yLCBsYXllcn1cbiAgICAgICAgICAgICAgICA6IHsgdGV4dDogc3RyaW5nLCB0ZXh0Q29sb3I/OiBudW1iZXJbXSwgZm9udFNpemU/OiBudW1iZXIsIHRleHRBbGlnbj86IFRleHRBbGlnbk1vZGUsIHBpeGVsUG9zaXRpb246IG51bWJlcltdLCBsYXllcj86IG51bWJlciB9KSA9PlxuICAgICAgICAgICAgc2NyZWVuLmFkZFRleHQoe1xuICAgICAgICAgICAgICAgIHRleHQsXG4gICAgICAgICAgICAgICAgcGl4ZWxQb3NpdGlvbixcbiAgICAgICAgICAgICAgICB0ZXh0QWxpZ24sXG4gICAgICAgICAgICAgICAgZm9udFNpemUsXG4gICAgICAgICAgICAgICAgdGV4dENvbG9yLFxuICAgICAgICAgICAgICAgIGxheWVyXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgc2V0V2lubmVyRm46IChmbjogV2lubmVyRnVuY3Rpb24pID0+IHtcbiAgICAgICAgICAgIF9kaXNwb3NlV2lubmVyRm4gPSBzZXJ2ZXJSb29tPy5zZXRXaW5uZXJGbihmbik7XG4gICAgICAgIH0sXG4gICAgICAgIGNoZWNrV2lubmVyczogKCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJjaGVja1dpbm5lcnNcIiwgISFzZXJ2ZXJSb29tLCAhIWNsaWVudFJvb20sIHBsYXllckluZGV4LCBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lKTtcbiAgICAgICAgICAgIGlmKHN0YXRlLnRpZUJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgICAgIHNlcnZlclJvb20/LmNoZWNrV2lubmVycyh7cGxheWVySW5kZXgsIG46IHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWV9KTsvL1RPRE8gUkVWSUVXOiB0aGlzIGNhbiBiZSBleGVjdXRlZCBkb3VibGUgZHVlIHRvIGJvdGggc2NyZWVuUnVubmVyc1xuICAgICAgICB9LFxuICAgICAgICBnZXRTcHJpdGVFbnRpdGllcyxcbiAgICAgICAgcmFuZG9tLFxuICAgICAgICByYW5kb21JbnQsXG4gICAgICAgIGdldFJhbmRvbUZyb21MaXN0OiAobGlzdDogYW55W10pID0+IGxpc3RbTWF0aC5mbG9vcihyYW5kb20oKSAqIGxpc3QubGVuZ3RoKV0sXG4gICAgICAgIHNodWZmbGVMaXN0OiAobGlzdDogYW55W10pID0+IHsvL2ltbXV0YWJsZSwgcmV0dXJucyBuZXcgbGlzdFxuICAgICAgICAgICAgY29uc3QgbGlzdENvcHkgPSBbLi4ubGlzdF07XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgICAgICAgICAgd2hpbGUgKGxpc3RDb3B5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBsaXN0Q29weS5zcGxpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmZsb29yKGdhbWUucmFuZG9tKCkgKiBsaXN0Lmxlbmd0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICAxKVswXVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHJlcHJvZHVjZVNwcml0ZUZyYW1lczooc3ByaXRlOlNwcml0ZUVudGl0eSwge2xvb3AsIHN0ZXBzUGVyRnJhbWV9OmFueSk9PnsvL1RPRE9cblxuICAgICAgICB9LFxuICAgICAgICBwbGF5ZXJzOiBbey8vVE9ETyBvbmx5IGZvciB1c2Ugd2l0aCBzaGFyZWQgc2NyZWVuLCBzaG91bGQgbm90IGJlIGltcGxlbWVudGVkIGhlcmUsIGJ1dCBpbiBzaGFyZWQtc2NyZWVuLXJ1bm5lciA/XG4gICAgICAgICAgICBzZXRQbGF5ZXJTY29yZTpzZXRQbGF5ZXIxU2NvcmUsXG4gICAgICAgICAgICBnZXRQbGF5ZXJTY29yZTooKT0+KHNlcnZlclJvb218fGNsaWVudFJvb20pPy5zdGF0ZS5wbGF5ZXJzWzBdPy5taW5pR2FtZVNjb3JlIHx8IHN0YXRlLnNjb3JlWzBdXG4gICAgICAgIH0se1xuICAgICAgICAgICAgc2V0UGxheWVyU2NvcmU6c2V0UGxheWVyMlNjb3JlLFxuICAgICAgICAgICAgZ2V0UGxheWVyU2NvcmU6KCk9PiAoc2VydmVyUm9vbXx8Y2xpZW50Um9vbSk/LnN0YXRlLnBsYXllcnNbMV0/Lm1pbmlHYW1lU2NvcmUgfHwgc3RhdGUuc2NvcmVbMV1cbiAgICAgICAgfV0sXG4gICAgICAgIHNldFBsYXllclNjb3JlOiAoZGF0YTogbnVtYmVyKSA9PiB7Ly9UT0RPIHRoaXMgc21lbGxzLCBzaG91bGQgbm90IGJlIHVzZWQgYnkgc2hhcmVkLXNjcmVlbiwgc2hvdWxkIG5vdCBiZSBpbXBsZW1lbnRlZCBoZXJlLCBidXQgaW4gc2hhcmVkLXNjcmVlbi1ydW5uZXIgP1xuICAgICAgICAgICAgc3RhdGUuc2NvcmVbcGxheWVySW5kZXhdID0gZGF0YTtcbiAgICAgICAgICAgIGlmIChzZXJ2ZXJSb29tKSB7XG4gICAgICAgICAgICAgICAgc2VydmVyUm9vbS5zdGF0ZS5wbGF5ZXJzW3BsYXllckluZGV4XS5taW5pR2FtZVNjb3JlID0gZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZ2V0UGxheWVyU2NvcmU6ICgpID0+IChzZXJ2ZXJSb29tIHx8IGNsaWVudFJvb20pPy5zdGF0ZS5wbGF5ZXJzW3BsYXllckluZGV4XT8ubWluaUdhbWVTY29yZSB8fCBzdGF0ZS5zY29yZVtwbGF5ZXJJbmRleF1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gcmFuZG9tKCkge1xuICAgICAgICAvL3JhbmRvbVRPRE8gUkVWSUVXIDogbGFzdEZyYW1lIGZvciBzZWVkIHdhcyBmb3Igcm9sbGJhY2sgZmVhdHVyZSwgY2hlY2sgaWYgc3RpbGwgbmVjZXNzYXJ5IGV2ZW4gd2hlbiBmZWF0dXJlIGlzIG5vdCByZWFkeVxuICAgICAgICBjb25zdCBfc2VlZCA9IHNlZWQ7Ly8gKyBydW50aW1lQXBpLnJ1bnRpbWUuZ2V0U3RhdGUoKS5sYXN0UmVwcm9kdWNlZEZyYW1lO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBtZW1TZWVkR2VuQ3JlYXRlKF9zZWVkKS5yYW5kb20oKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByYW5kb21JbnQobWluOm51bWJlciwgbWF4Om51bWJlcil7XG4gICAgICAgIHJldHVybiBtaW4gKyBNYXRoLmZsb29yKGdhbWUucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpO1xuICAgIH1cblxuICAgIGNvbnN0IHJ1bnRpbWVBcGkgPSB7XG4gICAgICAgIGRlZmluaXRpb246R2FtZUZhY3RvcnkuZGVmaW5pdGlvbixcbiAgICAgICAgcnVudGltZToge1xuICAgICAgICAgICAgdGllQnJlYWtlcixcbiAgICAgICAgICAgIGdldFBsYXllckluZGV4OiAoKSA9PiBwbGF5ZXJJbmRleCxcbiAgICAgICAgICAgIG9uUHJvcG9zZWRXaW5uZXI6IChmbjogRnVuY3Rpb24pOiBGdW5jdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLm9uUHJvcG9zZWRXaW5uZXIgPSBmbjtcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgcmV0dXJuICgpID0+IGNhbGxiYWNrcy5vblByb3Bvc2VkV2lubmVyID0gbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbldpbm5lcjogKGZuOiBGdW5jdGlvbik6IEZ1bmN0aW9uID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3Mub25XaW5uZXIgPSBmbjtcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgcmV0dXJuICgpID0+IGNhbGxiYWNrcy5vbldpbm5lciA9IG51bGw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXR0YWNoRGVidWdQYW5lbDogKGRlYnVnUGFuZWw6IGFueSkgPT4gX2RlYnVnUGFuZWwgPSBkZWJ1Z1BhbmVsLFxuICAgICAgICAgICAgcm9sbGJhY2tUb0ZyYW1lLFxuICAgICAgICAgICAgZ2V0U3RhdGU6ICgpID0+IHN0YXRlLFxuICAgICAgICAgICAgc2V0U3RhdGU6KG86YW55KT0+T2JqZWN0LmFzc2lnbihzdGF0ZSxvKSxcbiAgICAgICAgICAgIGdldEZwczogKCkgPT4gZnBzLFxuICAgICAgICAgICAgZGVzdHJveSxcbiAgICAgICAgICAgIHB1c2hJbnB1dEV2ZW50LFxuICAgICAgICAgICAgcHVzaEZyYW1lLFxuICAgICAgICAgICAgZ2V0Q3VycmVudEZyYW1lTnVtYmVyOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9UT0RPIFJFVklFVyBBTEwgVVNFUyBEYXRlLm5vdygpIGRvZXNudCB3b3JrIHdlbGwgd2hlbiB0aGVyZSBpcyBub3QgYXV0b3BsYXkgYW5kL29yIGZyYW1lcyBhcmUgcmVwcm9kdWNlZCBwcm9ncmFtbWF0aWNhbGx5XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKERhdGUubm93KCkgLSBzdGF0ZS5zdGFydFRpbWUpIC8gZnJhbWVNcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVwcm9kdWNlRnJhbWVzVW50aWwsXG4gICAgICAgICAgICByZXByb2R1Y2U6KGF1dG9QbGF5ID0gdHJ1ZSk9PntcbiAgICAgICAgICAgICAgICBzdGF0ZS5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aW1lcnMuY2xlYXJJbnRlcnZhbChmcmFtZUludGVydmFsKTtcbiAgICAgICAgICAgICAgICBmcmFtZUludGVydmFsID0gdGltZXJzLnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRGcmFtZSA9IGdldEZyYW1lTnVtYmVyKERhdGUubm93KCkgLSBzdGF0ZS5zdGFydFRpbWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJlcHJvZHVjZUZyYW1lc1VudGlsKGN1cnJlbnRGcmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIF9kZWJ1Z1BhbmVsPy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcHJpdGVFbnRpdGllczogXCJcXG5cIiArIGdldFNwcml0ZUVudGl0aWVzKCkubWFwKChzOiBTcHJpdGVFbnRpdHkpID0+IGAke3Mua2xhc3NQYXJhbXMua2xhc3N9LSR7cy5JRH0tJHtzLmdldFBpeGVsUG9zaXRpb24oKVsxXX1gKS5qb2luKFwiXFxuXCIpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfSwgZnJhbWVNcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhcnQ6IChhdXRvUGxheTogYm9vbGVhbiA9IHRydWUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlNUQVJUX19cIiwgcGxheWVySW5kZXgpO1xuICAgICAgICAgICAgICAgIHN0YXRlLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHN0YXRlLnN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgc3RhdGUuZnJhbWVzLnB1c2goe2luZGV4OiAwLCBldmVudHM6IFt7dHlwZTogXCJzdGFydFwiLCB0aW1lOiAwfV19KTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoYXV0b1BsYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVJbnRlcnZhbCA9IHRpbWVycy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudEZyYW1lID0gZ2V0RnJhbWVOdW1iZXIoRGF0ZS5ub3coKSAtIHN0YXRlLnN0YXJ0VGltZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcHJvZHVjZUZyYW1lc1VudGlsKGN1cnJlbnRGcmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfZGVidWdQYW5lbD8uc2V0U3RhdGUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwcml0ZUVudGl0aWVzOiBcIlxcblwiICsgZ2V0U3ByaXRlRW50aXRpZXMoKS5tYXAoKHM6IFNwcml0ZUVudGl0eSkgPT4gYCR7cy5rbGFzc1BhcmFtcy5rbGFzc30tJHtzLklEfS0ke3MuZ2V0UGl4ZWxQb3NpdGlvbigpWzFdfWApLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0sIGZyYW1lTXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5vblN0YXJ0LmZvckVhY2goYyA9PiBjKHtzZWVkfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZpbmlzaDogKCkgPT4ge1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0b3AsXG4gICAgICAgICAgICBnZXRTY3JlZW46ICgpID0+IHNjcmVlblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gdGllQnJlYWtlcih7d2lubmVySW5kZXh9Ont3aW5uZXJJbmRleDpudW1iZXJ9KXtcbiAgICAgICAgY29uc3QgQkFTRV9MQVlFUiA9IDkwO1xuICAgICAgICBjb25zdCBDT0lOX0FOSU1BVElPTl9GUkFNRV9ERUxBWSA9IDU7XG4gICAgICAgIGNvbnN0IHRleHQgPSBnYW1lLmFkZFRleHQoe1xuICAgICAgICAgICAgbGF5ZXI6QkFTRV9MQVlFUis0LFxuICAgICAgICAgICAgcGl4ZWxQb3NpdGlvbjpbMTkyLzIsMjBdLFxuICAgICAgICAgICAgdGV4dDpcIlRJRSBCUkVBS0VSXFxuVGhlIHdpbm5lciBpcyAuLi5cIixcbiAgICAgICAgICAgIGZvbnRTaXplOjAuOCxcbiAgICAgICAgICAgIHRleHRDb2xvcjpbMSwxLDEsMV0sXG4gICAgICAgICAgICB0ZXh0QWxpZ246VGV4dEFsaWduTW9kZS5UQU1fVE9QX0NFTlRFUlxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgb3ZlcmxheVNwcml0ZSA9IGdhbWUucmVnaXN0ZXJTcHJpdGVFbnRpdHkoe1xuICAgICAgICAgICAga2xhc3M6XCJPdmVybGF5XCIsXG4gICAgICAgICAgICBzcHJpdGVEZWZpbml0aW9uOntcbiAgICAgICAgICAgICAgICB4OjU3NixcbiAgICAgICAgICAgICAgICB5OjEyOCxcbiAgICAgICAgICAgICAgICB3OjE5MixcbiAgICAgICAgICAgICAgICBoOjEyOCxcbiAgICAgICAgICAgICAgICAuLi5TUFJJVEVfU0hFRVRfRElNRU5TSU9OXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLmNyZWF0ZSh7XG4gICAgICAgICAgICBwaXhlbFBvc2l0aW9uOlswLDBdLFxuICAgICAgICAgICAgbGF5ZXI6QkFTRV9MQVlFUisxXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBDb2luU3ByaXRlID0gZ2FtZS5yZWdpc3RlclNwcml0ZUVudGl0eSh7XG4gICAgICAgICAgICBrbGFzczpcIkNvaW5cIixcbiAgICAgICAgICAgIHNwcml0ZURlZmluaXRpb246e1xuICAgICAgICAgICAgICAgIHg6MCx5OjczNiwgdzozMiwgaDozMiwgY29sdW1uczo0LGZyYW1lczo0LFxuICAgICAgICAgICAgICAgIC4uLlNQUklURV9TSEVFVF9ESU1FTlNJT04sXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBDb2luTnVtYmVyU3ByaXRlID0gZ2FtZS5yZWdpc3RlclNwcml0ZUVudGl0eSh7XG5cbiAgICAgICAgICAgIGtsYXNzOlwiQ29pbk51bWJlclwiLFxuICAgICAgICAgICAgc3ByaXRlRGVmaW5pdGlvbjp7XG4gICAgICAgICAgICAgICAgeDowLHk6NzExLCB3OjMyLCBoOjI4LCBjb2x1bW5zOjYsZnJhbWVzOjYsXG4gICAgICAgICAgICAgICAgLi4uU1BSSVRFX1NIRUVUX0RJTUVOU0lPTixcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGNvaW5OdW1iZXIgPSBDb2luTnVtYmVyU3ByaXRlLmNyZWF0ZSh7XG4gICAgICAgICAgICBwaXhlbFBvc2l0aW9uOlsxOTIvMiAtIDE2LCA2Ml0sXG4gICAgICAgICAgICBsYXllcjpCQVNFX0xBWUVSKzRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY29pbiA9IENvaW5TcHJpdGUuY3JlYXRlKHtcbiAgICAgICAgICAgIHBpeGVsUG9zaXRpb246WzE5Mi8yIC0xNiw2MF0sXG4gICAgICAgICAgICBsYXllcjpCQVNFX0xBWUVSKzJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgd2lubmVyUm91bmQgPSA2K3dpbm5lckluZGV4O1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHtcbiAgICAgICAgICAgIHJvdW5kOjBcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBDT0lOX05VTUJFUl9GUkFNRVMgPSBbXG4gICAgICAgICAgICBbMyw0LDUsMCwxLDJdLFxuICAgICAgICAgICAgWzAsMSwyLDMsNCw1XSxcbiAgICAgICAgXTtcblxuICAgICAgICB3aGlsZShzdGF0ZS5yb3VuZCA8IHdpbm5lclJvdW5kKXtcbiAgICAgICAgICAgIGF3YWl0IHJvdW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGV4dC5zZXRUZXh0KFwiVElFIEJSRUFLRVJcXG5UaGUgd2lubmVyIGlzLi4uXFxucGxheWVyIFwiKyh3aW5uZXJJbmRleCsxKSlcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcm91bmQoKXtcbiAgICAgICAgICAgIGNvbnN0IGNvaW5OdW1iZXJGcmFtZXMgPSBDT0lOX05VTUJFUl9GUkFNRVNbd2lubmVySW5kZXhdO1xuXG4gICAgICAgICAgICBjb2luLmFwcGx5RnJhbWUoMCk7XG4gICAgICAgICAgICBjb2luTnVtYmVyLmFwcGx5RnJhbWUoY29pbk51bWJlckZyYW1lc1swXSk7XG4gICAgICAgICAgICBhd2FpdCBnYW1lLndhaXRGcmFtZXMoQ09JTl9BTklNQVRJT05fRlJBTUVfREVMQVkpO1xuXG5cbiAgICAgICAgICAgIGNvaW4uYXBwbHlGcmFtZSgxKTtcbiAgICAgICAgICAgIGNvaW5OdW1iZXIuYXBwbHlGcmFtZShjb2luTnVtYmVyRnJhbWVzWzFdKTsvL1RPRE8gTk9UIFdPUktJTkcgV0VMTCwgU1BSSVRFIE5PVCBWSVNJQiBMRVxuXG4gICAgICAgICAgICBhd2FpdCBnYW1lLndhaXRGcmFtZXMoQ09JTl9BTklNQVRJT05fRlJBTUVfREVMQVkpO1xuXG4gICAgICAgICAgICBjb2luLmFwcGx5RnJhbWUoMik7XG4gICAgICAgICAgICBjb2luTnVtYmVyLmFwcGx5RnJhbWUoY29pbk51bWJlckZyYW1lc1syXSk7XG4gICAgICAgICAgICBhd2FpdCBnYW1lLndhaXRGcmFtZXMoQ09JTl9BTklNQVRJT05fRlJBTUVfREVMQVkpO1xuXG4gICAgICAgICAgICBjb2luLmFwcGx5RnJhbWUoMyk7XG4gICAgICAgICAgICBjb2luTnVtYmVyLmhpZGUoKTtcblxuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcbiAgICAgICAgICAgIGNvaW4uYXBwbHlGcmFtZSgyKTtcbiAgICAgICAgICAgIGNvaW5OdW1iZXIuc2hvdygpO1xuICAgICAgICAgICAgY29pbk51bWJlci5hcHBseUZyYW1lKGNvaW5OdW1iZXJGcmFtZXNbM10pO1xuXG4gICAgICAgICAgICBhd2FpdCBnYW1lLndhaXRGcmFtZXMoQ09JTl9BTklNQVRJT05fRlJBTUVfREVMQVkpO1xuICAgICAgICAgICAgY29pbi5hcHBseUZyYW1lKDEpO1xuICAgICAgICAgICAgY29pbk51bWJlci5hcHBseUZyYW1lKGNvaW5OdW1iZXJGcmFtZXNbNF0pO1xuICAgICAgICAgICAgYXdhaXQgZ2FtZS53YWl0RnJhbWVzKENPSU5fQU5JTUFUSU9OX0ZSQU1FX0RFTEFZKTtcblxuICAgICAgICAgICAgY29pbi5hcHBseUZyYW1lKDApO1xuICAgICAgICAgICAgY29pbk51bWJlci5hcHBseUZyYW1lKGNvaW5OdW1iZXJGcmFtZXNbM10pO1xuXG4gICAgICAgICAgICBhd2FpdCBnYW1lLndhaXRGcmFtZXMoQ09JTl9BTklNQVRJT05fRlJBTUVfREVMQVkpO1xuICAgICAgICAgICAgc3RhdGUucm91bmQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB3aW5uZXJJbmRleDtcbiAgICB9XG4gICAgY29uc3QgZ2FtZSA9IHtcbiAgICAgICAgLi4uZ2FtZUFwaSxcbiAgICAgICAgLi4ucnVudGltZUFwaSxcbiAgICB9O1xuXG4gICAgY29uc3QgZ2FtZUluc3RhbmNlID0gR2FtZUZhY3RvcnkucnVuKHtnYW1lfSk7XG5cbiAgICByZXR1cm4gZ2FtZTtcblxuICAgIGZ1bmN0aW9uIHN0b3AoKSB7XG4gICAgICAgIHN0YXRlLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGltZXJzLmNsZWFySW50ZXJ2YWwoZnJhbWVJbnRlcnZhbCk7XG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gcmVwcm9kdWNlRnJhbWVzVW50aWwoZnJhbWVOdW1iZXI6IG51bWJlcikge1xuICAgICAgICBpZihzdGF0ZS5kZXN0cm95ZWQpIHtcbiAgICAgICAgICAgIC8vVE9ETyByZXZpZXcgdGhhdCByZXByb2R1Y2VGcmFtZXNVbnRpbCBzaG91bGRuJ3QgYmUgY2FsbGVkIG9uY2UgZGVzdHJveWVkXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiLy9UT0RPIHJldmlldyB0aGF0IHJlcHJvZHVjZUZyYW1lc1VudGlsIHNob3VsZG4ndCBiZSBjYWxsZWQgb25jZSBkZXN0cm95ZWRcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKGZyYW1lTnVtYmVyID4gc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSkge1xuICAgICAgICAgICAgc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSsrO1xuICAgICAgICAgICAgY29uc3QgZnJhbWUgPSBmaW5kRnJhbWUoc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0cmlnZ2VyRnJhbWUoc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSwgZnJhbWUpKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNlcnZlclJvb20gICYmIHNlcnZlclJvb20uc3RhdGUucGxheWVyc1twbGF5ZXJJbmRleF0pIHNlcnZlclJvb20uc3RhdGUucGxheWVyc1twbGF5ZXJJbmRleF0ubGFzdFJlcHJvZHVjZWRGcmFtZSA9IGZyYW1lTnVtYmVyO1xuXG4gICAgICAgIF9kZWJ1Z1BhbmVsPy5zZXRTdGF0ZSh7X2ZyYW1lOiBzdGF0ZS5sYXN0UmVwcm9kdWNlZEZyYW1lfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcm9sbGJhY2tUb0ZyYW1lKGZyYW1lTnVtYmVyOiBudW1iZXIpIHsvL1RPRE8gYnVnZ3lcbiAgICAgICAgY29uc29sZS5sb2coXCJnYW1lUnVubmVyIHJvbGxiYWNrVG9GcmFtZVwiLCBmcmFtZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHNuYXBzaG90VG9SZXN0b3JlSW5kZXggPSBfc25hcHNob3RzLmZpbmRJbmRleChzID0+IHMuZnJhbWVOdW1iZXIgPT09IGZyYW1lTnVtYmVyKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJzbmFwc2hvdFRvUmVzdG9yZUluZGV4XCIsIHNuYXBzaG90VG9SZXN0b3JlSW5kZXgpO1xuICAgICAgICBjb25zdCBzbmFwc2hvdFRvUmVzdG9yZSA9IF9zbmFwc2hvdHNbc25hcHNob3RUb1Jlc3RvcmVJbmRleF07XG4gICAgICAgIGNvbnNvbGUubG9nKFwic25hcHNob3RUb1Jlc3RvcmVcIiwgc25hcHNob3RUb1Jlc3RvcmUpO1xuICAgICAgICBjb25zb2xlLmxvZyhcInNuYXBzaG90c1wiLCBfc25hcHNob3RzKVxuICAgICAgICBjb25zdCByZXdpbmRGcmFtZXMgPSAoc3RhdGUubGFzdFJlcHJvZHVjZWRGcmFtZSAtIGZyYW1lTnVtYmVyKTtcbiAgICAgICAgZW50aXR5TWFuYWdlci5jbGVhblNwcml0ZUVudGl0aWVzKCk7XG4gICAgICAgIC8vICBzdGF0ZS5zdGFydFRpbWUgPSBzdGF0ZS5zdGFydFRpbWUgKyBNYXRoLmZsb29yKHJld2luZEZyYW1lcyAqIGZyYW1lTXMpO1xuXG4gICAgICAgIHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWUgPSBmcmFtZU51bWJlcjtcblxuICAgICAgICBjb25zdCBzcHJpdGVLbGFzc2VzID0gZW50aXR5TWFuYWdlci5nZXRTcHJpdGVFbnRpdHlLbGFzc2VzKCk7XG5cbiAgICAgICAgLy9UT0RPIHJlY3JlYXRlIGFsbCBzcHJpdGVzIHNhdmVkIGluIHRoZSBzbmFwc2hvdFxuICAgICAgICBzbmFwc2hvdFRvUmVzdG9yZS5zcHJpdGVzLmZvckVhY2goKHNwcml0ZVNuYXBzaG90OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUtsYXNzID0gc3ByaXRlS2xhc3Nlcy5nZXQoc3ByaXRlU25hcHNob3Qua2xhc3MpO1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlZFNwcml0ZUVudGl0eSA9IHNwcml0ZUtsYXNzLmNyZWF0ZSh7XG4gICAgICAgICAgICAgICAgSUQ6IHNwcml0ZVNuYXBzaG90LklELFxuICAgICAgICAgICAgICAgIHBpeGVsUG9zaXRpb246IHNwcml0ZVNuYXBzaG90LnBvc2l0aW9uLFxuICAgICAgICAgICAgICAgIGZyYW1lOiBzcHJpdGVTbmFwc2hvdC5mcmFtZSxcbiAgICAgICAgICAgICAgICBuZXR3b3JrOiBzcHJpdGVTbmFwc2hvdC5uZXR3b3JrLFxuICAgICAgICAgICAgICAgIGxheWVyOiBzcHJpdGVTbmFwc2hvdC5sYXllcixcbiAgICAgICAgICAgICAgICBjcmVhdGVQYXJhbXM6IHNwcml0ZVNuYXBzaG90LmNyZWF0ZVBhcmFtc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgX2RlYnVnUGFuZWw/LnNldFN0YXRlKHtfZnJhbWU6IHN0YXRlLmxhc3RSZXByb2R1Y2VkRnJhbWV9KTtcblxuICAgICAgICBzcGF3bmVycy5mb3JFYWNoKHMgPT4gcy5yb2xsYmFja1RvRnJhbWUoZnJhbWVOdW1iZXIpKTtcblxuICAgICAgICBfcm9sbGJhY2tEb25lID0gdHJ1ZTtcbi8vc3RvcCgpXG4gICAgICAgIC8vIHJlLWNyZWF0ZSBhbGwgdGhlIHNwcml0ZXNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaW5kRnJhbWUoaW5kZXg6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gc3RhdGUuZnJhbWVzLmZpbmQoKGY6IGFueSkgPT4gZi5pbmRleCA9PT0gaW5kZXgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEZyYW1lTnVtYmVyKGVsYXBzZWRNczogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKGVsYXBzZWRNcyAvIGZyYW1lTXMpXG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBXaW5uZXJGdW5jdGlvbiA9ICgpID0+IHZvaWQgfCB1bmRlZmluZWQgfCB7IHdpbm5lckluZGV4OiBudW1iZXIgfTsiXX0=