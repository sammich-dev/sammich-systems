export const compose = (...fns) => (initialVal) => fns.reduceRight((val, fn) => fn(val), initialVal);
export const pipe = (fn1, ...fns) => {
    const piped = fns.reduce((prevFn, nextFn) => (value) => nextFn(prevFn(value)), value => value);
    return (...args) => piped(fn1(...args));
};
export const memoize = (fn) => {
    const cache = {};
    return (...args) => {
        let n = args[0];
        if (n in cache) {
            return cache[n];
        }
        else {
            let result = fn(n);
            cache[n] = result;
            return result;
        }
    };
};
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function tryFn(fn, errorCallback) {
    try {
        let fnRes = fn();
        if (fnRes.catch) {
            fnRes.catch((error) => {
                console.error(error);
                errorCallback(error);
            });
        }
    }
    catch (error) {
        console.error(error);
        errorCallback(error);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnVuY3Rpb25hbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9kY2wtc3ByaXRlLXNjcmVlbi9mdW5jdGlvbmFsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxDQUFDLEdBQUcsR0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDLFVBQWMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMvRyxNQUFNLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FDaEIsR0FBc0IsRUFDdEIsR0FBRyxHQUF1QixFQUM1QixFQUFFO0lBQ0EsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNsRyxPQUFPLENBQUMsR0FBRyxJQUFPLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQy9DLENBQUMsQ0FBQztBQUNGLE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxDQUFDLEVBQVcsRUFBRSxFQUFFO0lBQ25DLE1BQU0sS0FBSyxHQUFPLEVBQUUsQ0FBQztJQUNyQixPQUFPLENBQUMsR0FBRyxJQUFVLEVBQUUsRUFBRTtRQUNyQixJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEIsSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUM7WUFDYixPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQixDQUFDO2FBQU0sQ0FBQztZQUNKLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQixLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO1lBQ2xCLE9BQU8sTUFBTSxDQUFDO1FBQ2xCLENBQUM7SUFDTCxDQUFDLENBQUE7QUFDTCxDQUFDLENBQUE7QUFFRCxNQUFNLFVBQVUsS0FBSyxDQUFDLEVBQVM7SUFDM0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBRUQsTUFBTSxVQUFVLEtBQUssQ0FBQyxFQUFXLEVBQUUsYUFBc0I7SUFDckQsSUFBRyxDQUFDO1FBQ0EsSUFBSSxLQUFLLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDakIsSUFBRyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUM7WUFDWixLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBUyxFQUFDLEVBQUU7Z0JBQ3JCLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3JCLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixDQUFDLENBQUMsQ0FBQTtRQUNOLENBQUM7SUFDTCxDQUFDO0lBQUEsT0FBTSxLQUFTLEVBQUMsQ0FBQztRQUNkLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDcEIsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pCLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IGNvbXBvc2UgPSAoLi4uZm5zOmFueVtdKSA9PiAoaW5pdGlhbFZhbDphbnkpID0+IGZucy5yZWR1Y2VSaWdodCgodmFsLCBmbikgPT4gZm4odmFsKSwgaW5pdGlhbFZhbCk7XG5leHBvcnQgY29uc3QgcGlwZSA9IDxUIGV4dGVuZHMgYW55W10sIFU+KFxuICAgIGZuMTogKC4uLmFyZ3M6IFQpID0+IFUsXG4gICAgLi4uZm5zOiBBcnJheTwoYTogVSkgPT4gVT5cbikgPT4ge1xuICAgIGNvbnN0IHBpcGVkID0gZm5zLnJlZHVjZSgocHJldkZuLCBuZXh0Rm4pID0+ICh2YWx1ZTogVSkgPT4gbmV4dEZuKHByZXZGbih2YWx1ZSkpLCB2YWx1ZSA9PiB2YWx1ZSk7XG4gICAgcmV0dXJuICguLi5hcmdzOiBUKSA9PiBwaXBlZChmbjEoLi4uYXJncykpO1xufTtcbmV4cG9ydCBjb25zdCBtZW1vaXplID0gKGZuOkZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2FjaGU6YW55ID0ge307XG4gICAgcmV0dXJuICguLi5hcmdzOmFueVtdKSA9PiB7XG4gICAgICAgIGxldCBuID0gYXJnc1swXTtcbiAgICAgICAgaWYgKG4gaW4gY2FjaGUpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZVtuXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBmbihuKTtcbiAgICAgICAgICAgIGNhY2hlW25dID0gcmVzdWx0O1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNsZWVwKG1zOm51bWJlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyeUZuKGZuOkZ1bmN0aW9uLCBlcnJvckNhbGxiYWNrOkZ1bmN0aW9uKXtcbiAgICB0cnl7XG4gICAgICAgIGxldCBmblJlcyA9IGZuKCk7XG4gICAgICAgIGlmKGZuUmVzLmNhdGNoKXtcbiAgICAgICAgICAgIGZuUmVzLmNhdGNoKChlcnJvcjphbnkpPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIGVycm9yQ2FsbGJhY2soZXJyb3IpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1jYXRjaChlcnJvcjphbnkpe1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgICAgICBlcnJvckNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG59Il19