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
    const score = _score || miniGameScoreComponent.game.runtime.getState().score;
    miniGameScoreComponent.setText(`${score[0]} - ${score[1]}`);
}