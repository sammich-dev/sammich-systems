import { TransformType } from "@dcl/ecs/dist/components/manual/Transform";
export declare const createInstructionScreen: ({ transform, gameAlias, gameInstructions, playerIndex, baseInstructionVideoURL }: {
    transform: TransformType;
    gameAlias: string;
    gameInstructions: string;
    playerIndex: number;
    baseInstructionVideoURL: string;
}) => {
    destroy: () => void;
    getState: () => {
        timeoutStartedTime: number;
        waitingOther: boolean;
        timeout: number;
    };
    showWaitingForOtherPlayer: ({ timeout }: {
        timeout?: number;
    }) => void;
    setTimeout: (timeout: number) => void;
};
