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
        logo: "https://europe1.discourse-cdn.com/business20/uploads/decentraland/original/1X/1e2aef1438927bb3a88457d4c9908148d68006df.png",
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