import { playersApi, gamesApi, statsApi, backupApi, checkApiHealth } from './api.js'

// Local storage utilities for persisting data (fallback when API unavailable)
const STORAGE_KEYS = {
  PLAYERS: 'scouting_players',
  GAMES: 'scouting_games',
  STATS: 'scouting_stats',
}

let apiAvailable = null

// Check API availability (cached)
async function isApiAvailable() {
  if (apiAvailable === null) {
    apiAvailable = await checkApiHealth()
  }
  return apiAvailable
}

// Reset API availability check (call when you want to recheck)
export function resetApiCheck() {
  apiAvailable = null
}

// Local storage operations
function loadFromStorage(key) {
  try {
    const data = localStorage.getItem(STORAGE_KEYS[key])
    return data ? JSON.parse(data) : key === 'PLAYERS' ? [] : key === 'GAMES' ? [] : {}
  } catch (error) {
    console.error('Error loading data from localStorage:', error)
    return key === 'PLAYERS' ? [] : key === 'GAMES' ? [] : {}
  }
}

function saveToStorage(key, data) {
  try {
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Error saving data to localStorage:', error)
    return false
  }
}

// Convert API player to app format
function apiPlayerToApp(player) {
  const recruitingStatuses = Array.isArray(player.recruiting_statuses)
    ? player.recruiting_statuses
    : player.recruiting_status
    ? [player.recruiting_status]
    : ['Watching']

  return {
    id: player.id,
    name: player.name,
    position: player.position || '',
    offensePosition: player.offense_position || '',
    defensePosition: player.defense_position || '',
    school: player.school || '',
    state: player.state || '',
    gradYear: player.grad_year || '',
    notes: player.notes || '',
    flagged: player.flagged ?? true,
    cutUpCompleted: player.cut_up_completed ?? false,
    recruitingStatuses,
    statusUpdatedAt: player.status_updated_at,
    statusNotes: player.status_notes || '',
    committedSchool: player.committed_school || '',
    committedDate: player.committed_date || '',
    compositeRating: player.composite_rating || null,
    profilePictureUrl: player.profile_picture_url
      ? `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${player.profile_picture_url}`
      : null,
  }
}

// Convert app player to API format
function appPlayerToApi(player) {
  const gradYear = player.gradYear ? parseInt(player.gradYear, 10) : null
  const compositeRating = player.compositeRating ? parseFloat(player.compositeRating) : null
  return {
    name: player.name,
    position: player.position || null,
    offense_position: player.offensePosition || null,
    defense_position: player.defensePosition || null,
    school: player.school || null,
    state: player.state || null,
    grad_year: Number.isNaN(gradYear) ? null : gradYear,
    notes: player.notes || null,
    flagged: player.flagged,
    cut_up_completed: player.cutUpCompleted,
    recruiting_statuses: player.recruitingStatuses || null,
    status_notes: player.statusNotes || null,
    committed_school: player.committedSchool || null,
    committed_date: player.committedDate || null,
    composite_rating: Number.isNaN(compositeRating) ? null : compositeRating,
  }
}

// Convert API game to app format
function apiGameToApp(game) {
  return {
    id: game.id,
    opponent: game.opponent || '',
    date: game.date ? game.date.split('T')[0] : '',
    location: game.location || '',
    competitionLevel: game.competition_level || '',
    videoUrl: game.video_url || '',
    notes: game.notes || '',
    playerIds: game.player_ids || [],
  }
}

// Convert app game to API format
function appGameToApi(game) {
  return {
    opponent: game.opponent,
    date: game.date,
    location: game.location,
    competition_level: game.competitionLevel,
    video_url: game.videoUrl,
    notes: game.notes,
  }
}

// Convert API stat to app format
function apiStatToApp(stat) {
  return {
    id: stat.id,
    gameId: stat.game_id,
    playerId: stat.player_id,
    playerName: stat.player_name,
    playerPosition: stat.player_position,
    statType: stat.stat_type,
    value: stat.value || 0,
    timestamp: stat.timestamp || '',
    period: stat.period || '',
    note: stat.note || '',
  }
}

// Convert app stat to API format
function appStatToApi(stat) {
  return {
    game_id: Number(stat.gameId),
    player_id: Number(stat.playerId),
    stat_type: stat.statType,
    value: stat.value,
    timestamp: stat.timestamp || null,
    period: stat.period || null,
    note: stat.note || null,
  }
}

// Players operations
export async function loadPlayers() {
  if (await isApiAvailable()) {
    try {
      const players = await playersApi.getAll()
      return players.map(apiPlayerToApp)
    } catch (err) {
      console.error('API error, falling back to localStorage:', err)
    }
  }
  return loadFromStorage('PLAYERS')
}

export async function savePlayers(players) {
  // Always save to localStorage as backup
  saveToStorage('PLAYERS', players)
  return true
}

