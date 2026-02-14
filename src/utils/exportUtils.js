import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import byuBannerUrl from '../assets/byubanner.jpeg'

// Position groups for stat filtering
const QB_POSITIONS = ['QB']
const RB_POSITIONS = ['RB', 'FB']
const WR_POSITIONS = ['WR']
const TE_POSITIONS = ['TE']
const OL_POSITIONS = ['OL', 'OT', 'OG', 'C']
const DL_POSITIONS = ['DL', 'DE', 'DT', 'NT']
const EDGE_POSITIONS = ['EDGE', 'OLB']
const LB_POSITIONS = ['LB', 'ILB', 'MLB']
const DB_POSITIONS = ['CB', 'S', 'FS', 'SS', 'DB']
const ATH_POSITIONS = ['ATH']

const RECRUIT_STATS_ORDER = {
  QB: ['passComp', 'passAtt', 'completionPct', 'passYards', 'passTD', 'rushYards', 'rushTD', 'interceptions', 'fumbles'],
  RB: ['carries', 'rushYds', 'rushTD', 'receptions', 'recYds', 'recTD', 'fumbles'],
  WR: ['receptions', 'recYds', 'recTD', 'carries', 'rushYds', 'rushTD', 'fumbles'],
  TE: ['receptions', 'recYds', 'tds', 'fumbles'],
  DL: ['tackles', 'tfl', 'pbu', 'sack', 'ff'],
  DE: ['tackles', 'tfl', 'pbu', 'sack', 'ff'],
  LB: ['tackles', 'pbu', 'ff', 'interceptions', 'sack', 'tfl'],
  S: ['pbu', 'tackles', 'interceptions'],
  C: ['pbu', 'tackles', 'interceptions'],
  K: ['patAtt', 'patMade', 'fgAtt', 'fgMade'],
  P: ['punts', 'netAvg'],
}

const RECRUIT_STATS_LABELS = {
  passComp: 'Comp',
  passAtt: 'Att',
  completionPct: 'Comp%',
  passYards: 'PassYds',
  passTD: 'PassTD',
  rushYards: 'RushYds',
  rushTD: 'RushTD',
  interceptions: 'INT',
  fumbles: 'Fum',
  carries: 'Car',
  rushYds: 'RushYds',
  receptions: 'Rec',
  recYds: 'RecYds',
  recTD: 'RecTD',
  tds: 'TD',
  tackles: 'Tkl',
  tfl: 'TFL',
  pbu: 'PBU',
  sack: 'Sack',
  ff: 'FF',
  patAtt: 'PATAtt',
  patMade: 'PATMade',
  fgAtt: 'FGAtt',
  fgMade: 'FGMade',
  punts: 'Punts',
  netAvg: 'NetAvg',
}

function formatRecruitStatsLine(position, stats = {}) {
  const keys = RECRUIT_STATS_ORDER[position] || []
  return keys
    .map((key) => {
      let value = stats[key]
      if (key === 'completionPct' && (value === undefined || value === '' || value === null)) {
        const comp = Number(stats.passComp || 0)
        const att = Number(stats.passAtt || 0)
        value = att > 0 ? Math.round((comp / att) * 100) : 0
      }
      return `${RECRUIT_STATS_LABELS[key] || key}: ${value ?? '-'}`
    })
    .join(' · ')
}

let bannerCachePromise = null

async function loadBannerImage() {
  if (bannerCachePromise) return bannerCachePromise
  bannerCachePromise = (async () => {
    const response = await fetch(byuBannerUrl)
    const blob = await response.blob()
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    return { dataUrl, width: img.width, height: img.height }
  })()
  return bannerCachePromise
}

async function addBanner(doc, pageWidth) {
  try {
    const banner = await loadBannerImage()
    const maxHeight = 18
    const maxWidth = pageWidth - 30
    const ratio = banner.width / banner.height
    const height = Math.min(maxHeight, maxWidth / ratio)
    const width = height * ratio
    const x = (pageWidth - width) / 2
    const y = 8
    doc.addImage(banner.dataUrl, 'JPEG', x, y, width, height)
    return y + height + 6
  } catch {
    return 15
  }
}

