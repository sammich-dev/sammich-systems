import { Router } from "express";
import { prisma } from "../db"

const router = Router();

router.get("/participants", async (_req, res) => {
    const participants = await prisma.tournamentParticipants.findMany()
    res.json(participants)
})

router.get("/participants/:id", async (req, res) => {
    const participant = await prisma.tournamentParticipants.findFirst({
        where: {
            id: parseInt(req.params.id)
        }
    })
    if(!participant){
        return res.status(404).json({error: 'participant not found'})
    }
    return res.json(participant)
})

router.post("/participants", async (req, res) => {
        const newParticipiant = await prisma.tournamentParticipants.create({
            data: req.body
        })
        res.json(newParticipiant);
})

export default router