import {
    engine, InputAction, Material, MeshCollider, MeshRenderer, PointerEvents, pointerEventsSystem, PointerEventType,
    Transform
} from '@dcl/sdk/ecs';

import {Vector3, Quaternion, Color4} from "@dcl/sdk/math";

import {createSammichScreen} from "dcl-sammich-screen";
import { getSceneInformation } from '~system/Runtime'

export const init = async () => {
    //we use scene base coords as server room id but can be any string, instances with same id will share server room
    const sammichScreenInstanceRoomId = JSON.parse((await getSceneInformation({})).metadataJson).scene.base;

    const rootEntity = engine.addEntity();
    await createSammichScreen(rootEntity, {
        position:Vector3.create(8,2,8),
        rotation:Quaternion.Zero(),
        scale: Vector3.create(3, 2, 1),
    },  sammichScreenInstanceRoomId);
}
