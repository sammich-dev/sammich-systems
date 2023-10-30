import {
    engine,
    Material,
    MaterialTransparencyMode,
    MeshRenderer,
    PBMaterial_PbrMaterial,
    TextureFilterMode,
    TextureWrapMode,
    Transform,
    Entity
} from '@dcl/sdk/ecs'
import {Quaternion, Vector3} from "@dcl/sdk/math";
import {pipe} from "./functional";


export function getNormalizedLocalPoint(entity:Entity, hitScenePosition:Vector3){
    const {x,y,z} = hitScenePosition;
    const sceneHit = Vector3.create(x, y, z);

    let currentTransform = Transform.get(entity);
    let currentEntity = entity;

    const hierarchyPositions:any[] = [];
    let hierarchyScales:any[] = [];
    let hierarchyRotations:any[] = [];
    let hitVector = Vector3.create(x, y, z);
    let position = currentTransform.position;
    let absolutePosition = currentTransform.position;

    hierarchyPositions.push(Transform.get(entity).position);
    hierarchyScales.push(Transform.get(entity).scale);
    hierarchyRotations.push(Transform.get(entity).rotation);

    let accumulatedScale = Vector3.One();
    while(currentTransform.parent){
        currentEntity = currentTransform.parent;
        currentTransform = Transform.get(currentEntity);

        hierarchyPositions.unshift(currentTransform.position);
        hierarchyScales.unshift(currentTransform.scale);
        hierarchyRotations.unshift(currentTransform.rotation);
    }
    console.log("hierarchyScales", hierarchyScales);
    console.log("hierarchyPositions,",hierarchyPositions);
    console.log("hierarchyRotations,",hierarchyRotations);

    const totalHierarchyScale = hierarchyScales.reduce((acc,current)=>Vector3.multiply(current, acc),Vector3.One());
    let previousScaleResult = Vector3.One();
    hierarchyScales = hierarchyScales.map((v,i)=>{
        console.log("MULT",v, previousScaleResult, Vector3.multiply(v, previousScaleResult ||Vector3.One()))
        return previousScaleResult = Vector3.multiply(v, previousScaleResult ||Vector3.One())
    })
    console.log("hierarchyScales2", hierarchyScales);
    console.log("hierarchyPositions",hierarchyPositions)
    const parentR:Vector3 = hierarchyPositions.reduce((acc, current, index)=>{
        const {x,y,z,w} = hierarchyRotations[index];
        const inverseRotation = Quaternion.create(-x,-y,-z,w);

        acc = Vector3.add(acc,
            Vector3.multiply(hierarchyScales[index-1] ||Vector3.One(),
                current
            ))
        acc = Vector3.rotate(acc, inverseRotation)
        return acc;
    }, Vector3.Zero());

    console.log("parentR",parentR);

    const totalHierarchyRotation = hierarchyRotations.reduce((acc, current)=>{
        return Quaternion.multiply(acc, current);
    }, Quaternion.Zero());
    console.log("totalHierarchyRotation",totalHierarchyRotation)
    console.log("totalHierarchyScale",totalHierarchyScale)
    console.log("parentRR", Vector3.divide(parentR, totalHierarchyScale));

    ////TODO POR FIIIIN
    console.log("SOL", Vector3.divide(Vector3.subtract(
        Vector3.rotate(hitVector, totalHierarchyRotation)
        , parentR),totalHierarchyScale ))
}


/*

export function getNormalizedLocalPoint(entity:Entity, hitScenePosition:Vector3){
    const {x,y,z} = hitScenePosition;
    const result = engine.getEntitiesWith(Transform);
    console.log("result", result);


    let currentTransform = Transform.get(entity);

    const hitVector = Vector3.create(x, y, z);

    let normalizedHitPoint;
    let localHitPoint;
    normalizedHitPoint = Vector3.subtract(hitVector, currentTransform.position);
    normalizedHitPoint = Vector3.divide(normalizedHitPoint, currentTransform.scale);

    let currentEntity:any = entity;

    console.log("normalizedHitPoint1",normalizedHitPoint)
    console.log("childEntity",entity);

    let normalizedPosition = Vector3.divide(currentTransform.position, currentTransform.scale);
    while(currentTransform.parent){
        console.log("currentEntity", currentEntity);
        currentEntity = currentTransform.parent;
        currentTransform = Transform.get(currentEntity);
        normalizedPosition = Vector3.multiply(normalizedPosition, Vector3.divide(currentTransform.position, currentTransform.scale))
    }

    console.log("normalizedHitPoint", Vector3.multiply(normalizedHitPoint, normalizedPosition) )
    console.log("normalizedPoisition",normalizedPosition)
}
*/


/**
 * function getNormalizedLocalHitPoint(hit:any, planeTransform:Transform){
 *   const planePosition = planeTransform.position.clone();
 *   const planeScale = planeTransform.scale.clone();
 *   const planeRotation = planeTransform.rotation.clone();
 *   const {x,y,z} = planeRotation.eulerAngles;
 *   const inverseRotation = Quaternion.Euler(-x,-y,-z);
 *   const {hitPoint} = hit;
 *   const hitVector = new Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
 *   return hitVector.subtract(planePosition).rotate(inverseRotation).divide(planeScale).subtract(new Vector3(-0.5, 0.5,0)).multiply(new Vector3(1,-1,-1));
 * }
 */