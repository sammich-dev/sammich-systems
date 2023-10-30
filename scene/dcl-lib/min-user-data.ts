import {getUserData, GetUserDataResponse, UserData} from "~system/UserIdentity";
export type MinUserData = UserData & {
    avatar:undefined
}
export async function getMinUserData():Promise<MinUserData>{
    return await (getUserData({}).then((r:GetUserDataResponse)=>({...r.data, avatar:undefined}) as MinUserData));
}