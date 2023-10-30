import {ReactEcs, ReactEcsRenderer, UiEntity} from '@dcl/sdk/react-ecs';

import {Vector3,Color4} from "@dcl/sdk/math";
let debugPanel:any;
const state = {};

ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity
        uiTransform={{
            width: '300px',
            height: '100%',
        }}
        uiBackground={{ color: Color4.create(0.5, 0.8, 0.1, 0.3) }}
    >
        <UiEntity
            uiTransform={{
                width: '300px',
                height: '100%',
                margin:{top:"300"}
            }}
            uiText={{ value: state && `STATE:\n\n`+JSON.stringify(state,null,"  "), font:"monospace", fontSize:12, textAlign:"top-left" }}
            uiBackground={{ color: Color4.create(0.1, 0.8, 0.8, 0.3) }}
        />
    </UiEntity>
));

function createDebugPanel(){
    return {
        setState:(o:any) => Object.assign(state, o),
        getState:()=>state
    };
}

export function getDebugPanel(){
    if(!debugPanel) debugPanel = createDebugPanel();

    return debugPanel;
}
