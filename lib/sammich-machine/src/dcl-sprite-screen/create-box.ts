import {engine, MeshRenderer, Transform} from "@dcl/sdk/ecs";
import {Vector3} from "@dcl/sdk/math";

export const createBox = ()=>{
    const entity = engine.addEntity();
    Transform.create(entity, {
        position:Vector3.create(8,1,8)
    });
    MeshRenderer.setBox(entity);
    console.log("createBox");
}