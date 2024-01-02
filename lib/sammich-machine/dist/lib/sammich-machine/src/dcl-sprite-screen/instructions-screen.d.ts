import { TransformType } from "@dcl/ecs/dist/components/manual/Transform";
export declare const createInstructionScreen: ({ transform, gameAlias, gameInstructions, playerIndex }: {
    transform: TransformType;
    gameAlias: string;
    gameInstructions: string;
    playerIndex: number;
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
