const MAX_INT = 2147483647;

export const seedGen = {
    create:(seed:number) => {
        let value = seed;
        random();
        return {
            random
        }

        function random(){
            value = value * 16807 % MAX_INT;
            return value/MAX_INT;
        }
    }
};