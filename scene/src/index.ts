import {init} from "./game";
import {sleep} from "../dcl-lib/sleep";
import {createGlobalScoreTransition} from "./score-transition";

(async()=>{
    await sleep(1300);
    init();


})();



