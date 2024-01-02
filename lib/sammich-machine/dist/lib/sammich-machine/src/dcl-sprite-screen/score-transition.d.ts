export declare function createGlobalScoreTransition(screen: any): {
    destroy: () => void;
    hide: () => void;
    showTransition: ({ winnerIndex, previousScores }: any) => Promise<void>;
    showFinalSprite: (trackWinnerIndex: number) => Promise<void>;
    reset: () => void;
};
