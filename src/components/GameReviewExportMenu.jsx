import { Download } from 'lucide-react'
import { exportToCSV } from '../utils/storage'

function GameReviewExportMenu({ game, reviewPlayers, totals, getPlayerTotals }) {
  const handleExport = () => {
    if (!game || reviewPlayers.length === 0) return
    const rows = reviewPlayers.map((player) => {
      const playerTotals = totals[player.id] || {}
      const derived = getPlayerTotals(player.id)
      return {
        date: game.date,
        name: player.name,
        school: player.school || '',
        opponent: game.opponent,
        position: player.position || '',
        gradYear: player.gradYear || '',
        totalYards: derived.totalYards,
        rushYards: derived.rushingYards,
        rushAttempts: derived.rushAttempts,
        yardsPerCarry: Number(derived.yardsPerCarry.toFixed(1)),
        rushingTDs: derived.rushingTDs,
        receivingYards: derived.receivingYards,
        receptions: derived.receptionCount,
        targets: derived.targetCount,
        yardsPerReception: Number(derived.yardsPerReception.toFixed(1)),
        receivingTDs: derived.receivingTDs,
        returnYards: derived.returnYards,
        tackles: derived.tackles,
        sacks: derived.sacks,
        interceptions: playerTotals['INT'] || 0,
        passBreakups: playerTotals['PBU'] || 0,
        forcedFumbles: playerTotals['Forced Fumble'] || 0,
        fumbles: playerTotals['Fumble'] || 0,
        passCompletions: playerTotals['Pass Comp'] || 0,
        passIncompletions: playerTotals['Pass Inc'] || 0,
        passTDs: playerTotals['Pass TD'] || 0,
        tacklesForLoss: playerTotals['TFL'] || 0,
        touchdowns: playerTotals['TD'] || 0,
        fieldGoals: playerTotals['FG'] || 0,
        pats: playerTotals['PAT'] || 0,
        kickoffs: playerTotals['Kickoff'] || 0,
        punts: playerTotals['Punt'] || 0,
        gameId: game.id,
      }
    })
    const filename = `${game.opponent || 'game'}-summary.csv`
    exportToCSV(rows, filename)
  }

  return (
    <button className="btn-secondary" onClick={handleExport}>
      <Download size={16} />
      Export CSV
    </button>
  )
}

export default GameReviewExportMenu
