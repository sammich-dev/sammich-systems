import {Database, Resource} from '@adminjs/prisma'
import AdminJS from 'adminjs'
import {PrismaClient} from "@prisma/client";
import {DMMFClass} from "@prisma/client/runtime";
import express from 'express';
import AdminJSExpress from '@adminjs/express';
import path from 'path';
import {fileURLToPath} from 'url';
import {tryFn} from "../lib/try-function";
import {getCatchResponseError} from "../lib/express-error-handling";
//@ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//import argon2 from 'argon2';

const prisma = new PrismaClient()
AdminJS.registerAdapter({Database, Resource})

const dmmf = ((prisma as any)._dmmf as DMMFClass);
const app = express();
const router = express.Router();
console.log("__dirname", __dirname)
const adminJs = new AdminJS({
    branding: {
        companyName: "Sammich Admin",
        logo: "data:image/jpeg;base64,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",
        softwareBrothers: false
    },
    resources: [
        {
            resource: {
                model: dmmf.modelMap.User,
                client: prisma,
            },
            options: {}
        },
        {
            resource: {
                model: dmmf.modelMap.RecordedGame,
                client: prisma,
            },
            options: {}
        },
        {
            resource: {
                model: dmmf.modelMap.Game,
                client: prisma,
            },
            options: {}
        },
        {
            resource: {
                model: dmmf.modelMap.PlayedMatch,
                client:prisma
            }
        },
        {
            resource: {
                model: dmmf.modelMap.PlayedMatchPlayer,
                client:prisma
            }
        }

    ]
})
const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
    //TODO REVIEW AUTH
    /*authenticate: async (email, password) => {
        const user = await prisma.AdminUser.findFirst({where:{ username:email }});
        if(!user) return false;
        if(!await argon2.verify(user.password,password)){
            return false;
        }
        return user;
    },
*/
    authenticate: (email, password) => true,
    cookiePassword: 'some-secret-password-used-to-ihu24hu9g4h94',
}, undefined, {
    saveUninitialized: false, resave: false
});
router.get("/api/played-games/:from", async (req, res) => {
    tryFn(async ()=>{
        const pageSize = req.query.pageSize || 100;
        const rows = await prisma.playedMatch.findMany({
            take:Number(pageSize),
            where:{
                ID:{gte:Number(req.params.from)}
            }
        });
        const lastPlayedGameId = (await prisma.playedMatch.findFirst({orderBy:{ID:"desc"}})).ID;
        res.send({
            results:rows,
            lastPlayedGameId
        });
    }, getCatchResponseError(res));
});

app.get("/api/last-played-game-id", async (req, res) => {
    tryFn(async ()=>{
        const lastPlayedGameId = (await prisma.playedMatch.findFirst({orderBy:{ID:"desc"}})).ID;
        return res.status(200).send({lastPlayedGameId})
    }, getCatchResponseError(res));
});

app.use(adminJs.options.rootPath, adminRouter);
app.use(router);
app.listen(process.env.PORT, () => {
    console.log("listening ...", process.env.PORT);
});
