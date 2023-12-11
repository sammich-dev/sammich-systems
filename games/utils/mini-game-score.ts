let miniGameScoreComponent:any;

export function createScoreTextComponent(game:any, options?:any){//TODO rename to createSharedScreenScoreTextComponent
    const miniGameScore = game.addText({
        text:`0 - 0`,
        pixelPosition:[192/2 - 24,20],
        fontSize:1,
        textColor:[1,1,1,1],
        ...options
    });
    miniGameScoreComponent = {
        game,
        setText:miniGameScore.setText
    }
    const disposeOnDestroy = game.onDestroy(()=>{
        miniGameScoreComponent = null;
        disposeOnDestroy();
    });
}

export async function updateScoreTextComponent(_score?:any){
    if(!miniGameScoreComponent) return;
    await miniGameScoreComponent.game.waitFrames(1);
    const score = _score || [
        miniGameScoreComponent.game.players[0].getPlayerScore(),
        miniGameScoreComponent.game.players[1].getPlayerScore()
    ];
    miniGameScoreComponent.setText(`${score[0]} - ${score[1]}`);
}