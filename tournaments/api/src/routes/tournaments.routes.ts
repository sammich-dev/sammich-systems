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
        const participants = req.body.participants.map(u=>u.address);

        const newTournament = await prisma.tournaments.create({
            data: {
                title: req.body.tournament_title,
                description: req.body.tournament_description,
                createdBy: req.body.createdBy,
                startDate: new Date(req.body.startDate),
                participantAddresses:participants.join(","),
                endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
            }
        })

        const matchesParticipants = getShuffledMatches(participants)
        await createMatches(matchesParticipants,1, newTournament.id);

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
        res.send(resolveMatch(match, winnerIndex));
    }catch(error:any){
        return res.status(500).send({
            error,
            message: error?.message||undefined
        })
    }

})
function getShuffledMatches(participants:string[]):string[][]{
    const participantsLeft = [...participants].sort(() => Math.random() - 0.5);
    const matchesParticipants:any[][] = [];
    while(participantsLeft.length){
        matchesParticipants.push([
            participantsLeft.pop(),
            participantsLeft.pop()
        ])
    }
    return matchesParticipants;
}

async function createMatches(matchesParticipants:string[][], round, tournamentId){
    for (let _match of matchesParticipants) {
        const data = {
            openDate: new Date(),
            resolutionDate: _match.filter(i=>i).length === 1?new Date():null,
            winnerIndex: _match.filter(i=>i).length === 1?0:null,
            tournamentId,
            players: _match.filter(i=>i).join(","),
            scores: null,
            round
        };
        await prisma.tournamentsMatches.create({
            data
        })
    }
}

export function getWinnersFromMatches(matches){
    return matches.reduce((acc, match)=>{
        const {winnerIndex, players} = match;
        const _players = players.split(",");
        const winner = _players[winnerIndex];



        return [...acc, winner];
    },[]);


}

export async function createNewMatchesIfNecessary(match){
    const roundMatches = await prisma.tournamentsMatches.findMany({where:{
            tournamentId: match.tournamentId,
            round:match.round
    }});
    const tournament:any = await prisma.tournaments.findFirst({where:{id:match.tournamentId}});
    const totalRounds = getTotalNumberOfRounds( tournament?.participantAddresses.split(",").length )
    const allRoundMatchesAreResolved = roundMatches.every(m=>m.resolutionDate);
    if(allRoundMatchesAreResolved && match.round !== totalRounds){
        //TODO generate new round of matches with winners
        const winners = getWinnersFromMatches(roundMatches);
        const matchesParticipants = getShuffledMatches(winners)
        await createMatches(matchesParticipants, match.round+1, match.tournamentId);
    }else if(match.round === totalRounds){
        const [winner] = getWinnersFromMatches(roundMatches);
        await prisma.tournaments.update({
            where:{
                id:tournament?.id
            },
            data:{
                winner,
                finished:true
            }
        })
    }

    return match;
}

export async function resolveMatch(match, winnerIndex){
    const updateResult = await prisma.tournamentsMatches.update({
        where:{id:match.id},
        data:{
            winnerIndex,
            resolutionDate: new Date()
        }
    });
    await createNewMatchesIfNecessary(match);

    return updateResult;
}
function getTotalNumberOfRounds (numParticipants:number){return Math.ceil(Math.log2(numParticipants))}

export default router