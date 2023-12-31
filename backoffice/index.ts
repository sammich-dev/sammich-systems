import {Database, Resource} from '@adminjs/prisma'
import AdminJS from 'adminjs'
import {PrismaClient} from "@prisma/client";
import {DMMFClass} from "@prisma/client/runtime";
import express from 'express';
import AdminJSExpress from '@adminjs/express';
import path from 'path';
import {fileURLToPath} from 'url';
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
router.use("*/public", express.static(__dirname + '/public'));
const adminJs = new AdminJS({
    branding: {
        companyName: "Sammich Admin",
        logo: "https://cdn.discordapp.com/attachments/1117787207089000468/1184539452194947132/pabloest_pixelart_frog_eating_sammich_28812ce4-73d4-4386-879e-20ed8f2af647.png?ex=658c5755&is=6579e255&hm=f5dcc6e2ea467fe43d8286c7fda5eb73399b7d72bb05788ca53d91c21597725f&",
        softwareBrothers: false
    },
    assets: {
        styles: [
            "/admin/public/custom.css"
        ]
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

app.use(adminJs.options.rootPath, adminRouter);
app.use(router);
app.listen(process.env.PORT, () => {
    console.log("listening ...", process.env.PORT);
});