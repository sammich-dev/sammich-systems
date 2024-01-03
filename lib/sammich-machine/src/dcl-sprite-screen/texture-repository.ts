import {Material, TextureFilterMode, TextureWrapMode} from "@dcl/sdk/ecs";

const textures = {};

export const getTexture = (src:string) => {
    textures[src] =  textures[src] || Material.Texture.Common({
        src,
        wrapMode: TextureWrapMode.TWM_REPEAT,
        filterMode: TextureFilterMode.TFM_POINT
    })
    return textures[src];
}