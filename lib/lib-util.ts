
export const cloneDeep = (o:any) => JSON.parse(JSON.stringify(o));

export function getRandomFromList(list:any[], exclude?:(()=>any)|any[]|any){
    if(!list?.length) return undefined;
    let iterations;//TODO to implement infinite loop protection
    //TODO check if all items are excluded
    let index = getRandomInt(0,list.length-1);
    if(list.every((item:any)=>{
        if(exclude && exclude instanceof Array) {
            return ~exclude.indexOf(item)
        } else if(typeof exclude === 'function'){
            return exclude(item);
        }else if(exclude !== undefined){
            return exclude === item;
        }
    })){
        throw Error("All items on list are excluded");
    }
    if(exclude && exclude instanceof Array) {
        while (~exclude.indexOf(list[index])) {
            index = getRandomInt(0, list.length - 1);
        }
    }else if(typeof exclude === 'function'){
        while(exclude(list[index])){
            index = getRandomInt(0, list.length - 1)
        }

    }else if(exclude !== undefined){
        while(list[index] === exclude){
            index = getRandomInt(0,list.length-1);
        }
    }

    return list[index];
}

export function getRandomInt(min:number, max:number) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

export function waitFor(check:Function, intervalMs:number = 100){
    return new Promise((resolve, reject)=>{
        try{
            let resolved = false;
            while(!resolved){
                resolved = check();
            }
            resolve(resolved);
        }catch(error){
            reject(error)
        }


    })
}