// State abbreviations for parsing
const STATE_ABBREVS = {
  'UT': 'Utah', 'AZ': 'Arizona', 'HI': 'Hawaii', 'CA': 'California',
  'TX': 'Texas', 'FL': 'Florida', 'GA': 'Georgia', 'OH': 'Ohio',
  'NV': 'Nevada', 'CO': 'Colorado', 'NM': 'New Mexico', 'ID': 'Idaho',
  'OR': 'Oregon', 'WA': 'Washington'
}

/**
 * Split a full name into first and last name
 */
function splitName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

/**
 * Try to extract state from school name
 */
function extractState(school) {
  if (!school) return ''
  // Check if school ends with state abbreviation in parentheses like "School (UT)"
  const parenMatch = school.match(/\(([A-Z]{2})\)$/)
  if (parenMatch && STATE_ABBREVS[parenMatch[1]]) {
    return parenMatch[1]
  }
  // Check for common state patterns
  if (school.includes('Utah') || school.includes(' UT')) return 'UT'
  if (school.includes('Arizona') || school.includes(' AZ')) return 'AZ'
  if (school.includes('Hawaii') || school.includes('Hawai')) return 'HI'
  if (school.includes('California') || school.includes(' CA')) return 'CA'
  return ''
}

/**
 * Get day of week from date string
 */
