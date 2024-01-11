# Sammich System (for Decentraland)
<img src="https://cdn.publish0x.com/prod/fs/cachedimages/2399835183-199b64a081f182118f4392aa8c9dca9cd9406e260d8f1725cea07491fc3326e2.png">

## How to add game plane screen to your SDK game or scene in Decentraland
**Requirement**: Your scene should be SDK7, this component doesn't work with SDK6.

In the root folder of your SDK scene, execute `npm install dcl-sammich-screen@latest`

Then you can create an instance of the game with something like this:
```js
import {createSammichScreen} from "dcl-sammich-screen";
import {getRealm, getSceneInformation} from "~system/Runtime";

export async function main() {
  const sammichScreenInstanceRoomId = JSON.parse((await getSceneInformation({})).metadataJson).scene.base;

  const rootEntity = engine.addEntity();
  const sammichScreen = await createSammichScreen(rootEntity, {
    position:Vector3.create(8,2,8),
    rotation:Quaternion.Zero(),
    scale: Vector3.create(3, 2, 1),
    defaultTextureSrc:"https://sammich.pro/images/spritesheet.png",
    baseInstructionVideoURL:"https://sammich.pro/instruction-videos",
    colyseusServerURL:"wss://sammich.pro/colyseus"
  },  sammichScreenInstanceRoomId);
  
  sammichScreen.onEvent(({type, data}) => {
      console.log("something happened");
      console.log("event type", type);
      console.log("event data", data);
      console.log("sammichScreen state", sammichScreen.getState())
  });
}

```

## Game API docs
TBD: All the minigames has a new custom multiplayer SDK, documentation and implementation tool is pendent.
meanwhile you can find example of using the sammich system game SDK here: https://github.com/sammich-dev/sammich-systems/blob/main/games/test-example.ts

## Docker setup
on root folder `docker compose up` will build the images and put up the game server and the tournament server 

## Running outconained services 
### How to run colyseus server (local port 2567)
`npm run ws`

### How to run tournaments (local port 2569)
`npm run tournaments-web`

### How to run demo scene
`npm run scene`

### How to run backoffice (local port 2569)
`npm run backoffice`

