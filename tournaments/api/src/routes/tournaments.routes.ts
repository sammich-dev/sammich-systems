import { Router } from "express";
import { prisma } from "../db"

const router = Router();

router.get("/tournaments", async (_req, res) => {
    const tournaments = await prisma.tournaments.findMany({
        include: {
            participants: true,
            matches: true
        }
    })
    res.json(tournaments.sort((a, b) => b.id - a.id))
})

router.get("/tournament/:id", async (req, res) => {
    console.log("/tournament/:id", req.params.id)
    const tournament = await prisma.tournaments.findFirst({
        where: {
            id: parseInt(req.params.id)
        },
        include: {
            participants: true,
            matches: true
        }
    })
    if (!tournament) {
        return res.status(404).json({ error: 'tournament not found' })
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
                endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
            }
        })
        req.body.participants;// ["0xA", "0xB"]
        const participantsLeft = [...req.body.participants].sort(() => Math.random() - 0.5);
        const matchesParticipants:any[][] = [];
        while(participantsLeft.length){
            matchesParticipants.push([
                participantsLeft.pop(),
                participantsLeft.pop()
            ])
        }

        for (let _match of matchesParticipants) {
            const data = {
                openDate: new Date(req.body.startDate),
                resolutionDate: _match.filter(i=>i).length === 1?new Date():null,
                winnerIndex: _match.filter(i=>i).length === 1?0:null,
                tournamentId: newTournament.id,
                players: _match.filter(i=>i).map(u=>u.address).join(","),
                scores: null
            };
            await prisma.tournamentsMatches.create({
                data
            })
        }
        res.json(true)

        console.log(newTournament)
    } catch (error: any) {
        console.log(error);
        res.status(500).send({ error: error?.message })
    }
})

router.put("/tournament/:id", async (req, res) => {
    const updatedTournament = await prisma.tournaments.update({
        where: {
            id: parseInt(req.params.id)
        },
        data: req.body
    })
    if (!updatedTournament) {
        return res.status(404).json({ error: 'tournament not found' })
    }
    return res.json(updatedTournament)
})

router.delete("/tournament/:id", async (req, res) => {
    const deletedTournament = await prisma.tournaments.delete({
        where: {
            id: parseInt(req.params.id)
        }
    })
    if (!deletedTournament) {
        return res.status(404).json({ error: 'tournament not found' })
    }
    return res.json(deletedTournament)
});

router.post("/manual-match-resolution", async (req,res)=>{
    try{
        const {match, winnerIndex} = req.body;
        const updated = await prisma.tournamentsMatches.update({
            where:{id:match.id},
            data:{
                winnerIndex,
                resolutionDate: new Date()
            }
        });
        res.send(updated);
    }catch(error:any){
        return res.status(500).send({
            error,
            message: error?.message||undefined
        })
    }

})

export default router