/// <reference types="@dcl/js-runtime" />
import { UserData } from "~system/UserIdentity";
export type MinUserData = UserData & {
    avatar: undefined;
};
export declare function getMinUserData(): Promise<MinUserData>;
