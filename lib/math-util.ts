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

export function boxCollision(rect1:{x:number,y:number,w:number,h:number}, rect2:{x:number,y:number,w:number,h:number}){
  return    rect1.x < rect2.x + rect2.w &&
      rect1.x + rect1.w > rect2.x &&
      rect1.y < rect2.y + rect2.h &&
      rect1.y + rect1.h > rect2.y;
}
