import {createSpawner, SpawnerOptions} from "./spawner";
import {seedGen} from "./seed-gen";
import {SpriteEntity, SpriteKlass, SpriteKlassParams} from "./game-entities";
import {createSpriteEntityFactory} from "./sprite-entity-factory";
import {Frame, FrameEvent, FrameEventType, InputEventRepresentation} from "./frame-util";
import {InputAction, TextAlignMode} from "@dcl/sdk/ecs";
import {SpriteDefinitionParams} from "./sprite-util";
import {sleep} from "../scene/dcl-lib/sleep";
import {SPRITE_SHEET_DIMENSION} from "./sprite-constants";

let _rollbackDone = false; //TODO delete, only dev
export type GameRunnerCallback = {
    onStart: Function[],
    onInput: Function[],
    onFrame: Function[],
    onFinish: Function[],
    onDestroy: Function[],
    onWinner:Function|null,
    onProposedWinner: Function | null
};
const DEFAULT_FPS = 60;
const FRAMES_TO_TIE_BREAKER = 60 * 60 * 2;//2 minutes per game maximum

export const createScreenRunner = ({
                                       screen,
                                       timers,
                                       seed = 1,
                                       GameFactory,
                                       onFinish,
                                       clientRoom,
                                       serverRoom,
                                       isClientPlayer,
                                       playerIndex,
                                       recordFrames,
                                       velocityMultiplier = 1
                                   }: any) => {
    if (serverRoom && clientRoom) throw Error("NOT CORRECT");

    const memoize = (fn:Function) => {
        const cache:any = {};
        return (...args:any[]) => {
            let n = args[0];
            if (n in cache) {
                return cache[n];
            } else {
                let result = fn(n);
                cache[n] = result;
                return result;
            }
        }
    }
    const memSeedGenCreate = memoize(seedGen.create);//TODO review to memoize, but caution when several instances, because it should use different seedGen memoizeed based on instance index
    const fps = GameFactory?.definition?.fps || DEFAULT_FPS;
    const frameMs = 1000 / fps / velocityMultiplier;
    let _debugPanel: any = null;

    const callbacks: GameRunnerCallback = {
        onStart: [],
        onInput: [],
        onFrame: [],
        onFinish: [],
        onDestroy:[],
        onWinner: null,
        onProposedWinner: null
    };

    const state: any = {
        frames: [],
        running: false,
        destroyed: false,
        startTime: 0,
        lastReproducedFrame: -1,
        tieBreaker:false,
        score:[0,0]
    };

    if(clientRoom){
        clientRoom.onStateChange(()=>{//TODO ? REVIEW OPTIMIZE ?
            if(clientRoom.state?.players?.length){
                if(clientRoom.state?.players[0]) state.score[0] = clientRoom.state.players[0].miniGameScore;
                if(clientRoom.state?.players[1]) state.score[1] = clientRoom.state.players[1].miniGameScore;
            }
        });
    }

    const _snapshots: any[] = [{}];


    const spawners: any[] = [];
    const awaitingFrames: any[] = [];

    const triggerFrame = (n: number, frame: any) => {
        spawners.forEach(s => s.frame(n));
        callbacks.onFrame.forEach(f => f(n, frame));
        entityManager.checkColliders();

        if (frame) {
            for (let frameEvent of frame.events) {
                if (frameEvent.type === FrameEventType.INPUT) {
                    const {inputActionKey, isPressed, time, frameNumber} = frameEvent.data;
                    triggerInput(
                        frameEvent.data.playerIndex!==undefined?frameEvent.data.playerIndex:playerIndex ,
                        inputActionKey,
                        isPressed,
                        time,
                        frameNumber
                    );
                }
            }
        }


        const snapshot = {
            frameNumber: state.lastReproducedFrame,
            sprites: getSpriteEntities().map((s: SpriteEntity) => s.toJSON()),
        };
        _debugPanel?.setState({"lastSnapshotPositions": getSpriteEntities().map((s: SpriteEntity) => s.toJSON().position[1])})

        if (recordFrames) _snapshots.push(snapshot);
        let shouldSplitAwait = false;
        if (awaitingFrames?.length) {
            awaitingFrames.forEach(awaitingFrame => {//TODO FIX IT
                const {startedFrame, waitN} = awaitingFrame;
                if ((n - startedFrame) >= waitN) {
                    awaitingFrames.splice(awaitingFrames.indexOf(awaitingFrame), 1);
                    shouldSplitAwait = true;
                    awaitingFrame.resolve();
                }
            });
        }

        if(serverRoom && n > FRAMES_TO_TIE_BREAKER && !state.tieBreaker){
            console.log("SERVER RUNNER TIE_BREAKER", n, state, GameFactory.definition.alias);
            state.tieBreaker = true;
            const winnerIndex = game.randomInt(0,1);
            serverRoom.tieBreaker({winnerIndex});//TODO change method name serverRoom.tieBreaker: server broadcast TIE_BREAKER with the winner, so that client can reproduce the animation
        }
        return shouldSplitAwait;
    };

    const triggerInput = (playerIndex:number, inputActionKey: number, isPressed: false | number, time?: number, frameNumber?:number) => {
        callbacks.onInput.forEach(i => i({inputActionKey, isPressed, time, playerIndex, frameNumber}));
    }

    const entityManager = createSpriteEntityFactory({
        screen,
        serverRoom,
        clientRoom,
        isClientPlayer,
        playerIndex
    });

    const getSpriteEntities = entityManager.getSpriteEntities;

    let frameInterval: any;

    function pushFrame(_frame: any) {
        if (_frame.index) {
            //TODO REVIEW: NEXT COMMENTS MAYBE OR NOT
            //TODO check all existent frames, we should push the frame in the appropriate position
            //TODO find any frameIndex lower than the new one
            //TODO TODO find any frameIndex immediatelly higher than new one
        }
        const index = state.lastReproducedFrame + 1;
        const frame: Frame = {
            index,
            ..._frame
        }
        state.frames.push(frame);
        return frame;
    }

    function pushInputEvent(inputEventRepresentation: InputEventRepresentation): Frame {
        const time = inputEventRepresentation.time || (Date.now() - state.startTime);
        const actualFrameNumber = state.lastReproducedFrame + 1;
        const frameNumber = inputEventRepresentation.frameNumber || actualFrameNumber;

        let frame: Frame = state.frames.find((f: Frame) => f.index === actualFrameNumber);

        const event: FrameEvent = {
            type: FrameEventType.INPUT,
            data: {
                time,
                frameNumber,
                ...inputEventRepresentation
            }
        };

        if (frame) {
            frame.events.push(event);
        } else {
            frame = pushFrame({
                events: [event]
            })
        }
        return frame;
    }

    const destroy = () => {
        callbacks.onDestroy.forEach(d=>d());
        state.destroyed = true;
        console.log("GAME RUNNER DESTROY");
        spawners.forEach(s => s && s.destroy());
        spawners.splice(0, spawners.length)
        entityManager.destroy();
        awaitingFrames.splice(0, awaitingFrames.length);
        _disposeWinnerFn && _disposeWinnerFn();
        stop();
    };
    let _disposeWinnerFn: any;

    const waitFrames = (n: number) => {
        const waitingFrame = {
            startedFrame: state.lastReproducedFrame,
            waitN: n,
        };
        const promise = new Promise((resolve, reject) => {
            Object.assign(waitingFrame, {resolve, reject});
        });

        awaitingFrames.push(waitingFrame);

        return promise;
    };
    const setScreenSprite = ({spriteDefinition}: SpriteDefinitionParams) => screen.setBackgroundSprite({spriteDefinition});
    const setPlayer1Score = (data:number) => {
        state.score[0] = data;
        if (serverRoom && serverRoom.state.players[0]){
            return serverRoom.state.players[0].miniGameScore = data;
        }
    };
    const setPlayer2Score = (data:number) => {
        state.score[1] = data;
        if (serverRoom && serverRoom.state.players[1]){
            return serverRoom.state.players[1].miniGameScore = data;
        }
    };
    const gameApi = {
        setScreenSprite,
        waitFrames,
        onStart: (fn: Function) => {
            callbacks.onStart.push(fn);
            return () => callbacks.onStart.splice(callbacks.onStart.indexOf(fn), 1);
        },
        onInput: (fn: Function) => {
            callbacks.onInput.push(fn);
            return () => callbacks.onInput.splice(callbacks.onInput.indexOf(fn), 1);
        },
        onFrame: (fn: Function) => {
            callbacks.onFrame.push(fn);
            return () => callbacks.onFrame.splice(callbacks.onFrame.indexOf(fn), 1);
        },
        onFinish: (fn: Function) => {
            callbacks.onFinish.push(fn);
            return () => callbacks.onFinish.splice(callbacks.onFinish.indexOf(fn), 1);
        },
        onDestroy: (fn: Function) => {
            callbacks.onDestroy.push(fn);
            return () => callbacks.onDestroy.splice(callbacks.onDestroy.indexOf(fn), 1);
        },
        registerSpriteEntity: (options: SpriteKlassParams) => entityManager.registerSpriteEntity(options),
        getSpriteEntityKlasses: () => entityManager.getSpriteEntityKlasses(),
        createSpawner: (spriteEntity: SpriteKlass, options: SpawnerOptions) => {
            const spawner = createSpawner(spriteEntity, options, game);
            spawners.push(spawner);
            return spawner;
        },
        addText: ({text, pixelPosition, textAlign, fontSize, textColor,layer}: {text:string, textColor?:number[], fontSize?:number, textAlign?:TextAlignMode, pixelPosition:number[], layer?:number}) => screen.addText({
            text,
            pixelPosition,
            textAlign,
            fontSize,
            textColor,
            layer
        }),
        setWinnerFn: (fn: WinnerFunction) => {
            _disposeWinnerFn = serverRoom?.setWinnerFn(fn);
        },
        checkWinners: () => {
            console.log("checkWinners", !!serverRoom, !!clientRoom, playerIndex, state.lastReproducedFrame);
            if(state.tieBreaker) return;
            serverRoom?.checkWinners({playerIndex, n: state.lastReproducedFrame});//TODO REVIEW: this can be executed double due to both screenRunners
        },
        getSpriteEntities,
        random,
        randomInt,
        getRandomFromList: (list: any[]) => {
            return list[Math.floor(random() * list.length)];
        },
        shuffleList: (list: any[]) => {//immutable, returns new list
            const listCopy = [...list];
            const result = [];

            while (listCopy.length) {
                result.push(
                    listCopy.splice(
                        Math.floor(game.random() * list.length),
                        1)[0]
                );
            }

            return result;
        },
        reproduceSpriteFrames:(sprite:SpriteEntity, {loop, stepsPerFrame}:any)=>{//TODO

        },
        players: [{//TODO only for use with shared screen, should not be implemented here, but in shared-screen-runner ?
            setPlayerScore:setPlayer1Score,
            getPlayerScore:()=>(serverRoom||clientRoom)?.state.players[0].miniGameScore || state.score[0]
        },{
            setPlayerScore:setPlayer2Score,
            getPlayerScore:()=> (serverRoom||clientRoom)?.state.players[1].miniGameScore || state.score[1]
        }],
        setPlayerScore: (data: number) => {//TODO this smells, should not be used by shared-screen, should not be implemented here, but in shared-screen-runner ?
            state.score[playerIndex] = data;
            if (serverRoom) {
                serverRoom.state.players[playerIndex].miniGameScore = data;
            }
        },
        getPlayerScore: () => (serverRoom||clientRoom)?.state.players[playerIndex].miniGameScore || state.score[playerIndex]
    };

    function random() {
        //randomTODO REVIEW : lastFrame for seed was for rollback feature, check if still necessary even when feature is not ready
        const _seed = seed;// + runtimeApi.runtime.getState().lastReproducedFrame;
        const result = memSeedGenCreate(_seed).random();
        return result;
    }

    function randomInt(min:number, max:number){
        return min + Math.floor(game.random() * (max - min + 1));
    }

    const runtimeApi = {
        definition:GameFactory.definition,
        runtime: {
            tieBreaker,
            getPlayerIndex: () => playerIndex,
            onProposedWinner: (fn: Function): Function => {
                callbacks.onProposedWinner = fn;
                // @ts-ignore
                return () => callbacks.onProposedWinner = null;
            },
            onWinner: (fn: Function): Function => {
                callbacks.onWinner = fn;
                // @ts-ignore
                return () => callbacks.onWinner = null;
            },
            attachDebugPanel: (debugPanel: any) => _debugPanel = debugPanel,
            rollbackToFrame,
            getState: () => state,
            setState:(o:any)=>Object.assign(state,o),
            getFps: () => fps,
            destroy,
            pushInputEvent,
            pushFrame,
            getCurrentFrameNumber: () => {
                //TODO REVIEW ALL USES Date.now() doesnt work well when there is not autoplay and/or frames are reproduced programmatically
                return Math.floor((Date.now() - state.startTime) / frameMs);
            },
            reproduceFramesUntil,
            reproduce:(autoPlay = true)=>{
                state.running = true;
                timers.clearInterval(frameInterval);
                frameInterval = timers.setInterval(() => {
                    let currentFrame = getFrameNumber(Date.now() - state.startTime);

                    reproduceFramesUntil(currentFrame);
                    _debugPanel?.setState({
                        spriteEntities: "\n" + getSpriteEntities().map((s: SpriteEntity) => `${s.klassParams.klass}-${s.ID}-${s.getPixelPosition()[1]}`).join("\n")
                    });

                }, frameMs);
            },
            start: (autoPlay: boolean = true) => {
                console.log("START__", playerIndex);
                state.running = true;
                state.startTime = Date.now();
                state.frames.push({index: 0, events: [{type: "start", time: 0}]});
                state.lastReproducedFrame = 0;
                if (autoPlay) {
                    frameInterval = timers.setInterval(() => {
                        let currentFrame = getFrameNumber(Date.now() - state.startTime);

                        reproduceFramesUntil(currentFrame);
                        _debugPanel?.setState({
                            spriteEntities: "\n" + getSpriteEntities().map((s: SpriteEntity) => `${s.klassParams.klass}-${s.ID}-${s.getPixelPosition()[1]}`).join("\n")
                        });

                    }, frameMs);
                }

                callbacks.onStart.forEach(c => c({seed}));
            },
            finish: () => {
            },
            stop,
            getScreen: () => screen
        }
    }

    async function tieBreaker({winnerIndex}:{winnerIndex:number}){
        const BASE_LAYER = 90;
        const COIN_ANIMATION_FRAME_DELAY = 5;
        const text = game.addText({
            layer:BASE_LAYER+4,
            pixelPosition:[192/2,20],
            text:"TIE BREAKER\nThe winner is ...",
            fontSize:0.8,
            textColor:[1,1,1,1],
            textAlign:TextAlignMode.TAM_TOP_CENTER
        });
        const overlaySprite = game.registerSpriteEntity({
            klass:"Overlay",
            spriteDefinition:{
                x:576,
                y:128,
                w:192,
                h:128,
                ...SPRITE_SHEET_DIMENSION
            }
        }).create({
            pixelPosition:[0,0],
            layer:BASE_LAYER+1
        });
        const CoinSprite = game.registerSpriteEntity({
            klass:"Coin",
            spriteDefinition:{
                x:0,y:736, w:32, h:32, columns:4,frames:4,
                ...SPRITE_SHEET_DIMENSION,
            }
        });
        const CoinNumberSprite = game.registerSpriteEntity({

            klass:"CoinNumber",
            spriteDefinition:{
                x:0,y:711, w:32, h:28, columns:6,frames:6,
                ...SPRITE_SHEET_DIMENSION,
            }
        });
        const coinNumber = CoinNumberSprite.create({
            pixelPosition:[192/2 - 16, 62],
            layer:BASE_LAYER+4
        });

        const coin = CoinSprite.create({
            pixelPosition:[192/2 -16,60],
            layer:BASE_LAYER+2
        });

        const winnerRound = 6+winnerIndex;
        const state = {
            round:0
        };

        const COIN_NUMBER_FRAMES = [
            [3,4,5,0,1,2],
            [0,1,2,3,4,5],
        ];

        while(state.round < winnerRound){
            await round();
        }
        text.setText("TIE BREAKER\nThe winner is...\nplayer "+(winnerIndex+1))
        async function round(){
            const coinNumberFrames = COIN_NUMBER_FRAMES[winnerIndex];

            coin.applyFrame(0);
            coinNumber.applyFrame(coinNumberFrames[0]);
            await game.waitFrames(COIN_ANIMATION_FRAME_DELAY);


            coin.applyFrame(1);
            coinNumber.applyFrame(coinNumberFrames[1]);//TODO NOT WORKING WELL, SPRITE NOT VISIB LE

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

    const gameInstance = GameFactory.run({game});

    return game;

    function stop() {
        state.running = false;
        timers.clearInterval(frameInterval);
    }

    async function reproduceFramesUntil(frameNumber: number) {
        if(state.destroyed) {
            //TODO review that reproduceFramesUntil shouldn't be called once destroyed
            console.error("//TODO review that reproduceFramesUntil shouldn't be called once destroyed");
            return;
        }
        while (frameNumber > state.lastReproducedFrame) {
            state.lastReproducedFrame++;
            const frame = findFrame(state.lastReproducedFrame);

            if (triggerFrame(state.lastReproducedFrame, frame)) {
                await sleep(0);
            }
        }
        if (serverRoom  && serverRoom.state.players[playerIndex]) serverRoom.state.players[playerIndex].lastReproducedFrame = frameNumber;

        _debugPanel?.setState({_frame: state.lastReproducedFrame});
    }

    function rollbackToFrame(frameNumber: number) {//TODO buggy
        console.log("gameRunner rollbackToFrame", frameNumber);
        const snapshotToRestoreIndex = _snapshots.findIndex(s => s.frameNumber === frameNumber);
        console.log("snapshotToRestoreIndex", snapshotToRestoreIndex);
        const snapshotToRestore = _snapshots[snapshotToRestoreIndex];
        console.log("snapshotToRestore", snapshotToRestore);
        console.log("snapshots", _snapshots)
        const rewindFrames = (state.lastReproducedFrame - frameNumber);
        entityManager.cleanSpriteEntities();
        //  state.startTime = state.startTime + Math.floor(rewindFrames * frameMs);

        state.lastReproducedFrame = frameNumber;

        const spriteKlasses = entityManager.getSpriteEntityKlasses();

        //TODO recreate all sprites saved in the snapshot
        snapshotToRestore.sprites.forEach((spriteSnapshot: any) => {
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

        _debugPanel?.setState({_frame: state.lastReproducedFrame});

        spawners.forEach(s => s.rollbackToFrame(frameNumber));

        _rollbackDone = true;
//stop()
        // re-create all the sprites
    }

    function findFrame(index: number) {
        return state.frames.find((f: any) => f.index === index);
    }

    function getFrameNumber(elapsedMs: number) {
        return Math.floor(elapsedMs / frameMs)
    }
}

export type WinnerFunction = () => void | undefined | { winnerIndex: number };