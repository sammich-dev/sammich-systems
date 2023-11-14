import {Sprite, SpriteDefinition} from "./sprite-util";

export type SpriteKlassParams ={
    klass:string,//TODO rename to klassAlias
    spriteDefinition:SpriteDefinition,
    collisionBox?:any,
    screen:any
}

export type SpriteKlass = SpriteKlassParams & {
    create: ({pixelPosition, layer}: SpriteEntityCreationParams) => any
}
export type SpriteEntityCreationParams = {
    pixelPosition:number[],
    layer:number,
    ID?:number,
    network:boolean,
    frame?:number,
}
export type SpriteEntity = {
    ID:number,
    sprite:Sprite,
    klassParams:SpriteKlassParams,
    createParams:SpriteEntityCreationParams,
    spriteEntityKlass:SpriteKlass|undefined,
    onCollide:Function,
    detectCollisions:boolean,
    colliding:boolean,
    network:boolean,
    destroy:Function,
    setPixelPosition:Function,
    applyFrame:Function,
    isKlass:Function,
    getPixelPosition:Function,
    getNetwork:Function,
    setNetwork:Function,
    toJSON:Function
}

