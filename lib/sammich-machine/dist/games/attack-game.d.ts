declare function run({ game }: any): Promise<void>;
declare const AttackGame: {
    definition: {
        alias: string;
        split: boolean;
        fps: number;
        instructions: string;
    };
    run: typeof run;
};
export { AttackGame };
