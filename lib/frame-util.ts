import {InputAction} from "@dcl/sdk/ecs";

export enum FrameEventType {
    INPUT
}

export type InputEventRepresentation = {
    frameNumber?:number,
    playerIndex:number,
    isPressed:boolean,
    inputActionKey:InputAction,
    time?:number
}
export type FrameEventData = InputEventRepresentation & {
    time?:number,
}
export type FrameEvent = {
    type:FrameEventType,
    data:FrameEventData
}

export type Frame = {
    index: number,
    events: FrameEvent[]
}

export function getFrameNumber(elapsedMs:number, frameMs:number){
    return Math.floor(elapsedMs/frameMs)
}

