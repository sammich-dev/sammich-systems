export declare const compose: (...fns: any[]) => (initialVal: any) => any;
export declare const pipe: <T extends any[], U>(fn1: (...args: T) => U, ...fns: ((a: U) => U)[]) => (...args: T) => U;
export declare const memoize: (fn: Function) => (...args: any[]) => any;
export declare function sleep(ms: number): Promise<unknown>;
export declare function tryFn(fn: Function, errorCallback: Function): void;
