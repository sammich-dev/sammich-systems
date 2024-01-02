import { InputAction } from "@dcl/sdk/ecs";
export declare enum FrameEventType {
    INPUT = 0
}
export type InputEventRepresentation = {
    frameNumber?: number;
    playerIndex: number;
    isPressed: boolean;
    inputActionKey: InputAction;
    time?: number;
};
export type FrameEventData = InputEventRepresentation & {
    time?: number;
};
export type FrameEvent = {
    type: FrameEventType;
    data: FrameEventData;
};
export type Frame = {
    index: number;
    events: FrameEvent[];
};
export declare function getFrameNumber(elapsedMs: number, frameMs: number): number;
