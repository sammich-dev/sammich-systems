import {
    engine, InputAction, MeshCollider, MeshRenderer, PointerEvents, pointerEventsSystem, PointerEventType,
    Transform
} from '@dcl/sdk/ecs';

import {Vector3, Quaternion} from "@dcl/sdk/math";
import {getDebugPanel} from "../dcl-lib/debug-panel";
import "../dcl-lib/decorate-console";
import "./polyfill";
import {createMachineScreen} from "./game-machine";
import {EVENT} from "./events";

export const init = async () => {

    getDebugPanel();

    const rootEntity = engine.addEntity();
    const position = Vector3.create(8,2,8);

    Transform.create(rootEntity, {
        position
    });

    const machine = await createMachineScreen(rootEntity, {
        position:Vector3.Zero(),
        rotation:Quaternion.Zero(),
        scale: Vector3.create(192 / 40, 128 / 40, 1)
    });
    machine.onEvent(({type, data}:any)=>{
        if(type === EVENT.END_TRACK){
            workaroundButtonBug();
        }
    })

    workaroundButtonBug();


    function workaroundButtonBug(){
        const boxStartGameWorkaround = engine.addEntity();
        MeshRenderer.setBox(boxStartGameWorkaround);
        MeshCollider.setBox(boxStartGameWorkaround);
        Transform.create(boxStartGameWorkaround, {
            position:Vector3.add(position, Vector3.create(-3,-1.5,-1))
        });

        const boxJoinGameWorkaround = engine.addEntity();
        MeshRenderer.setBox(boxJoinGameWorkaround);
        MeshCollider.setBox(boxJoinGameWorkaround);
        Transform.create(boxJoinGameWorkaround, {
            position:Vector3.add(position, Vector3.create(+3,-1.5,-1))
        });

        PointerEvents.create(boxStartGameWorkaround, {pointerEvents:[{
                eventType: PointerEventType.PET_DOWN,
                eventInfo: {
                    button: InputAction.IA_POINTER,
                    showFeedback:true
                }
        }]});

        PointerEvents.create(boxJoinGameWorkaround, {pointerEvents:[{
                eventType: PointerEventType.PET_DOWN,
                eventInfo: {
                    button: InputAction.IA_POINTER,
                    showFeedback:true
                }
            }]});

        pointerEventsSystem.onPointerDown({ entity: boxStartGameWorkaround, opts:{hoverText:"Create", showFeedback:true, button:InputAction.IA_POINTER} },(event) => {
            console.log("box onClickCreate");
            machine.onClickCreate();
            engine.removeEntity(boxStartGameWorkaround);
            engine.removeEntity(boxJoinGameWorkaround);
        });
        pointerEventsSystem.onPointerDown({ entity: boxJoinGameWorkaround, opts:{hoverText:"Join", showFeedback:true, button:InputAction.IA_POINTER} },(event) => {
            console.log("box onClickJoin");
            machine.onClickJoin();
            engine.removeEntity(boxStartGameWorkaround);
            engine.removeEntity(boxJoinGameWorkaround);
        });
    }

}