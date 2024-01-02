import {timers} from "@dcl-sdk/utils";

export function dclSleep(milliseconds:number){//TODO rename to dclSleep
    return new Promise((resolve, reject)=>{
        timers.setTimeout(()=>{
            resolve(null)
        }, milliseconds)
    });
}