import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Plus, Undo2, Redo2, Pencil, Search, MessageSquare, Star, Clock, Check, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  loadData,
  saveData,
  exportToCSV,
  loadPlayers,
  loadGames,
  loadStats,
  createGame,
  updateGame,
  createStat,
  updateStat,
  deleteStat,
  setGamePlayers,
} from '../utils/storage'
import { gradesApi, notesApi, authApi, statsApi, shortcutsApi } from '../utils/api'
import { useUndoRedo } from '../hooks/useUndoRedo'
import { useWebSocket } from '../hooks/useWebSocket'
import EmptyState from './EmptyState'

const STAT_TYPES = [
  'Rush',
  'Reception',
  'Target',
  'Pass Comp',
  'Pass Inc',
  'Pass TD',
  'Sack',
  'Tackle Solo',
  'Tackle Assist',
  'INT',
  'Fumble',
  'Forced Fumble',
  'PBU',
  'TD',
  'Rush TD',
  'Rec TD',
  'FG',
  'PAT',
  'Kickoff',
  'Punt',
  'Return',
  'TFL',
  'Sack Taken',
]

const YARDAGE_STATS = new Set([
  'Rush',
  'Reception',
  'Return',
  'Pass Comp',
  'Pass TD',
  'Rush TD',
  'Rec TD',
])

const POSITION_STAT_PRESETS = {
  QB: ['Pass Comp', 'Pass Inc', 'Pass TD', 'Rush', 'Rush TD', 'Sack Taken', 'INT', 'Fumble'],
  RB: ['Rush', 'Rush TD', 'Reception', 'Rec TD', 'Target', 'Fumble'],
  WR: ['Reception', 'Rec TD', 'Target', 'Fumble'],
  TE: ['Reception', 'Rec TD', 'Target', 'Fumble'],
  OL: [], // OL tracks notes only, no stats
  DL: ['Sack', 'TFL', 'Tackle Solo', 'Forced Fumble'],
  LB: ['Tackle Solo', 'Tackle Assist', 'TFL', 'Sack', 'INT', 'PBU'],
  DB: ['Tackle Solo', 'Tackle Assist', 'INT', 'PBU', 'TD'],
  K: ['FG', 'PAT', 'Kickoff'],
  P: ['Punt', 'Kickoff'],
  ATH: ['Rush', 'Rush TD', 'Reception', 'Rec TD', 'Return', 'TD'],
}

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'ATH']
const DEFENSE_POSITIONS = ['DL', 'LB', 'DB']
const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P', 'ATH']

const DEFAULT_SHORTCUTS = {
  r: 'Rush',
  c: 'Reception',
  t: 'Tackle Solo',
  a: 'Tackle Assist',
  p: 'Pass Comp',
  m: 'Pass Inc',  // m for miss/incomplete
  i: 'INT',
  f: 'Fumble',
  s: 'Sack',
  l: 'TFL',
  b: 'PBU',
  y: 'Return',
  q: 'Sack Taken', // q for QB sacked
}

const DEFAULT_COMBO_SHORTCUTS = {
  RT: 'Rush TD',
  CT: 'Rec TD',
  PT: 'Pass TD',
}

const DEFAULT_STAT_PRESETS = ['Rush', 'Reception', 'Tackle Solo', 'INT', 'PBU', 'TD']

