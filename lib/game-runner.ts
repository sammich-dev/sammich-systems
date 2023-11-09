import {createSpawner, SpawnerOptions} from "./spawner";
import {seedGen} from "./seed-gen";
import {SpriteEntity, SpriteKlass, SpriteKlassParams} from "./game-entities";
import {createSpriteEntityFactory} from "./sprite-entity-factory";
import {Frame, FrameEvent, FrameEventType, InputEventRepresentation} from "./frame-util";
import {InputAction} from "@dcl/sdk/ecs";
import {SpriteDefinitionParams} from "./sprite-util";

let _rollbackDone = false; //TODO delete, only dev
export type GameRunnerCallback = {
    onStart:Function[],
    onInput:Function[],
    onFrame:Function[],
    onFinish:Function[],
    onProposedWinner:Function|null
};
const DEFAULT_FPS = 60;

export const createScreenRunner = ({screen, timers, seed = 1, GameFactory, onFinish, clientRoom, serverRoom, isClientPlayer,
                                     playerIndex, recordFrames, velocityMultiplier = 1}:any)=>{
    if(serverRoom && clientRoom) throw Error("NOT CORRECT")
    const memSeedGenCreate = (seedGen.create);//TODO review to memoize, but caution when several instances, because it should use different seedGen memoizeed based on instance index
    const fps = GameFactory?.definition?.fps || DEFAULT_FPS;
    const frameMs = 1000 / fps / velocityMultiplier;
    let _debugPanel:any = null;

    const callbacks:GameRunnerCallback = {
        onStart:[],
        onInput:[],
        onFrame:[],
        onFinish:[],
        onProposedWinner:null
    };

    const state:any = {
        frames:[],
        running:false,
        destroyed:false,
        startTime:0,
        lastReproducedFrame:-1
    };
    const _snapshots:any[] = [{}];


    const spawners:any[] = [];
    const awaitingFrames:any[] = [];

    const triggerFrame = (n:number, dt:number, frame:any) => {
        spawners.forEach(s=>s.frame(n));
        callbacks.onFrame.forEach(f=>f(n, dt, frame));
        entityManager.checkColliders();
        serverRoom?.checkWinners({playerIndex, n});//TODO REVIEW: this can be executed double due to both screenRunners

        if(frame){
            for(let frameEvent of frame.events){
                if(frameEvent.type === FrameEventType.INPUT){
                    const {inputActionKey, isPressed, time} = frameEvent.data;
                    triggerInput(inputActionKey, isPressed, time);
                }
            }
        }

        const snapshot = {
            frameNumber:state.lastReproducedFrame,
            sprites:getSpriteEntities().map((s:SpriteEntity)=>s.toJSON()),
        };
        _debugPanel?.setState({"lastSnapshotPositions":getSpriteEntities().map((s:SpriteEntity)=>s.toJSON().position[1]) })

        if(recordFrames) _snapshots.push(snapshot);

        if(awaitingFrames?.length){
            awaitingFrames.forEach(awaitingFrame => {
                const {startedFrame, waitN} = awaitingFrame;
                if((n-startedFrame) >= waitN){
                    awaitingFrames.splice(awaitingFrames.indexOf(awaitingFrame), 1);
                    console.log("resolve awaiting frames")
                    awaitingFrame.resolve();
                }
            });
        }
    };

    const triggerInput = (inputActionKey:number, isPressed:false|number, time?:number) => {
        callbacks.onInput.forEach(i => i({inputActionKey, isPressed, time}));
    }

    const entityManager = createSpriteEntityFactory({
        screen,
        serverRoom,
        clientRoom,
        isClientPlayer,
        playerIndex
    });

    const getSpriteEntities = entityManager.getSpriteEntities;

    let frameInterval:any;

    function pushFrame (_frame:any) {
        if(_frame.index){
            //TODO check all existent frames, we should push the frame in the appropriate position
            //TODO find any frameIndex lower than the new one
            //TODO TODO find any frameIndex immediatelly higher than new one
        }
        const index = state.lastReproducedFrame+1;
        const frame:Frame = {
            index,
            ..._frame
        }
        state.frames.push(frame);
        return frame;
    }

    function pushInputEvent(inputEventRepresentation:InputEventRepresentation):Frame {
        const time =  inputEventRepresentation.time || (Date.now() - state.startTime);
        const actualFrameNumber = state.lastReproducedFrame + 1;
        let frame:Frame = state.frames.find((f:Frame) => f.index === actualFrameNumber);

        const event:FrameEvent = {
            type:FrameEventType.INPUT,
            data:{
                time,
                ...inputEventRepresentation
            }
        };

        if(frame){
            frame.events.push(event);
        }else{
            frame = pushFrame({
                events:[event]
            })
        }
        return frame;
    }

    const destroy = () => {
        state.destroyed = true;
        console.log("GAME RUNNER DESTROY");
        timers.clearInterval(frameInterval);
        spawners.forEach(s=>s && s.destroy());
        spawners.splice(0,spawners.length)
        entityManager.destroy();
        awaitingFrames.splice(0, awaitingFrames.length);
        _disposeWinnerFn && _disposeWinnerFn();

    };
    let _disposeWinnerFn:any;
    const gameApi = {
        setScreenSprite:({spriteDefinition}:SpriteDefinitionParams)=>screen.setBackgroundSprite({spriteDefinition}),
        waitFrames:(n:number)=>{
            console.log("wait frames")
            const waitingFrame = {
                startedFrame:getFrameNumber(Math.max(0, Date.now() - state.startTime)),
                waitN:n,
            };
            const promise = new Promise((resolve, reject)=>{
                Object.assign(waitingFrame, {resolve,reject});
            });

            awaitingFrames.push(waitingFrame);

            return promise;
        },
        onStart: (fn:Function) => {
            callbacks.onStart.push(fn);
            return ()=>callbacks.onStart.splice(callbacks.onStart.indexOf(fn), 1);
        },
        onInput: (fn:Function) => {
            callbacks.onInput.push(fn);
            return ()=>callbacks.onInput.splice(callbacks.onInput.indexOf(fn), 1);
        },
        onFrame: (fn:Function) => {
            callbacks.onFrame.push(fn);
            return ()=>callbacks.onFrame.splice(callbacks.onFrame.indexOf(fn), 1);
        },
        onFinish: (fn:Function) => {
            callbacks.onFinish.push(fn);
            return ()=>callbacks.onFinish.splice(callbacks.onFinish.indexOf(fn), 1);
        },
        registerSpriteEntity: (options:SpriteKlassParams) => entityManager.registerSpriteEntity(options),
        getSpriteEntityKlasses:()=>entityManager.getSpriteEntityKlasses(),
        createSpawner:(spriteEntity:SpriteKlass, options:SpawnerOptions)=>{
            const spawner = createSpawner(spriteEntity, options, game);
            spawners.push(spawner);
            return spawner;
        },
        addText:({text, pixelPosition, textAlign, fontSize}:any)=>screen.addText( {text,pixelPosition, textAlign, fontSize}),
        setWinnerFn:(fn:WinnerFunction) => {
            _disposeWinnerFn = serverRoom?.setWinnerFn(fn);
        },
        getSpriteEntities,
        random: () => {
            //TODO should work with rollback
            // seed is frame + counter, a new frame always has counter to 0
            const result = memSeedGenCreate(seed + runtimeApi.runtime.getState().lastReproducedFrame * 1000).random();

            return result;
        },
        setPlayerScore:(data:number)=>{
            if(!isClientPlayer && serverRoom){
                console.log("setPlayerScore", playerIndex, data);
                serverRoom.state.players[playerIndex].miniGameScore = data;
            }else{
                //TODO?
            }
        },
        getPlayerScore:() => {
            if(serverRoom){
                return serverRoom.state.players[playerIndex].miniGameScore;
            }else if(clientRoom){
                return clientRoom.state.players[playerIndex].miniGameScore;
            }
        }
    };

    const runtimeApi = {
        runtime:{
            onProposedWinner:(fn:Function):Function=>{
                callbacks.onProposedWinner = fn;
                // @ts-ignore
                return ()=>callbacks.onProposedWinner = null;
            },
            attachDebugPanel:(debugPanel:any)=> _debugPanel = debugPanel,
            rollbackToFrame,
            getState:()=>state,
            getFps:()=>fps,
            destroy,
            pushInputEvent,
            pushFrame,
            getCurrentFrameNumber: () => {
                //TODO REVIEW ALL USES Date.now() doesnt work well when there is not autoplay and/or frames are reproduced programmatically
                return Math.floor((Date.now() - state.startTime)/frameMs);
            },
            reproduceFramesUntil,
            start: (autoPlay:boolean = true)=>{
                console.log("START__", playerIndex);
                state.running = true;
                state.startTime = Date.now();
                state.frames.push({index:0, events:[{type:"start", time:0}]});
                state.lastReproducedFrame = 0;
                if(autoPlay){
                    frameInterval = timers.setInterval(()=>{
                        let currentFrame = getFrameNumber(Date.now() - state.startTime);

                        reproduceFramesUntil(currentFrame);
                        _debugPanel?.setState({
                            spriteEntities:"\n"+getSpriteEntities().map((s:SpriteEntity)=>`${s.klassParams.klass}-${s.ID}-${s.getPixelPosition()[1]}`).join("\n")
                        });

                    }, frameMs);
                }

                callbacks.onStart.forEach(c=>c({seed}));
            },
            finish:()=>{},
            stop,
            getScreen:()=>screen
        }
    }

    const game = {
        ...gameApi,
        ...runtimeApi,
    };

    const gameInstance = GameFactory({game}); //TODO get from repository based on gameID

    return game;

    function stop(){
        state.running = false;
        timers.clearInterval(frameInterval);
    }

    function reproduceFramesUntil(frameNumber:number){
        let frames = 0;

        while(frameNumber > state.lastReproducedFrame) {
            state.lastReproducedFrame++;
            const dt = Date.now() - state.startTime + (frames*frameMs);
            const frame = findFrame(state.lastReproducedFrame);

            triggerFrame(state.lastReproducedFrame, dt, frame);

            frames++;
        }

        _debugPanel?.setState({frame:state.lastReproducedFrame});
    }

    function rollbackToFrame(frameNumber:number){//TODO buggy
        console.log("gameRunner rollbackToFrame", frameNumber);
        const snapshotToRestoreIndex = _snapshots.findIndex(s=>s.frameNumber === frameNumber);
        console.log("snapshotToRestoreIndex",snapshotToRestoreIndex);
        const snapshotToRestore = _snapshots[snapshotToRestoreIndex ];
        console.log("snapshotToRestore",snapshotToRestore);
        console.log("snapshots",_snapshots)
        const rewindFrames = (state.lastReproducedFrame - frameNumber);
        entityManager.cleanSpriteEntities();
      //  state.startTime = state.startTime + Math.floor(rewindFrames * frameMs);

        state.lastReproducedFrame = frameNumber;

        const spriteKlasses = entityManager.getSpriteEntityKlasses();

        //TODO recreate all sprites saved in the snapshot
        snapshotToRestore.sprites.forEach( (spriteSnapshot:any) => {
            const spriteKlass =  spriteKlasses.get(spriteSnapshot.klass);
            const createdSpriteEntity = spriteKlass.create({
                ID:spriteSnapshot.ID,
                pixelPosition:spriteSnapshot.position,
                frame:spriteSnapshot.frame,
                network:spriteSnapshot.network,
                layer:spriteSnapshot.layer,
                createParams:spriteSnapshot.createParams
            });

        });

        _debugPanel?.setState({frame:state.lastReproducedFrame});

        spawners.forEach(s=>s.rollbackToFrame(frameNumber));

        _rollbackDone = true;
//stop()
        // re-create all the sprites
    }

    function findFrame(index:number){
        return state.frames.find((f:any)=>f.index===index);
    }

    function getFrameNumber(elapsedMs:number){
        return Math.floor(elapsedMs/frameMs)
    }
}

export type WinnerFunction = () => void|undefined|{winnerIndex:number};