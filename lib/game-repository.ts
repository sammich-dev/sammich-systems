import {SammichGame} from "../games/sammich-game";
import {DifferenceGame} from "../games/difference-game";
import {FrogGame} from "../games/frog-game";

const games = new Map();
export const setupGameRepository = () => {
    games.set(1, SammichGame);
    games.set(2, DifferenceGame);
    games.set(3, FrogGame);
}

export const getGame = (id:number) => games.get(id)

