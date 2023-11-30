import { Router } from "express";
import { prisma } from "../db"

const router = Router();

router.get("/tournaments", async (_req, res) => {
    const tournaments = await prisma.tournaments.findMany()
    res.json(tournaments)
})

router.get("/tournaments/:id", async (req, res) => {
    const tournament = await prisma.tournaments.findFirst({
        where: {
            id: parseInt(req.params.id)
        }
    })
    if(!tournament){
        return res.status(404).json({error: 'tournament not found'})
    }
    return res.json(tournament)
})

router.post("/tournaments", async (req, res) => {
    try {
        const newTournament = await prisma.tournaments.create({
            data: req.body
        })
        res.json(newTournament);
    } catch (error) {
        console.log(error);
    }
})

router.delete("/tournaments/:id", async (req, res) => {
    const deletedTournament = await prisma.tournaments.delete({
        where: {
            id: parseInt(req.params.id)
        }
    })
    if(!deletedTournament){
        return res.status(404).json({error: 'tournament not found'})
    }
    return res.json(deletedTournament)
})

export default router