import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Video,
  Users,
  FileText,
  Clock,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Table,
  Mail,
  Search,
  Eye,
  ClipboardList,
  Flag,
} from 'lucide-react'
import {
  loadData,
  loadPlayers,
  loadGames,
  loadAllStats,
  exportBackup,
  importBackup,
  downloadJSON,
} from '../utils/storage'
import {
  exportGameDayPDF,
  exportGameDayExcel,
  exportSeasonStatsPDF,
  exportSeasonStatsExcel,
  exportGameDayPDFByPosition,
  getPositionGroup,
} from '../utils/exportUtils'
import { emailApi, gradesApi } from '../utils/api'
import TopPerformances from './TopPerformances'
import EmptyState from './EmptyState'
import ActivityFeed from './ActivityFeed'

const GAMES_PER_PAGE = 10

function Dashboard() {
  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [stats, setStats] = useState({})
  const [allStatsFlat, setAllStatsFlat] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [backupStatus, setBackupStatus] = useState('')
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0])
  const [exportStatus, setExportStatus] = useState('')
  const [flaggedSearch, setFlaggedSearch] = useState('')
  const [flaggedPosition, setFlaggedPosition] = useState('All')
  const [flaggedPage, setFlaggedPage] = useState(1)
  const [flaggedPerPage] = useState(20)
  const [sendSelectedOnly, setSendSelectedOnly] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState([])
  const [previewPdfs, setPreviewPdfs] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [playersData, gamesData, statsData] = await Promise.all([
          loadPlayers(),
          loadGames(),
          loadAllStats(),
        ])
        setPlayers(playersData)
        setGames(gamesData)
        setStats(loadData('STATS'))
        setAllStatsFlat(statsData || [])
      } catch (err) {
        console.error('Error loading data:', err)
        setPlayers(loadData('PLAYERS'))
        setGames(loadData('GAMES'))
        setStats(loadData('STATS'))
        // Flatten local stats for export
        const localStats = loadData('STATS')
        const flat = Object.entries(localStats).flatMap(([gameId, entries]) =>
          (entries || []).map((s) => ({ ...s, gameId }))
        )
        setAllStatsFlat(flat)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const { flaggedPlayers, sortedGames, totalStats, totalPages, paginatedGames, avgCompositeRating } = useMemo(() => {
    const flagged = players.filter((player) => player.flagged)
    const sorted = [...games].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
    const statCount = Object.values(stats).reduce((count, entries) => {
      if (!Array.isArray(entries)) return count
      return count + entries.length
    }, 0)
    const pages = Math.ceil(sorted.length / GAMES_PER_PAGE)
    const start = (currentPage - 1) * GAMES_PER_PAGE
    const paginated = sorted.slice(start, start + GAMES_PER_PAGE)

    // Calculate average composite rating for committed players
    const committedPlayers = players.filter((p) => {
      const statuses = p.recruitingStatuses || []
      return statuses.includes('Committed') || statuses.includes('Signed')
    })
    const ratingsWithValues = committedPlayers
      .map((p) => p.compositeRating)
      .filter((r) => r != null && !isNaN(parseFloat(r)))
    const avg = ratingsWithValues.length > 0
      ? ratingsWithValues.reduce((sum, r) => sum + parseFloat(r), 0) / ratingsWithValues.length
      : null

    return {
      flaggedPlayers: flagged,
      sortedGames: sorted,
      totalStats: statCount,
      totalPages: pages || 1,
      paginatedGames: paginated,
      avgCompositeRating: avg,
    }
  }, [players, games, stats, currentPage])

  const flaggedPositions = useMemo(() => {
    const positions = new Set(flaggedPlayers.map((p) => p.position).filter(Boolean))
    return ['All', ...Array.from(positions)]
  }, [flaggedPlayers])

  const filteredFlaggedPlayers = useMemo(() => {
    return flaggedPlayers.filter((player) => {
      if (flaggedSearch) {
        const query = flaggedSearch.toLowerCase()
        const matchesName = player.name?.toLowerCase().includes(query)
        const matchesSchool = player.school?.toLowerCase().includes(query)
        if (!matchesName && !matchesSchool) return false
      }
      if (flaggedPosition !== 'All' && player.position !== flaggedPosition) {
        return false
      }
      return true
    })
  }, [flaggedPlayers, flaggedSearch, flaggedPosition])

  const flaggedTotalPages = Math.ceil(filteredFlaggedPlayers.length / flaggedPerPage)
  const paginatedFlaggedPlayers = useMemo(() => {
    const start = (flaggedPage - 1) * flaggedPerPage
    return filteredFlaggedPlayers.slice(start, start + flaggedPerPage)
  }, [filteredFlaggedPlayers, flaggedPage, flaggedPerPage])

  const handleBackup = async () => {
    setBackupStatus('Exporting...')
    try {
      const backup = await exportBackup()
      const filename = `scouting-backup-${new Date().toISOString().split('T')[0]}.json`
      downloadJSON(backup, filename)
      setBackupStatus('Backup downloaded!')
      setTimeout(() => setBackupStatus(''), 3000)
    } catch (err) {
      console.error('Backup error:', err)
      setBackupStatus('Backup failed')
      setTimeout(() => setBackupStatus(''), 3000)
    }
  }

  const handleRestoreClick = () => {
    fileInputRef.current?.click()
  }

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBackupStatus('Restoring...')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importBackup(data)
      setBackupStatus('Restore complete! Refreshing...')
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error('Restore error:', err)
      setBackupStatus('Restore failed: ' + err.message)
      setTimeout(() => setBackupStatus(''), 5000)
    }
    e.target.value = ''
  }

  // Get games and stats for the selected export date
  const getGameDayData = () => {
    const gamesOnDate = games.filter((g) => g.date === exportDate)
    const gameIds = gamesOnDate.map((g) => String(g.id))
    const statsOnDate = allStatsFlat.filter((s) => {
      const gameId = String(s.gameId || s.game_id)
      return gameIds.includes(gameId)
    })
    const playerIds = [...new Set(statsOnDate.map((s) => String(s.playerId || s.player_id)))]
    const playersOnDate = players.filter((p) => playerIds.includes(String(p.id)))
    return { gamesOnDate, statsOnDate, playersOnDate, gameIds }
  }

  const availablePositions = useMemo(() => {
    const { playersOnDate } = getGameDayData()
    const groups = new Set()
    playersOnDate.forEach((player) => {
      groups.add(getPositionGroup(player.position))
    })
    return Array.from(groups).sort()
  }, [players, games, allStatsFlat, exportDate])

  useEffect(() => {
    if (!sendSelectedOnly) {
      setSelectedPositions(availablePositions)
      return
    }
    setSelectedPositions((prev) => {
      const filtered = prev.filter((pos) => availablePositions.includes(pos))
      return filtered.length > 0 ? filtered : availablePositions
    })
  }, [availablePositions, sendSelectedOnly])

  useEffect(() => {
    return () => {
      previewPdfs.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [previewPdfs])

  // Load grades for games on a specific date
  const loadGradesForGames = async (gameIds) => {
    const allGrades = []
    for (const gameId of gameIds) {
      try {
        const grades = await gradesApi.getForGame(gameId)
        allGrades.push(...grades)
      } catch (err) {
        console.error(`Error loading grades for game ${gameId}:`, err)
      }
    }
    return allGrades
  }

  const handleGameDayExportPDF = async () => {
    const { gamesOnDate, statsOnDate, playersOnDate, gameIds } = getGameDayData()
    if (statsOnDate.length === 0) {
      setExportStatus('No stats found for ' + exportDate)
      setTimeout(() => setExportStatus(''), 3000)
      return
    }
    setExportStatus('Loading grades & generating PDF...')
    try {
      const grades = await loadGradesForGames(gameIds)
      await exportGameDayPDF(playersOnDate, gamesOnDate, statsOnDate, exportDate, grades)
      setExportStatus('PDF downloaded!')
      setTimeout(() => setExportStatus(''), 3000)
    } catch (err) {
      console.error('Export error:', err)
      setExportStatus('Export failed')
      setTimeout(() => setExportStatus(''), 3000)
    }
  }

  const handleGameDayExportExcel = async () => {
    const { gamesOnDate, statsOnDate, playersOnDate, gameIds } = getGameDayData()
    if (statsOnDate.length === 0) {
      setExportStatus('No stats found for ' + exportDate)
      setTimeout(() => setExportStatus(''), 3000)
      return
    }
    setExportStatus('Loading grades & generating Excel...')
    try {
      const grades = await loadGradesForGames(gameIds)
      exportGameDayExcel(playersOnDate, gamesOnDate, statsOnDate, exportDate, grades)
      setExportStatus('Excel downloaded!')
      setTimeout(() => setExportStatus(''), 3000)
    } catch (err) {
      console.error('Export error:', err)
      setExportStatus('Export failed')
      setTimeout(() => setExportStatus(''), 3000)
    }
  }

  const buildPositionPdfs = async () => {
    const { gamesOnDate, statsOnDate, playersOnDate, gameIds } = getGameDayData()
    if (statsOnDate.length === 0) {
      throw new Error('No stats found for ' + exportDate)
    }
    const grades = await loadGradesForGames(gameIds)
    let pdfs = await exportGameDayPDFByPosition(playersOnDate, gamesOnDate, statsOnDate, exportDate, grades)
    if (sendSelectedOnly) {
      pdfs = pdfs.filter((pdf) => selectedPositions.includes(pdf.positionGroup))
    }
    if (pdfs.length === 0) {
      throw new Error('No position groups selected')
    }
    return pdfs
  }

  const handleGameDayPreview = async () => {
    setExportStatus('Generating preview...')
    try {
      const pdfs = await buildPositionPdfs()
      previewPdfs.forEach((item) => URL.revokeObjectURL(item.url))
      const withUrls = pdfs.map((pdf) => ({
        positionGroup: pdf.positionGroup,
        filename: pdf.filename,
        url: URL.createObjectURL(pdf.blob),
      }))
      setPreviewPdfs(withUrls)
      setExportStatus('Preview ready')
      setTimeout(() => setExportStatus(''), 3000)
    } catch (err) {
      console.error('Preview error:', err)
      setExportStatus(err?.message || 'Preview failed')
      setTimeout(() => setExportStatus(''), 3000)
    }
  }

  const handleGameDayEmail = async () => {
    setExportStatus('Generating position PDFs & sending email...')
    try {
      const pdfs = await buildPositionPdfs()
      const attachments = await Promise.all(
        pdfs.map(async (pdf) => {
          const buffer = await pdf.blob.arrayBuffer()
          return {
            positionGroup: pdf.positionGroup,
            filename: pdf.filename,
            data: btoa(String.fromCharCode(...new Uint8Array(buffer))),
          }
        })
      )
      await emailApi.sendGameDay({ date: exportDate, attachments })
      setExportStatus('Email sent to coaches!')
      setTimeout(() => setExportStatus(''), 3000)
    } catch (err) {
      console.error('Email error:', err)
      setExportStatus(err?.message || 'Email failed')
      setTimeout(() => setExportStatus(''), 3000)
    }
  }

  const handleSeasonExportPDF = () => {
    if (players.length === 0) {
      setExportStatus('No players to export')
      setTimeout(() => setExportStatus(''), 3000)
      return
    }
    setExportStatus('Generating Season PDF...')
    exportSeasonStatsPDF(players, allStatsFlat, games)
      .then(() => {
        setExportStatus('Season PDF downloaded!')
        setTimeout(() => setExportStatus(''), 3000)
      })
      .catch((err) => {
        console.error('Export error:', err)
        setExportStatus('Export failed')
        setTimeout(() => setExportStatus(''), 3000)
      })
  }

  const handleSeasonExportExcel = () => {
    if (players.length === 0) {
      setExportStatus('No players to export')
      setTimeout(() => setExportStatus(''), 3000)
      return
    }
    setExportStatus('Generating Season Excel...')
    try {
      exportSeasonStatsExcel(players, allStatsFlat, games)
      setExportStatus('Season Excel downloaded!')
      setTimeout(() => setExportStatus(''), 3000)
    } catch (err) {
      console.error('Export error:', err)
      setExportStatus('Export failed')
      setTimeout(() => setExportStatus(''), 3000)
    }
  }

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Saturday Review Hub</h2>
          <p>Queue flagged players, log stats quickly, export the spreadsheet in minutes.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" onClick={handleBackup}>
            <Download size={16} />
            Backup Data
          </button>
          <button className="btn-secondary" onClick={handleRestoreClick}>
            <Upload size={16} />
            Restore Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleRestoreFile}
            style={{ display: 'none' }}
          />
          <Link className="btn-secondary" to="/players">
            <Users size={16} />
            Manage Players
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                Avg Composite Rating:
              </span>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Goal: 88.04+
              </div>
            </div>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '700',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {avgCompositeRating != null ? avgCompositeRating.toFixed(2) : '-'}
            </div>
          </div>
          <Link className="btn-primary" to={`/review/${Date.now()}`}>
            <Video size={16} />
            Start New Review
          </Link>
        </div>
      </header>

      {backupStatus && (
        <div className="panel" style={{ padding: '12px 16px', background: '#e2e8f0' }}>
          {backupStatus}
        </div>
      )}

      <section className="card-grid">
        <div className="card">
          <div className="card-icon">
            <Users size={20} />
          </div>
          <div>
            <p className="card-label">Flagged Players</p>
            <h3>{flaggedPlayers.length}</h3>
            <p className="card-subtext">Ready for Saturday review.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-icon">
            <Video size={20} />
          </div>
          <div>
            <p className="card-label">Games Tracked</p>
            <h3>{games.length}</h3>
            <p className="card-subtext">Games reviewed this season.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-icon">
            <FileText size={20} />
          </div>
          <div>
            <p className="card-label">Stats Logged</p>
            <h3>{totalStats}</h3>
            <p className="card-subtext">Tagged clips and stat lines.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-icon">
            <Clock size={20} />
          </div>
          <div>
            <p className="card-label">Saturday Checklist</p>
            <ul className="card-list">
              <li>Queue flagged players</li>
              <li>Log stats with timestamps</li>
              <li>Export stats for coaches</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <ActivityFeed limit={15} />
      </section>

      {/* Top Performances */}
      <section style={{ marginTop: '24px' }}>
        <TopPerformances />
      </section>

      {/* Export Section */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={20} />
          Export Stats
        </h3>
        {exportStatus && (
          <div style={{ padding: '8px 12px', background: 'var(--color-bg-muted)', borderRadius: '8px', marginBottom: '16px' }}>
            {exportStatus}
          </div>
        )}
        <div className="export-grid">
          <div className="export-card">
            <div className="export-card-header">
              <Calendar size={20} />
              <strong>Game Day Export</strong>
            </div>
            <p className="helper-text">Export all player stats from a specific game day (e.g., Friday night games).</p>
            <div className="export-controls">
              <label className="field" style={{ marginBottom: '12px' }}>
                Select Date
                <input
                  type="date"
                  value={exportDate}
                  onChange={(e) => setExportDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
              <div className="export-buttons">
                <button className="btn-primary" onClick={handleGameDayExportPDF}>
                  <FileText size={16} />
                  PDF
                </button>
                <button className="btn-secondary" onClick={handleGameDayExportExcel}>
                  <Table size={16} />
                  Excel
                </button>
                <button className="btn-secondary" onClick={handleGameDayPreview}>
                  <FileText size={16} />
                  Preview
                </button>
                <button className="btn-secondary" onClick={handleGameDayEmail}>
                  <Mail size={16} />
                  Email
                </button>
              </div>
              <div className="export-toggle">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={sendSelectedOnly}
                    onChange={(e) => setSendSelectedOnly(e.target.checked)}
                  />
                  Send only selected positions
                </label>
              </div>
              {sendSelectedOnly ? (
                <div className="export-positions">
                  {availablePositions.map((pos) => (
                    <label key={pos} className="checkbox">
                      <input
                        type="checkbox"
                        checked={selectedPositions.includes(pos)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPositions((prev) => [...prev, pos])
                          } else {
                            setSelectedPositions((prev) => prev.filter((p) => p !== pos))
                          }
                        }}
                      />
                      {pos}
                    </label>
                  ))}
                </div>
              ) : null}
              {previewPdfs.length > 0 ? (
                <div className="preview-list">
                  {previewPdfs.map((pdf) => (
                    <div key={pdf.filename} className="preview-item">
                      <span>{pdf.positionGroup}</span>
                      <a className="link" href={pdf.url} target="_blank" rel="noreferrer">
                        Open PDF
                      </a>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="export-card">
            <div className="export-card-header">
              <Table size={20} />
              <strong>Season Stats Export</strong>
            </div>
            <p className="helper-text">Export cumulative season statistics for all players on your radar.</p>
            <div className="export-controls" style={{ marginTop: 'auto' }}>
              <div className="export-buttons">
                <button className="btn-primary" onClick={handleSeasonExportPDF}>
                  <FileText size={16} />
                  PDF
                </button>
                <button className="btn-secondary" onClick={handleSeasonExportExcel}>
                  <Table size={16} />
                  Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <h3>Flagged Player Queue</h3>
          {flaggedPlayers.length === 0 ? (
            <EmptyState icon={Flag} title="No flagged players" subtitle="Flag players to build your Saturday watchlist." />
          ) : (
            <>
              <div className="search-filters">
                <div className="field-inline">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search flagged players..."
                    value={flaggedSearch}
                    onChange={(e) => setFlaggedSearch(e.target.value)}
                  />
                </div>
                <select
                  value={flaggedPosition}
                  onChange={(e) => setFlaggedPosition(e.target.value)}
                >
                  {flaggedPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos === 'All' ? 'All Positions' : pos}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="list">
                {paginatedFlaggedPlayers.map((player) => (
                  <li key={player.id} className="list-item">
                    <div>
                      <strong>{player.name}</strong>
                      <span>
                        {player.position || 'Position TBD'} · {player.school || 'School TBD'}
                      </span>
                    </div>
                    <div className="row-actions">
                      <Link className="link" to={`/player/${player.id}/stats`}>
                        Stats
                      </Link>
                      <Link className="link" to="/players">
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              {flaggedTotalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn-ghost"
                    onClick={() => setFlaggedPage((p) => Math.max(1, p - 1))}
                    disabled={flaggedPage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {flaggedPage} of {flaggedTotalPages} ({filteredFlaggedPlayers.length} total)
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => setFlaggedPage((p) => Math.min(flaggedTotalPages, p + 1))}
                    disabled={flaggedPage === flaggedTotalPages}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="panel">
          <h3>All Games ({sortedGames.length})</h3>
          {sortedGames.length === 0 ? (
            <EmptyState icon={Video} title="No games yet" subtitle="Start a game review to log stats and export CSV." />
          ) : (
            <>
              <ul className="list">
                {paginatedGames.map((game) => (
                  <li key={game.id} className="list-item">
                    <div>
                      <strong>{game.opponent || 'Opponent TBD'}</strong>
                      <span>
                        {game.date || 'Date TBD'} · {game.location || 'Location TBD'}
                      </span>
                    </div>
                    <Link className="link" to={`/review/${game.id}`}>
                      Continue
                    </Link>
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn-ghost"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {currentPage} of {totalPages} ({sortedGames.length} games)
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
