import {engine, InputAction, inputSystem} from '@dcl/sdk/ecs'

let callbacks: Function[] = [];

const DEFAULT_KEYS_STATE = {
    [InputAction.IA_PRIMARY]: false,
    [InputAction.IA_SECONDARY]: false,
    [InputAction.IA_POINTER]: false,
    [InputAction.IA_ACTION_3]: false,
    [InputAction.IA_ACTION_4]: false,
    [InputAction.IA_ACTION_5]: false,
    [InputAction.IA_ACTION_6]: false,
};

const state: any = {
    ...DEFAULT_KEYS_STATE
};

export function setupInputController() {
    engine.addSystem((dt) => {
        if (callbacks.length) {
            Object.keys(DEFAULT_KEYS_STATE).forEach((_key: InputAction | string) => {
                const key = Number(_key);
                if (!state[key as InputAction] && inputSystem.isPressed(key as InputAction)) {
                    state[key as InputAction] = true;

                    callbacks.forEach((fn) => fn(key, state[key as InputAction]))
                } else if (state[key as InputAction] && !inputSystem.isPressed(key as InputAction)) {
                    state[key as InputAction] = false;
                    callbacks.forEach((fn) => fn(key, state[key as InputAction]))
                }
            });
        }
    });
}

export function getInputState(){
    return state;
}

export function onInputKeyEvent(fnCAllback: Function) {
    callbacks.push(fnCAllback);
    return () => callbacks.splice(callbacks.indexOf(fnCAllback), 1)
}