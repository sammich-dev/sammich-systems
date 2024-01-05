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
            id: req.params.id
        }
    })
    if(!participant){
        return res.status(404).json({error: 'participant not found'})
    }
    return res.json(participant)
})

router.post("/participant", async (req, res) => {
    try {
        const newParticipiant = await prisma.tournamentParticipants.create({
            data: req.body
        })
        res.json(newParticipiant);
    }
    catch(error) {
        console.error(error);
    }
})

router.delete("/participant/:id", async (req, res) => {
    const deletedParticipant = await prisma.tournamentParticipants.delete({
        where: {
            id: req.params.id
        }
    })
    if(!deletedParticipant){
        return res.status(404).json({error: 'Participant not found'})
    }
    return res.json(deletedParticipant)
})


export default router