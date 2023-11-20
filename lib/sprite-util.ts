export enum UVS_BACK {
    INVISIBLE, SAME, MIRROR
}
export type SpriteDefinition = {
    spriteSheetWidth: number;
    spriteSheetHeight: number;
    x: number;
    y: number;
    w: number;
    h: number;
    columns?: number;
    frames?: number;
};

export type Sprite = {
    ID:number,
    getPixelPosition:()=>number[],
    applyFrame:Function,
    hide:Function,
    show:Function,
    setPixelPosition:Function,
    setZoom:Function,
    destroy:Function,
    setNetwork:Function,
    getNetwork:Function
    getFrame: Function;
    getLayer: Function;
}

export type SpriteDefinitionParams = {
    spriteDefinition: SpriteDefinition;
    back?: UVS_BACK;
};

/**
 *      B ------> C
 *      ^         |
 *      |         |
 *      |         v
 *      A <------ D
 */
export function getUvsFromSprite({spriteDefinition, back = UVS_BACK.INVISIBLE}:SpriteDefinitionParams) {
    const {spriteSheetWidth, spriteSheetHeight, x, y, w, h} = spriteDefinition;
    const X1 = x / spriteSheetWidth;
    const X2 = (x / spriteSheetWidth + w / spriteSheetWidth);
    const Y1 = 1 - (y / spriteSheetHeight);
    const Y2 = 1 - (y / spriteSheetHeight + h / spriteSheetHeight);
    const FRONT_UVS = [
        X1, Y2, //A
        X1, Y1, //B
        X2, Y1, //C
        X2, Y2 //D
    ]
    const BACK_UVS = back === 0
        ? [0, 0, 0, 0, 0, 0, 0, 0]
        : back === 1
            ? FRONT_UVS
            : [
                X2, Y2,
                X2, Y1,
                X1, Y1,
                X1, Y2
            ]

    return [
        ...FRONT_UVS,
        ...BACK_UVS
    ];
}

export function createSpriteAnimationUVSGetter({spriteDefinition, back = UVS_BACK.INVISIBLE}:SpriteDefinitionParams) {
    const {x, y, w, h, columns} = spriteDefinition;

    return (frame:number) => {
        const _x = x + ((frame * w) % ((columns||1) * w));
        const _y = y + Math.floor(frame / (columns||1)) * h;

        return getUvsFromSprite({
            spriteDefinition: {
                ...spriteDefinition,
                x: _x, y: _y
            },
            back
        });
    }
}


export function getPixelPositionNormalizer({screenSpriteDefinition, spriteDefinition}:{screenSpriteDefinition:SpriteDefinition, spriteDefinition:SpriteDefinition}){
    return function normalizePixelPosition(xPixels: number, yPixels: number, layer: number) {
        const offsetX = (spriteDefinition.w / screenSpriteDefinition.w) / 2 - 0.5;
        const offsetY = 0.5 - (spriteDefinition.h / screenSpriteDefinition.h) / 2

        return [
            offsetX + (xPixels / screenSpriteDefinition.w),
            offsetY - (yPixels / screenSpriteDefinition.h),
            -layer * 0.001
        ];
    }
}