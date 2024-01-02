import { TransformTypeWithOptionals } from "@dcl/ecs/dist/components/manual/Transform";
import { PBMaterial_PbrMaterial } from "@dcl/sdk/ecs";
import { Sprite, SpriteDefinition } from "./sprite-util";
export type SpriteScreenOptions = {
    transform: TransformTypeWithOptionals;
    spriteMaterial: PBMaterial_PbrMaterial;
    spriteDefinition: SpriteDefinition;
};
export declare function createSpriteScreen({ transform, spriteMaterial, spriteDefinition }: SpriteScreenOptions): {
    setBackgroundSprite: ({ spriteDefinition }: {
        spriteDefinition: SpriteDefinition;
    }) => void;
    getSize: () => number[];
    addSprite: ({ ID, spriteDefinition, onClick, pixelPosition, layer, network, hoverText, zoom }: any) => Sprite;
    addText: ({ pixelPosition, textAlign, text, textColor, fontSize, layer }: any) => {
        destroy: () => void;
        setText: (value: string) => string;
        setPixelPosition: (px: number, py: number) => void;
        hide: () => number;
        show: () => number;
    };
    getEntity: () => import("@dcl/sdk/ecs").Entity;
    hide: () => void;
    show: () => void;
    destroy: () => void;
};
export declare function createSpritePlane({ spriteDefinition, transform, spriteMaterial }: any): import("@dcl/sdk/ecs").Entity;
