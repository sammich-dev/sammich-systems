export declare enum UVS_BACK {
    INVISIBLE = 0,
    SAME = 1,
    MIRROR = 2
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
    ID: number;
    getPixelPosition: () => number[];
    applyFrame: Function;
    hide: Function;
    show: Function;
    setPixelPosition: Function;
    setZoom: Function;
    destroy: Function;
    setNetwork: Function;
    getNetwork: Function;
    getFrame: Function;
    getLayer: Function;
};
export type SpriteDefinitionParams = {
    spriteDefinition: SpriteDefinition;
    back?: UVS_BACK;
};
export declare function getUvsFromSprite({ spriteDefinition, back }: SpriteDefinitionParams): number[];
export declare function createSpriteAnimationUVSGetter({ spriteDefinition, back }: SpriteDefinitionParams): (frame: number) => number[];
