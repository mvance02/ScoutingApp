import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, FileText, Loader } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { loadPlayers, loadGames, loadAllStats, loadData } from '../utils/storage'
import StatTrendChart from './StatTrendChart'
import PlayerComments from './PlayerComments'
import PlayerVisits from './PlayerVisits'
import CompositeRatingTrend from './CompositeRatingTrend'
import byuLogo from '../assets/byu-logo.svg'

function PlayerStats() {
  const { playerId } = useParams()
  const [player, setPlayer] = useState(null)
  const [games, setGames] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [exportingPDF, setExportingPDF] = useState(false)
  const chartRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [playersData, gamesData, statsData] = await Promise.all([
          loadPlayers(),
          loadGames(),
          loadAllStats(playerId),
        ])
        const foundPlayer = playersData.find((p) => String(p.id) === String(playerId))
        setPlayer(foundPlayer)
        setGames(gamesData)
        setStats(statsData)
      } catch (err) {
        console.error('Error loading data:', err)
        const players = loadData('PLAYERS')
        const foundPlayer = players.find((p) => String(p.id) === String(playerId))
        setPlayer(foundPlayer)
        setGames(loadData('GAMES'))

        // Fallback: load stats from localStorage
        const allStats = loadData('STATS')
        const playerStats = Object.entries(allStats).flatMap(([gameId, entries]) =>
          (entries || [])
            .filter((s) => String(s.playerId) === String(playerId))
            .map((s) => ({ ...s, gameId }))
        )
        setStats(playerStats)
      }
      setLoading(false)
    }
    fetchData()
  }, [playerId])

  const careerTotals = useMemo(() => {
    const totals = {}
    stats.forEach((stat) => {
      const type = stat.statType
      totals[type] = (totals[type] || 0) + Number(stat.value || 0)
    })
    return totals
  }, [stats])

  const derivedStats = useMemo(() => {
    const rushingYards = (careerTotals['Rush'] || 0) + (careerTotals['Rush TD'] || 0)
    const receivingYards = (careerTotals['Reception'] || 0) + (careerTotals['Rec TD'] || 0)
    const returnYards = careerTotals['Return'] || 0
    const totalYards = rushingYards + receivingYards + returnYards

    const rushAttempts = stats.filter(
      (s) => s.statType === 'Rush' || s.statType === 'Rush TD'
    ).length
    const receptionCount = stats.filter(
      (s) => s.statType === 'Reception' || s.statType === 'Rec TD'
    ).length
    const targetCount = stats.filter((s) => s.statType === 'Target').length

    const rushingTDs = stats.filter((s) => s.statType === 'Rush TD').length
    const receivingTDs = stats.filter((s) => s.statType === 'Rec TD').length
    const passingTDs = stats.filter((s) => s.statType === 'Pass TD').length

    const tackles = (careerTotals['Tackle Solo'] || 0) + (careerTotals['Tackle Assist'] || 0)
    const sacks = careerTotals['Sack'] || 0

    const yardsPerCarry = rushAttempts > 0 ? rushingYards / rushAttempts : 0
    const yardsPerReception = receptionCount > 0 ? receivingYards / receptionCount : 0

    return {
      totalYards,
      rushingYards,
      receivingYards,
      returnYards,
      rushAttempts,
      receptionCount,
      targetCount,
      rushingTDs,
      receivingTDs,
      passingTDs,
      tackles,
      sacks,
      yardsPerCarry,
      yardsPerReception,
    }
  }, [stats, careerTotals])

  const gameBreakdown = useMemo(() => {
    const byGame = {}
    stats.forEach((stat) => {
      const gId = stat.gameId || stat.game_id
      if (!byGame[gId]) {
        byGame[gId] = { gameId: gId, stats: {} }
      }
      const type = stat.statType
      byGame[gId].stats[type] = (byGame[gId].stats[type] || 0) + Number(stat.value || 0)
    })

    return Object.values(byGame).map((entry) => {
      const game = games.find((g) => String(g.id) === String(entry.gameId))
      const gameTotals = entry.stats

      const rushYards = (gameTotals['Rush'] || 0) + (gameTotals['Rush TD'] || 0)
      const recYards = (gameTotals['Reception'] || 0) + (gameTotals['Rec TD'] || 0)
      const returnYards = gameTotals['Return'] || 0
      const totalYards = rushYards + recYards + returnYards

      return {
        gameId: entry.gameId,
        opponent: game?.opponent || 'Unknown',
        date: game?.date || '',
        totalYards,
        rushYards,
        recYards,
        tackles: (gameTotals['Tackle Solo'] || 0) + (gameTotals['Tackle Assist'] || 0),
        ints: gameTotals['INT'] || 0,
        sacks: gameTotals['Sack'] || 0,
        tds:
          (stats.filter(
            (s) =>
              (s.gameId === entry.gameId || s.game_id === entry.gameId) &&
              (s.statType === 'Rush TD' || s.statType === 'Rec TD' || s.statType === 'TD')
          ).length || 0),
      }
    }).sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [stats, games])

  const gamesPlayed = gameBreakdown.length

  const averages = useMemo(() => {
    if (gamesPlayed === 0) return null
    return {
      yardsPerGame: derivedStats.totalYards / gamesPlayed,
      rushYardsPerGame: derivedStats.rushingYards / gamesPlayed,
      recYardsPerGame: derivedStats.receivingYards / gamesPlayed,
      tacklesPerGame: derivedStats.tackles / gamesPlayed,
    }
  }, [derivedStats, gamesPlayed])

  const generatePDF = async () => {
    if (!player) return

    setExportingPDF(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('BYU Football Scouting Report', pageWidth / 2, 20, { align: 'center' })

      // Player Info
      doc.setFontSize(16)
      doc.text(player.name, pageWidth / 2, 35, { align: 'center' })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const playerInfo = [
        player.position || 'Position TBD',
        player.school || 'School TBD',
        player.gradYear ? `Class of ${player.gradYear}` : '',
      ].filter(Boolean).join(' | ')
      doc.text(playerInfo, pageWidth / 2, 43, { align: 'center' })

      doc.setDrawColor(200)
      doc.line(20, 50, pageWidth - 20, 50)

      // Career Summary
      let yPos = 60
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`Career Summary (${gamesPlayed} Games)`, 20, yPos)

      yPos += 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      // Offensive Stats
      const offenseData = [
        ['Total Yards', derivedStats.totalYards],
        ['Rush Yards', derivedStats.rushingYards],
        ['Rush Attempts', derivedStats.rushAttempts],
        ['Yards/Carry', derivedStats.yardsPerCarry.toFixed(1)],
        ['Rush TDs', derivedStats.rushingTDs],
        ['Rec Yards', derivedStats.receivingYards],
        ['Receptions', derivedStats.receptionCount],
        ['Yards/Rec', derivedStats.yardsPerReception.toFixed(1)],
        ['Rec TDs', derivedStats.receivingTDs],
        ['Targets', derivedStats.targetCount],
      ]

      // Defensive Stats
      const defenseData = [
        ['Tackles', derivedStats.tackles],
        ['Solo Tackles', careerTotals['Tackle Solo'] || 0],
        ['Assists', careerTotals['Tackle Assist'] || 0],
        ['Sacks', derivedStats.sacks],
        ['INTs', careerTotals['INT'] || 0],
        ['PBUs', careerTotals['PBU'] || 0],
        ['Forced Fumbles', careerTotals['Forced Fumble'] || 0],
        ['TFL', careerTotals['TFL'] || 0],
      ]

      // Draw stats in two columns
      autoTable(doc, {
        startY: yPos,
        head: [['Offensive Stats', 'Value', 'Defensive Stats', 'Value']],
        body: offenseData.map((off, i) => {
          const def = defenseData[i] || ['', '']
          return [off[0], off[1], def[0], def[1]]
        }),
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 40 },
          3: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: 20, right: 20 },
      })

      // Per Game Averages
      if (averages) {
        yPos = (doc.lastAutoTable?.finalY || yPos) + 15
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Per Game Averages', 20, yPos)

        autoTable(doc, {
          startY: yPos + 5,
          head: [['Yards/Game', 'Rush Yds/Game', 'Rec Yds/Game', 'Tackles/Game']],
          body: [[
            averages.yardsPerGame.toFixed(1),
            averages.rushYardsPerGame.toFixed(1),
            averages.recYardsPerGame.toFixed(1),
            averages.tacklesPerGame.toFixed(1),
          ]],
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
          margin: { left: 20, right: 20 },
        })
      }

      // Game-by-Game Breakdown
      if (gameBreakdown.length > 0) {
        yPos = (doc.lastAutoTable?.finalY || yPos) + 15
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Game-by-Game Breakdown', 20, yPos)

        const gameTableData = gameBreakdown.map((game) => [
          game.opponent,
          game.date || '-',
          game.totalYards,
          game.rushYards,
          game.recYards,
          game.tds,
          game.tackles,
          game.ints,
        ])

        autoTable(doc, {
          startY: yPos + 5,
          head: [['Opponent', 'Date', 'Total Yds', 'Rush', 'Rec', 'TDs', 'Tackles', 'INTs']],
          body: gameTableData,
          foot: [['Career Total', `${gamesPlayed} games`, derivedStats.totalYards, derivedStats.rushingYards, derivedStats.receivingYards, derivedStats.rushingTDs + derivedStats.receivingTDs, derivedStats.tackles, careerTotals['INT'] || 0]],
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
          columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'left' },
          },
          margin: { left: 20, right: 20 },
        })
      }

      // Capture and add charts if available
      if (chartRef.current && gameBreakdown.length >= 2) {
        // Add a new page for charts
        doc.addPage()

        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0)
        doc.text('Performance Trends', pageWidth / 2, 20, { align: 'center' })

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100)
        doc.text(`${player.name} - Season Trend Analysis`, pageWidth / 2, 28, { align: 'center' })
        doc.setTextColor(0)

        try {
          // Capture the chart as an image
          const canvas = await html2canvas(chartRef.current, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
          })

          const imgData = canvas.toDataURL('image/png')
          const imgWidth = pageWidth - 20
          const imgHeight = (canvas.height * imgWidth) / canvas.width

          // Check if chart fits on page, scale down if needed
          const maxHeight = pageHeight - 50
          const finalHeight = Math.min(imgHeight, maxHeight)
          const finalWidth = (finalHeight / imgHeight) * imgWidth

          const xOffset = (pageWidth - finalWidth) / 2
          doc.addImage(imgData, 'PNG', xOffset, 35, finalWidth, finalHeight)
        } catch (chartErr) {
          console.error('Error capturing chart:', chartErr)
          doc.setFontSize(10)
          doc.text('Chart could not be captured', pageWidth / 2, 50, { align: 'center' })
        }
      }

      // Footer on last page
      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} | BYU Football Scouting`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )

      // Save the PDF
      const filename = `${player.name.replace(/\s+/g, '_')}_scouting_report.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setExportingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading player stats...</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="page">
        <p className="empty-state">Player not found.</p>
        <Link className="link" to="/players">
          <ArrowLeft size={16} />
          Back to Players
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {player.profilePictureUrl ? (
            <img
              src={player.profilePictureUrl}
              alt={player.name}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                padding: 12,
              }}
            >
              <img
                src={byuLogo}
                alt="BYU"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
          <div>
            <Link className="link" to="/players" style={{ marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={16} />
              Back to Players
            </Link>
            <h2>{player.name}</h2>
            <p>
              {player.position || 'Position TBD'}
              {player.offensePosition ? ` · O: ${player.offensePosition}` : ''}
              {player.defensePosition ? ` · D: ${player.defensePosition}` : ''} ·{' '}
              {player.school || 'School TBD'} · {player.gradYear || 'Grad year TBD'}
            </p>
          </div>
        </div>
        <div className="action-row">
          <button className="btn-primary" onClick={generatePDF} disabled={stats.length === 0 || exportingPDF}>
            {exportingPDF ? <Loader size={16} className="spin" /> : <FileText size={16} />}
            {exportingPDF ? 'Generating PDF...' : 'Export PDF Report'}
          </button>
          <div className="card-icon">
            <BarChart3 size={24} />
          </div>
        </div>
      </header>

      <section className="panel">
        <h3>Career Totals ({gamesPlayed} games)</h3>
        {stats.length === 0 ? (
          <p className="empty-state">No stats recorded for this player yet.</p>
        ) : (
          <div className="totals-grid">
            <div className="totals-card">
              <strong>Offensive Stats</strong>
              <div className="totals-list">
                <span>Total Yards: {derivedStats.totalYards}</span>
                <span>Rush Yards: {derivedStats.rushingYards}</span>
                <span>Rush Attempts: {derivedStats.rushAttempts}</span>
                <span>Yards/Carry: {derivedStats.yardsPerCarry.toFixed(1)}</span>
                <span>Rush TDs: {derivedStats.rushingTDs}</span>
                <span>Rec Yards: {derivedStats.receivingYards}</span>
                <span>Receptions: {derivedStats.receptionCount}</span>
                <span>Yards/Rec: {derivedStats.yardsPerReception.toFixed(1)}</span>
                <span>Rec TDs: {derivedStats.receivingTDs}</span>
                <span>Targets: {derivedStats.targetCount}</span>
                <span>Return Yards: {derivedStats.returnYards}</span>
              </div>
            </div>
            <div className="totals-card">
              <strong>Defensive Stats</strong>
              <div className="totals-list">
                <span>Tackles: {derivedStats.tackles}</span>
                <span>Solo Tackles: {careerTotals['Tackle Solo'] || 0}</span>
                <span>Assists: {careerTotals['Tackle Assist'] || 0}</span>
                <span>Sacks: {derivedStats.sacks}</span>
                <span>Interceptions: {careerTotals['INT'] || 0}</span>
                <span>Pass Breakups: {careerTotals['PBU'] || 0}</span>
                <span>Forced Fumbles: {careerTotals['Forced Fumble'] || 0}</span>
                <span>TFL: {careerTotals['TFL'] || 0}</span>
              </div>
            </div>
            <div className="totals-card">
              <strong>Passing Stats</strong>
              <div className="totals-list">
                <span>Completions: {careerTotals['Pass Comp'] || 0}</span>
                <span>Incompletions: {careerTotals['Pass Inc'] || 0}</span>
                <span>Pass TDs: {derivedStats.passingTDs}</span>
                <span>
                  Comp %:{' '}
                  {careerTotals['Pass Comp'] + careerTotals['Pass Inc'] > 0
                    ? (
                        (careerTotals['Pass Comp'] /
                          (careerTotals['Pass Comp'] + careerTotals['Pass Inc'])) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </div>
            </div>
            {averages && (
              <div className="totals-card">
                <strong>Per Game Averages</strong>
                <div className="totals-list">
                  <span>Yards/Game: {averages.yardsPerGame.toFixed(1)}</span>
                  <span>Rush Yards/Game: {averages.rushYardsPerGame.toFixed(1)}</span>
                  <span>Rec Yards/Game: {averages.recYardsPerGame.toFixed(1)}</span>
                  <span>Tackles/Game: {averages.tacklesPerGame.toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {gameBreakdown.length >= 2 && (
        <div ref={chartRef}>
          <StatTrendChart
            gameBreakdown={gameBreakdown}
            playerPosition={player?.position || player?.offensePosition || player?.defensePosition}
          />
        </div>
      )}

      {gameBreakdown.length > 0 && (
        <section className="panel">
          <h3>Game-by-Game Breakdown</h3>
          <div className="table">
            <div className="table-row table-row-6col table-header">
              <span>Opponent</span>
              <span>Date</span>
              <span>Total Yds</span>
              <span>Rush Yds</span>
              <span>Rec Yds</span>
              <span>TDs</span>
            </div>
            {gameBreakdown.map((game) => (
              <div key={game.gameId} className="table-row table-row-6col">
                <span>
                  <Link className="link" to={`/review/${game.gameId}`}>
                    {game.opponent}
                  </Link>
                </span>
                <span>{game.date || '-'}</span>
                <span>{game.totalYards}</span>
                <span>{game.rushYards}</span>
                <span>{game.recYards}</span>
                <span>{game.tds}</span>
              </div>
            ))}
            <div className="table-row table-row-6col table-footer">
              <span>Career Total</span>
              <span>{gamesPlayed} games</span>
              <span>{derivedStats.totalYards}</span>
              <span>{derivedStats.rushingYards}</span>
              <span>{derivedStats.receivingYards}</span>
              <span>{derivedStats.rushingTDs + derivedStats.receivingTDs}</span>
            </div>
          </div>
        </section>
      )}

      {/* Composite Rating Trend */}
      {player?.compositeRating && (
        <section className="panel">
          <CompositeRatingTrend playerId={playerId} />
        </section>
      )}

      {/* Player Comments */}
      <section className="panel">
        <PlayerComments playerId={playerId} />
      </section>

      {/* Player Visits */}
      <section className="panel">
        <PlayerVisits playerId={playerId} />
      </section>
    </div>
  )
}

export default PlayerStats
