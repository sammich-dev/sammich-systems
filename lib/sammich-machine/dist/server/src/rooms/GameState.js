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
    constructor(gameInstanceId) {
        super();
        this.gameStage = 1;
        this.tieBreakerWinner = -1;
        this.created = Date.now();
        this.players = new ArraySchema();
        this.users = new ArraySchema();
        this.miniGameTrack = new ArraySchema();
        this.miniGameResults = new ArraySchema();
        this.seed = 1;
        this.gameInstanceId = "0,0";
        this.screenFrames = new ArraySchema();
        console.log("GameState constructor", gameInstanceId);
        this.gameInstanceId = gameInstanceId;
        console.log("state gameInstanceId", this.gameInstanceId);
        this.screenFrames[0] = new PlayerFrameCollection();
        this.screenFrames[1] = new PlayerFrameCollection();
    }
    async setupNewTrack(seed = Math.random()) {
        this.resetTrack(false);
        this.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
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
    type("uint8")
], GameState.prototype, "gameStage", void 0);
__decorate([
    type("uint8")
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
    type("uint64")
], GameState.prototype, "seed", void 0);
__decorate([
    type("string")
], GameState.prototype, "gameInstanceId", void 0);
__decorate([
    type([PlayerFrameCollection])
], GameState.prototype, "screenFrames", void 0);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2FtZVN0YXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc2VydmVyL3NyYy9yb29tcy9HYW1lU3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBRUEsT0FBTyxFQUFFLE1BQU0sRUFBVyxXQUFXLEVBQWEsSUFBSSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFakYsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzVDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3hELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN6RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFHcEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztBQUVsQyxNQUFNLE9BQU8sU0FBVSxTQUFRLE1BQU07SUFPakMsWUFBWSxFQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBSztRQUN2RSxLQUFLLEVBQUUsQ0FBQztRQVBJLGNBQVMsR0FBVyxFQUFFLENBQUM7UUFDdEIscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ25DLFdBQU0sR0FBVyxFQUFFLENBQUM7UUFDdEIsWUFBTyxHQUFXLENBQUMsQ0FBQztRQUNsQixnQkFBVyxHQUFXLEVBQUUsQ0FBQztRQUlyQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBQyxFQUFDLFNBQVMsRUFBQyxTQUFTLElBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBQyxDQUFDLENBQUM7SUFDOUcsQ0FBQztDQUNKO0FBVm1CO0lBQWYsSUFBSSxDQUFDLFFBQVEsQ0FBQzs0Q0FBd0I7QUFDdEI7SUFBaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQzttREFBbUM7QUFD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LE1BQU0sQ0FBQyxDQUFDO2dEQUEyQztBQUUxRDtJQURDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2tEQUNzQztBQUVyRDtJQURDLElBQUksQ0FBQyxRQUFRLENBQUM7dUNBQ0M7QUFHaEI7SUFEQyxJQUFJLENBQUMsUUFBUSxDQUFDO2lEQUNlO0FBRzlCO0lBREMsSUFBSSxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQzsrQ0FDMEIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBub2luc3BlY3Rpb24gSlNBbm5vdGF0b3JcblxuaW1wb3J0IHsgU2NoZW1hLCBDb250ZXh0LCBBcnJheVNjaGVtYSwgTWFwU2NoZW1hLCB0eXBlIH0gZnJvbSBcIkBjb2x5c2V1cy9zY2hlbWFcIjtcbmltcG9ydCB7Q2xpZW50fSBmcm9tIFwiY29seXNldXNcIjtcbmltcG9ydCB7UHJpc21hQ2xpZW50fSBmcm9tIFwiQHByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7Z2V0UmFuZG9tRnJvbUxpc3R9IGZyb20gXCIuLi8uLi8uLi9saWIvbGliLXV0aWxcIjtcbmltcG9ydCB7Z2V0R2FtZUtleXN9IGZyb20gXCIuLi8uLi8uLi9saWIvZ2FtZS1yZXBvc2l0b3J5XCI7XG5pbXBvcnQge0dBTUVfU1RBR0V9IGZyb20gXCIuLi8uLi8uLi9saWIvZ2FtZS1zdGFnZXNcIjtcbmltcG9ydCB7RnJhbWUsIEZyYW1lRXZlbnQsIEZyYW1lRXZlbnREYXRhLCBJbnB1dEV2ZW50UmVwcmVzZW50YXRpb259IGZyb20gXCIuLi8uLi8uLi9saWIvZnJhbWUtdXRpbFwiO1xuXG5jb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KCk7XG5cbmV4cG9ydCBjbGFzcyBVc2VyU3RhdGUgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwic3RyaW5nXCIpIHB1YmxpY0tleTogc3RyaW5nID0gXCJcIjtcbiAgICBAdHlwZShcImJvb2xlYW5cIikgaGFzQ29ubmVjdGVkV2ViMzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIEB0eXBlKFwic3RyaW5nXCIpIHVzZXJJZDogc3RyaW5nID0gXCJcIjtcbiAgICBAdHlwZShcImludDhcIikgdmVyc2lvbjogbnVtYmVyID0gMDtcbiAgICBAdHlwZShcInN0cmluZ1wiKSBkaXNwbGF5TmFtZTogc3RyaW5nID0gXCJcIjtcblxuICAgIGNvbnN0cnVjdG9yKHtwdWJsaWNLZXksIGhhc0Nvbm5lY3RlZFdlYjMsIHVzZXJJZCwgdmVyc2lvbiwgZGlzcGxheU5hbWV9OmFueSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBPYmplY3QuYXNzaWduKHRoaXMse3B1YmxpY0tleTpwdWJsaWNLZXl8fHRoaXMucHVibGljS2V5LCBoYXNDb25uZWN0ZWRXZWIzLCB1c2VySWQsIHZlcnNpb24sIGRpc3BsYXlOYW1lfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3ByaXRlU3RhdGUgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwibnVtYmVyXCIpIElEOm51bWJlcjtcbiAgICBAdHlwZShcInN0cmluZ1wiKSBrbGFzczpzdHJpbmc7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSBwbGF5ZXJJbmRleDogbnVtYmVyID0gLTE7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSB4OiBudW1iZXIgPSAwO1xuICAgIEB0eXBlKFwidWludDhcIikgeTogbnVtYmVyID0gMDtcbiAgICBAdHlwZShcInVpbnQ4XCIpIGxheWVyOiBudW1iZXIgPSAxO1xuICAgIEB0eXBlKFwidWludDE2XCIpIGZyYW1lOm51bWJlciA9IDA7XG4gICAgQHR5cGUoXCJib29sZWFuXCIpIHZpc2libGU6Ym9vbGVhbiA9IGZhbHNlO1xuXG5cbiAgICBjb25zdHJ1Y3Rvcih7SUQsZnJhbWUseCx5LCBwbGF5ZXJJbmRleCwga2xhc3MsIGxheWVyfTphbnkpe1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmtsYXNzID0ga2xhc3M7XG4gICAgICAgIHRoaXMuSUQgPSBJRDtcbiAgICAgICAgdGhpcy5sYXllciA9IGxheWVyO1xuICAgICAgICBPYmplY3QuYXNzaWduKHRoaXMsIHtJRCwgZnJhbWUsIHgsIHksIHZpc2libGU6dHJ1ZSwgcGxheWVySW5kZXh9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXJTdGF0ZSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoVXNlclN0YXRlKSB1c2VyOmFueTtcbiAgICBAdHlwZShcInVpbnQ4XCIpIHBsYXllckluZGV4Om51bWJlciA9IC0xO1xuICAgIEB0eXBlKFwiYm9vbGVhblwiKSBpbnN0cnVjdGlvbnNSZWFkeTpib29sZWFuID0gZmFsc2U7XG4gICAgQHR5cGUoXCJudW1iZXJcIikgbWluaUdhbWVTY29yZTphbnkgPSAwO1xuICAgIEB0eXBlKFwidWludDMyXCIpIGxhc3RSZXByb2R1Y2VkRnJhbWU6bnVtYmVyID0gLTE7XG4gICAgQHR5cGUoW1Nwcml0ZVN0YXRlXSkgc3ByaXRlRW50aXRpZXMgPSBuZXcgQXJyYXlTY2hlbWE8U3ByaXRlU3RhdGU+KCk7Ly9zcHJpdGVzIHRoYXQgYXJlIHNoYXJlZCB3aXRoIG5ldHdvcmsgYW5kIGJlbG9uZyBvciBhcmUgcmVsYXRlZCB0byBwbGF5ZXJcblxuICAgIGNsaWVudDpDbGllbnQ7XG5cbiAgICBAdHlwZShcImJvb2xlYW5cIilcbiAgICByZWFkeTpib29sZWFuID0gZmFsc2U7XG5cblxuICAgIGNvbnN0cnVjdG9yKHt1c2VyLCBjbGllbnQsIHBsYXllckluZGV4fTogeyB1c2VyOmFueSwgY2xpZW50OkNsaWVudCwgcGxheWVySW5kZXg6bnVtYmVyIH0pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5wbGF5ZXJJbmRleCA9IHBsYXllckluZGV4O1xuICAgICAgICB0aGlzLnVzZXIgPSAgbmV3IFVzZXJTdGF0ZSh1c2VyKTtcbiAgICAgICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTY3JlZW5TdGF0ZSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoW1Nwcml0ZVN0YXRlXSkgc3ByaXRlcyA9IG5ldyBBcnJheVNjaGVtYTxTcHJpdGVTdGF0ZT4oKTtcbn1cblxuZXhwb3J0IGNsYXNzIE1pbmlHYW1lUmVzdWx0IGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcInVpbnQ4XCIpXG4gICAgd2lubmVyUGxheWVySW5kZXg6bnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3Ioe3Njb3JlLCB3aW5uZXJQbGF5ZXJJbmRleH06YW55KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMud2lubmVyUGxheWVySW5kZXggPSB3aW5uZXJQbGF5ZXJJbmRleDtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGcmFtZUV2ZW50RGF0YVNjaGVtYSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJ1aW50NjRcIikgZnJhbWVOdW1iZXI/Om51bWJlcjtcbiAgICBAdHlwZShcInVpbnQ4XCIpIHBsYXllckluZGV4PzpudW1iZXI7XG4gICAgQHR5cGUoXCJib29sZWFuXCIpIGlzUHJlc3NlZD86Ym9vbGVhbjtcbiAgICBAdHlwZShcInVpbnQ4XCIpIGlucHV0QWN0aW9uS2V5PzpudW1iZXI7XG4gICAgQHR5cGUoXCJ1aW50NjRcIikgdGltZT86bnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoZGF0YTpGcmFtZUV2ZW50RGF0YSl7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZnJhbWVOdW1iZXIgPSBkYXRhLmZyYW1lTnVtYmVyO1xuICAgICAgICB0aGlzLnBsYXllckluZGV4ID0gZGF0YS5wbGF5ZXJJbmRleDtcbiAgICAgICAgdGhpcy5pc1ByZXNzZWQgPSBkYXRhLmlzUHJlc3NlZDtcbiAgICAgICAgdGhpcy5pbnB1dEFjdGlvbktleSA9IGRhdGEuaW5wdXRBY3Rpb25LZXk7XG4gICAgICAgIHRoaXMudGltZSA9IGRhdGEudGltZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGcmFtZUV2ZW50U2NoZW1hIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcInVpbnQ4XCIpIHR5cGU6bnVtYmVyO1xuICAgIEB0eXBlKEZyYW1lRXZlbnREYXRhU2NoZW1hKSBkYXRhOmFueTtcblxuICAgIGNvbnN0cnVjdG9yKGV2ZW50OkZyYW1lRXZlbnQpe1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnR5cGUgPSBldmVudC50eXBlO1xuICAgICAgICB0aGlzLmRhdGEgPSBuZXcgRnJhbWVFdmVudERhdGFTY2hlbWEoZXZlbnQuZGF0YSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIElucHV0RnJhbWVTY2hlbWEgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwidWludDY0XCIpIGluZGV4Om51bWJlcjtcbiAgICBAdHlwZShbRnJhbWVFdmVudFNjaGVtYV0pIGV2ZW50czpGcmFtZUV2ZW50U2NoZW1hW107XG5cbiAgICBjb25zdHJ1Y3RvcihmcmFtZTpGcmFtZSl7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuaW5kZXggPSBmcmFtZS5pbmRleDtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgQXJyYXlTY2hlbWE8RnJhbWVFdmVudFNjaGVtYT4oKTtcbiAgICAgICAgZnJhbWUuZXZlbnRzLmZvckVhY2goKGUpID0+IHRoaXMuZXZlbnRzLnB1c2gobmV3IEZyYW1lRXZlbnRTY2hlbWEoZSkpICk7XG4gICAgfVxufVxuXG5jbGFzcyBQbGF5ZXJGcmFtZUNvbGxlY3Rpb24gZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFtJbnB1dEZyYW1lU2NoZW1hXSkgZnJhbWVzID0gbmV3IEFycmF5U2NoZW1hPElucHV0RnJhbWVTY2hlbWE+KCk7XG59XG5cbmV4cG9ydCBjbGFzcyBHYW1lU3RhdGUgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwidWludDhcIikgZ2FtZVN0YWdlOm51bWJlciA9IDE7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSB0aWVCcmVha2VyV2lubmVyOm51bWJlciA9IC0xO1xuICAgIEB0eXBlKFwidWludDY0XCIpIGNyZWF0ZWQgPSBEYXRlLm5vdygpO1xuICAgIEB0eXBlKFtQbGF5ZXJTdGF0ZV0pIHBsYXllcnMgPSBuZXcgQXJyYXlTY2hlbWE8UGxheWVyU3RhdGU+KCk7XG4gICAgQHR5cGUoW1BsYXllclN0YXRlXSkgdXNlcnMgPSBuZXcgQXJyYXlTY2hlbWE8UGxheWVyU3RhdGU+KCk7XG4gICAgQHR5cGUoW1wiaW50OFwiXSkgbWluaUdhbWVUcmFjayA9IG5ldyBBcnJheVNjaGVtYTxudW1iZXI+KCk7XG4gICAgQHR5cGUoW1wiaW50OFwiXSlcbiAgICBtaW5pR2FtZVJlc3VsdHM6bnVtYmVyW10gPSBuZXcgQXJyYXlTY2hlbWE8bnVtYmVyPigpO1xuICAgIEB0eXBlKFwidWludDY0XCIpXG4gICAgc2VlZDpudW1iZXIgPSAxO1xuXG4gICAgQHR5cGUoXCJzdHJpbmdcIilcbiAgICBnYW1lSW5zdGFuY2VJZDpzdHJpbmcgPSBcIjAsMFwiO1xuXG4gICAgQHR5cGUoW1BsYXllckZyYW1lQ29sbGVjdGlvbl0pXG4gICAgc2NyZWVuRnJhbWVzID0gbmV3IEFycmF5U2NoZW1hPFBsYXllckZyYW1lQ29sbGVjdGlvbj4oKTtcblxuICAgIGNvbnN0cnVjdG9yKGdhbWVJbnN0YW5jZUlkOnN0cmluZykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkdhbWVTdGF0ZSBjb25zdHJ1Y3RvclwiLCBnYW1lSW5zdGFuY2VJZClcbiAgICAgICAgdGhpcy5nYW1lSW5zdGFuY2VJZCA9IGdhbWVJbnN0YW5jZUlkO1xuICAgICAgICBjb25zb2xlLmxvZyhcInN0YXRlIGdhbWVJbnN0YW5jZUlkXCIsIHRoaXMuZ2FtZUluc3RhbmNlSWQpXG4gICAgICAgIHRoaXMuc2NyZWVuRnJhbWVzWzBdID0gbmV3IFBsYXllckZyYW1lQ29sbGVjdGlvbigpO1xuICAgICAgICB0aGlzLnNjcmVlbkZyYW1lc1sxXSA9IG5ldyBQbGF5ZXJGcmFtZUNvbGxlY3Rpb24oKTtcbiAgICB9XG5cbiAgICBhc3luYyBzZXR1cE5ld1RyYWNrKHNlZWQgPSBNYXRoLnJhbmRvbSgpKXtcbiAgICAgICAgdGhpcy5yZXNldFRyYWNrKGZhbHNlKTtcbiAgICAgICAgdGhpcy5zZWVkID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG4gICAgICAgIC8vVE9ETyBEb24ndCBsb2FkIG1pbmlnYW1lcyBmcm9tIGRhdGFiYXNlIGZvciBub3csIGJlY2F1c2UgZm9yIG5vdyB3ZSBoYXZlIG1pbmktZ2FtZXMgY29kZSBpbiBsb2NhbCwgbGF0ZXIgd2Ugd2lsbCBuZWVkIHRvIGZpbHRlciBieSBzdGF0ZSwgZXRjLiBsYXRlciwgbWF5YmUgd2UgbmVlZCB0byBhZGQgbmV3IEdBTUVfU1RBR0UuREVGSU5JTkdfVFJBQ0sgb3IgdXNlIFdBSVRJTkdfUkVBRFkgJiYgIXRoaXMubWluaVRyYWNrLmxlbmd0aFxuICAgICAgIC8vIGNvbnN0IG1pbmlHYW1lSURzID0gKGF3YWl0IHByaXNtYS5nYW1lLmZpbmRNYW55KHtzZWxlY3Q6e2lkOnRydWV9fSkpLm1hcChpPT5pLmlkKTtcbiAgICAgICAgY29uc3QgbWluaUdhbWVJRHMgPSBnZXRHYW1lS2V5cygpO1xuXG4gICAgICAgIHdoaWxlKHRoaXMubWluaUdhbWVUcmFjay5sZW5ndGggPCA1KXtcbiAgICAgICAgICAgIHRoaXMubWluaUdhbWVUcmFjay5wdXNoKGdldFJhbmRvbUZyb21MaXN0KG1pbmlHYW1lSURzKSk7XG4gICAgICAgICAgICAvL3RoaXMubWluaUdhbWVUcmFjay5wdXNoKDIpO1xuICAgICAgICB9XG5cblxuICAgICAgICB0aGlzLmdhbWVTdGFnZSA9IEdBTUVfU1RBR0UuU0hPV0lOR19JTlNUUlVDVElPTlM7XG5cbiAgICAgICAgcmV0dXJuIHtzZWVkLCBtaW5pR2FtZVRyYWNrOnRoaXMubWluaUdhbWVUcmFja307XG4gICAgfVxuXG4gICAgcmVzZXRUcmFjayhyZXNldFBsYXllcnMgPSB0cnVlKXtcbiAgICAgICAgdGhpcy5jcmVhdGVkID0gMDtcbiAgICAgICAgaWYocmVzZXRQbGF5ZXJzKSB0aGlzLnBsYXllcnMuc3BsaWNlKDAsdGhpcy5wbGF5ZXJzLmxlbmd0aCk7XG4gICAgICAgIHRoaXMubWluaUdhbWVUcmFjay5zcGxpY2UoMCx0aGlzLm1pbmlHYW1lVHJhY2subGVuZ3RoKTtcbiAgICAgICAgdGhpcy5taW5pR2FtZVJlc3VsdHMuc3BsaWNlKDAsdGhpcy5taW5pR2FtZVJlc3VsdHMubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5zY3JlZW5GcmFtZXNbMF0uZnJhbWVzLnNwbGljZSgwLHRoaXMuc2NyZWVuRnJhbWVzWzBdLmZyYW1lcy5sZW5ndGgpO1xuICAgICAgICB0aGlzLnNjcmVlbkZyYW1lc1sxXS5mcmFtZXMuc3BsaWNlKDAsdGhpcy5zY3JlZW5GcmFtZXNbMV0uZnJhbWVzLmxlbmd0aCk7XG4gICAgICAgIHRoaXMudGllQnJlYWtlcldpbm5lciA9IC0xO1xuICAgICAgICB0aGlzLmdhbWVTdGFnZSA9IEdBTUVfU1RBR0UuSURMRTtcbiAgICB9XG5cbn1cblxuIl19