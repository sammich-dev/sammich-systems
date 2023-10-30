const X = 2147483647;
export const seedGen = {
    create:(seed:number) => {
        let value = seed;

        return {
            random:()=>{
                value = value * 16807 % X;
                return value/X;
            }
        }
    }
};