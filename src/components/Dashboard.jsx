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
import { emailApi, gradesApi, recruitingGoalsApi } from '../utils/api'
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
  const [recruitingGoals, setRecruitingGoals] = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [playersData, gamesData, statsData, goalsData] = await Promise.all([
          loadPlayers(),
          loadGames(),
          loadAllStats(),
          recruitingGoalsApi.get().catch(() => ({})),
        ])
        setPlayers(playersData)
        setGames(gamesData)
        setStats(loadData('STATS'))
        setAllStatsFlat(statsData || [])
        setRecruitingGoals(goalsData || {})
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
    // Filter out JUCO and Transfer players
    const hsPlayers = players.filter((p) => {
      if (p.isJuco === true) return false
      if (p.isTransferWishlist === true) return false
      return true
    })
    const flagged = hsPlayers.filter((player) => player.flagged)
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

    // Calculate average composite rating for committed players (HS only)
    const committedPlayers = hsPlayers.filter((p) => {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div className="skeleton-block skeleton-title" />
            <div className="skeleton-block skeleton-subtitle" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton-block skeleton-btn" />
            <div className="skeleton-block skeleton-btn" />
          </div>
        </div>
        <div className="skeleton-block skeleton-panel-sm" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
        </div>
        <div className="skeleton-block skeleton-panel" />
      </div>
    )
  }

  return (
    <div className="page db-page">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="db-header">
        <div className="db-header-top">
          <div>
            <span className="db-eyebrow">BYU Football · Recruiting Ops</span>
            <h1 className="db-title">Saturday Review Hub</h1>
          </div>
          <div className="db-header-actions">
            <button className="db-action-btn" onClick={handleBackup}>
              <Download size={13} /> Backup
            </button>
            <button className="db-action-btn" onClick={handleRestoreClick}>
              <Upload size={13} /> Restore
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreFile} style={{ display: 'none' }} />
            <Link className="db-action-btn" to="/players">
              <Users size={13} /> HS Players
            </Link>
            <Link className="db-action-btn primary" to={`/review/${Date.now()}`}>
              <Video size={13} /> New Review
            </Link>
          </div>
        </div>
        <div className="db-kpi-row">
          <div className="db-kpi">
            <span className="db-kpi-n">{flaggedPlayers.length}</span>
            <span className="db-kpi-l">Flagged</span>
          </div>
          <div className="db-kpi-divider" />
          <div className="db-kpi">
            <span className="db-kpi-n">{games.length}</span>
            <span className="db-kpi-l">Games</span>
          </div>
          <div className="db-kpi-divider" />
          <div className="db-kpi">
            <span className="db-kpi-n">{totalStats}</span>
            <span className="db-kpi-l">Stats Logged</span>
          </div>
          <div className="db-kpi-divider" />
          <div className="db-kpi db-kpi-composite">
            <span className="db-kpi-n">{avgCompositeRating != null ? avgCompositeRating.toFixed(2) : '—'}</span>
            <span className="db-kpi-l">Avg Composite</span>
            <span className="db-kpi-goal">Goal: {recruitingGoals.compositeRatingGoal ?? 86.12}+</span>
          </div>
        </div>
      </div>

      {/* ── STATUS MESSAGES ────────────────────────────────────── */}
      {(backupStatus || exportStatus) && (
        <div className="db-status-bar">
          {backupStatus || exportStatus}
        </div>
      )}

      {/* ── MAIN BODY ──────────────────────────────────────────── */}
      <div className="db-body">

        {/* LEFT COLUMN */}
        <div className="db-col-left">

          {/* Flagged Queue */}
          <div className="db-section">
            <div className="db-section-header">
              <Flag size={14} />
              <span className="db-section-title">Saturday Queue</span>
              <span className="db-section-count">{filteredFlaggedPlayers.length}</span>
            </div>
            {flaggedPlayers.length === 0 ? (
              <div className="db-empty">Flag players to build your Saturday watchlist</div>
            ) : (
              <>
                <div className="db-queue-filters">
                  <div className="db-queue-search">
                    <Search size={12} />
                    <input
                      type="text"
                      placeholder="Search…"
                      value={flaggedSearch}
                      onChange={e => setFlaggedSearch(e.target.value)}
                    />
                  </div>
                  <select className="db-queue-select" value={flaggedPosition} onChange={e => setFlaggedPosition(e.target.value)}>
                    {flaggedPositions.map(pos => <option key={pos} value={pos}>{pos === 'All' ? 'All Pos' : pos}</option>)}
                  </select>
                </div>
                <ul className="db-queue-list">
                  {paginatedFlaggedPlayers.map(player => (
                    <li key={player.id} className="db-queue-item">
                      <div className="db-queue-info">
                        <Link to={`/player/${player.id}`} className="db-queue-name">{player.name}</Link>
                        <span className="db-queue-meta">{player.position || '—'} · {player.school || 'School TBD'}</span>
                      </div>
                      <div className="db-queue-actions">
                        <Link className="db-queue-link" to={`/player/${player.id}/stats`}>Stats</Link>
                        <Link className="db-queue-link" to="/players">Edit</Link>
                      </div>
                    </li>
                  ))}
                </ul>
                {flaggedTotalPages > 1 && (
                  <div className="db-pager">
                    <button className="db-pager-btn" onClick={() => setFlaggedPage(p => Math.max(1, p - 1))} disabled={flaggedPage === 1}><ChevronLeft size={13} /></button>
                    <span className="db-pager-info">{flaggedPage} / {flaggedTotalPages}</span>
                    <button className="db-pager-btn" onClick={() => setFlaggedPage(p => Math.min(flaggedTotalPages, p + 1))} disabled={flaggedPage === flaggedTotalPages}><ChevronRight size={13} /></button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Games List */}
          <div className="db-section">
            <div className="db-section-header">
              <Video size={14} />
              <span className="db-section-title">All Games</span>
              <span className="db-section-count">{sortedGames.length}</span>
            </div>
            {sortedGames.length === 0 ? (
              <div className="db-empty">No games yet — start a review to log stats</div>
            ) : (
              <>
                <ul className="db-games-list">
                  {paginatedGames.map(game => (
                    <li key={game.id} className="db-game-item">
                      <div className="db-game-info">
                        <span className="db-game-opponent">{game.opponent || 'Opponent TBD'}</span>
                        <span className="db-game-meta">
                          <span className="db-game-date">{game.date || 'Date TBD'}</span>
                          {game.location ? ` · ${game.location}` : ''}
                        </span>
                      </div>
                      <Link className="db-queue-link" to={`/review/${game.id}`}>Open</Link>
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <div className="db-pager">
                    <button className="db-pager-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={13} /></button>
                    <span className="db-pager-info">{currentPage} / {totalPages}</span>
                    <button className="db-pager-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={13} /></button>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="db-col-right">

          {/* Export Section */}
          <div className="db-section">
            <div className="db-section-header">
              <Download size={14} />
              <span className="db-section-title">Export Stats</span>
            </div>

            <div className="db-export-block">
              <div className="db-export-label">
                <Calendar size={12} /> Game Day Export
              </div>
              <input
                type="date"
                className="db-export-date"
                value={exportDate}
                onChange={e => setExportDate(e.target.value)}
              />
              <div className="db-export-btns">
                <button className="db-export-btn" onClick={handleGameDayExportPDF}><FileText size={12} /> PDF</button>
                <button className="db-export-btn" onClick={handleGameDayExportExcel}><Table size={12} /> Excel</button>
                <button className="db-export-btn" onClick={handleGameDayPreview}><Eye size={12} /> Preview</button>
                <button className="db-export-btn" onClick={handleGameDayEmail}><Mail size={12} /> Email</button>
              </div>
              <label className="db-export-check">
                <input type="checkbox" checked={sendSelectedOnly} onChange={e => setSendSelectedOnly(e.target.checked)} />
                Selected positions only
              </label>
              {sendSelectedOnly && availablePositions.length > 0 && (
                <div className="db-export-positions">
                  {availablePositions.map(pos => (
                    <label key={pos} className="db-pos-check">
                      <input type="checkbox" checked={selectedPositions.includes(pos)}
                        onChange={e => {
                          if (e.target.checked) setSelectedPositions(prev => [...prev, pos])
                          else setSelectedPositions(prev => prev.filter(p => p !== pos))
                        }} />
                      {pos}
                    </label>
                  ))}
                </div>
              )}
              {previewPdfs.length > 0 && (
                <div className="db-preview-list">
                  {previewPdfs.map(pdf => (
                    <div key={pdf.filename} className="db-preview-item">
                      <span>{pdf.positionGroup}</span>
                      <a href={pdf.url} target="_blank" rel="noreferrer" className="db-queue-link">Open PDF</a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="db-export-divider" />

            <div className="db-export-block">
              <div className="db-export-label">
                <Table size={12} /> Season Stats Export
              </div>
              <div className="db-export-btns">
                <button className="db-export-btn" onClick={handleSeasonExportPDF}><FileText size={12} /> PDF</button>
                <button className="db-export-btn" onClick={handleSeasonExportExcel}><Table size={12} /> Excel</button>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="db-section db-section-feed">
            <div className="db-section-header">
              <ClipboardList size={14} />
              <span className="db-section-title">Recent Activity</span>
            </div>
            <ActivityFeed limit={15} />
          </div>

          {/* Top Performances */}
          <div className="db-section">
            <TopPerformances />
          </div>

        </div>
      </div>
    </div>
  )
}

export default Dashboard
