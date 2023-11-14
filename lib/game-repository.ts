import {SammichGame} from "../games/sammich-game";
import {DifferenceGame} from "../games/difference-game";

const games = new Map();
export const setupGameRepository = () => {
    games.set(1, SammichGame);
    games.set(2, DifferenceGame);
}

export const getGame = (id:number) => games.get(id)