function GameReview() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const {
    state: gameStats,
    setState: setGameStats,
    setWithoutHistory: setGameStatsWithoutHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo([])

  const gameStatsRef = useRef([])
  const [clockSeconds, setClockSeconds] = useState(0)
  const [clockRunning, setClockRunning] = useState(false)
  const [quickEntry, setQuickEntry] = useState('')
  const [valueBuffer, setValueBuffer] = useState('')
  const [editingStatId, setEditingStatId] = useState(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerPositionFilter, setPlayerPositionFilter] = useState('All')
  const [reviewQueuePage, setReviewQueuePage] = useState(1)
  const [reviewQueuePerPage] = useState(10)
  const [statForm, setStatForm] = useState({
    playerId: '',
    statType: STAT_TYPES[0],
    value: 1,
    timestamp: '',
    period: '',
    note: '',
  })

  // Custom keyboard shortcuts
  const [activeShortcuts, setActiveShortcuts] = useState(DEFAULT_SHORTCUTS)
  const [activeComboShortcuts, setActiveComboShortcuts] = useState(DEFAULT_COMBO_SHORTCUTS)

  // User state for admin check
  const [currentUser, setCurrentUser] = useState(null)
  const isAdmin = currentUser?.role === 'admin'

  // Player grades state
  const [playerGrades, setPlayerGrades] = useState({})
  const [gradeForm, setGradeForm] = useState({
    playerId: '',
    grade: '',
    notes: '',
    admin_notes: '',
    game_score: '',
    team_record: '',
    next_opponent: '',
    next_game_date: ''
  })

  // Game notes state
  const [gameNotes, setGameNotes] = useState([])
  const [noteForm, setNoteForm] = useState({ timestamp: '', period: '', note: '', category: 'general' })
  const [editingNoteId, setEditingNoteId] = useState(null)

  // Save feedback state
  const [savedGrades, setSavedGrades] = useState(() => new Set())
  const [savedNoteAction, setSavedNoteAction] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)

  const game = games.find((item) => String(item.id) === String(gameId))

  // Real-time updates via WebSocket
  useWebSocket({
    gameId,
    onStatUpdate: async (data) => {
      if (data.type === 'created') {
        // Skip if this stat already exists (duplicate from own broadcast)
        setGameStats((prev) => {
          const realId = data.stat.id
          // Already have this exact ID
          if (prev.some((s) => s.id === realId)) return prev
          // Check if we have a temp entry that matches (same stat we just created locally)
          const tempIdx = prev.findIndex(
            (s) =>
              String(s.id).startsWith('temp-') &&
              String(s.playerId || s.player_id) === String(data.stat.player_id) &&
              s.statType === (data.stat.statType || data.stat.stat_type) &&
              String(s.gameId || s.game_id) === String(data.stat.game_id)
          )
          if (tempIdx !== -1) {
            // Replace temp entry with real one (keep position)
            const next = [...prev]
            next[tempIdx] = { ...next[tempIdx], id: realId }
            return next
          }
          // Truly new stat from another user — add at the top
          return [data.stat, ...prev]
        })
      } else if (data.type === 'updated') {
        // Update existing stat
        setGameStats((prev) => prev.map((s) => (s.id === data.stat.id ? data.stat : s)))
      } else if (data.type === 'deleted') {
        // Remove deleted stat
        setGameStats((prev) => prev.filter((s) => s.id !== data.statId))
      }
    },
  })

  // Load data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Load current user info and custom shortcuts
        const [userData, shortcutsData] = await Promise.all([
          authApi.me().catch(() => null),
          shortcutsApi.get().catch(() => null),
        ])
        setCurrentUser(userData)
        if (shortcutsData?.shortcuts) setActiveShortcuts(shortcutsData.shortcuts)
        if (shortcutsData?.combo_shortcuts) setActiveComboShortcuts(shortcutsData.combo_shortcuts)

        const [playersData, gamesData] = await Promise.all([loadPlayers(), loadGames()])
        setPlayers(playersData)
        setGames(gamesData)

        if (gameId) {
          const [statsData, gradesData, notesData] = await Promise.all([
            loadStats(gameId),
            gradesApi.getForGame(gameId).catch(() => []),
            notesApi.getForGame(gameId).catch(() => []),
          ])
          setGameStatsWithoutHistory(statsData)
          // Convert grades array to object keyed by playerId
          const gradesMap = {}
          gradesData.forEach((g) => {
            gradesMap[g.player_id] = {
              grade: g.grade,
              notes: g.notes,
              admin_notes: g.admin_notes || '',
              game_score: g.game_score || '',
              team_record: g.team_record || '',
              next_opponent: g.next_opponent || '',
              next_game_date: g.next_game_date || ''
            }
          })
          setPlayerGrades(gradesMap)
          setGameNotes(notesData)
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setPlayers(loadData('PLAYERS'))
        setGames(loadData('GAMES'))
        const allStats = loadData('STATS')
        setGameStatsWithoutHistory(allStats[gameId] || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [gameId, setGameStatsWithoutHistory])

  useEffect(() => {
    gameStatsRef.current = gameStats
  }, [gameStats])

  // Create game if it doesn't exist
  useEffect(() => {
    if (!gameId || loading) return
    if (games.some((item) => String(item.id) === String(gameId))) return
    const newGame = {
      opponent: '',
      date: new Date().toISOString().slice(0, 10),
      location: '',
      competitionLevel: '',
      videoUrl: '',
      notes: '',
      playerIds: [],
    }

    createGame(newGame)
      .then((created) => {
        if (created?.id && String(created.id) !== String(gameId)) {
          navigate(`/review/${created.id}`, { replace: true })
          return
        }
        if (created?.id) {
          setGames((prev) => [created, ...prev])
        }
      })
      .catch(() => {
        const fallback = { ...newGame, id: gameId }
        const next = [fallback, ...games]
        setGames(next)
        saveData('GAMES', next)
      })
  }, [gameId, games, loading, navigate])

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      if (playerSearch) {
        const query = playerSearch.toLowerCase()
        const matchesName = player.name?.toLowerCase().includes(query)
        const matchesSchool = player.school?.toLowerCase().includes(query)
        if (!matchesName && !matchesSchool) return false
      }

      if (playerPositionFilter !== 'All') {
        const positions = [player.position, player.offensePosition, player.defensePosition].filter(
          Boolean
        )
        const matchesPosition = positions.some(
          (p) =>
            p.toUpperCase() === playerPositionFilter ||
            p.toUpperCase().includes(playerPositionFilter)
        )
        if (!matchesPosition) return false
      }

      return true
    })
  }, [players, playerSearch, playerPositionFilter])

  // Pagination for review queue
  const reviewQueueTotalPages = Math.ceil(filteredPlayers.length / reviewQueuePerPage)
  const paginatedFilteredPlayers = useMemo(() => {
    const start = (reviewQueuePage - 1) * reviewQueuePerPage
    return filteredPlayers.slice(start, start + reviewQueuePerPage)
  }, [filteredPlayers, reviewQueuePage, reviewQueuePerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setReviewQueuePage(1)
  }, [playerSearch, playerPositionFilter])

  const reviewPlayers = useMemo(() => {
    if (!game) return []
    return players.filter((player) => game.playerIds?.includes(player.id))
  }, [players, game])

  const totals = useMemo(() => {
    const summary = {}
    gameStats.forEach((entry) => {
      if (!summary[entry.playerId]) summary[entry.playerId] = {}
      const current = summary[entry.playerId][entry.statType] || 0
      summary[entry.playerId][entry.statType] = current + Number(entry.value || 0)
    })
    return summary
  }, [gameStats])

  const getPlayerTotals = useCallback(
    (playerId) => {
      const playerTotals = totals[playerId] || {}
      const rushingYards = (playerTotals['Rush'] || 0) + (playerTotals['Rush TD'] || 0)
      const receivingYards = (playerTotals['Reception'] || 0) + (playerTotals['Rec TD'] || 0)
      const returnYards = playerTotals['Return'] || 0
      const totalYards = rushingYards + receivingYards + returnYards
      const rushAttempts = gameStats.filter(
        (entry) =>
          entry.playerId === playerId &&
          (entry.statType === 'Rush' || entry.statType === 'Rush TD')
      ).length
      const receptionCount = gameStats.filter(
        (entry) =>
          entry.playerId === playerId &&
          (entry.statType === 'Reception' || entry.statType === 'Rec TD')
      ).length
      const targetCount = gameStats.filter(
        (entry) => entry.playerId === playerId && entry.statType === 'Target'
      ).length
      const rushingTDs = gameStats.filter(
        (entry) => entry.playerId === playerId && entry.statType === 'Rush TD'
      ).length
      const receivingTDs = gameStats.filter(
        (entry) => entry.playerId === playerId && entry.statType === 'Rec TD'
      ).length
      const tackles = (playerTotals['Tackle Solo'] || 0) + (playerTotals['Tackle Assist'] || 0)
      const sacks = playerTotals['Sack'] || 0
      const yardsPerCarry = rushAttempts > 0 ? rushingYards / rushAttempts : 0
      const yardsPerReception = receptionCount > 0 ? receivingYards / receptionCount : 0
      return {
        rushingYards,
        receivingYards,
        returnYards,
        totalYards,
        rushAttempts,
        receptionCount,
        targetCount,
        rushingTDs,
        receivingTDs,
        yardsPerCarry,
        yardsPerReception,
        tackles,
        sacks,
      }
    },
    [gameStats, totals]
  )

  const gameYardageTotal = useMemo(() => {
    return gameStats.reduce((sum, entry) => {
      if (!YARDAGE_STATS.has(entry.statType)) return sum
      return sum + Number(entry.value || 0)
    }, 0)
  }, [gameStats])

  const getPlayerRoleFlags = (player) => {
    const offense = (player.offensePosition || player.position || '').toUpperCase()
    const defense = (player.defensePosition || '').toUpperCase()
    const isOffense = OFFENSE_POSITIONS.includes(offense)
    const isDefense =
      DEFENSE_POSITIONS.includes(defense) || DEFENSE_POSITIONS.includes(offense)
    if (!player.offensePosition && !player.defensePosition && !player.position) {
      return { showOffense: true, showDefense: true }
    }
    return {
      showOffense: isOffense || (!isDefense && !!player.offensePosition),
      showDefense: isDefense || (!!player.defensePosition && !isOffense),
    }
  }

  const handleGameChange = async (field, value) => {
    if (!gameId) return
    const fallbackGame = {
      id: gameId,
      opponent: '',
      date: new Date().toISOString().slice(0, 10),
      location: '',
      competitionLevel: '',
      videoUrl: '',
      notes: '',
      playerIds: [],
    }
    const baseGame = game || fallbackGame
    const updatedGame = { ...baseGame, [field]: value }

    setGames((prev) => {
      const exists = prev.some((item) => String(item.id) === String(gameId))
      const next = exists
        ? prev.map((item) => (String(item.id) === String(gameId) ? updatedGame : item))
        : [updatedGame, ...prev]
      saveData('GAMES', next)
      return next
    })

    try {
      await updateGame(gameId, updatedGame)
    } catch (err) {
      console.error('Error updating game:', err)
    }
  }

  const togglePlayer = async (playerId) => {
    if (!gameId) return
    const fallbackGame = {
      id: gameId,
      opponent: '',
      date: new Date().toISOString().slice(0, 10),
      location: '',
      competitionLevel: '',
      videoUrl: '',
      notes: '',
      playerIds: [],
    }
    const baseGame = game || fallbackGame
    const playerIds = baseGame.playerIds?.includes(playerId)
      ? baseGame.playerIds.filter((id) => id !== playerId)
      : [...(baseGame.playerIds || []), playerId]

    handleGameChange('playerIds', playerIds)
    try {
      await setGamePlayers(gameId, playerIds)
    } catch (err) {
      console.error('Error setting game players:', err)
    }
  }

  const handleStatChange = (event) => {
    const { name, value } = event.target
    setStatForm((prev) => ({
      ...prev,
      [name]: name === 'value' ? Number(value) : value,
    }))
  }

  const formatClock = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getCurrentTimestamp = useCallback(() => {
    return formatClock(clockSeconds)
  }, [clockSeconds])

  const saveStatsToStorage = useCallback(
    (newStats) => {
      const allStats = loadData('STATS')
      allStats[gameId] = newStats
      saveData('STATS', allStats)
    },
    [gameId]
  )

  const addStatEntry = useCallback(
    async (override = {}) => {
      if (!gameId) return
      const playerId = override.playerId || statForm.playerId
      if (!playerId) return

      const timestamp = override.timestamp || statForm.timestamp || getCurrentTimestamp()
      const period = override.period || statForm.period
      const statType = override.statType || statForm.statType
      const value = Number(override.value ?? statForm.value ?? 0)

      // Build list of entries to create (main stat + cascading stats)
      const entriesToCreate = []

      const tempId = `temp-${Date.now()}`
      const mainEntry = {
        id: tempId,
        playerId,
        gameId,
        statType,
        value,
        timestamp,
        period,
        note: override.note || statForm.note,
      }
      entriesToCreate.push(mainEntry)

      // Cascading stats for Sack (defensive): also count as TFL and Tackle Solo
      if (statType === 'Sack') {
        entriesToCreate.push({
          id: `temp-${Date.now()}-tfl`,
          playerId,
          gameId,
          statType: 'TFL',
          value: value, // same value (supports half sacks)
          timestamp,
          period,
          note: 'Auto: from sack',
        })
        entriesToCreate.push({
          id: `temp-${Date.now()}-tkl`,
          playerId,
          gameId,
          statType: 'Tackle Solo',
          value: value, // same value (supports half sacks)
          timestamp,
          period,
          note: 'Auto: from sack',
        })
      }

      // Cascading stat for Sack Taken (QB): also count as a rush attempt (negative yards)
      if (statType === 'Sack Taken') {
        entriesToCreate.push({
          id: `temp-${Date.now()}-rush`,
          playerId,
          gameId,
          statType: 'Rush',
          value: value * -1, // negative yards for sack
          timestamp,
          period,
          note: 'Auto: sack taken',
        })
      }

      const nextStats = [...entriesToCreate, ...gameStats]
      setGameStats(nextStats)
      saveStatsToStorage(nextStats)

      // Save all entries to database
      for (const entry of entriesToCreate) {
        try {
          const created = await createStat(entry)
          if (created?.id && created.id !== entry.id) {
            const latestStats = gameStatsRef.current
            const tempStillExists = latestStats.some((stat) => stat.id === entry.id)
            if (!tempStillExists) continue
            const syncedStats = latestStats.map((stat) =>
              stat.id === entry.id ? { ...stat, id: created.id } : stat
            )
            setGameStatsWithoutHistory(syncedStats)
            saveStatsToStorage(syncedStats)
          }
        } catch (err) {
          console.error('Error creating stat:', err)
        }
      }

      setStatForm((prev) => ({ ...prev, value: 1, note: '' }))
    },
    [
      gameId,
      statForm,
      gameStats,
      setGameStats,
      setGameStatsWithoutHistory,
      getCurrentTimestamp,
      saveStatsToStorage,
    ]
  )

  const handleEditStat = (entry) => {
    setEditingStatId(entry.id)
    setStatForm({
      playerId: entry.playerId,
      statType: entry.statType,
      value: entry.value || 1,
      timestamp: entry.timestamp || '',
      period: entry.period || '',
      note: entry.note || '',
    })
  }

  const handleUpdateStat = async () => {
    if (!editingStatId || !gameId) return

    const updatedEntry = {
      id: editingStatId,
      playerId: statForm.playerId,
      gameId,
      statType: statForm.statType,
      value: Number(statForm.value || 0),
      timestamp: statForm.timestamp,
      period: statForm.period,
      note: statForm.note,
    }

    const nextStats = gameStats.map((s) => (s.id === editingStatId ? updatedEntry : s))
    setGameStats(nextStats)
    saveStatsToStorage(nextStats)

    try {
      await updateStat(editingStatId, gameId, updatedEntry)
    } catch (err) {
      console.error('Error updating stat:', err)
    }

    setEditingStatId(null)
    setStatForm({
      playerId: statForm.playerId,
      statType: STAT_TYPES[0],
      value: 1,
      timestamp: '',
      period: '',
      note: '',
    })
  }

  const cancelEdit = () => {
    setEditingStatId(null)
    setStatForm({
      playerId: reviewPlayers[0]?.id || '',
      statType: STAT_TYPES[0],
      value: 1,
      timestamp: '',
      period: '',
      note: '',
    })
  }

  const handleQuickEntry = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const trimmed = quickEntry.trim()
    if (!trimmed) return
    const normalized = trimmed.replace(/\s+/g, '').replace('+', '')

    // Support decimal values like ".5s" or "0.5s" for half sacks
    const decimalMatch = normalized.match(/^(\d*\.?\d+)([a-z]{1,2})$/i)
    if (!decimalMatch) return

    const value = parseFloat(decimalMatch[1])
    const shortcutKey = decimalMatch[2].toUpperCase()

    if (shortcutKey.length === 2 && activeComboShortcuts[shortcutKey]) {
      const statType = activeComboShortcuts[shortcutKey]
      addStatEntry({ statType, value })
    } else {
      const statType = activeShortcuts[shortcutKey.toLowerCase()]
      if (!statType) return
      addStatEntry({ statType, value })
    }
    setQuickEntry('')
    setValueBuffer('')
    setStatForm((prev) => ({ ...prev, value }))
  }

  const applyTimestamp = useCallback(() => {
    setStatForm((prev) => ({ ...prev, timestamp: getCurrentTimestamp() }))
  }, [getCurrentTimestamp])

  const quickStatOptions = useMemo(() => {
    const player = players.find((item) => item.id === statForm.playerId)
    if (!player) return DEFAULT_STAT_PRESETS
    const key = (player.position || '').toUpperCase()
    if (POSITION_STAT_PRESETS[key]) return POSITION_STAT_PRESETS[key]
    const offenseKey = (player.offensePosition || '').toUpperCase()
    const defenseKey = (player.defensePosition || '').toUpperCase()
    return (
      POSITION_STAT_PRESETS[offenseKey] ||
      POSITION_STAT_PRESETS[defenseKey] ||
      DEFAULT_STAT_PRESETS
    )
  }, [players, statForm.playerId])

  useEffect(() => {
    if (reviewPlayers.length === 0) return
    setStatForm((prev) => {
      if (prev.playerId) return prev
      return { ...prev, playerId: reviewPlayers[0].id }
    })
  }, [reviewPlayers])

  useEffect(() => {
    if (!clockRunning) return
    const timer = setInterval(() => {
      setClockSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [clockRunning])

  const removeStatEntry = async (entryId) => {
    if (!gameId) return
    const nextStats = gameStats.filter((entry) => entry.id !== entryId)
    setGameStats(nextStats)
    saveStatsToStorage(nextStats)

    try {
      if (!String(entryId).startsWith('temp-')) {
        await deleteStat(entryId, gameId)
      }
    } catch (err) {
      console.error('Error deleting stat:', err)
    }
  }

  // Player grades functions
  const handleSaveGrade = async (playerId) => {
    if (!gameId || !playerId) return
    const gradeData = gradeForm.playerId === playerId ? gradeForm : playerGrades[playerId] || {}
    try {
      const payload = {
        grade: gradeData.grade || '',
        notes: gradeData.notes || '',
        game_score: gradeData.game_score || '',
        team_record: gradeData.team_record || '',
        next_opponent: gradeData.next_opponent || '',
        next_game_date: gradeData.next_game_date || '',
      }
      // Only include admin_notes if user is admin
      if (isAdmin && gradeData.admin_notes !== undefined) {
        payload.admin_notes = gradeData.admin_notes || ''
      }
      await gradesApi.upsert(gameId, playerId, payload)
      setPlayerGrades((prev) => ({
        ...prev,
        [playerId]: {
          grade: gradeData.grade || '',
          notes: gradeData.notes || '',
          admin_notes: isAdmin ? (gradeData.admin_notes || '') : (prev[playerId]?.admin_notes || ''),
          game_score: gradeData.game_score || '',
          team_record: gradeData.team_record || '',
          next_opponent: gradeData.next_opponent || '',
          next_game_date: gradeData.next_game_date || '',
        },
      }))
      setGradeForm({ playerId: '', grade: '', notes: '', admin_notes: '', game_score: '', team_record: '', next_opponent: '', next_game_date: '' })
      // Show saved feedback
      setSavedGrades((prev) => new Set(prev).add(playerId))
      setTimeout(() => {
        setSavedGrades((prev) => {
          const next = new Set(prev)
          next.delete(playerId)
          return next
        })
      }, 2000)
    } catch (err) {
      console.error('Error saving grade:', err)
    }
  }

  const handleGradeChange = (playerId, field, value) => {
    if (gradeForm.playerId !== playerId) {
      const existing = playerGrades[playerId] || {}
      setGradeForm({
        playerId,
        grade: existing.grade || '',
        notes: existing.notes || '',
        admin_notes: existing.admin_notes || '',
        game_score: existing.game_score || '',
        team_record: existing.team_record || '',
        next_opponent: existing.next_opponent || '',
        next_game_date: existing.next_game_date || '',
        [field]: value
      })
    } else {
      setGradeForm((prev) => ({ ...prev, [field]: value }))
    }
  }

  // Game notes functions
  const handleAddNote = async () => {
    if (!gameId || !noteForm.note.trim()) return
    try {
      const created = await notesApi.create({
        game_id: gameId,
        timestamp: noteForm.timestamp || getCurrentTimestamp(),
        period: noteForm.period,
        note: noteForm.note,
        category: noteForm.category,
      })
      setGameNotes((prev) => [created, ...prev])
      setNoteForm({ timestamp: '', period: '', note: '', category: 'general' })
      setSavedNoteAction(true)
      setTimeout(() => setSavedNoteAction(false), 2000)
    } catch (err) {
      console.error('Error adding note:', err)
    }
  }

  const handleUpdateNote = async () => {
    if (!editingNoteId || !noteForm.note.trim()) return
    try {
      const updated = await notesApi.update(editingNoteId, {
        timestamp: noteForm.timestamp,
        period: noteForm.period,
        note: noteForm.note,
        category: noteForm.category,
      })
      setGameNotes((prev) => prev.map((n) => (n.id === editingNoteId ? { ...n, ...updated } : n)))
      setEditingNoteId(null)
      setNoteForm({ timestamp: '', period: '', note: '', category: 'general' })
      setSavedNoteAction(true)
      setTimeout(() => setSavedNoteAction(false), 2000)
    } catch (err) {
      console.error('Error updating note:', err)
    }
  }

  const handleDeleteNote = async (noteId) => {
    try {
      await notesApi.delete(noteId)
      setGameNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      console.error('Error deleting note:', err)
    }
  }

  const handleEditNote = (note) => {
    setEditingNoteId(note.id)
    setNoteForm({
      timestamp: note.timestamp || '',
      period: note.period || '',
      note: note.note || '',
      category: note.category || 'general',
    })
  }

  // Save & Finish: flush active grade form, save all grades, navigate home
  const handleSaveAndFinish = async () => {
    if (!gameId) return
    setIsSavingAll(true)
    try {
      // Merge active gradeForm into playerGrades if it has a playerId
      const mergedGrades = { ...playerGrades }
      if (gradeForm.playerId) {
        mergedGrades[gradeForm.playerId] = {
          grade: gradeForm.grade || '',
          notes: gradeForm.notes || '',
          admin_notes: gradeForm.admin_notes || '',
          game_score: gradeForm.game_score || '',
          team_record: gradeForm.team_record || '',
          next_opponent: gradeForm.next_opponent || '',
          next_game_date: gradeForm.next_game_date || '',
        }
      }

      // Save all player grades
      const playerIds = Object.keys(mergedGrades)
      for (const playerId of playerIds) {
        const gradeData = mergedGrades[playerId]
        const payload = {
          grade: gradeData.grade || '',
          notes: gradeData.notes || '',
          game_score: gradeData.game_score || '',
          team_record: gradeData.team_record || '',
          next_opponent: gradeData.next_opponent || '',
          next_game_date: gradeData.next_game_date || '',
        }
        if (isAdmin && gradeData.admin_notes !== undefined) {
          payload.admin_notes = gradeData.admin_notes || ''
        }
        try {
          await gradesApi.upsert(gameId, playerId, payload)
        } catch (err) {
          console.error(`Error saving grade for player ${playerId}:`, err)
        }
      }

      navigate('/')
    } catch (err) {
      console.error('Error in save & finish:', err)
    } finally {
      setIsSavingAll(false)
    }
  }

  // Timer seek function
  const seekToTimestamp = useCallback((timestamp) => {
    if (!timestamp) return
    const parts = timestamp.split(':')
    if (parts.length !== 2) return
    const minutes = parseInt(parts[0], 10)
    const seconds = parseInt(parts[1], 10)
    if (isNaN(minutes) || isNaN(seconds)) return
    const totalSeconds = minutes * 60 + seconds
    setClockSeconds(totalSeconds)
    setClockRunning(false)
  }, [])

  // Keyboard shortcuts including undo/redo
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return
      const target = event.target

      // Handle Cmd/Ctrl+Z for undo, Cmd/Ctrl+Shift+Z for redo
      if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return
      }

      const key = event.key.toLowerCase()
      // Allow digits and decimal point for values like .5 (half sack)
      if (key >= '0' && key <= '9') {
        setValueBuffer((prev) => `${prev}${key}`.slice(0, 5))
        return
      }
      if (key === '.' && !valueBuffer.includes('.')) {
        setValueBuffer((prev) => `${prev}.`.slice(0, 5))
        return
      }
      if (key === 'backspace') {
        setValueBuffer((prev) => prev.slice(0, -1))
        return
      }
      if (key === 'escape') {
        setValueBuffer('')
        return
      }
      if (key === ' ') {
        event.preventDefault()
        applyTimestamp()
        return
      }
      const statType = activeShortcuts[key]
      if (!statType) return
      const bufferedValue = valueBuffer ? parseFloat(valueBuffer) : 1
      event.preventDefault()
      addStatEntry({ statType, value: bufferedValue })
      setValueBuffer('')
      setStatForm((prev) => ({ ...prev, value: 1 }))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [statForm, gameStats, clockSeconds, valueBuffer, undo, redo, addStatEntry, applyTimestamp, activeShortcuts])

  const exportGameStats = () => {
    if (!game || gameStats.length === 0) return
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

  if (!gameId) {
    return (
      <div className="page">
        <EmptyState icon={ClipboardList} title="No game selected" subtitle="Select a game review from the dashboard to get started." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading game data...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Game Review</h2>
          <p>Log stats with timestamps so the spreadsheet is ready right after film.</p>
        </div>
        <div className="action-row">
          <button className="btn-ghost" onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)">
            <Undo2 size={16} />
            Undo
          </button>
          <button
            className="btn-ghost"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={16} />
            Redo
          </button>
          <button className="btn-secondary" onClick={exportGameStats}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <section className="panel">
        <h3>Game Details</h3>
        <div className="form-grid">
          <label className="field">
            Opponent
            <input
              value={game?.opponent || ''}
              onChange={(event) => handleGameChange('opponent', event.target.value)}
              placeholder="Opponent"
            />
          </label>
          <label className="field">
            Date
            <input
              type="date"
              value={game?.date || ''}
              onChange={(event) => handleGameChange('date', event.target.value)}
            />
          </label>
          <label className="field">
            Location
            <input
              value={game?.location || ''}
              onChange={(event) => handleGameChange('location', event.target.value)}
              placeholder="Home / Away"
            />
          </label>
          <label className="field">
            Competition Level
            <input
              value={game?.competitionLevel || ''}
              onChange={(event) => handleGameChange('competitionLevel', event.target.value)}
              placeholder="Region, playoff, 5A, etc."
            />
          </label>
          <label className="field field-wide">
            Notes
            <input
              value={game?.notes || ''}
              onChange={(event) => handleGameChange('notes', event.target.value)}
              placeholder="Context, scheme notes, personnel"
            />
          </label>
        </div>
      </section>

      <section className="panel video-panel">
        <div className="video-header">
          <h3>Timer + Timestamping</h3>
          <div className="clock">
            <span className="clock-time">{formatClock(clockSeconds)}</span>
            <div className="clock-actions">
              <button className="btn-ghost" onClick={() => setClockRunning((prev) => !prev)}>
                {clockRunning ? 'Pause' : 'Start'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setClockRunning(false)
                  setClockSeconds(0)
                }}
              >
                Reset
              </button>
              <button className="btn-ghost" onClick={applyTimestamp}>
                Stamp Time (Space)
              </button>
            </div>
          </div>
        </div>
        <p className="helper-text">
          Tip: type a yardage value, then hit a shortcut key to log a play instantly.
        </p>
        <p className="helper-text">
          Keep the film on a separate monitor and use this timer for quick timestamps.
        </p>
      </section>

      <section className="split">
        <div className="panel">
          <h3>Review Queue</h3>
          {players.length === 0 ? (
            <p className="empty-state">Add players first to build your review queue.</p>
          ) : (
            <>
              <div className="search-filters">
                <div className="field-inline">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                  />
                </div>
                <select
                  value={playerPositionFilter}
                  onChange={(e) => setPlayerPositionFilter(e.target.value)}
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos === 'All' ? 'All Positions' : pos}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="list">
                {paginatedFilteredPlayers.map((player) => {
                  const isSelected = game?.playerIds?.includes(player.id)
                  return (
                    <li key={player.id} className="list-item">
                      <div>
                        <strong>{player.name}</strong>
                        <span>
                          {player.position || 'Position TBD'}
                          {player.offensePosition ? ` · O: ${player.offensePosition}` : ''}
                          {player.defensePosition ? ` · D: ${player.defensePosition}` : ''} ·{' '}
                          {player.school || 'School TBD'}
                        </span>
                      </div>
                      <button
                        className={`btn-ghost ${isSelected ? 'active' : ''}`}
                        onClick={() => togglePlayer(player.id)}
                      >
                        {isSelected ? 'In Review' : 'Add'}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {reviewQueueTotalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn-ghost"
                    onClick={() => setReviewQueuePage((p) => Math.max(1, p - 1))}
                    disabled={reviewQueuePage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {reviewQueuePage} of {reviewQueueTotalPages} ({filteredPlayers.length} total)
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => setReviewQueuePage((p) => Math.min(reviewQueueTotalPages, p + 1))}
                    disabled={reviewQueuePage === reviewQueueTotalPages}
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
          <h3>{editingStatId ? 'Edit Stat' : 'Stat Entry'}</h3>
          {reviewPlayers.length === 0 ? (
            <p className="empty-state">Select players to start logging stats.</p>
          ) : (
            <>
              <div className="form-grid">
                <label className="field">
                  Player
                  <select name="playerId" value={statForm.playerId} onChange={handleStatChange}>
                    <option value="">Select player</option>
                    {reviewPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Stat Type
                  <select name="statType" value={statForm.statType} onChange={handleStatChange}>
                    {STAT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Value
                  <input
                    name="value"
                    type="number"
                    value={statForm.value}
                    onChange={handleStatChange}
                  />
                </label>
                <label className="field">
                  Quick Entry
                  <input
                    value={quickEntry}
                    onChange={(event) => setQuickEntry(event.target.value)}
                    onKeyDown={handleQuickEntry}
                    placeholder="20RT or 20+C (press Enter)"
                    disabled={!!editingStatId}
                  />
                </label>
                <label className="field">
                  Timestamp
                  <input
                    name="timestamp"
                    value={statForm.timestamp}
                    onChange={handleStatChange}
                    placeholder="8:42"
                  />
                </label>
                <label className="field">
                  Period
                  <input
                    name="period"
                    value={statForm.period}
                    onChange={handleStatChange}
                    placeholder="Q1, Q2, OT"
                  />
                </label>
                <label className="field field-wide">
                  Note
                  <input
                    name="note"
                    value={statForm.note}
                    onChange={handleStatChange}
                    placeholder="Coverage, scheme, assignment, etc."
                  />
                </label>
                {editingStatId ? (
                  <div className="action-row">
                    <button className="btn-primary" onClick={handleUpdateStat}>
                      Update Stat
                    </button>
                    <button className="btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary" onClick={() => addStatEntry()}>
                    <Plus size={16} />
                    Add Stat
                  </button>
                )}
              </div>
              {!editingStatId && (
                <div className="tag-row">
                  {quickStatOptions.map((type) => (
                    <button
                      key={type}
                      className="btn-ghost"
                      onClick={() => {
                        const bufferedValue = valueBuffer ? Number(valueBuffer) : undefined
                        addStatEntry({
                          statType: type,
                          value: bufferedValue ?? statForm.value,
                        })
                        if (valueBuffer) {
                          setValueBuffer('')
                          setStatForm((prev) => ({ ...prev, value: bufferedValue }))
                        }
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
              {valueBuffer ? (
                <p className="helper-text">
                  Keyboard yardage buffer: {valueBuffer} (Backspace to edit, Esc to clear)
                </p>
              ) : null}
              <div className="shortcut-grid">
                {Object.entries(activeShortcuts).map(([key, label]) => (
                  <div key={key} className="shortcut-pill">
                    <span>{key.toUpperCase()}</span>
                    <span>{label}</span>
                  </div>
                ))}
                <div className="shortcut-pill">
                  <span>Space</span>
                  <span>Stamp Time</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Totals & Grades</h3>
        {reviewPlayers.length === 0 ? (
          <p className="empty-state">Totals will appear once stats are logged.</p>
        ) : (
          <div className="totals-grid">
            {reviewPlayers.map((player) => {
              const currentGrade = gradeForm.playerId === player.id ? gradeForm : playerGrades[player.id] || {}
              return (
                <div key={player.id} className="totals-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{player.name}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Star size={16} style={{ color: 'var(--color-warning)' }} />
                      <select
                        value={currentGrade.grade || ''}
                        onChange={(e) => handleGradeChange(player.id, 'grade', e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px' }}
                      >
                        <option value="">Grade</option>
                        <option value="A+">A+</option>
                        <option value="A">A</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B">B</option>
                        <option value="B-">B-</option>
                        <option value="C+">C+</option>
                        <option value="C">C</option>
                        <option value="C-">C-</option>
                        <option value="D">D</option>
                        <option value="F">F</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', padding: '10px', background: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Game Info
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Score (W 28-14)"
                        value={currentGrade.game_score || ''}
                        onChange={(e) => handleGradeChange(player.id, 'game_score', e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        placeholder="Record (5-2)"
                        value={currentGrade.team_record || ''}
                        onChange={(e) => handleGradeChange(player.id, 'team_record', e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        placeholder="Next Opponent"
                        value={currentGrade.next_opponent || ''}
                        onChange={(e) => handleGradeChange(player.id, 'next_opponent', e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        placeholder="Next Game Date"
                        value={currentGrade.next_game_date || ''}
                        onChange={(e) => handleGradeChange(player.id, 'next_game_date', e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                      />
                    </div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>
                      Game Notes
                    </label>
                    <textarea
                      placeholder="Scout notes for this game..."
                      value={currentGrade.notes || ''}
                      onChange={(e) => handleGradeChange(player.id, 'notes', e.target.value)}
                      rows={2}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px', width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    {isAdmin && (
                      <textarea
                        placeholder="Admin notes (admin only)..."
                        value={currentGrade.admin_notes || ''}
                        onChange={(e) => handleGradeChange(player.id, 'admin_notes', e.target.value)}
                        rows={2}
                        style={{ padding: '8px 10px', borderRadius: '6px', border: '2px solid var(--color-warning)', fontSize: '13px', width: '100%', resize: 'vertical', fontFamily: 'inherit', background: 'rgba(217, 119, 6, 0.1)' }}
                      />
                    )}
                    <button
                      className={savedGrades.has(player.id) ? 'btn-saved' : 'btn-primary'}
                      onClick={() => handleSaveGrade(player.id)}
                      disabled={savedGrades.has(player.id)}
                      style={{ fontSize: '12px', padding: '6px 12px', alignSelf: 'flex-start' }}
                    >
                      {savedGrades.has(player.id) ? (
                        <><Check size={14} /> Saved!</>
                      ) : (
                        <><Save size={14} /> Save</>
                      )}
                    </button>
                  </div>
                  <div className="totals-list">
                    {(() => {
                      const derived = getPlayerTotals(player.id)
                      const roleFlags = getPlayerRoleFlags(player)
                      return (
                        <>
                          {roleFlags.showOffense ? (
                            <>
                              <span>Total Yards: {derived.totalYards}</span>
                              <span>Rush Yards: {derived.rushingYards}</span>
                              <span>Rush Att: {derived.rushAttempts}</span>
                              <span>Yards/Carry: {derived.yardsPerCarry.toFixed(1)}</span>
                              <span>Rush TDs: {derived.rushingTDs}</span>
                              <span>Rec Yards: {derived.receivingYards}</span>
                              <span>Receptions: {derived.receptionCount}</span>
                              <span>Yards/Rec: {derived.yardsPerReception.toFixed(1)}</span>
                              <span>Rec TDs: {derived.receivingTDs}</span>
                              <span>Targets: {derived.targetCount}</span>
                              <span>Return Yards: {derived.returnYards}</span>
                            </>
                          ) : null}
                          {roleFlags.showDefense ? (
                            <>
                              <span>Tackles: {derived.tackles}</span>
                              <span>
                                {derived.sacks === 1 ? 'Sack' : 'Sacks'}: {derived.sacks}
                              </span>
                            </>
                          ) : null}
                        </>
                      )
                    })()}
                    {STAT_TYPES.map((type) => (
                      <span key={type}>
                        {type}: {totals[player.id]?.[type] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Logged Stats ({gameStats.length})</h3>
        {gameStats.length === 0 ? (
          <p className="empty-state">No stats logged yet.</p>
        ) : (
          <div className="table">
            <div className="table-row table-header">
              <span>Stat</span>
              <span>Yards</span>
              <span>Time</span>
              <span>Period</span>
              <span>Note</span>
              <span>By</span>
              <span />
            </div>
            {gameStats.map((entry) => {
              const yards = YARDAGE_STATS.has(entry.statType) ? entry.value : '-'
              const player = players.find((p) => p.id === entry.playerId)
              return (
                <div
                  key={entry.id}
                  className={`table-row ${editingStatId === entry.id ? 'active' : ''}`}
                >
                  <span>
                    {entry.statType}
                    {player ? ` (${player.name})` : ''}
                  </span>
                  <span>{yards}</span>
                  <span>
                    {entry.timestamp ? (
                      <button
                        className="btn-ghost"
                        onClick={() => seekToTimestamp(entry.timestamp)}
                        title="Click to set timer"
                        style={{ padding: '2px 6px', fontSize: '13px' }}
                      >
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        {entry.timestamp}
                      </button>
                    ) : (
                      '-'
                    )}
                  </span>
                  <span>{entry.period || '-'}</span>
                  <span>{entry.note || '-'}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {entry.created_by_name || '-'}
                  </span>
                  <div className="row-actions">
                    <button className="btn-ghost" onClick={() => handleEditStat(entry)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-ghost danger"
                      onClick={() => removeStatEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
            <div className="table-row table-footer">
              <span>Total</span>
              <span>{gameYardageTotal}</span>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>
          <MessageSquare size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Game Film Notes ({gameNotes.length})
        </h3>
        <div className="form-grid">
          <label className="field">
            Timestamp
            <div className="field-inline">
              <input
                value={noteForm.timestamp}
                onChange={(e) => setNoteForm((prev) => ({ ...prev, timestamp: e.target.value }))}
                placeholder="0:00"
              />
              <button className="btn-ghost" onClick={() => setNoteForm((prev) => ({ ...prev, timestamp: getCurrentTimestamp() }))}>
                Now
              </button>
            </div>
          </label>
          <label className="field">
            Period
            <input
              value={noteForm.period}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, period: e.target.value }))}
              placeholder="Q1, Q2, etc."
            />
          </label>
          <label className="field">
            Category
            <select
              value={noteForm.category}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="general">General</option>
              <option value="scheme">Scheme</option>
              <option value="personnel">Personnel</option>
              <option value="tendency">Tendency</option>
              <option value="highlight">Highlight</option>
              <option value="concern">Concern</option>
            </select>
          </label>
          <label className="field field-wide">
            Note
            <input
              value={noteForm.note}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Observation, scheme note, tendency..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !editingNoteId) {
                  e.preventDefault()
                  handleAddNote()
                }
              }}
            />
          </label>
          {editingNoteId ? (
            <div className="action-row">
              <button
                className={savedNoteAction ? 'btn-saved' : 'btn-primary'}
                onClick={handleUpdateNote}
                disabled={savedNoteAction}
              >
                {savedNoteAction ? <><Check size={16} /> Saved!</> : 'Update Note'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditingNoteId(null)
                  setNoteForm({ timestamp: '', period: '', note: '', category: 'general' })
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className={savedNoteAction ? 'btn-saved' : 'btn-primary'}
              onClick={handleAddNote}
              disabled={savedNoteAction}
            >
              {savedNoteAction ? (
                <><Check size={16} /> Saved!</>
              ) : (
                <><Plus size={16} /> Add Note</>
              )}
            </button>
          )}
        </div>
        {gameNotes.length === 0 ? (
          <p className="empty-state">No notes yet. Add observations as you review the film.</p>
        ) : (
          <ul className="list">
            {gameNotes.map((note) => (
              <li key={note.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {note.timestamp ? (
                      <button
                        className="btn-ghost"
                        onClick={() => seekToTimestamp(note.timestamp)}
                        title="Click to set timer"
                        style={{ padding: '2px 8px', fontSize: '12px' }}
                      >
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        {note.timestamp}
                      </button>
                    ) : null}
                    {note.period && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{note.period}</span>
                    )}
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: note.category === 'highlight' ? 'var(--color-success)' : note.category === 'concern' ? 'var(--color-danger)' : 'var(--color-bg-accent)',
                        color: (note.category === 'highlight' || note.category === 'concern') ? 'white' : 'var(--color-text-secondary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {note.category || 'general'}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{note.note}</p>
                  {note.author_name && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>— {note.author_name}</span>
                  )}
                </div>
                <div className="row-actions">
                  <button className="btn-ghost" onClick={() => handleEditNote(note)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-ghost danger" onClick={() => handleDeleteNote(note.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel save-finish-panel">
        <h3>Finish Review</h3>
        <p className="helper-text">
          Save all grades and notes for this game, then return to the dashboard.
        </p>
        <button
          className="btn-primary btn-finish"
          onClick={handleSaveAndFinish}
          disabled={isSavingAll}
        >
          {isSavingAll ? (
            <><Save size={18} className="spin" /> Saving...</>
          ) : (
            <><Save size={18} /> Save &amp; Finish</>
          )}
        </button>
      </section>
    </div>
  )
}

export default GameReview