export async function createPlayer(player) {
  if (await isApiAvailable()) {
    try {
      const created = await playersApi.create(appPlayerToApi(player))
      return apiPlayerToApp(created)
    } catch (err) {
      console.error('API error creating player:', err)
    }
  }
  // Fallback: save to localStorage with generated ID
  const players = loadFromStorage('PLAYERS')
  const newPlayer = { ...player, id: player.id || Date.now() }
  players.push(newPlayer)
  saveToStorage('PLAYERS', players)
  return newPlayer
}

export async function updatePlayer(id, updates) {
  if (await isApiAvailable()) {
    try {
      const updated = await playersApi.update(id, appPlayerToApi(updates))
      return apiPlayerToApp(updated)
    } catch (err) {
      console.error('API error updating player:', err)
    }
  }
  // Fallback
  const players = loadFromStorage('PLAYERS')
  const index = players.findIndex((p) => p.id === id)
  if (index !== -1) {
    players[index] = { ...players[index], ...updates }
    saveToStorage('PLAYERS', players)
    return players[index]
  }
  return null
}

export async function deletePlayer(id) {
  if (await isApiAvailable()) {
    try {
      await playersApi.delete(id)
      return true
    } catch (err) {
      console.error('API error deleting player:', err)
    }
  }
  // Fallback
  const players = loadFromStorage('PLAYERS')
  const filtered = players.filter((p) => p.id !== id)
  saveToStorage('PLAYERS', filtered)
  return true
}

// Games operations
export async function loadGames() {
  if (await isApiAvailable()) {
    try {
      const games = await gamesApi.getAll()
      return games.map(apiGameToApp)
    } catch (err) {
      console.error('API error, falling back to localStorage:', err)
    }
  }
  return loadFromStorage('GAMES')
}

export async function saveGames(games) {
  saveToStorage('GAMES', games)
  return true
}

export async function createGame(game) {
  if (await isApiAvailable()) {
    try {
      const created = await gamesApi.create(appGameToApi(game))
      return apiGameToApp(created)
    } catch (err) {
      console.error('API error creating game:', err)
    }
  }
  // Fallback
  const games = loadFromStorage('GAMES')
  const newGame = { ...game, id: game.id || Date.now() }
  games.push(newGame)
  saveToStorage('GAMES', games)
  return newGame
}

export async function updateGame(id, updates) {
  if (await isApiAvailable()) {
    try {
      const updated = await gamesApi.update(id, appGameToApi(updates))
      return apiGameToApp(updated)
    } catch (err) {
      console.error('API error updating game:', err)
    }
  }
  // Fallback
  const games = loadFromStorage('GAMES')
  const index = games.findIndex((g) => g.id === id)
  if (index !== -1) {
    games[index] = { ...games[index], ...updates }
    saveToStorage('GAMES', games)
    return games[index]
  }
  return null
}

export async function deleteGame(id) {
  if (await isApiAvailable()) {
    try {
      await gamesApi.delete(id)
      return true
    } catch (err) {
      console.error('API error deleting game:', err)
    }
  }
  // Fallback
  const games = loadFromStorage('GAMES')
  const filtered = games.filter((g) => g.id !== id)
  saveToStorage('GAMES', filtered)
  return true
}

export async function setGamePlayers(gameId, playerIds) {
  if (await isApiAvailable()) {
    try {
      await gamesApi.setPlayers(gameId, playerIds)
      return true
    } catch (err) {
      console.error('API error setting game players:', err)
    }
  }
  // Fallback - update localStorage
  const games = loadFromStorage('GAMES')
  const index = games.findIndex((g) => g.id === gameId)
  if (index !== -1) {
    games[index].playerIds = playerIds
    saveToStorage('GAMES', games)
  }
  return true
}

// Stats operations
export async function loadStats(gameId) {
  if (await isApiAvailable()) {
    try {
      const stats = await statsApi.getForGame(gameId)
      return stats.map(apiStatToApp)
    } catch (err) {
      console.error('API error, falling back to localStorage:', err)
    }
  }
  const allStats = loadFromStorage('STATS')
  return allStats[gameId] || []
}

export async function loadAllStats(playerId) {
  if (await isApiAvailable()) {
    try {
      const stats = await statsApi.getAll(playerId)
      return stats.map(apiStatToApp)
    } catch (err) {
      console.error('API error loading all stats:', err)
    }
  }
  // Fallback - aggregate from localStorage
  const allStats = loadFromStorage('STATS')
  const flatStats = Object.entries(allStats).flatMap(([gameId, stats]) =>
    stats.map((s) => ({ ...s, gameId }))
  )
  if (playerId) {
    return flatStats.filter((s) => s.playerId === playerId)
  }
  return flatStats
}

export async function saveStats(gameId, stats) {
  const allStats = loadFromStorage('STATS')
  allStats[gameId] = stats
  saveToStorage('STATS', allStats)
  return true
}

