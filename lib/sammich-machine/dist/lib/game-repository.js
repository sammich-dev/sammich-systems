import { SammichGame } from "../games/sammich-game";
import { DifferenceGame } from "../games/difference-game";
import { FrogGame } from "../games/frog-game";
import { AttackGame } from "../games/attack-game";
import { MathGame } from "../games/math-game";
const games = new Map();
export const setupGameRepository = () => {
    games.set(1, SammichGame);
    games.set(2, DifferenceGame);
    games.set(3, FrogGame);
    games.set(4, AttackGame);
    games.set(5, MathGame);
    console.log("game id's", Array.from(games.keys()));
};
export const getGames = () => games;
export const getGameKeys = () => Array.from(games.keys());
export const getGame = (id) => games.get(id);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1yZXBvc2l0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vZ2FtZS1yZXBvc2l0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNsRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUV4QixNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxHQUFHLEVBQUU7SUFDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDMUIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDN0IsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdkIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDekIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFFdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRXZELENBQUMsQ0FBQTtBQUVELE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBRyxHQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUM7QUFDbkMsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7QUFFMUQsTUFBTSxDQUFDLE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBUyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU2FtbWljaEdhbWUgfSBmcm9tIFwiLi4vZ2FtZXMvc2FtbWljaC1nYW1lXCI7XG5pbXBvcnQgeyBEaWZmZXJlbmNlR2FtZSB9IGZyb20gXCIuLi9nYW1lcy9kaWZmZXJlbmNlLWdhbWVcIjtcbmltcG9ydCB7IEZyb2dHYW1lIH0gZnJvbSBcIi4uL2dhbWVzL2Zyb2ctZ2FtZVwiO1xuaW1wb3J0IHsgQXR0YWNrR2FtZSB9IGZyb20gXCIuLi9nYW1lcy9hdHRhY2stZ2FtZVwiO1xuaW1wb3J0IHsgTWF0aEdhbWUgfSBmcm9tIFwiLi4vZ2FtZXMvbWF0aC1nYW1lXCI7XG5cbmNvbnN0IGdhbWVzID0gbmV3IE1hcCgpO1xuXG5leHBvcnQgY29uc3Qgc2V0dXBHYW1lUmVwb3NpdG9yeSA9ICgpID0+IHtcbiAgICBnYW1lcy5zZXQoMSwgU2FtbWljaEdhbWUpO1xuICAgIGdhbWVzLnNldCgyLCBEaWZmZXJlbmNlR2FtZSk7XG4gICAgZ2FtZXMuc2V0KDMsIEZyb2dHYW1lKTtcbiAgICBnYW1lcy5zZXQoNCwgQXR0YWNrR2FtZSk7XG4gICAgZ2FtZXMuc2V0KDUsIE1hdGhHYW1lKTtcblxuICAgIGNvbnNvbGUubG9nKFwiZ2FtZSBpZCdzXCIsIEFycmF5LmZyb20oZ2FtZXMua2V5cygpKSk7XG5cbn1cblxuZXhwb3J0IGNvbnN0IGdldEdhbWVzID0gKCk9PiBnYW1lcztcbmV4cG9ydCBjb25zdCBnZXRHYW1lS2V5cyA9ICgpID0+IEFycmF5LmZyb20oZ2FtZXMua2V5cygpKTtcblxuZXhwb3J0IGNvbnN0IGdldEdhbWUgPSAoaWQ6bnVtYmVyKSA9PiBnYW1lcy5nZXQoaWQpXG5cbiJdfQ==