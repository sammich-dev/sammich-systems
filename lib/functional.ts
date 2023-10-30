export const compose = (...fns:any[]) => (initialVal:any) => fns.reduceRight((val, fn) => fn(val), initialVal);
export const pipe = <T extends any[], U>(
    fn1: (...args: T) => U,
    ...fns: Array<(a: U) => U>
) => {
    const piped = fns.reduce((prevFn, nextFn) => (value: U) => nextFn(prevFn(value)), value => value);
    return (...args: T) => piped(fn1(...args));
};
export const memoize = (fn:Function) => {
    const cache:any = {};
    return (...args:any[]) => {
        let n = args[0];
        if (n in cache) {
            return cache[n];
        } else {
            let result = fn(n);
            cache[n] = result;
            return result;
        }
    }
}