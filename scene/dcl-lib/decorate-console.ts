const _log = console.log;


const state:any = {
    format: "color:green;",
    prefix: "-->"
}

console.log = (...args) => {
    if(typeof state.prefix === "function"){
        state.format
            ? _log("%cHello", state.format)
            : _log(state.prefix(), ...args)
    }else{
        state.format
            ? _log("%cHello", state.format)
            : _log(state.prefix, ...args)
    }

}

export function decorateConsole(prefix: string|Function = "", format:string = "") {
    state.prefix = prefix;
    state.format = format;//TODO this is not working, because original log was already decorated
}
decorateConsole(()=>{
    const d = new Date();
    return `${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}:${d.getMilliseconds().toString().padStart(3,"0")}-->`
});