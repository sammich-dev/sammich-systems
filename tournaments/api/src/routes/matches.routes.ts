import { Router } from "express";
import { prisma } from "../db"

const router = Router();

router.get("/matches", async (_req, res) => {
    const matches = await prisma.tournamentsMatches.findMany()
    res.json(matches)
})

router.get("/matches/:id", async (req, res) => {
    const match = await prisma.tournamentsMatches.findFirst({
        where: {
            id: req.params.id
        }
    })
    if(!match){
        return res.status(404).json({error: 'match not found'})
    }
    return res.json(match)
})

router.post("/match", async (req, res) => {
    const newMatch = await prisma.tournamentsMatches.create({
        data: req.body
    })
    res.json(newMatch);
})

export default router;