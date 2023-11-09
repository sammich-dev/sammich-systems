import {PlayerState, SpriteState} from "../server/src/rooms/GameState";
import * as net from "net";
import {SpriteDefinition, SpriteDefinitionParams} from "./sprite-util";

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
        addSprite:({ID, pixelPosition, layer, network}: any)=>{
            const spriteState = {
                pixelPosition,
                network,
                layer,
                frame:0
            };

            if(getNetwork()){
                playerState.spriteEntities.push(new SpriteState({ID, frame:1, x:pixelPosition[0], y:pixelPosition[1], layer}));
            }

            return {
                ID,
                destroy: () => {
                    if(spriteState.network){
                        const spriteIndex = playerState.spriteEntities.findIndex(s=>s.ID === ID);
                        playerState.spriteEntities.splice(spriteIndex, 1);
                    }
                },
                applyFrame:(n:number)=>{
                    console.log("SERVER APPLY FRAME", n)
                    spriteState.frame = n;
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        colyseusSprite.frame = n;
                    }
                },
                getFrame:()=>spriteState.frame,
                getLayer:()=>spriteState.layer,
                hide:()=>{
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        if(!colyseusSprite){
                            console.trace();
                            debugger;
                        }
                        colyseusSprite.visible = false;
                    }
                },
                show:()=>{
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        colyseusSprite.visible = true;
                    }
                },
                getPixelPosition:()=>spriteState.pixelPosition,
                setPixelPosition:(px:number,py:number)=>{
                    spriteState.pixelPosition = [ px, py ];
                    if(spriteState.network){
                        const colyseusSprite = playerState.spriteEntities.find(s=>s.ID === ID);
                        if(!colyseusSprite){
                            console.trace();
                            debugger;
                        }
                        colyseusSprite.x = px;
                        colyseusSprite.y = py;
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
        addText:(...args:any[]):any=>({setText:(...args:any[]):any=>{}})
    }
}