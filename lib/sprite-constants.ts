import {Vector3} from "@dcl/sdk/math";

export const SPRITESHEET_WIDTH = 1024;
export const SPRITESHEET_HEIGHT = 1024;
export const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITESHEET_WIDTH,
    spriteSheetHeight: SPRITESHEET_HEIGHT,
}
export const DEFAULT_SPRITE_DEF = {
   ...SPRITE_SHEET_DIMENSION,
    columns: 1, frames: 1
};
export const SPLIT_SCREEN_RESOLUTION_WIDTH = 192 / 2;
export const SPLIT_SCREEN_WIDTH = SPLIT_SCREEN_RESOLUTION_WIDTH / 40;
export const SPLIT_SCREEN_SCALE = Vector3.create(0.5, 1, 1);
export const NAME_COLOR = `#e2bf37`;