function getDayOfWeek(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * Determine position group for stat filtering
 */
export function getPositionGroup(position) {
  if (!position) return 'ATH'
  const pos = position.toUpperCase()
  if (QB_POSITIONS.some(p => pos.includes(p))) return 'QB'
  if (RB_POSITIONS.some(p => pos.includes(p))) return 'RB'
  if (WR_POSITIONS.some(p => pos.includes(p))) return 'WR'
  if (TE_POSITIONS.some(p => pos.includes(p))) return 'TE'
  if (OL_POSITIONS.some(p => pos.includes(p))) return 'OL'
  if (EDGE_POSITIONS.some(p => pos.includes(p))) return 'EDGE'
  if (DL_POSITIONS.some(p => pos.includes(p))) return 'DL'
  if (LB_POSITIONS.some(p => pos.includes(p))) return 'LB'
  if (DB_POSITIONS.some(p => pos.includes(p))) return 'DB'
  if (ATH_POSITIONS.some(p => pos.includes(p))) return 'ATH'
  return 'ATH'
}

/**
 * Calculate aggregated stats for a player from a list of stat entries
 */
function aggregateStats(statEntries) {
  const totals = {}
  statEntries.forEach((stat) => {
    const type = stat.statType || stat.stat_type
    const value = Number(stat.value || 0)
    totals[type] = (totals[type] || 0) + value
  })

  const rushYards = (totals['Rush'] || 0) + (totals['Rush TD'] || 0)
  const recYards = (totals['Reception'] || 0) + (totals['Rec TD'] || 0)
  const totalYards = rushYards + recYards + (totals['Return'] || 0)
  const tackles = (totals['Tackle Solo'] || 0) + (totals['Tackle Assist'] || 0)

  return {
    ...totals,
    rushYards,
    recYards,
    totalYards,
    tackles,
  }
}

/**
 * Get position-specific stats object
 */
function getPositionStats(posGroup, agg, pStats) {
  const countType = (types) => pStats.filter(s => {
    const type = s.statType || s.stat_type
    return types.includes(type)
  }).length

  switch (posGroup) {
    case 'QB':
      {
        const passComp = agg['Pass Comp'] || 0
        const passInc = agg['Pass Inc'] || 0
        const passAtt = passComp + passInc
        const compPct = passAtt > 0 ? Math.round((passComp / passAtt) * 100) : 0
        return {
          'Pass Att': passAtt,
          'Pass Comp': passComp,
          'Comp %': compPct,
          'Pass Inc': passInc,
          'Pass TDs': countType(['Pass TD']),
          'Rush Yds': agg.rushYards || 0,
          'Rush TDs': countType(['Rush TD']),
          'Sacks Taken': agg['Sack Taken'] || 0,
        }
      }
    case 'RB':
      return {
        'Rush Yds': agg.rushYards || 0,
        'Rush Att': countType(['Rush', 'Rush TD']),
        'Rush TDs': countType(['Rush TD']),
        'Rec Yds': agg.recYards || 0,
        'Rec': countType(['Reception', 'Rec TD']),
        'Rec TDs': countType(['Rec TD']),
      }
    case 'WR':
    case 'TE':
      return {
        'Rec Yds': agg.recYards || 0,
        'Rec': countType(['Reception', 'Rec TD']),
        'Rec TDs': countType(['Rec TD']),
        'Targets': agg['Target'] || 0,
      }
    case 'OL':
      return {
        // OL tracks notes only, no stats
      }
    case 'DL':
    case 'EDGE':
      return {
        'Tackles': agg.tackles || 0,
        'Sacks': agg['Sack'] || 0,
        'TFLs': agg['TFL'] || 0,
        'FF': agg['Forced Fumble'] || 0,
      }
    case 'LB':
      return {
        'Tackles': agg.tackles || 0,
        'Solo': agg['Tackle Solo'] || 0,
        'Ast': agg['Tackle Assist'] || 0,
        'Sacks': agg['Sack'] || 0,
        'TFLs': agg['TFL'] || 0,
        'INTs': agg['INT'] || 0,
        'PBUs': agg['PBU'] || 0,
      }
    case 'DB':
      return {
        'Tackles': agg.tackles || 0,
        'INTs': agg['INT'] || 0,
        'PBUs': agg['PBU'] || 0,
        'FF': agg['Forced Fumble'] || 0,
      }
    case 'ATH':
    default:
      return {
        'Total Yds': agg.totalYards || 0,
        'Rush Yds': agg.rushYards || 0,
        'Rec Yds': agg.recYards || 0,
        'TDs': countType(['Rush TD', 'Rec TD', 'Pass TD', 'TD']),
        'Tackles': agg.tackles || 0,
        'INTs': agg['INT'] || 0,
      }
  }
}

/**
 * Export Game Day stats to PDF
 * @param {Array} grades - Optional grades/notes data for players
 */
export async function exportGameDayPDF(players, games, stats, date, grades = []) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  const headerY = await addBanner(doc, pageWidth)

  // Create a lookup for grades by game_id + player_id
  const gradesLookup = {}
  grades.forEach(g => {
    const key = `${g.game_id}-${g.player_id}`
    gradesLookup[key] = g
  })

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('BYU Football Scouting - Game Day Report', pageWidth / 2, headerY, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  const dayOfWeek = getDayOfWeek(date)
  doc.text(`${dayOfWeek}, ${formatDate(date)}`, pageWidth / 2, headerY + 8, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`${players.length} player(s) tracked`, pageWidth / 2, headerY + 15, { align: 'center' })
  doc.setTextColor(0)

  doc.setDrawColor(200)
  doc.line(15, headerY + 20, pageWidth - 15, headerY + 20)

  // Group stats by player
  const playerStats = {}
  stats.forEach((stat) => {
    const playerId = stat.playerId || stat.player_id
    if (!playerStats[playerId]) playerStats[playerId] = []
    playerStats[playerId].push(stat)
  })

  // Build table data grouped by position
  const positionGroups = {}

  Object.entries(playerStats).forEach(([playerId, pStats]) => {
    const player = players.find((p) => String(p.id) === String(playerId))
    if (!player) return

    const posGroup = getPositionGroup(player.position)
    if (!positionGroups[posGroup]) positionGroups[posGroup] = []

    const { firstName, lastName } = splitName(player.name)
    const agg = aggregateStats(pStats)
    const game = games.find((g) => {
      const gameId = pStats[0]?.gameId || pStats[0]?.game_id
      return String(g.id) === String(gameId)
    })
    const posStats = getPositionStats(posGroup, agg, pStats)

    // Get notes for this player/game
    const gameId = pStats[0]?.gameId || pStats[0]?.game_id
    const gradeData = gradesLookup[`${gameId}-${playerId}`] || {}

    positionGroups[posGroup].push({
      firstName,
      lastName,
      gradYear: player.gradYear || '',
      position: player.position || '',
      school: player.school || '',
      state: player.state || extractState(player.school),
      opponent: game?.opponent || '',
      score: gradeData.game_score || '',
      teamRecord: gradeData.team_record || '',
      nextOpponent: gradeData.next_opponent || '',
      nextGame: gradeData.next_game_date || '',
      stats: posStats,
      gameGrade: gradeData.grade || '',
      scoutNotes: gradeData.notes || '',
      adminNotes: gradeData.admin_notes || '',
    })
  })

  let yPos = headerY + 27

  // Render each position group
  Object.entries(positionGroups).forEach(([posGroup, groupPlayers]) => {
    if (yPos > 180) {
      doc.addPage()
      yPos = headerY
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`${posGroup} (${groupPlayers.length})`, 15, yPos)
    yPos += 6

    // Get stat columns for this position group
    const statCols = groupPlayers.length > 0 ? Object.keys(groupPlayers[0].stats) : []
    const headers = ['First', 'Last', 'Class', 'Pos', 'School', 'ST', 'Opp', 'Score', 'Rec', 'Next Opp', 'Next', ...statCols, 'Grd', 'Scout Notes', 'Admin Notes']

    const tableData = groupPlayers.map(p => [
      p.firstName,
      p.lastName,
      p.gradYear,
      p.position,
      p.school,
      p.state,
      p.opponent,
      p.score,
      p.teamRecord,
      p.nextOpponent,
      p.nextGame,
      ...Object.values(p.stats),
      p.gameGrade,
      p.scoutNotes,
      p.adminNotes,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 6 },
      styles: { fontSize: 6, cellPadding: 1.5 },
      margin: { left: 10, right: 10 },
      columnStyles: {
        [headers.length - 2]: { cellWidth: 35 }, // Scout Notes
        [headers.length - 1]: { cellWidth: 35 }, // Admin Notes
      },
    })

    yPos = (doc.lastAutoTable?.finalY || yPos) + 12
  })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(128)
  doc.text(`Generated ${new Date().toLocaleDateString()} | BYU Football Scouting`, pageWidth / 2, pageHeight - 8, { align: 'center' })

  doc.save(`game_day_stats_${date}.pdf`)
}

