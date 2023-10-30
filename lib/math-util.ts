import {SpriteEntity} from "./game-entities";

export function checkBoxesContact(box1:any, box2:any, pixelOffset:number = 0) {
    if (
        box1.x < (box2.x + box2.w) &&
        (box1.x + box1.w) > box2.x &&
        box1.y < box2.y + box2.h &&
        box1.y + box1.h > box2.y
    ) {
        return true;
    }
}


export function getAbsoluteCollisionBoxFromSprite(spriteEntity:SpriteEntity){
    return {
        x: spriteEntity.getPixelPosition()[0] + spriteEntity.klassParams.collisionBox.x,
        y: spriteEntity.getPixelPosition()[1] + spriteEntity.klassParams.collisionBox.y,
        w: spriteEntity.klassParams.collisionBox.w,
        h: spriteEntity.klassParams.collisionBox.h
    }
}