export async function createStat(stat) {
  if (await isApiAvailable()) {
    try {
      const created = await statsApi.create(appStatToApi(stat))
      return apiStatToApp(created)
    } catch (err) {
      console.error('API error creating stat:', err)
    }
  }
  // Fallback
  const allStats = loadFromStorage('STATS')
  const gameStats = allStats[stat.gameId] || []
  const newStat = { ...stat, id: stat.id || Date.now() }
  gameStats.push(newStat)
  allStats[stat.gameId] = gameStats
  saveToStorage('STATS', allStats)
  return newStat
}

export async function updateStat(id, gameId, updates) {
  if (await isApiAvailable()) {
    try {
      const updated = await statsApi.update(id, appStatToApi(updates))
      return apiStatToApp(updated)
    } catch (err) {
      console.error('API error updating stat:', err)
    }
  }
  // Fallback
  const allStats = loadFromStorage('STATS')
  const gameStats = allStats[gameId] || []
  const index = gameStats.findIndex((s) => s.id === id)
  if (index !== -1) {
    gameStats[index] = { ...gameStats[index], ...updates }
    allStats[gameId] = gameStats
    saveToStorage('STATS', allStats)
    return gameStats[index]
  }
  return null
}

export async function deleteStat(id, gameId) {
  if (await isApiAvailable()) {
    try {
      await statsApi.delete(id)
      return true
    } catch (err) {
      console.error('API error deleting stat:', err)
    }
  }
  // Fallback
  const allStats = loadFromStorage('STATS')
  const gameStats = allStats[gameId] || []
  allStats[gameId] = gameStats.filter((s) => s.id !== id)
  saveToStorage('STATS', allStats)
  return true
}

// Backup operations
export async function exportBackup() {
  if (await isApiAvailable()) {
    try {
      return await backupApi.export()
    } catch (err) {
      console.error('API error exporting backup:', err)
    }
  }
  // Fallback - export from localStorage
  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    data: {
      players: loadFromStorage('PLAYERS'),
      games: loadFromStorage('GAMES'),
      stats: Object.entries(loadFromStorage('STATS')).flatMap(([gameId, stats]) =>
        stats.map((s) => ({ ...s, game_id: gameId }))
      ),
      game_players: [],
    },
  }
}

export async function importBackup(backupData) {
  if (await isApiAvailable()) {
    try {
      return await backupApi.restore(backupData)
    } catch (err) {
      console.error('API error importing backup:', err)
      throw err
    }
  }
  // Fallback - import to localStorage
  if (backupData.data) {
    saveToStorage('PLAYERS', backupData.data.players || [])
    saveToStorage('GAMES', backupData.data.games || [])

    // Convert stats array to object keyed by gameId
    const statsObj = {}
    for (const stat of backupData.data.stats || []) {
      const gameId = stat.game_id || stat.gameId
      if (!statsObj[gameId]) statsObj[gameId] = []
      statsObj[gameId].push(stat)
    }
    saveToStorage('STATS', statsObj)
  }
  return { message: 'Restore completed (localStorage)' }
}

// Legacy sync functions for backwards compatibility
export function loadData(key) {
  return loadFromStorage(key)
}

export function saveData(key, data) {
  return saveToStorage(key, data)
}

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          return typeof value === 'string' && value.includes(',')
            ? `"${value.replace(/"/g, '""')}"`
            : value
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Player photo operations
export async function uploadPlayerPhoto(playerId, file) {
  if (await isApiAvailable()) {
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('playerId', playerId)
      
      const token = localStorage.getItem('auth_token')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      const SERVER_BASE = API_URL.replace('/api', '')
      
      const response = await fetch(`${API_URL}/players/${playerId}/photo`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })
      
      if (!response.ok) {
        // If endpoint doesn't exist, return player without updating photo
        const player = await playersApi.get(playerId)
        return apiPlayerToApp(player)
      }
      
      const result = await response.json()
      return {
        ...apiPlayerToApp(result),
        profilePictureUrl: result.profile_picture_url 
          ? `${SERVER_BASE}${result.profile_picture_url}`
          : null,
      }
    } catch (err) {
      console.error('API error uploading photo:', err)
      // Return the player without photo update
      try {
        const player = await playersApi.get(playerId)
        return apiPlayerToApp(player)
      } catch {
        throw err
      }
    }
  }
  // Fallback - return player without photo
  const players = loadFromStorage('PLAYERS')
  const player = players.find((p) => p.id === playerId)
  return player || null
}

export async function deletePlayerPhoto(playerId) {
  if (await isApiAvailable()) {
    try {
      const token = localStorage.getItem('auth_token')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      
      const response = await fetch(`${API_URL}/players/${playerId}/photo`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      
      if (!response.ok) {
        // If endpoint doesn't exist, just return success
        return true
      }
      
      return true
    } catch (err) {
      console.error('API error deleting photo:', err)
      // Return success even if endpoint doesn't exist
      return true
    }
  }
  // Fallback - return success
  return true
}
