import { Entity } from "@dcl/sdk/ecs";
import { TransformTypeWithOptionals } from "@dcl/ecs/dist/components/manual/Transform";
export declare function createSammichScreen(parent: Entity, { position, rotation, scale }: TransformTypeWithOptionals, _gameInstanceId?: string): Promise<{
    onEvent: (fn: Function) => () => Function[];
    getState: () => any;
}>;
