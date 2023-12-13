export function waitFor(check:Function, intervalMs:number = 100){
    return new Promise(async (resolve, reject)=>{
        try{
            let resolved = false;
            while(!resolved){
                resolved = check();
                if(intervalMs) await sleep(100);
            }
            resolve(resolved);
        }catch(error){
            reject(error)
        }
    })
}

export function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
