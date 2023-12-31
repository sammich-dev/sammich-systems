import {Sprite, SpriteDefinition} from "./sammich-machine/src/dcl-sprite-screen/sprite-util";

export type SpriteKlassParams ={
    klass:string,//TODO rename to klassAlias
    spriteDefinition:SpriteDefinition,
    collisionBox?:any,
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
    zoom?:number[]
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
    setZoom:Function,
    hide:Function,
    show:Function,
    isKlass:Function,
    getPixelPosition:Function,
    getNetwork:Function,
    setNetwork:Function,
    toJSON:Function
}

