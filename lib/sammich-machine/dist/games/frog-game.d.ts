declare function run({ game }: any): Promise<void>;
declare const FrogGame: {
    definition: {
        alias: string;
        split: boolean;
        fps: number;
        instructions: string;
    };
    run: typeof run;
};
export { FrogGame };