/**
 * Generate game day PDFs grouped by position for emailing.
 * Returns an array of { positionGroup, filename, blob }.
 */
export async function exportGameDayPDFByPosition(players, games, stats, date, grades = []) {
  // Create a lookup for grades by game_id + player_id
  const gradesLookup = {}
  grades.forEach(g => {
    const key = `${g.game_id}-${g.player_id}`
    gradesLookup[key] = g
  })

  // Group stats by player
  const playerStats = {}
  stats.forEach((stat) => {
    const playerId = stat.playerId || stat.player_id
    if (!playerStats[playerId]) playerStats[playerId] = []
    playerStats[playerId].push(stat)
  })

  // Build table data grouped by position
  const positionGroups = {}

  Object.entries(playerStats).forEach(([playerId, pStats]) => {
    const player = players.find((p) => String(p.id) === String(playerId))
    if (!player) return

    const posGroup = getPositionGroup(player.position)
    if (!positionGroups[posGroup]) positionGroups[posGroup] = []

    const { firstName, lastName } = splitName(player.name)
    const agg = aggregateStats(pStats)
    const game = games.find((g) => {
      const gameId = pStats[0]?.gameId || pStats[0]?.game_id
      return String(g.id) === String(gameId)
    })
    const posStats = getPositionStats(posGroup, agg, pStats)

    const gameId = pStats[0]?.gameId || pStats[0]?.game_id
    const gradeData = gradesLookup[`${gameId}-${playerId}`] || {}

    positionGroups[posGroup].push({
      firstName,
      lastName,
      gradYear: player.gradYear || '',
      position: player.position || '',
      school: player.school || '',
      state: player.state || extractState(player.school),
      opponent: game?.opponent || '',
      score: gradeData.game_score || '',
      teamRecord: gradeData.team_record || '',
      nextOpponent: gradeData.next_opponent || '',
      nextGame: gradeData.next_game_date || '',
      stats: posStats,
      gameGrade: gradeData.grade || '',
      scoutNotes: gradeData.notes || '',
      adminNotes: gradeData.admin_notes || '',
    })
  })

  const outputs = []
  const dayOfWeek = getDayOfWeek(date)

  for (const [posGroup, groupPlayers] of Object.entries(positionGroups)) {
    if (groupPlayers.length === 0) continue
    const doc = new jsPDF('landscape')
    const pageWidth = doc.internal.pageSize.getWidth()

    const headerY = await addBanner(doc, pageWidth)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(`BYU Football Scouting - ${posGroup} Game Day Report`, pageWidth / 2, headerY, { align: 'center' })

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`${dayOfWeek}, ${formatDate(date)}`, pageWidth / 2, headerY + 8, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`${groupPlayers.length} player(s)`, pageWidth / 2, headerY + 15, { align: 'center' })
    doc.setTextColor(0)

    doc.setDrawColor(200)
    doc.line(15, headerY + 20, pageWidth - 15, headerY + 20)

    const statCols = groupPlayers.length > 0 ? Object.keys(groupPlayers[0].stats) : []
    const headers = ['First', 'Last', 'Class', 'Pos', 'School', 'ST', 'Opp', 'Score', 'Rec', 'Next Opp', 'Next', ...statCols, 'Grd', 'Scout Notes', 'Admin Notes']
    const tableData = groupPlayers.map(p => [
      p.firstName,
      p.lastName,
      p.gradYear,
      p.position,
      p.school,
      p.state,
      p.opponent,
      p.score,
      p.teamRecord,
      p.nextOpponent,
      p.nextGame,
      ...Object.values(p.stats),
      p.gameGrade,
      p.scoutNotes,
      p.adminNotes,
    ])

    autoTable(doc, {
      startY: headerY + 27,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 6 },
      styles: { fontSize: 6, cellPadding: 1.5 },
      margin: { left: 10, right: 10 },
      columnStyles: {
        [headers.length - 2]: { cellWidth: 35 },
        [headers.length - 1]: { cellWidth: 35 },
      },
    })

    outputs.push({
      positionGroup: posGroup,
      filename: `game_day_${posGroup}_${date}.pdf`,
      blob: doc.output('blob'),
    })
  }

  return outputs
}

