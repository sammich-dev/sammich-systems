import { Entity } from "@dcl/sdk/ecs";
import "./polyfill";
import { TransformTypeWithOptionals } from "@dcl/ecs/dist/components/manual/Transform";
export type SammichScreenOptions = {
    defaultTextureSrc?: string;
    baseInstructionVideoURL?: string;
    colyseusServerURL?: string;
};
export declare function createSammichScreen(parent: Entity, { position, rotation, scale, defaultTextureSrc, baseInstructionVideoURL, colyseusServerURL }: TransformTypeWithOptionals & SammichScreenOptions, _gameInstanceId?: string): Promise<{
    onEvent: (fn: Function) => () => Function[];
    getState: () => any;
}>;
