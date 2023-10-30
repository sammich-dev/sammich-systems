import {timers} from "@dcl-sdk/utils";

export function sleep(milliseconds:number){
    return new Promise((resolve, reject)=>{
        timers.setTimeout(()=>{
            resolve(null)
        }, milliseconds)
    });
}