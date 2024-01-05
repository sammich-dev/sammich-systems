import { Material } from "@dcl/sdk/ecs";
const textures = {};
export const getTexture = (src) => {
    textures[src] = textures[src] || Material.Texture.Common({
        src,
        wrapMode: 0,
        filterMode: 0
    });
    return textures[src];
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS1yZXBvc2l0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2RjbC1zcHJpdGUtc2NyZWVuL3RleHR1cmUtcmVwb3NpdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsUUFBUSxFQUFxQyxNQUFNLGNBQWMsQ0FBQztBQUUxRSxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFFcEIsTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBVSxFQUFFLEVBQUU7SUFDckMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUN0RCxHQUFHO1FBQ0gsUUFBUSxHQUE0QjtRQUNwQyxVQUFVLEdBQTZCO0tBQzFDLENBQUMsQ0FBQTtJQUNGLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLENBQUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7TWF0ZXJpYWwsIFRleHR1cmVGaWx0ZXJNb2RlLCBUZXh0dXJlV3JhcE1vZGV9IGZyb20gXCJAZGNsL3Nkay9lY3NcIjtcblxuY29uc3QgdGV4dHVyZXMgPSB7fTtcblxuZXhwb3J0IGNvbnN0IGdldFRleHR1cmUgPSAoc3JjOnN0cmluZykgPT4ge1xuICAgIHRleHR1cmVzW3NyY10gPSAgdGV4dHVyZXNbc3JjXSB8fCBNYXRlcmlhbC5UZXh0dXJlLkNvbW1vbih7XG4gICAgICAgIHNyYyxcbiAgICAgICAgd3JhcE1vZGU6IFRleHR1cmVXcmFwTW9kZS5UV01fUkVQRUFULFxuICAgICAgICBmaWx0ZXJNb2RlOiBUZXh0dXJlRmlsdGVyTW9kZS5URk1fUE9JTlRcbiAgICB9KVxuICAgIHJldHVybiB0ZXh0dXJlc1tzcmNdO1xufSJdfQ==