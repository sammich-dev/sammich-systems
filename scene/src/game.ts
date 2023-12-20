import {
    engine, InputAction, Material, MeshCollider, MeshRenderer, PointerEvents, pointerEventsSystem, PointerEventType,
    Transform
} from '@dcl/sdk/ecs';

import {Vector3, Quaternion, Color4} from "@dcl/sdk/math";
import {getDebugPanel} from "../dcl-lib/debug-panel";
import "../dcl-lib/decorate-console";
import "./polyfill";
import {createMachineScreen} from "./game-machine";
import {EVENT} from "./events";
import {getMinUserData, MinUserData} from "../dcl-lib/min-user-data";

export const init = async () => {
    getDebugPanel();

    const rootEntity = engine.addEntity();
    await createMachineScreen(rootEntity, {
        position:Vector3.create(4,1,4),
        rotation:Quaternion.Zero(),
        scale: Vector3.create(2, 1.5, 1)
    }, "test");
}
