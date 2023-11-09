# Sammich System (for Decentraland)
<img src="https://cdn.publish0x.com/prod/fs/cachedimages/2399835183-199b64a081f182118f4392aa8c9dca9cd9406e260d8f1725cea07491fc3326e2.png">

## How to run... 

### How to run backoffice (local port 2569)
`npm run backoffice`

### How to run colyseus server (local port 2567)
`npm run ws`

### How to run demo scene
`npm run scene`

### Some Context About This Toolkit Repository
Sammich-system is not just a game but a component that can be integrated in other games or scenes, like putting a television in your scene. Users can also customize it, creating new mini-games with provided toolkit and libraries; Besides the programming utilities, artistic people that could have limitations using blender to design 3D, will be able to easily create own pixel art in the mini-games and express themselves.

Old version was initially designed to be serverless P2P, due to bad perfomance of MessageBus (a message could last like 5 minutes to reach another player when there was some traffic), it was necessary to quickly (firefighting) move some logic to a centralized server (being the first scene in decentraland using colyseus) but protocol didn’t change, therefore it was easy to cheat on it for people with minimum programming knowledge.

This new version needs a rewrite, by one hand it will provide better anti-cheat mechanism, by other hand it will have a separation between presentational and logic on gameplay. The gameplay will be fully deterministic for server validation*. Each mini-game code will work for client and for server, boarder idea is that a programmer doesn’t need to care about networking and just need to write game logic once. In addition, the API for mini-game code is SDK agnostic.