/**
 * Export Game Day stats to Excel with position-specific sheets
 * @param {Array} grades - Optional grades/notes data for players
 */
export function exportGameDayExcel(players, games, stats, date, grades = []) {
  const wb = XLSX.utils.book_new()
  const dayOfWeek = getDayOfWeek(date)

  // Create a lookup for grades by game_id + player_id
  const gradesLookup = {}
  grades.forEach(g => {
    const key = `${g.game_id}-${g.player_id}`
    gradesLookup[key] = g
  })

  // Group stats by player
  const playerStats = {}
  stats.forEach((stat) => {
    const playerId = stat.playerId || stat.player_id
    if (!playerStats[playerId]) playerStats[playerId] = []
    playerStats[playerId].push(stat)
  })

  // Group players by position
  const positionGroups = {}

  Object.entries(playerStats).forEach(([playerId, pStats]) => {
    const player = players.find((p) => String(p.id) === String(playerId))
    if (!player) return

    const posGroup = getPositionGroup(player.position)
    if (!positionGroups[posGroup]) positionGroups[posGroup] = []

    const { firstName, lastName } = splitName(player.name)
    const agg = aggregateStats(pStats)
    const game = games.find((g) => {
      const gameId = pStats[0]?.gameId || pStats[0]?.game_id
      return String(g.id) === String(gameId)
    })
    const posStats = getPositionStats(posGroup, agg, pStats)

    // Get notes for this player/game
    const gameId = pStats[0]?.gameId || pStats[0]?.game_id
    const gradeData = gradesLookup[`${gameId}-${playerId}`] || {}

    positionGroups[posGroup].push({
      'First Name': firstName,
      'Last Name': lastName,
      'Grad Year': player.gradYear || '',
      'Position': player.position || '',
      'School': player.school || '',
      'State': player.state || extractState(player.school),
      'Date': date,
      'Day': dayOfWeek,
      'Opponent': game?.opponent || '',
      'Score': gradeData.game_score || '',
      'Team Record': gradeData.team_record || '',
      'Next Opponent': gradeData.next_opponent || '',
      'Next Game': gradeData.next_game_date || '',
      ...posStats,
      'Grade': gradeData.grade || '',
      'Scout Notes': gradeData.notes || '',
      'Admin Notes': gradeData.admin_notes || '',
    })
  })

  // Create a sheet for each position group
  const posOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'DB', 'ATH']

  posOrder.forEach(posGroup => {
    if (!positionGroups[posGroup] || positionGroups[posGroup].length === 0) return

    const data = positionGroups[posGroup]
    const ws = XLSX.utils.json_to_sheet(data)

    // Set column widths
    const cols = Object.keys(data[0])
    ws['!cols'] = cols.map(col => {
      if (col === 'First Name' || col === 'Last Name') return { wch: 14 }
      if (col === 'School') return { wch: 20 }
      if (col === 'Opponent' || col === 'Next Opponent') return { wch: 22 }
      if (col === 'Date' || col === 'Next Game') return { wch: 12 }
      if (col === 'Day') return { wch: 10 }
      if (col === 'Grade') return { wch: 8 }
      if (col === 'Scout Notes' || col === 'Admin Notes') return { wch: 30 }
      return { wch: 10 }
    })

    XLSX.utils.book_append_sheet(wb, ws, posGroup)
  })

  // Also create an "All Players" sheet
  const allData = []
  Object.entries(playerStats).forEach(([playerId, pStats]) => {
    const player = players.find((p) => String(p.id) === String(playerId))
    if (!player) return

    const { firstName, lastName } = splitName(player.name)
    const agg = aggregateStats(pStats)
    const game = games.find((g) => {
      const gameId = pStats[0]?.gameId || pStats[0]?.game_id
      return String(g.id) === String(gameId)
    })
    const posGroup = getPositionGroup(player.position)
    const posStats = getPositionStats(posGroup, agg, pStats)

    // Get notes for this player/game
    const gameId = pStats[0]?.gameId || pStats[0]?.game_id
    const gradeData = gradesLookup[`${gameId}-${playerId}`] || {}

    allData.push({
      'First Name': firstName,
      'Last Name': lastName,
      'Grad Year': player.gradYear || '',
      'Position': player.position || '',
      'School': player.school || '',
      'State': player.state || extractState(player.school),
      'Date': date,
      'Day': dayOfWeek,
      'Opponent': game?.opponent || '',
      'Score': gradeData.game_score || '',
      'Team Record': gradeData.team_record || '',
      'Next Opponent': gradeData.next_opponent || '',
      'Next Game': gradeData.next_game_date || '',
      ...posStats,
      'Grade': gradeData.grade || '',
      'Scout Notes': gradeData.notes || '',
      'Admin Notes': gradeData.admin_notes || '',
    })
  })

  if (allData.length > 0) {
    const wsAll = XLSX.utils.json_to_sheet(allData)
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Players')
  }

  XLSX.writeFile(wb, `game_day_stats_${date}.xlsx`)
}

