import {init} from "./game";
import {sleep} from "../dcl-lib/sleep";
(async()=>{
    await sleep(1000);
    init();
})();

