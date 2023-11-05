import {SpriteEntity, SpriteKlass, SpriteKlassParams} from "./game-entities";
import {Sprite} from "./sprite-util";
import {checkBoxesContact, getAbsoluteCollisionBoxFromSprite} from "./math-util";
type KlassAlias = string;

//TODO REVIEW IF decouple screen (probably dcl related)
export const createSpriteEntityFactory = ({screen, serverRoom, clientRoom,isClientPlayer,playerIndex}:any):any => {
    let IDCount = 1;
    const spriteEntityKlasses:Map<KlassAlias, SpriteKlass> = new Map();
    const spriteEntities:SpriteEntity[] = [];
    const collisionListeners:Map<SpriteEntity, Function> = new Map()
console.log("isClientPlayer",isClientPlayer);
    if(clientRoom){
        clientRoom.onStateChange((...args:any[]) => {
            if(!isClientPlayer){

                //TODO !IMPORTANT OPTIMIZE
                const state = clientRoom.state.toJSON();

                state.players[playerIndex].spriteEntities.forEach((spriteData:any) => {
                    spriteEntities.forEach(spriteEntity => {
                        if(spriteEntity.ID === spriteData.ID){
                            spriteEntity.setPixelPosition(spriteData.x, spriteData.y)
                            spriteEntity.applyFrame(spriteData.frame);
                        }
                    })
                });
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
            create:({pixelPosition, layer, network, ID, frame, createParams}:any):SpriteEntity => {
                const _ID = ID || IDCount++;
                const sprite:Sprite = screen.addSprite({
                    ID:_ID,
                    spriteDefinition,
                    pixelPosition,
                    layer,
                    network
                });
                if(frame!==undefined){
                    sprite.applyFrame(frame);
                }

                const _createParams = createParams || {
                    pixelPosition,
                    layer,
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
                    klassParams:{
                        klass,
                        spriteDefinition,
                        collisionBox,
                        screen:undefined
                    },
                    spriteEntityKlass,
                    createParams:_createParams,
                    onCollide:(fn:Function)=> collisionListeners.set(spriteEntity, fn),
                    detectCollisions:!!collisionBox,
                    colliding:false,
                    isKlass:(klass:SpriteKlass)=>spriteEntityKlass === klass,
                    destroy:()=>{
                        console.log("spriteEntity destroy", klass, ID)
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
            collisionBox,
            screen
        };
        spriteEntityKlasses.set(klass, spriteEntityKlass);
        return spriteEntityKlass;
    }
}