/**
 * Export Season Stats to PDF
 */
export async function exportSeasonStatsPDF(players, allStats, games) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  const headerY = await addBanner(doc, pageWidth)

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('BYU Football Scouting Report', pageWidth / 2, headerY, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Season Statistics Summary', pageWidth / 2, headerY + 9, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`${players.length} player(s) · Generated ${new Date().toLocaleDateString()}`, pageWidth / 2, headerY + 16, { align: 'center' })
  doc.setTextColor(0)

  doc.setDrawColor(200)
  doc.line(15, headerY + 21, pageWidth - 15, headerY + 21)

  const tableData = players.map((player) => {
    const pStats = allStats.filter((s) => {
      const playerId = s.playerId || s.player_id
      return String(playerId) === String(player.id)
    })

    const agg = aggregateStats(pStats)
    const gamesPlayed = new Set(pStats.map((s) => s.gameId || s.game_id)).size
    const { firstName, lastName } = splitName(player.name)
    const passComp = countStatType(pStats, ['Pass Comp'])
    const passInc = countStatType(pStats, ['Pass Inc'])
    const passAtt = passComp + passInc
    const compPct = passAtt > 0 ? Math.round((passComp / passAtt) * 100) : ''

    return [
      firstName,
      lastName,
      player.gradYear || '-',
      player.position || '-',
      player.school || '-',
      player.state || extractState(player.school) || '-',
      gamesPlayed,
      compPct,
      agg.totalYards || 0,
      agg.rushYards || 0,
      countStatType(pStats, ['Rush TD']),
      agg.recYards || 0,
      countStatType(pStats, ['Rec TD']),
      agg.tackles || 0,
      agg['Sack'] || 0,
      agg['INT'] || 0,
    ]
  })

  tableData.sort((a, b) => b[7] - a[7])

  autoTable(doc, {
    startY: headerY + 28,
    head: [['First', 'Last', 'Class', 'Pos', 'School', 'ST', 'GP', 'Comp%', 'Total', 'Rush', 'RTD', 'Rec', 'RecTD', 'Tkl', 'Sack', 'INT']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    margin: { left: 10, right: 10 },
  })

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(128)
  doc.text(`BYU Football Scouting | Season Stats`, pageWidth / 2, pageHeight - 10, { align: 'center' })

  doc.save(`season_stats_${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export Season Stats to Excel
 */
export function exportSeasonStatsExcel(players, allStats, games) {
  const data = players.map((player) => {
    const pStats = allStats.filter((s) => {
      const playerId = s.playerId || s.player_id
      return String(playerId) === String(player.id)
    })

    const agg = aggregateStats(pStats)
    const gamesPlayed = new Set(pStats.map((s) => s.gameId || s.game_id)).size
    const { firstName, lastName } = splitName(player.name)
    const posGroup = getPositionGroup(player.position)
    const posStats = getPositionStats(posGroup, agg, pStats)

    return {
      'First Name': firstName,
      'Last Name': lastName,
      'Grad Year': player.gradYear || '',
      'Position': player.position || '',
      'School': player.school || '',
      'State': player.state || extractState(player.school),
      'Games Played': gamesPlayed,
      ...posStats,
    }
  })

  data.sort((a, b) => (b['Total Yds'] || b['Rush Yds'] || b['Tackles'] || 0) - (a['Total Yds'] || a['Rush Yds'] || a['Tackles'] || 0))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)

  ws['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 6 }, { wch: 6 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Season Stats')

  XLSX.writeFile(wb, `season_stats_${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * Load a profile picture as a data URL for embedding in PDF.
 * Returns { dataUrl, width, height } or null on failure.
 */
async function loadProfileImage(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    return dataUrl
  } catch {
    return null
  }
}

const SERVER_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : 'http://localhost:3001'

/**
 * Draw a square profile image that fills the cell with 0.5mm padding.
 */
function drawSquareImage(doc, dataUrl, cell) {
  const pad = 0.5
  const available = Math.min(cell.width, cell.height) - pad * 2
  const x = cell.x + (cell.width - available) / 2
  const y = cell.y + (cell.height - available) / 2
  doc.addImage(dataUrl, 'JPEG', x, y, available, available)
}

/**
 * Draw BYU logo placeholder square (blue oval with white Y).
 */
function drawInitialSquare(doc, name, cell) {
  const pad = 0.5
  const available = Math.min(cell.width, cell.height) - pad * 2
  const x = cell.x + (cell.width - available) / 2
  const y = cell.y + (cell.height - available) / 2
  const centerX = x + available / 2
  const centerY = y + available / 2
  
  // Draw blue oval background
  doc.setFillColor(0, 48, 135) // BYU blue #003087
  doc.ellipse(centerX, centerY, available * 0.45, available * 0.4, 'F')
  
  // Draw white Y letter using basic shapes
  doc.setFillColor(255, 255, 255)
  const ySize = available * 0.5
  const yTop = centerY - ySize * 0.2
  const yMid = centerY + ySize * 0.1
  const yBottom = centerY + ySize * 0.35
  
  // Left arm of Y (thick rectangle positioned diagonally)
  const armWidth = ySize * 0.15
  const armHeight = ySize * 0.3
  // Left arm - positioned to form left side of Y
  doc.rect(
    centerX - ySize * 0.3,
    yTop,
    armWidth,
    armHeight,
    'F'
  )
  
  // Right arm of Y
  doc.rect(
    centerX + ySize * 0.15,
    yTop,
    armWidth,
    armHeight,
    'F'
  )
  
  // Stem of Y (vertical rectangle)
  const stemWidth = ySize * 0.15
  const stemHeight = ySize * 0.3
  doc.rect(
    centerX - stemWidth / 2,
    yMid,
    stemWidth,
    stemHeight,
    'F'
  )
  
  // Reset
  doc.setFillColor(0, 0, 0)
}

/**
 * Export Recruits Report to PDF
 */
async function buildRecruitsReportDoc(recruits, notes, weekStart, weekEnd) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  const headerY = await addBanner(doc, pageWidth)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('BYU Football Recruits Weekly Report', pageWidth / 2, headerY, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Week: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`, pageWidth / 2, headerY + 8, { align: 'center' })

  doc.setDrawColor(200)
  doc.line(15, headerY + 20, pageWidth - 15, headerY + 20)

  const notesByRecruit = {}
  notes.forEach((note) => {
    if (!notesByRecruit[note.recruit_id]) notesByRecruit[note.recruit_id] = []
    notesByRecruit[note.recruit_id].push(note)
  })

  const groups = {
    OFFENSE: ['QB', 'RB', 'WR', 'TE', 'OL'],
    DEFENSE: ['DL', 'DE', 'LB', 'C', 'S'],
    SPECIAL: ['K', 'P'],
  }

  let yPos = headerY + 28
  Object.entries(groups).forEach(([side, positions]) => {
    const sideRecruits = recruits.filter((r) => positions.includes(r.position))
    if (sideRecruits.length === 0) return

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(side, 15, yPos)
    yPos += 6

    positions.forEach((pos) => {
      const posRecruits = sideRecruits.filter((r) => r.position === pos)
      if (posRecruits.length === 0) return

      if (yPos > 175) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(11)
      doc.text(`${pos} (${posRecruits.length})`, 15, yPos)
      yPos += 4

      const headers = ['Name', 'School', 'Class', 'Status', 'Last Game', 'Stats', 'Next Game', 'Notes']
      const body = posRecruits.map((r) => {
        const lastGame = [
          r.last_game_date || '',
          r.last_game_opponent || '',
          r.last_game_score || '',
          r.last_game_result || '',
        ].filter(Boolean).join(' ')
        const nextGame = [
          r.next_game_date || '',
          r.next_game_opponent || '',
        ].filter(Boolean).join(' ')
        const recruitNotes = notesByRecruit[r.id] || []
        const notesText = recruitNotes.length > 0
          ? recruitNotes.map((n) => {
              const parts = []
              const dateSrc = [
                n.note_date ? String(n.note_date).split('T')[0] : '',
                n.source || '',
              ].filter(Boolean).join(' - ')
              if (dateSrc) parts.push(dateSrc)
              if (n.summary) parts.push(n.summary)
              if (n.quote) parts.push(`"${n.quote}"`)
              if (n.link) parts.push(n.link)
              return parts.join('\n')
            }).join('\n\n')
          : '-'
        const committedDetail =
          r.status === 'COMMITTED ELSEWHERE' && r.committed_school
            ? ` (${r.committed_school}${r.committed_date ? `, ${String(r.committed_date).split('T')[0]}` : ''})`
            : ''
        return [
            r.name,
            r.school,
            r.class_year || '',
            `${r.status || ''}${committedDetail}`,
            lastGame || '-',
            formatRecruitStatsLine(r.position, r.stats || {}),
            nextGame || '-',
            notesText,
        ]
      })

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 6 },
        styles: { fontSize: 5.5, cellPadding: 1.5 },
        margin: { left: 10, right: 10 },
        columnStyles: {
          5: { cellWidth: 50 },
          7: { cellWidth: 75 },
        },
      })

      yPos = (doc.lastAutoTable?.finalY || yPos) + 8
    })
  })

  return doc
}

export async function exportRecruitsReportPDF(recruits, notes, weekStart, weekEnd) {
  const doc = await buildRecruitsReportDoc(recruits, notes, weekStart, weekEnd)
  doc.save(`recruits_report_${weekStart}.pdf`)
}

export async function exportRecruitsReportPDFBlob(recruits, notes, weekStart, weekEnd) {
  const doc = await buildRecruitsReportDoc(recruits, notes, weekStart, weekEnd)
  return doc.output('blob')
}

const RECRUIT_COACH_GROUPS = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  OL: ['OL'],
  DL: ['DL', 'DE'],
  LB: ['LB'],
  DB: ['C', 'S'],
  ST: ['K', 'P'],
}

export async function exportRecruitsReportPDFByCoach(recruits, notes, weekStart, weekEnd) {
  const outputs = []

  for (const [group, positions] of Object.entries(RECRUIT_COACH_GROUPS)) {
    const groupRecruits = recruits.filter((r) => positions.includes(r.position))
    if (groupRecruits.length === 0) continue

    const recruitIds = new Set(groupRecruits.map((r) => r.id))
    const groupNotes = notes.filter((n) => recruitIds.has(n.recruit_id))

    const doc = await buildRecruitsReportDoc(groupRecruits, groupNotes, weekStart, weekEnd)
    outputs.push({
      positionGroup: group,
      filename: `recruits_report_${group}_${weekStart}.pdf`,
      blob: doc.output('blob'),
    })
  }

  return outputs
}

// Helper functions
function countStatType(stats, types) {
  return stats.filter((s) => {
    const type = s.statType || s.stat_type
    return types.includes(type)
  }).length
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown Date'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
