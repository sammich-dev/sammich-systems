import {SpriteEntity, SpriteEntityCreationParams, SpriteKlass, SpriteKlassParams} from "./game-entities";
import {Sprite} from "./sprite-util";
import {checkBoxesContact, getAbsoluteCollisionBoxFromSprite} from "./math-util";
import {SpriteState} from "../server/src/rooms/GameState";
type KlassAlias = string;

export const createSpriteEntityFactory = ({screen, serverRoom, clientRoom,isClientPlayer,playerIndex}:any):any => {
    let IDCount = 1;
    const spriteEntityKlasses:Map<KlassAlias, SpriteKlass> = new Map();
    const spriteEntities:SpriteEntity[] = [];
    const collisionListeners:Map<SpriteEntity, Function> = new Map()

    let spritesStateInitialized = false;

    if(clientRoom && !isClientPlayer){//TODO REVIEW REFACTOR IF THIS SHOULD BE OUT, THE RESPONSIBILITY SHOULD NOT BE HERE
        clientRoom.onStateChange((...args:any[]) => {
           if(!spritesStateInitialized && clientRoom.state.players[playerIndex].spriteEntities){
               clientRoom.state.players[playerIndex].spriteEntities.onAdd((spriteState:SpriteState, index:number)=>{
                   const klass = spriteState.klass;
                   const SpriteKlass = spriteEntityKlasses.get(klass);
                   const localSprite:SpriteEntity = spriteEntities.find(i=>i.ID === spriteState.ID) as SpriteEntity;
                   if(!localSprite){
                       const {ID, layer, frame} = spriteState;
                       SpriteKlass?.create({
                           ID,
                           pixelPosition:[spriteState.x, spriteState.y],
                           layer,
                           network:true,
                           frame
                       })
                   }

                   spriteState.onChange((changes)=>{
                       const spriteStateJSON:SpriteState = spriteState.toJSON() as SpriteState;
                       const localSprite:SpriteEntity = spriteEntities.find(i=>i.ID === spriteStateJSON.ID) as SpriteEntity;
                       if(localSprite.sprite.getPixelPosition()[0] !== spriteStateJSON.x || localSprite.sprite.getPixelPosition()[1] !== spriteStateJSON.y){
                           localSprite.setPixelPosition(spriteStateJSON.x,spriteStateJSON.y);
                       }
                       if(localSprite.sprite.getFrame() !== spriteStateJSON.frame){
                           localSprite.applyFrame(spriteStateJSON.frame);
                       }
                   })
               });

               clientRoom.state.players[playerIndex].spriteEntities.onRemove((spriteState:SpriteState)=>{
                   const localSprite:SpriteEntity = spriteEntities.find(i=>i.ID === spriteState.ID) as SpriteEntity;
                   localSprite?.destroy();
               });

               spritesStateInitialized = true;
           }
        });
    }

    return {
        registerSpriteEntity,
        checkColliders,
        getSpriteEntities:()=>spriteEntities,
        cleanSpriteEntities: () => {
            while(spriteEntities.length) spriteEntities[0].destroy();
        },
        getCollisionListeners:()=>collisionListeners,
        getSpriteEntityKlasses:()=>spriteEntityKlasses,
        destroy:()=>{
            while(spriteEntities?.length) spriteEntities[0].destroy();
        }
    };

    function checkColliders(){
        const colliders = spriteEntities.filter((i:SpriteEntity)=>i.detectCollisions);
        colliders.forEach((colliderSpriteEntity:SpriteEntity, index:number)=>{
            const otherColliders = colliders.filter((c:any)=>c!==colliderSpriteEntity);
            let foundColliders = 0;
            otherColliders.forEach((otherSprite:any)=>{
                const collisionListener = collisionListeners.get(colliderSpriteEntity);
                if(collisionListener && checkBoxesContact(
                    getAbsoluteCollisionBoxFromSprite(colliderSpriteEntity),
                    getAbsoluteCollisionBoxFromSprite(otherSprite)
                )){
                    foundColliders++;

                    if(!colliderSpriteEntity.colliding) collisionListener({otherSprite});

                    colliderSpriteEntity.colliding = true;
                }
            });
            colliderSpriteEntity.colliding = !!foundColliders;
            return foundColliders;
        });
    }
    function registerSpriteEntity({klass, spriteDefinition, collisionBox}:SpriteKlassParams):SpriteKlass{
        const spriteEntityKlass:SpriteKlass = {
            create:({pixelPosition, layer, network, ID, frame, zoom}:SpriteEntityCreationParams):SpriteEntity => {
                const _ID = ID || IDCount++;
                const sprite:Sprite = screen.addSprite({
                    ID:_ID,
                    spriteDefinition,
                    pixelPosition,
                    layer,
                    network,
                    klass,
                    zoom
                });
                if(frame!==undefined){
                    sprite.applyFrame(frame);
                }

                const _createParams = {
                    pixelPosition,
                    layer,
                    network
                }
                const spriteEntity:SpriteEntity = {
                    ID:_ID,
                    setNetwork:(value:boolean)=>sprite.setNetwork(value),
                    getNetwork:()=>sprite.getNetwork(),
                    network,
                    sprite,
                    getPixelPosition:()=>sprite.getPixelPosition(),
                    setPixelPosition: (px:number,py:number) => sprite.setPixelPosition(px,py),
                    applyFrame:(n:number)=>sprite.applyFrame(n),
                    hide:(n:number)=>sprite.hide(n),
                    show:(n:number)=>sprite.show(n),
                    setZoom:(zoom:number[]) => sprite.setZoom(zoom),
                    klassParams:{
                        klass,
                        spriteDefinition,
                        collisionBox
                    },
                    spriteEntityKlass,
                    createParams:_createParams,
                    onCollide:(fn:Function)=> collisionListeners.set(spriteEntity, fn),
                    detectCollisions:!!collisionBox,
                    colliding:false,
                    isKlass:(klass:SpriteKlass)=>spriteEntityKlass === klass,
                    destroy:()=>{
                        sprite.destroy();
                        //@ts-ignore //TODO REVIEW
                        delete spriteEntity.spriteEntityKlass;
                        //@ts-ignore //TODO REVIEW
                        delete spriteEntity.onCollide;
                        collisionListeners.delete(spriteEntity);
                        const spriteIndex = spriteEntities.indexOf(spriteEntity);
                        spriteEntities.splice(spriteIndex, 1);
                    },
                    toJSON:()=>{
                        return {
                            position:sprite.getPixelPosition(),
                            layer:sprite.getLayer(),
                            ID:sprite.ID,
                            network,
                            frame:sprite.getFrame(),
                            klass,
                            createParams:_createParams
                        }
                    }
                };
                spriteEntities.push(spriteEntity);
                return spriteEntity;
            },
            klass,
            spriteDefinition,
            collisionBox
        };
        spriteEntityKlasses.set(klass, spriteEntityKlass);
        return spriteEntityKlass;
    }
}

