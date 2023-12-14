import { Router } from "express";
import { prisma } from "../db"

const router = Router();

router.get("/tournaments", async (_req, res) => {
    const tournaments = await prisma.tournaments.findMany({
        include: {
            participants:true,
            matches:true
        }
    })
    res.json(tournaments)
})

router.get("/tournaments/:id", async (req, res) => {
    const tournament = await prisma.tournaments.findUnique({
        where: {
            id: parseInt(req.params.id)
        },
        include: {
            participants: true,
            matches: true
        }
    })
    if(!tournament){
        return res.status(404).json({error: 'tournament not found'})
    }
    return res.json(tournament)
})

router.post("/tournament", async (req, res) => {
    try {
        const newTournament = await prisma.tournaments.create({
            data: {
                title: req.body.tournament_title,
                description: req.body.tournament_description,
                createdBy: req.body.createdBy,
                startDate: new Date(req.body.startDate),
                endDate: new Date(req.body.endDate)
            }
        })
        for (let participant of req.body.participants) {
            await prisma.tournamentParticipants.create({
                data: {
                    ...participant,
                    tournamentId: newTournament.id
                }
            })
        }
        res.json(true)
    } catch (error:any) {
        console.log(error);
        res.status(500).send({error:error?.message})
    }
})

router.delete("/tournament/:id", async (req, res) => {
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