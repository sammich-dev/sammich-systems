export function tryFn(fn:Function, errorCallback:Function){
    try{
        let fnRes = fn();
        if(fnRes.catch){
            fnRes.catch((error:any)=> {
                console.error(error);
                errorCallback(error);
            })
        }
    }catch(error:any){
        console.error(error)
        errorCallback(error);
    }
}