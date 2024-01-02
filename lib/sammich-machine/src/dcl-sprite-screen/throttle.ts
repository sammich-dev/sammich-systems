import {timers} from "@dcl-sdk/utils";

export const throttle = (callback:Function, delay:number) => {
    let timeout:any;
    return (...args:any[]) => {
        if (timeout !== undefined) {
            return
        }

        timeout = timers.setTimeout(() => {
            timeout = undefined
        }, delay)

        return callback(...args)
    }
}