import {PlayerState, SpriteState} from "../server/src/rooms/GameState";
import {SpriteDefinition, SpriteDefinitionParams} from "./sammich-machine/src/dcl-sprite-screen/sprite-util";

export function createServerSpriteScreen(playerState:PlayerState) {
    const state:{spriteDefinition:SpriteDefinition} = {
        spriteDefinition:{
            spriteSheetHeight:0,
            spriteSheetWidth:0,
            w:0,
            h:0,
            x:0,y:0
        }
    }
    return {
        getSize:()=>[state.spriteDefinition.w, state.spriteDefinition.h],
        setBackgroundSprite:({spriteDefinition, back}:SpriteDefinitionParams)=>{
            state.spriteDefinition = spriteDefinition;
        },
        addSprite:({ID, pixelPosition, layer, network, klass}: any)=>{
            const spriteState = {
                pixelPosition,
                network,
                layer,
                frame:0
            };

            if(getNetwork()){
                playerState.spriteEntities.push(
                    new SpriteState({
                        ID,
                        frame:1,
                        x:pixelPosition[0],
                        y:pixelPosition[1],
                        layer,
                        playerIndex:playerState.playerIndex,
                        klass
                    }));
            }

            return {
                ID,
                destroy: () => {
                    if(spriteState.network){
                        const spriteIndex = playerState.spriteEntities.findIndex(s=>s.ID === ID);
                        playerState.spriteEntities.splice(spriteIndex, 1);
                    }
                },
                setZoom:(n:number)=>{},
                applyFrame:(n:number)=>{
                    spriteState.frame = n;
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        if(colyseusSprite) colyseusSprite.frame = n;
                    }
                },
                getFrame:()=>spriteState.frame,
                getLayer:()=>spriteState.layer,
                hide:()=>{
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        if(!colyseusSprite){
                            console.trace();
                           // debugger;//TODO still can happen?
                        }
                        if(colyseusSprite) colyseusSprite.visible = false;
                    }
                },
                show:()=>{
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        if(colyseusSprite) colyseusSprite.visible = true;
                    }
                },
                getPixelPosition:()=>spriteState.pixelPosition,
                setPixelPosition:(px:number,py:number)=>{
                    spriteState.pixelPosition = [ px, py ];
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        if(colyseusSprite) colyseusSprite.x = px;
                        if(colyseusSprite) colyseusSprite.y = py;
                    }
                },
                setNetwork,
                getNetwork
            }
            function setNetwork(value:boolean){
                if(!spriteState.network){
                    if(!playerState.spriteEntities.find(sd=>sd.ID === ID)){
                        playerState.spriteEntities.push(new SpriteState({
                            ID,
                            frame:spriteState.frame,
                            x:spriteState.pixelPosition[0],
                            y:spriteState.pixelPosition[1],
                            layer
                        }));
                    }else{
                        console.log("NOTPUSHED NEW SPRITE_STATE")
                    }
                }
                spriteState.network = value;
            }
            function getNetwork(){
                return spriteState.network;
            }
        },
        addText:(...args:any[]):any=>({setText:(...args:any[]):any=>{}}),
        setZoom: (zoom:number[]) => {
            //TODO
        }
    }
}