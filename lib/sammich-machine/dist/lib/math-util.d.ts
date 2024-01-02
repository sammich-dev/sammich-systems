import { SpriteEntity } from "./game-entities";
export declare function checkBoxesContact(box1: any, box2: any, pixelOffset?: number): boolean;
export declare function getAbsoluteCollisionBoxFromSprite(spriteEntity: SpriteEntity): {
    x: any;
    y: any;
    w: any;
    h: any;
};
export declare function boxCollision(rect1: {
    x: number;
    y: number;
    w: number;
    h: number;
}, rect2: {
    x: number;
    y: number;
    w: number;
    h: number;
}): boolean;
