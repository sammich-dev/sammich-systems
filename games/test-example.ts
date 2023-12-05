const SPRITE_SHEET_SIZE = 1024;
const SPRITE_SHEET_DIMENSION = {
    spriteSheetWidth: SPRITE_SHEET_SIZE,
    spriteSheetHeight: SPRITE_SHEET_SIZE,
};

async function run({game}:any){
    game.setScreenSprite({
        spriteDefinition:{
            x:576,
            y:128,
            w:192,
            h:128,
            ...SPRITE_SHEET_DIMENSION
        }
    });

    const CursorSprite = game.registerSpriteEntity({
        klass:"Cursor",
        spriteDefinition:{
            x:0,y:486, w:16, h:18, columns:2,frames:2,
            ...SPRITE_SHEET_DIMENSION,
        }
    });

    const c1 = CursorSprite.create({
        pixelPosition:[20, 20],
        layer:2,
        network:true
    });
    /**
     * lets wait 1 second
     * how many frames? each frame, lasts 17ms
     * 1000/17
     */
    const FRAMES_PER_SECOND = game.runtime.getFps();
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    console.log("______")
    await game.waitFrames(FRAMES_PER_SECOND);
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    console.log(game.randomInt(0,100));
    c1.setPixelPosition(40,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(60,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(80,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(100,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(120,20);
    await game.waitFrames(FRAMES_PER_SECOND);
    c1.setPixelPosition(140,20);


}

const definition = {
    alias:"test-wait",
    split:false,
    fps:60,
    instructions:"test wait"
};

const TestExample = {definition, run};


export {TestExample}