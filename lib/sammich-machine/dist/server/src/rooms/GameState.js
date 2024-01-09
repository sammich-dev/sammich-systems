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
    type("string")
], GameState.prototype, "gameInstanceId", void 0);
__decorate([
    type([PlayerFrameCollection])
], GameState.prototype, "screenFrames", void 0);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2FtZVN0YXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc2VydmVyL3NyYy9yb29tcy9HYW1lU3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBRUEsT0FBTyxFQUFFLE1BQU0sRUFBVyxXQUFXLEVBQWEsSUFBSSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFakYsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzVDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3hELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN6RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFHcEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztBQUVsQyxNQUFNLE9BQU8sU0FBVSxTQUFRLE1BQU07SUFPakMsWUFBWSxFQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBSztRQUN2RSxLQUFLLEVBQUUsQ0FBQztRQVBJLGNBQVMsR0FBVyxFQUFFLENBQUM7UUFDdEIscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ25DLFdBQU0sR0FBVyxFQUFFLENBQUM7UUFDdEIsWUFBTyxHQUFXLENBQUMsQ0FBQztRQUNsQixnQkFBVyxHQUFXLEVBQUUsQ0FBQztRQUlyQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBQyxFQUFDLFNBQVMsRUFBQyxTQUFTLElBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBQyxDQUFDLENBQUM7SUFDOUcsQ0FBQztDQUNKO0FBVm1CO0lBQWYsSUFBSSxDQUFDLFFBQVEsQ0FBQzs0Q0FBd0I7QUFDdEI7SUFBaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQzttREFBbUM7QUFD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Q0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUM7K0NBQzBCIiwic291cmNlc0NvbnRlbnQiOlsiLy8gbm9pbnNwZWN0aW9uIEpTQW5ub3RhdG9yXG5cbmltcG9ydCB7IFNjaGVtYSwgQ29udGV4dCwgQXJyYXlTY2hlbWEsIE1hcFNjaGVtYSwgdHlwZSB9IGZyb20gXCJAY29seXNldXMvc2NoZW1hXCI7XG5pbXBvcnQge0NsaWVudH0gZnJvbSBcImNvbHlzZXVzXCI7XG5pbXBvcnQge1ByaXNtYUNsaWVudH0gZnJvbSBcIkBwcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQge2dldFJhbmRvbUZyb21MaXN0fSBmcm9tIFwiLi4vLi4vLi4vbGliL2xpYi11dGlsXCI7XG5pbXBvcnQge2dldEdhbWVLZXlzfSBmcm9tIFwiLi4vLi4vLi4vbGliL2dhbWUtcmVwb3NpdG9yeVwiO1xuaW1wb3J0IHtHQU1FX1NUQUdFfSBmcm9tIFwiLi4vLi4vLi4vbGliL2dhbWUtc3RhZ2VzXCI7XG5pbXBvcnQge0ZyYW1lLCBGcmFtZUV2ZW50LCBGcmFtZUV2ZW50RGF0YSwgSW5wdXRFdmVudFJlcHJlc2VudGF0aW9ufSBmcm9tIFwiLi4vLi4vLi4vbGliL2ZyYW1lLXV0aWxcIjtcblxuY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCgpO1xuXG5leHBvcnQgY2xhc3MgVXNlclN0YXRlIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcInN0cmluZ1wiKSBwdWJsaWNLZXk6IHN0cmluZyA9IFwiXCI7XG4gICAgQHR5cGUoXCJib29sZWFuXCIpIGhhc0Nvbm5lY3RlZFdlYjM6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBAdHlwZShcInN0cmluZ1wiKSB1c2VySWQ6IHN0cmluZyA9IFwiXCI7XG4gICAgQHR5cGUoXCJpbnQ4XCIpIHZlcnNpb246IG51bWJlciA9IDA7XG4gICAgQHR5cGUoXCJzdHJpbmdcIikgZGlzcGxheU5hbWU6IHN0cmluZyA9IFwiXCI7XG5cbiAgICBjb25zdHJ1Y3Rvcih7cHVibGljS2V5LCBoYXNDb25uZWN0ZWRXZWIzLCB1c2VySWQsIHZlcnNpb24sIGRpc3BsYXlOYW1lfTphbnkpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLHtwdWJsaWNLZXk6cHVibGljS2V5fHx0aGlzLnB1YmxpY0tleSwgaGFzQ29ubmVjdGVkV2ViMywgdXNlcklkLCB2ZXJzaW9uLCBkaXNwbGF5TmFtZX0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwcml0ZVN0YXRlIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcIm51bWJlclwiKSBJRDpudW1iZXI7XG4gICAgQHR5cGUoXCJzdHJpbmdcIikga2xhc3M6c3RyaW5nO1xuICAgIEB0eXBlKFwidWludDhcIikgcGxheWVySW5kZXg6IG51bWJlciA9IC0xO1xuICAgIEB0eXBlKFwidWludDhcIikgeDogbnVtYmVyID0gMDtcbiAgICBAdHlwZShcInVpbnQ4XCIpIHk6IG51bWJlciA9IDA7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSBsYXllcjogbnVtYmVyID0gMTtcbiAgICBAdHlwZShcInVpbnQxNlwiKSBmcmFtZTpudW1iZXIgPSAwO1xuICAgIEB0eXBlKFwiYm9vbGVhblwiKSB2aXNpYmxlOmJvb2xlYW4gPSBmYWxzZTtcblxuXG4gICAgY29uc3RydWN0b3Ioe0lELGZyYW1lLHgseSwgcGxheWVySW5kZXgsIGtsYXNzLCBsYXllcn06YW55KXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5rbGFzcyA9IGtsYXNzO1xuICAgICAgICB0aGlzLklEID0gSUQ7XG4gICAgICAgIHRoaXMubGF5ZXIgPSBsYXllcjtcbiAgICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLCB7SUQsIGZyYW1lLCB4LCB5LCB2aXNpYmxlOnRydWUsIHBsYXllckluZGV4fSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWVyU3RhdGUgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFVzZXJTdGF0ZSkgdXNlcjphbnk7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSBwbGF5ZXJJbmRleDpudW1iZXIgPSAtMTtcbiAgICBAdHlwZShcImJvb2xlYW5cIikgaW5zdHJ1Y3Rpb25zUmVhZHk6Ym9vbGVhbiA9IGZhbHNlO1xuICAgIEB0eXBlKFwibnVtYmVyXCIpIG1pbmlHYW1lU2NvcmU6YW55ID0gMDtcbiAgICBAdHlwZShcInVpbnQzMlwiKSBsYXN0UmVwcm9kdWNlZEZyYW1lOm51bWJlciA9IC0xO1xuICAgIEB0eXBlKFtTcHJpdGVTdGF0ZV0pIHNwcml0ZUVudGl0aWVzID0gbmV3IEFycmF5U2NoZW1hPFNwcml0ZVN0YXRlPigpOy8vc3ByaXRlcyB0aGF0IGFyZSBzaGFyZWQgd2l0aCBuZXR3b3JrIGFuZCBiZWxvbmcgb3IgYXJlIHJlbGF0ZWQgdG8gcGxheWVyXG5cbiAgICBjbGllbnQ6Q2xpZW50O1xuXG4gICAgQHR5cGUoXCJib29sZWFuXCIpXG4gICAgcmVhZHk6Ym9vbGVhbiA9IGZhbHNlO1xuXG5cbiAgICBjb25zdHJ1Y3Rvcih7dXNlciwgY2xpZW50LCBwbGF5ZXJJbmRleH06IHsgdXNlcjphbnksIGNsaWVudDpDbGllbnQsIHBsYXllckluZGV4Om51bWJlciB9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMucGxheWVySW5kZXggPSBwbGF5ZXJJbmRleDtcbiAgICAgICAgdGhpcy51c2VyID0gIG5ldyBVc2VyU3RhdGUodXNlcik7XG4gICAgICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xuICAgIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgU2NyZWVuU3RhdGUgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFtTcHJpdGVTdGF0ZV0pIHNwcml0ZXMgPSBuZXcgQXJyYXlTY2hlbWE8U3ByaXRlU3RhdGU+KCk7XG59XG5cbmV4cG9ydCBjbGFzcyBNaW5pR2FtZVJlc3VsdCBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJ1aW50OFwiKVxuICAgIHdpbm5lclBsYXllckluZGV4Om51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHtzY29yZSwgd2lubmVyUGxheWVySW5kZXh9OmFueSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLndpbm5lclBsYXllckluZGV4ID0gd2lubmVyUGxheWVySW5kZXg7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgRnJhbWVFdmVudERhdGFTY2hlbWEgZXh0ZW5kcyBTY2hlbWEge1xuICAgIEB0eXBlKFwidWludDY0XCIpIGZyYW1lTnVtYmVyPzpudW1iZXI7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSBwbGF5ZXJJbmRleD86bnVtYmVyO1xuICAgIEB0eXBlKFwiYm9vbGVhblwiKSBpc1ByZXNzZWQ/OmJvb2xlYW47XG4gICAgQHR5cGUoXCJ1aW50OFwiKSBpbnB1dEFjdGlvbktleT86bnVtYmVyO1xuICAgIEB0eXBlKFwidWludDY0XCIpIHRpbWU/Om51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGRhdGE6RnJhbWVFdmVudERhdGEpe1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmZyYW1lTnVtYmVyID0gZGF0YS5mcmFtZU51bWJlcjtcbiAgICAgICAgdGhpcy5wbGF5ZXJJbmRleCA9IGRhdGEucGxheWVySW5kZXg7XG4gICAgICAgIHRoaXMuaXNQcmVzc2VkID0gZGF0YS5pc1ByZXNzZWQ7XG4gICAgICAgIHRoaXMuaW5wdXRBY3Rpb25LZXkgPSBkYXRhLmlucHV0QWN0aW9uS2V5O1xuICAgICAgICB0aGlzLnRpbWUgPSBkYXRhLnRpbWU7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgRnJhbWVFdmVudFNjaGVtYSBleHRlbmRzIFNjaGVtYSB7XG4gICAgQHR5cGUoXCJ1aW50OFwiKSB0eXBlOm51bWJlcjtcbiAgICBAdHlwZShGcmFtZUV2ZW50RGF0YVNjaGVtYSkgZGF0YTphbnk7XG5cbiAgICBjb25zdHJ1Y3RvcihldmVudDpGcmFtZUV2ZW50KXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy50eXBlID0gZXZlbnQudHlwZTtcbiAgICAgICAgdGhpcy5kYXRhID0gbmV3IEZyYW1lRXZlbnREYXRhU2NoZW1hKGV2ZW50LmRhdGEpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnB1dEZyYW1lU2NoZW1hIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcInVpbnQ2NFwiKSBpbmRleDpudW1iZXI7XG4gICAgQHR5cGUoW0ZyYW1lRXZlbnRTY2hlbWFdKSBldmVudHM6RnJhbWVFdmVudFNjaGVtYVtdO1xuXG4gICAgY29uc3RydWN0b3IoZnJhbWU6RnJhbWUpe1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmluZGV4ID0gZnJhbWUuaW5kZXg7XG4gICAgICAgIHRoaXMuZXZlbnRzID0gbmV3IEFycmF5U2NoZW1hPEZyYW1lRXZlbnRTY2hlbWE+KCk7XG4gICAgICAgIGZyYW1lLmV2ZW50cy5mb3JFYWNoKChlKSA9PiB0aGlzLmV2ZW50cy5wdXNoKG5ldyBGcmFtZUV2ZW50U2NoZW1hKGUpKSApO1xuICAgIH1cbn1cblxuY2xhc3MgUGxheWVyRnJhbWVDb2xsZWN0aW9uIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShbSW5wdXRGcmFtZVNjaGVtYV0pIGZyYW1lcyA9IG5ldyBBcnJheVNjaGVtYTxJbnB1dEZyYW1lU2NoZW1hPigpO1xufVxuXG5leHBvcnQgY2xhc3MgR2FtZVN0YXRlIGV4dGVuZHMgU2NoZW1hIHtcbiAgICBAdHlwZShcImludDhcIikgZ2FtZVN0YWdlOm51bWJlciA9IDE7XG4gICAgQHR5cGUoXCJpbnQ4XCIpIHRpZUJyZWFrZXJXaW5uZXI6bnVtYmVyID0gLTE7XG4gICAgQHR5cGUoXCJ1aW50NjRcIikgY3JlYXRlZCA9IERhdGUubm93KCk7XG4gICAgQHR5cGUoW1BsYXllclN0YXRlXSkgcGxheWVycyA9IG5ldyBBcnJheVNjaGVtYTxQbGF5ZXJTdGF0ZT4oKTtcbiAgICBAdHlwZShbUGxheWVyU3RhdGVdKSB1c2VycyA9IG5ldyBBcnJheVNjaGVtYTxQbGF5ZXJTdGF0ZT4oKTtcbiAgICBAdHlwZShbXCJpbnQ4XCJdKSBtaW5pR2FtZVRyYWNrID0gbmV3IEFycmF5U2NoZW1hPG51bWJlcj4oKTtcbiAgICBAdHlwZShbXCJpbnQ4XCJdKVxuICAgIG1pbmlHYW1lUmVzdWx0czpudW1iZXJbXSA9IG5ldyBBcnJheVNjaGVtYTxudW1iZXI+KCk7XG5cbiAgICBAdHlwZShcInN0cmluZ1wiKVxuICAgIGdhbWVJbnN0YW5jZUlkOnN0cmluZyA9IFwiMCwwXCI7XG5cbiAgICBAdHlwZShbUGxheWVyRnJhbWVDb2xsZWN0aW9uXSlcbiAgICBzY3JlZW5GcmFtZXMgPSBuZXcgQXJyYXlTY2hlbWE8UGxheWVyRnJhbWVDb2xsZWN0aW9uPigpO1xuXG4gICAgY29uc3RydWN0b3IoZ2FtZUluc3RhbmNlSWQ6c3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiR2FtZVN0YXRlIGNvbnN0cnVjdG9yXCIsIGdhbWVJbnN0YW5jZUlkKVxuICAgICAgICB0aGlzLmdhbWVJbnN0YW5jZUlkID0gZ2FtZUluc3RhbmNlSWQ7XG4gICAgICAgIGNvbnNvbGUubG9nKFwic3RhdGUgZ2FtZUluc3RhbmNlSWRcIiwgdGhpcy5nYW1lSW5zdGFuY2VJZClcbiAgICAgICAgdGhpcy5zY3JlZW5GcmFtZXNbMF0gPSBuZXcgUGxheWVyRnJhbWVDb2xsZWN0aW9uKCk7XG4gICAgICAgIHRoaXMuc2NyZWVuRnJhbWVzWzFdID0gbmV3IFBsYXllckZyYW1lQ29sbGVjdGlvbigpO1xuICAgIH1cblxuICAgIGFzeW5jIHNldHVwTmV3VHJhY2soc2VlZCA9IE1hdGgucmFuZG9tKCkpe1xuICAgICAgICB0aGlzLnJlc2V0VHJhY2soZmFsc2UpO1xuICAgICAgICAvL1RPRE8gRG9uJ3QgbG9hZCBtaW5pZ2FtZXMgZnJvbSBkYXRhYmFzZSBmb3Igbm93LCBiZWNhdXNlIGZvciBub3cgd2UgaGF2ZSBtaW5pLWdhbWVzIGNvZGUgaW4gbG9jYWwsIGxhdGVyIHdlIHdpbGwgbmVlZCB0byBmaWx0ZXIgYnkgc3RhdGUsIGV0Yy4gbGF0ZXIsIG1heWJlIHdlIG5lZWQgdG8gYWRkIG5ldyBHQU1FX1NUQUdFLkRFRklOSU5HX1RSQUNLIG9yIHVzZSBXQUlUSU5HX1JFQURZICYmICF0aGlzLm1pbmlUcmFjay5sZW5ndGhcbiAgICAgICAvLyBjb25zdCBtaW5pR2FtZUlEcyA9IChhd2FpdCBwcmlzbWEuZ2FtZS5maW5kTWFueSh7c2VsZWN0OntpZDp0cnVlfX0pKS5tYXAoaT0+aS5pZCk7XG4gICAgICAgIGNvbnN0IG1pbmlHYW1lSURzID0gZ2V0R2FtZUtleXMoKTtcblxuICAgICAgICB3aGlsZSh0aGlzLm1pbmlHYW1lVHJhY2subGVuZ3RoIDwgNSl7XG4gICAgICAgICAgICB0aGlzLm1pbmlHYW1lVHJhY2sucHVzaChnZXRSYW5kb21Gcm9tTGlzdChtaW5pR2FtZUlEcykpO1xuICAgICAgICAgICAgLy90aGlzLm1pbmlHYW1lVHJhY2sucHVzaCgyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgdGhpcy5nYW1lU3RhZ2UgPSBHQU1FX1NUQUdFLlNIT1dJTkdfSU5TVFJVQ1RJT05TO1xuXG4gICAgICAgIHJldHVybiB7c2VlZCwgbWluaUdhbWVUcmFjazp0aGlzLm1pbmlHYW1lVHJhY2t9O1xuICAgIH1cblxuICAgIHJlc2V0VHJhY2socmVzZXRQbGF5ZXJzID0gdHJ1ZSl7XG4gICAgICAgIHRoaXMuY3JlYXRlZCA9IDA7XG4gICAgICAgIGlmKHJlc2V0UGxheWVycykgdGhpcy5wbGF5ZXJzLnNwbGljZSgwLHRoaXMucGxheWVycy5sZW5ndGgpO1xuICAgICAgICB0aGlzLm1pbmlHYW1lVHJhY2suc3BsaWNlKDAsdGhpcy5taW5pR2FtZVRyYWNrLmxlbmd0aCk7XG4gICAgICAgIHRoaXMubWluaUdhbWVSZXN1bHRzLnNwbGljZSgwLHRoaXMubWluaUdhbWVSZXN1bHRzLmxlbmd0aCk7XG4gICAgICAgIHRoaXMuc2NyZWVuRnJhbWVzWzBdLmZyYW1lcy5zcGxpY2UoMCx0aGlzLnNjcmVlbkZyYW1lc1swXS5mcmFtZXMubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5zY3JlZW5GcmFtZXNbMV0uZnJhbWVzLnNwbGljZSgwLHRoaXMuc2NyZWVuRnJhbWVzWzFdLmZyYW1lcy5sZW5ndGgpO1xuICAgICAgICB0aGlzLnRpZUJyZWFrZXJXaW5uZXIgPSAtMTtcbiAgICAgICAgdGhpcy5nYW1lU3RhZ2UgPSBHQU1FX1NUQUdFLklETEU7XG4gICAgfVxuXG59XG5cbiJdfQ==