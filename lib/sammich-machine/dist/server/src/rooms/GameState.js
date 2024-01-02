var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Schema, ArraySchema, type } from "@colyseus/schema";
import { PrismaClient } from "@prisma/client";
import { getRandomFromList } from "../../../lib/lib-util";
import { getGameKeys } from "../../../lib/game-repository";
import { GAME_STAGE } from "../../../lib/game-stages";
const prisma = new PrismaClient();
export class UserState extends Schema {
    constructor({ publicKey, hasConnectedWeb3, userId, version, displayName }) {
        super();
        this.publicKey = "";
        this.hasConnectedWeb3 = false;
        this.userId = "";
        this.version = 0;
        this.displayName = "";
        Object.assign(this, { publicKey: publicKey || this.publicKey, hasConnectedWeb3, userId, version, displayName });
    }
}
__decorate([
    type("string")
], UserState.prototype, "publicKey", void 0);
__decorate([
    type("boolean")
], UserState.prototype, "hasConnectedWeb3", void 0);
__decorate([
    type("string")
], UserState.prototype, "userId", void 0);
__decorate([
    type("int8")
], UserState.prototype, "version", void 0);
__decorate([
    type("string")
], UserState.prototype, "displayName", void 0);
export class SpriteState extends Schema {
    constructor({ ID, frame, x, y, playerIndex, klass, layer }) {
        super();
        this.playerIndex = -1;
        this.x = 0;
        this.y = 0;
        this.layer = 1;
        this.frame = 0;
        this.visible = false;
        this.klass = klass;
        this.ID = ID;
        this.layer = layer;
        Object.assign(this, { ID, frame, x, y, visible: true, playerIndex });
    }
}
__decorate([
    type("number")
], SpriteState.prototype, "ID", void 0);
__decorate([
    type("string")
], SpriteState.prototype, "klass", void 0);
__decorate([
    type("uint8")
], SpriteState.prototype, "playerIndex", void 0);
__decorate([
    type("uint8")
], SpriteState.prototype, "x", void 0);
__decorate([
    type("uint8")
], SpriteState.prototype, "y", void 0);
__decorate([
    type("uint8")
], SpriteState.prototype, "layer", void 0);
__decorate([
    type("uint16")
], SpriteState.prototype, "frame", void 0);
__decorate([
    type("boolean")
], SpriteState.prototype, "visible", void 0);
export class PlayerState extends Schema {
    constructor({ user, client, playerIndex }) {
        super();
        this.playerIndex = -1;
        this.instructionsReady = false;
        this.miniGameScore = 0;
        this.lastReproducedFrame = -1;
        this.spriteEntities = new ArraySchema();
        this.ready = false;
        this.playerIndex = playerIndex;
        this.user = new UserState(user);
        this.client = client;
    }
}
__decorate([
    type(UserState)
], PlayerState.prototype, "user", void 0);
__decorate([
    type("uint8")
], PlayerState.prototype, "playerIndex", void 0);
__decorate([
    type("boolean")
], PlayerState.prototype, "instructionsReady", void 0);
__decorate([
    type("number")
], PlayerState.prototype, "miniGameScore", void 0);
__decorate([
    type("uint32")
], PlayerState.prototype, "lastReproducedFrame", void 0);
__decorate([
    type([SpriteState])
], PlayerState.prototype, "spriteEntities", void 0);
__decorate([
    type("boolean")
], PlayerState.prototype, "ready", void 0);
export class ScreenState extends Schema {
    constructor() {
        super(...arguments);
        this.sprites = new ArraySchema();
    }
}
__decorate([
    type([SpriteState])
], ScreenState.prototype, "sprites", void 0);
export class MiniGameResult extends Schema {
    constructor({ score, winnerPlayerIndex }) {
        super();
        this.winnerPlayerIndex = winnerPlayerIndex;
    }
}
__decorate([
    type("uint8")
], MiniGameResult.prototype, "winnerPlayerIndex", void 0);
export class FrameEventDataSchema extends Schema {
    constructor(data) {
        super();
        this.frameNumber = data.frameNumber;
        this.playerIndex = data.playerIndex;
        this.isPressed = data.isPressed;
        this.inputActionKey = data.inputActionKey;
        this.time = data.time;
    }
}
__decorate([
    type("uint64")
], FrameEventDataSchema.prototype, "frameNumber", void 0);
__decorate([
    type("uint8")
], FrameEventDataSchema.prototype, "playerIndex", void 0);
__decorate([
    type("boolean")
], FrameEventDataSchema.prototype, "isPressed", void 0);
__decorate([
    type("uint8")
], FrameEventDataSchema.prototype, "inputActionKey", void 0);
__decorate([
    type("uint64")
], FrameEventDataSchema.prototype, "time", void 0);
export class FrameEventSchema extends Schema {
    constructor(event) {
        super();
        this.type = event.type;
        this.data = new FrameEventDataSchema(event.data);
    }
}
__decorate([
    type("uint8")
], FrameEventSchema.prototype, "type", void 0);
__decorate([
    type(FrameEventDataSchema)
], FrameEventSchema.prototype, "data", void 0);
export class InputFrameSchema extends Schema {
    constructor(frame) {
        super();
        this.index = frame.index;
        this.events = new ArraySchema();
        frame.events.forEach((e) => this.events.push(new FrameEventSchema(e)));
    }
}
__decorate([
    type("uint64")
], InputFrameSchema.prototype, "index", void 0);
__decorate([
    type([FrameEventSchema])
], InputFrameSchema.prototype, "events", void 0);
class PlayerFrameCollection extends Schema {
    constructor() {
        super(...arguments);
        this.frames = new ArraySchema();
    }
}
__decorate([
    type([InputFrameSchema])
], PlayerFrameCollection.prototype, "frames", void 0);
export class GameState extends Schema {
    constructor() {
        super();
        this.gameStage = 1;
        this.tieBreakerWinner = -1;
        this.created = Date.now();
        this.players = new ArraySchema();
        this.users = new ArraySchema();
        this.miniGameTrack = new ArraySchema();
        this.miniGameResults = new ArraySchema();
        this.screenFrames = new ArraySchema();
        this.screenFrames[0] = new PlayerFrameCollection();
        this.screenFrames[1] = new PlayerFrameCollection();
    }
    async setupNewTrack(seed = Math.random()) {
        this.resetTrack(false);
        const miniGameIDs = getGameKeys();
        while (this.miniGameTrack.length < 5) {
            this.miniGameTrack.push(getRandomFromList(miniGameIDs));
        }
        this.gameStage = GAME_STAGE.SHOWING_INSTRUCTIONS;
        return { seed, miniGameTrack: this.miniGameTrack };
    }
    resetTrack(resetPlayers = true) {
        this.created = 0;
        if (resetPlayers)
            this.players.splice(0, this.players.length);
        this.miniGameTrack.splice(0, this.miniGameTrack.length);
        this.miniGameResults.splice(0, this.miniGameResults.length);
        this.screenFrames[0].frames.splice(0, this.screenFrames[0].frames.length);
        this.screenFrames[1].frames.splice(0, this.screenFrames[1].frames.length);
        this.tieBreakerWinner = -1;
        this.gameStage = GAME_STAGE.IDLE;
    }
}
__decorate([
    type("int8")
], GameState.prototype, "gameStage", void 0);
__decorate([
    type("int8")
], GameState.prototype, "tieBreakerWinner", void 0);
__decorate([
    type("uint64")
], GameState.prototype, "created", void 0);
__decorate([
    type([PlayerState])
], GameState.prototype, "players", void 0);
__decorate([
    type([PlayerState])
], GameState.prototype, "users", void 0);
__decorate([
    type(["int8"])
], GameState.prototype, "miniGameTrack", void 0);
__decorate([
    type(["int8"])
], GameState.prototype, "miniGameResults", void 0);
__decorate([
    type([PlayerFrameCollection])
], GameState.prototype, "screenFrames", void 0);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2FtZVN0YXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc2VydmVyL3NyYy9yb29tcy9HYW1lU3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBRUEsT0FBTyxFQUFFLE1BQU0sRUFBVyxXQUFXLEVBQWEsSUFBSSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFakYsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzVDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3hELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN6RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFHcEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztBQUVsQyxNQUFNLE9BQU8sU0FBVSxTQUFRLE1BQU07SUFPakMsWUFBWSxFQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBSztRQUN2RSxLQUFLLEVBQUUsQ0FBQztRQVBJLGNBQVMsR0FBVyxFQUFFLENBQUM7UUFDdEIscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ25DLFdBQU0sR0FBVyxFQUFFLENBQUM7UUFDdEIsWUFBTyxHQUFXLENBQUMsQ0FBQztRQUNsQixnQkFBVyxHQUFXLEVBQUUsQ0FBQztRQUlyQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBQyxFQUFDLFNBQVMsRUFBQyxTQUFTLElBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBQyxDQUFDLENBQUM7SUFDOUcsQ0FBQztDQUNKO0FBVm1CO0lBQWYsSUFBSSxDQUFDLFFBQVEsQ0FBQzs0Q0FBd0I7QUFDdEI7SUFBaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQzttREFBbUM7QUFDbkM7SUFBZixJQUFJLENBQUMsUUFBUSxDQUFDO3lDQUFxQjtBQUN0QjtJQUFiLElBQUksQ0FBQyxNQUFNLENBQUM7MENBQXFCO0FBQ2xCO0lBQWYsSUFBSSxDQUFDLFFBQVEsQ0FBQzs4Q0FBMEI7QUFRN0MsTUFBTSxPQUFPLFdBQVksU0FBUSxNQUFNO0lBV25DLFlBQVksRUFBQyxFQUFFLEVBQUMsS0FBSyxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUs7UUFDckQsS0FBSyxFQUFFLENBQUM7UUFURyxnQkFBVyxHQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ3pCLE1BQUMsR0FBVyxDQUFDLENBQUM7UUFDZCxNQUFDLEdBQVcsQ0FBQyxDQUFDO1FBQ2QsVUFBSyxHQUFXLENBQUMsQ0FBQztRQUNqQixVQUFLLEdBQVUsQ0FBQyxDQUFDO1FBQ2hCLFlBQU8sR0FBVyxLQUFLLENBQUM7UUFLckMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDYixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUMsSUFBSSxFQUFFLFdBQVcsRUFBQyxDQUFDLENBQUM7SUFDdEUsQ0FBQztDQUNKO0FBakJtQjtJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7dUNBQVc7QUFDVjtJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7MENBQWM7QUFDZDtJQUFkLElBQUksQ0FBQyxPQUFPLENBQUM7Z0RBQTBCO0FBQ3pCO0lBQWQsSUFBSSxDQUFDLE9BQU8sQ0FBQztzQ0FBZTtBQUNkO0lBQWQsSUFBSSxDQUFDLE9BQU8sQ0FBQztzQ0FBZTtBQUNkO0lBQWQsSUFBSSxDQUFDLE9BQU8sQ0FBQzswQ0FBbUI7QUFDakI7SUFBZixJQUFJLENBQUMsUUFBUSxDQUFDOzBDQUFrQjtBQUNoQjtJQUFoQixJQUFJLENBQUMsU0FBUyxDQUFDOzRDQUF5QjtBQVk3QyxNQUFNLE9BQU8sV0FBWSxTQUFRLE1BQU07SUFjbkMsWUFBWSxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFrRDtRQUNwRixLQUFLLEVBQUUsQ0FBQztRQWJHLGdCQUFXLEdBQVUsQ0FBQyxDQUFDLENBQUM7UUFDdEIsc0JBQWlCLEdBQVcsS0FBSyxDQUFDO1FBQ25DLGtCQUFhLEdBQU8sQ0FBQyxDQUFDO1FBQ3RCLHdCQUFtQixHQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzNCLG1CQUFjLEdBQUcsSUFBSSxXQUFXLEVBQWUsQ0FBQztRQUtyRSxVQUFLLEdBQVcsS0FBSyxDQUFDO1FBS2xCLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxJQUFJLEdBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDekIsQ0FBQztDQUNKO0FBbkJvQjtJQUFoQixJQUFJLENBQUMsU0FBUyxDQUFDO3lDQUFVO0FBQ1g7SUFBZCxJQUFJLENBQUMsT0FBTyxDQUFDO2dEQUF5QjtBQUN0QjtJQUFoQixJQUFJLENBQUMsU0FBUyxDQUFDO3NEQUFtQztBQUNuQztJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7a0RBQXVCO0FBQ3RCO0lBQWYsSUFBSSxDQUFDLFFBQVEsQ0FBQzt3REFBaUM7QUFDM0I7SUFBcEIsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7bURBQWlEO0FBS3JFO0lBREMsSUFBSSxDQUFDLFNBQVMsQ0FBQzswQ0FDTTtBQVkxQixNQUFNLE9BQU8sV0FBWSxTQUFRLE1BQU07SUFBdkM7O1FBQ3lCLFlBQU8sR0FBRyxJQUFJLFdBQVcsRUFBZSxDQUFDO0lBQ2xFLENBQUM7Q0FBQTtBQUR3QjtJQUFwQixJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQzs0Q0FBMEM7QUFHbEUsTUFBTSxPQUFPLGNBQWUsU0FBUSxNQUFNO0lBSXRDLFlBQVksRUFBQyxLQUFLLEVBQUUsaUJBQWlCLEVBQUs7UUFDdEMsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsaUJBQWlCLEdBQUcsaUJBQWlCLENBQUM7SUFDL0MsQ0FBQztDQUNKO0FBTkc7SUFEQyxJQUFJLENBQUMsT0FBTyxDQUFDO3lEQUNXO0FBUTdCLE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxNQUFNO0lBTzVDLFlBQVksSUFBbUI7UUFDM0IsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDcEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNoQyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDMUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzFCLENBQUM7Q0FDSjtBQWRtQjtJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7eURBQXFCO0FBQ3JCO0lBQWQsSUFBSSxDQUFDLE9BQU8sQ0FBQzt5REFBcUI7QUFDbEI7SUFBaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQzt1REFBb0I7QUFDckI7SUFBZCxJQUFJLENBQUMsT0FBTyxDQUFDOzREQUF3QjtBQUN0QjtJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7a0RBQWM7QUFZakMsTUFBTSxPQUFPLGdCQUFpQixTQUFRLE1BQU07SUFJeEMsWUFBWSxLQUFnQjtRQUN4QixLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUN2QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksb0JBQW9CLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JELENBQUM7Q0FDSjtBQVJrQjtJQUFkLElBQUksQ0FBQyxPQUFPLENBQUM7OENBQWE7QUFDQztJQUEzQixJQUFJLENBQUMsb0JBQW9CLENBQUM7OENBQVU7QUFRekMsTUFBTSxPQUFPLGdCQUFpQixTQUFRLE1BQU07SUFJeEMsWUFBWSxLQUFXO1FBQ25CLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxXQUFXLEVBQW9CLENBQUM7UUFDbEQsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRSxDQUFDO0lBQzVFLENBQUM7Q0FDSjtBQVRtQjtJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7K0NBQWM7QUFDSDtJQUF6QixJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dEQUEyQjtBQVV4RCxNQUFNLHFCQUFzQixTQUFRLE1BQU07SUFBMUM7O1FBQzhCLFdBQU0sR0FBRyxJQUFJLFdBQVcsRUFBb0IsQ0FBQztJQUMzRSxDQUFDO0NBQUE7QUFENkI7SUFBekIsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztxREFBOEM7QUFHM0UsTUFBTSxPQUFPLFNBQVUsU0FBUSxNQUFNO0lBYWpDO1FBQ0ksS0FBSyxFQUFFLENBQUM7UUFiRSxjQUFTLEdBQVUsQ0FBQyxDQUFDO1FBQ3JCLHFCQUFnQixHQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzNCLFlBQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDaEIsWUFBTyxHQUFHLElBQUksV0FBVyxFQUFlLENBQUM7UUFDekMsVUFBSyxHQUFHLElBQUksV0FBVyxFQUFlLENBQUM7UUFDNUMsa0JBQWEsR0FBRyxJQUFJLFdBQVcsRUFBVSxDQUFDO1FBRTFELG9CQUFlLEdBQVksSUFBSSxXQUFXLEVBQVUsQ0FBQztRQUdyRCxpQkFBWSxHQUFHLElBQUksV0FBVyxFQUF5QixDQUFDO1FBSXBELElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1FBQ25ELElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxxQkFBcUIsRUFBRSxDQUFDO0lBQ3ZELENBQUM7SUFFRCxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ3BDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFHdkIsTUFBTSxXQUFXLEdBQUcsV0FBVyxFQUFFLENBQUM7UUFFbEMsT0FBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBRTVELENBQUM7UUFHRCxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQztRQUVqRCxPQUFPLEVBQUMsSUFBSSxFQUFFLGFBQWEsRUFBQyxJQUFJLENBQUMsYUFBYSxFQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELFVBQVUsQ0FBQyxZQUFZLEdBQUcsSUFBSTtRQUMxQixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztRQUNqQixJQUFHLFlBQVk7WUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1RCxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQztJQUNyQyxDQUFDO0NBRUo7QUE5Q2lCO0lBQWIsSUFBSSxDQUFDLE1BQU0sQ0FBQzs0Q0FBc0I7QUFDckI7SUFBYixJQUFJLENBQUMsTUFBTSxDQUFDO21EQUE4QjtBQUMzQjtJQUFmLElBQUksQ0FBQyxRQUFRLENBQUM7MENBQXNCO0FBQ2hCO0lBQXBCLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDOzBDQUEwQztBQUN6QztJQUFwQixJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQzt3Q0FBd0M7QUFDNUM7SUFBZixJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztnREFBMkM7QUFFMUQ7SUFEQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztrREFDc0M7QUFHckQ7SUFEQyxJQUFJLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDOytDQUMwQiIsInNvdXJjZXNDb250ZW50IjpbIi8vIG5vaW5zcGVjdGlvbiBKU0Fubm90YXRvclxuXG5pbXBvcnQgeyBTY2hlbWEsIENvbnRleHQsIEFycmF5U2NoZW1hLCBNYXBTY2hlbWEsIHR5cGUgfSBmcm9tIFwiQGNvbHlzZXVzL3NjaGVtYVwiO1xuaW1wb3J0IHtDbGllbnR9IGZyb20gXCJjb2x5c2V1c1wiO1xuaW1wb3J0IHtQcmlzbWFDbGllbnR9IGZyb20gXCJAcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHtnZXRSYW5kb21Gcm9tTGlzdH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9saWItdXRpbFwiO1xuaW1wb3J0IHtnZXRHYW1lS2V5c30gZnJvbSBcIi4uLy4uLy4uL2xpYi9nYW1lLXJlcG9zaXRvcnlcIjtcbmltcG9ydCB7R0FNRV9TVEFHRX0gZnJvbSBcIi4uLy4uLy4uL2xpYi9nYW1lLXN0YWdlc1wiO1xuaW1wb3J0IHtGcmFtZSwgRnJhbWVFdmVudCwgRnJhbWVFdmVudERhdGEsIElucHV0RXZlbnRSZXByZXNlbnRhdGlvbn0gZnJvbSBcIi4uLy4uLy4uL2xpYi9mcmFtZS11dGlsXCI7XG5cbmNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoKTtcblxuZXhwb3J0IGNsYXNzIFVzZXJTdGF0ZSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJzdHJpbmdcIikgcHVibGljS2V5OiBzdHJpbmcgPSBcIlwiO1xuICAgIEB0eXBlKFwiYm9vbGVhblwiKSBoYXNDb25uZWN0ZWRXZWIzOiBib29sZWFuID0gZmFsc2U7XG4gICAgQHR5cGUoXCJzdHJpbmdcIikgdXNlcklkOiBzdHJpbmcgPSBcIlwiO1xuICAgIEB0eXBlKFwiaW50OFwiKSB2ZXJzaW9uOiBudW1iZXIgPSAwO1xuICAgIEB0eXBlKFwic3RyaW5nXCIpIGRpc3BsYXlOYW1lOiBzdHJpbmcgPSBcIlwiO1xuXG4gICAgY29uc3RydWN0b3Ioe3B1YmxpY0tleSwgaGFzQ29ubmVjdGVkV2ViMywgdXNlcklkLCB2ZXJzaW9uLCBkaXNwbGF5TmFtZX06YW55KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIE9iamVjdC5hc3NpZ24odGhpcyx7cHVibGljS2V5OnB1YmxpY0tleXx8dGhpcy5wdWJsaWNLZXksIGhhc0Nvbm5lY3RlZFdlYjMsIHVzZXJJZCwgdmVyc2lvbiwgZGlzcGxheU5hbWV9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcHJpdGVTdGF0ZSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJudW1iZXJcIikgSUQ6bnVtYmVyO1xuICAgIEB0eXBlKFwic3RyaW5nXCIpIGtsYXNzOnN0cmluZztcbiAgICBAdHlwZShcInVpbnQ4XCIpIHBsYXllckluZGV4OiBudW1iZXIgPSAtMTtcbiAgICBAdHlwZShcInVpbnQ4XCIpIHg6IG51bWJlciA9IDA7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSB5OiBudW1iZXIgPSAwO1xuICAgIEB0eXBlKFwidWludDhcIikgbGF5ZXI6IG51bWJlciA9IDE7XG4gICAgQHR5cGUoXCJ1aW50MTZcIikgZnJhbWU6bnVtYmVyID0gMDtcbiAgICBAdHlwZShcImJvb2xlYW5cIikgdmlzaWJsZTpib29sZWFuID0gZmFsc2U7XG5cblxuICAgIGNvbnN0cnVjdG9yKHtJRCxmcmFtZSx4LHksIHBsYXllckluZGV4LCBrbGFzcywgbGF5ZXJ9OmFueSl7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMua2xhc3MgPSBrbGFzcztcbiAgICAgICAgdGhpcy5JRCA9IElEO1xuICAgICAgICB0aGlzLmxheWVyID0gbGF5ZXI7XG4gICAgICAgIE9iamVjdC5hc3NpZ24odGhpcywge0lELCBmcmFtZSwgeCwgeSwgdmlzaWJsZTp0cnVlLCBwbGF5ZXJJbmRleH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBsYXllclN0YXRlIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShVc2VyU3RhdGUpIHVzZXI6YW55O1xuICAgIEB0eXBlKFwidWludDhcIikgcGxheWVySW5kZXg6bnVtYmVyID0gLTE7XG4gICAgQHR5cGUoXCJib29sZWFuXCIpIGluc3RydWN0aW9uc1JlYWR5OmJvb2xlYW4gPSBmYWxzZTtcbiAgICBAdHlwZShcIm51bWJlclwiKSBtaW5pR2FtZVNjb3JlOmFueSA9IDA7XG4gICAgQHR5cGUoXCJ1aW50MzJcIikgbGFzdFJlcHJvZHVjZWRGcmFtZTpudW1iZXIgPSAtMTtcbiAgICBAdHlwZShbU3ByaXRlU3RhdGVdKSBzcHJpdGVFbnRpdGllcyA9IG5ldyBBcnJheVNjaGVtYTxTcHJpdGVTdGF0ZT4oKTsvL3Nwcml0ZXMgdGhhdCBhcmUgc2hhcmVkIHdpdGggbmV0d29yayBhbmQgYmVsb25nIG9yIGFyZSByZWxhdGVkIHRvIHBsYXllclxuXG4gICAgY2xpZW50OkNsaWVudDtcblxuICAgIEB0eXBlKFwiYm9vbGVhblwiKVxuICAgIHJlYWR5OmJvb2xlYW4gPSBmYWxzZTtcblxuXG4gICAgY29uc3RydWN0b3Ioe3VzZXIsIGNsaWVudCwgcGxheWVySW5kZXh9OiB7IHVzZXI6YW55LCBjbGllbnQ6Q2xpZW50LCBwbGF5ZXJJbmRleDpudW1iZXIgfSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnBsYXllckluZGV4ID0gcGxheWVySW5kZXg7XG4gICAgICAgIHRoaXMudXNlciA9ICBuZXcgVXNlclN0YXRlKHVzZXIpO1xuICAgICAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFNjcmVlblN0YXRlIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShbU3ByaXRlU3RhdGVdKSBzcHJpdGVzID0gbmV3IEFycmF5U2NoZW1hPFNwcml0ZVN0YXRlPigpO1xufVxuXG5leHBvcnQgY2xhc3MgTWluaUdhbWVSZXN1bHQgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwidWludDhcIilcbiAgICB3aW5uZXJQbGF5ZXJJbmRleDpudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih7c2NvcmUsIHdpbm5lclBsYXllckluZGV4fTphbnkpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy53aW5uZXJQbGF5ZXJJbmRleCA9IHdpbm5lclBsYXllckluZGV4O1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZyYW1lRXZlbnREYXRhU2NoZW1hIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcInVpbnQ2NFwiKSBmcmFtZU51bWJlcj86bnVtYmVyO1xuICAgIEB0eXBlKFwidWludDhcIikgcGxheWVySW5kZXg/Om51bWJlcjtcbiAgICBAdHlwZShcImJvb2xlYW5cIikgaXNQcmVzc2VkPzpib29sZWFuO1xuICAgIEB0eXBlKFwidWludDhcIikgaW5wdXRBY3Rpb25LZXk/Om51bWJlcjtcbiAgICBAdHlwZShcInVpbnQ2NFwiKSB0aW1lPzpudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihkYXRhOkZyYW1lRXZlbnREYXRhKXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5mcmFtZU51bWJlciA9IGRhdGEuZnJhbWVOdW1iZXI7XG4gICAgICAgIHRoaXMucGxheWVySW5kZXggPSBkYXRhLnBsYXllckluZGV4O1xuICAgICAgICB0aGlzLmlzUHJlc3NlZCA9IGRhdGEuaXNQcmVzc2VkO1xuICAgICAgICB0aGlzLmlucHV0QWN0aW9uS2V5ID0gZGF0YS5pbnB1dEFjdGlvbktleTtcbiAgICAgICAgdGhpcy50aW1lID0gZGF0YS50aW1lO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZyYW1lRXZlbnRTY2hlbWEgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwidWludDhcIikgdHlwZTpudW1iZXI7XG4gICAgQHR5cGUoRnJhbWVFdmVudERhdGFTY2hlbWEpIGRhdGE6YW55O1xuXG4gICAgY29uc3RydWN0b3IoZXZlbnQ6RnJhbWVFdmVudCl7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudHlwZSA9IGV2ZW50LnR5cGU7XG4gICAgICAgIHRoaXMuZGF0YSA9IG5ldyBGcmFtZUV2ZW50RGF0YVNjaGVtYShldmVudC5kYXRhKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW5wdXRGcmFtZVNjaGVtYSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJ1aW50NjRcIikgaW5kZXg6bnVtYmVyO1xuICAgIEB0eXBlKFtGcmFtZUV2ZW50U2NoZW1hXSkgZXZlbnRzOkZyYW1lRXZlbnRTY2hlbWFbXTtcblxuICAgIGNvbnN0cnVjdG9yKGZyYW1lOkZyYW1lKXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5pbmRleCA9IGZyYW1lLmluZGV4O1xuICAgICAgICB0aGlzLmV2ZW50cyA9IG5ldyBBcnJheVNjaGVtYTxGcmFtZUV2ZW50U2NoZW1hPigpO1xuICAgICAgICBmcmFtZS5ldmVudHMuZm9yRWFjaCgoZSkgPT4gdGhpcy5ldmVudHMucHVzaChuZXcgRnJhbWVFdmVudFNjaGVtYShlKSkgKTtcbiAgICB9XG59XG5cbmNsYXNzIFBsYXllckZyYW1lQ29sbGVjdGlvbiBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoW0lucHV0RnJhbWVTY2hlbWFdKSBmcmFtZXMgPSBuZXcgQXJyYXlTY2hlbWE8SW5wdXRGcmFtZVNjaGVtYT4oKTtcbn1cblxuZXhwb3J0IGNsYXNzIEdhbWVTdGF0ZSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJpbnQ4XCIpIGdhbWVTdGFnZTpudW1iZXIgPSAxO1xuICAgIEB0eXBlKFwiaW50OFwiKSB0aWVCcmVha2VyV2lubmVyOm51bWJlciA9IC0xO1xuICAgIEB0eXBlKFwidWludDY0XCIpIGNyZWF0ZWQgPSBEYXRlLm5vdygpO1xuICAgIEB0eXBlKFtQbGF5ZXJTdGF0ZV0pIHBsYXllcnMgPSBuZXcgQXJyYXlTY2hlbWE8UGxheWVyU3RhdGU+KCk7XG4gICAgQHR5cGUoW1BsYXllclN0YXRlXSkgdXNlcnMgPSBuZXcgQXJyYXlTY2hlbWE8UGxheWVyU3RhdGU+KCk7XG4gICAgQHR5cGUoW1wiaW50OFwiXSkgbWluaUdhbWVUcmFjayA9IG5ldyBBcnJheVNjaGVtYTxudW1iZXI+KCk7XG4gICAgQHR5cGUoW1wiaW50OFwiXSlcbiAgICBtaW5pR2FtZVJlc3VsdHM6bnVtYmVyW10gPSBuZXcgQXJyYXlTY2hlbWE8bnVtYmVyPigpO1xuXG4gICAgQHR5cGUoW1BsYXllckZyYW1lQ29sbGVjdGlvbl0pXG4gICAgc2NyZWVuRnJhbWVzID0gbmV3IEFycmF5U2NoZW1hPFBsYXllckZyYW1lQ29sbGVjdGlvbj4oKTtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnNjcmVlbkZyYW1lc1swXSA9IG5ldyBQbGF5ZXJGcmFtZUNvbGxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5zY3JlZW5GcmFtZXNbMV0gPSBuZXcgUGxheWVyRnJhbWVDb2xsZWN0aW9uKCk7XG4gICAgfVxuXG4gICAgYXN5bmMgc2V0dXBOZXdUcmFjayhzZWVkID0gTWF0aC5yYW5kb20oKSl7XG4gICAgICAgIHRoaXMucmVzZXRUcmFjayhmYWxzZSk7XG4gICAgICAgIC8vVE9ETyBEb24ndCBsb2FkIG1pbmlnYW1lcyBmcm9tIGRhdGFiYXNlIGZvciBub3csIGJlY2F1c2UgZm9yIG5vdyB3ZSBoYXZlIG1pbmktZ2FtZXMgY29kZSBpbiBsb2NhbCwgbGF0ZXIgd2Ugd2lsbCBuZWVkIHRvIGZpbHRlciBieSBzdGF0ZSwgZXRjLiBsYXRlciwgbWF5YmUgd2UgbmVlZCB0byBhZGQgbmV3IEdBTUVfU1RBR0UuREVGSU5JTkdfVFJBQ0sgb3IgdXNlIFdBSVRJTkdfUkVBRFkgJiYgIXRoaXMubWluaVRyYWNrLmxlbmd0aFxuICAgICAgIC8vIGNvbnN0IG1pbmlHYW1lSURzID0gKGF3YWl0IHByaXNtYS5nYW1lLmZpbmRNYW55KHtzZWxlY3Q6e2lkOnRydWV9fSkpLm1hcChpPT5pLmlkKTtcbiAgICAgICAgY29uc3QgbWluaUdhbWVJRHMgPSBnZXRHYW1lS2V5cygpO1xuXG4gICAgICAgIHdoaWxlKHRoaXMubWluaUdhbWVUcmFjay5sZW5ndGggPCA1KXtcbiAgICAgICAgICAgIHRoaXMubWluaUdhbWVUcmFjay5wdXNoKGdldFJhbmRvbUZyb21MaXN0KG1pbmlHYW1lSURzKSk7XG4gICAgICAgICAgICAvL3RoaXMubWluaUdhbWVUcmFjay5wdXNoKDIpO1xuICAgICAgICB9XG5cblxuICAgICAgICB0aGlzLmdhbWVTdGFnZSA9IEdBTUVfU1RBR0UuU0hPV0lOR19JTlNUUlVDVElPTlM7XG5cbiAgICAgICAgcmV0dXJuIHtzZWVkLCBtaW5pR2FtZVRyYWNrOnRoaXMubWluaUdhbWVUcmFja307XG4gICAgfVxuXG4gICAgcmVzZXRUcmFjayhyZXNldFBsYXllcnMgPSB0cnVlKXtcbiAgICAgICAgdGhpcy5jcmVhdGVkID0gMDtcbiAgICAgICAgaWYocmVzZXRQbGF5ZXJzKSB0aGlzLnBsYXllcnMuc3BsaWNlKDAsdGhpcy5wbGF5ZXJzLmxlbmd0aCk7XG4gICAgICAgIHRoaXMubWluaUdhbWVUcmFjay5zcGxpY2UoMCx0aGlzLm1pbmlHYW1lVHJhY2subGVuZ3RoKTtcbiAgICAgICAgdGhpcy5taW5pR2FtZVJlc3VsdHMuc3BsaWNlKDAsdGhpcy5taW5pR2FtZVJlc3VsdHMubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5zY3JlZW5GcmFtZXNbMF0uZnJhbWVzLnNwbGljZSgwLHRoaXMuc2NyZWVuRnJhbWVzWzBdLmZyYW1lcy5sZW5ndGgpO1xuICAgICAgICB0aGlzLnNjcmVlbkZyYW1lc1sxXS5mcmFtZXMuc3BsaWNlKDAsdGhpcy5zY3JlZW5GcmFtZXNbMV0uZnJhbWVzLmxlbmd0aCk7XG4gICAgICAgIHRoaXMudGllQnJlYWtlcldpbm5lciA9IC0xO1xuICAgICAgICB0aGlzLmdhbWVTdGFnZSA9IEdBTUVfU1RBR0UuSURMRTtcbiAgICB9XG5cbn1cblxuIl19