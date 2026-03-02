import { Star, Check, Save } from 'lucide-react'

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

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'ATH']
const DEFENSE_POSITIONS = ['DL', 'LB', 'DB']

function getPlayerRoleFlags(player) {
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

function GameReviewStatRow({
  player,
  currentGrade,
  totals,
  getPlayerTotals,
  onGradeChange,
  onSaveGrade,
  savedGrades,
  isAdmin,
}) {
  const derived = getPlayerTotals(player.id)
  const roleFlags = getPlayerRoleFlags(player)
  const playerTotals = totals[player.id] || {}
  const isSaved = savedGrades.has(player.id)

  return (
    <div className="totals-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{player.name}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={16} style={{ color: 'var(--color-warning)' }} />
          <select
            value={currentGrade.grade || ''}
            onChange={(e) => onGradeChange(player.id, 'grade', e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px' }}
          >
            <option value="">Grade</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
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
            onChange={(e) => onGradeChange(player.id, 'game_score', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
          />
          <input
            type="text"
            placeholder="Record (5-2)"
            value={currentGrade.team_record || ''}
            onChange={(e) => onGradeChange(player.id, 'team_record', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
          />
          <input
            type="text"
            placeholder="Next Opponent"
            value={currentGrade.next_opponent || ''}
            onChange={(e) => onGradeChange(player.id, 'next_opponent', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
          />
          <input
            type="text"
            placeholder="Next Game Date"
            value={currentGrade.next_game_date || ''}
            onChange={(e) => onGradeChange(player.id, 'next_game_date', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
          />
        </div>
        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>
          Game Notes
        </label>
        <textarea
          placeholder="Scout notes for this game..."
          value={currentGrade.notes || ''}
          onChange={(e) => onGradeChange(player.id, 'notes', e.target.value)}
          rows={2}
          style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px', width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
        {isAdmin && (
          <textarea
            placeholder="Admin notes (admin only)..."
            value={currentGrade.admin_notes || ''}
            onChange={(e) => onGradeChange(player.id, 'admin_notes', e.target.value)}
            rows={2}
            style={{ padding: '8px 10px', borderRadius: '6px', border: '2px solid var(--color-warning)', fontSize: '13px', width: '100%', resize: 'vertical', fontFamily: 'inherit', background: 'rgba(217, 119, 6, 0.1)' }}
          />
        )}
        <button
          className={isSaved ? 'btn-saved' : 'btn-primary'}
          onClick={() => onSaveGrade(player.id)}
          disabled={isSaved}
          style={{ fontSize: '12px', padding: '6px 12px', alignSelf: 'flex-start' }}
        >
          {isSaved ? (
            <><Check size={14} /> Saved!</>
          ) : (
            <><Save size={14} /> Save</>
          )}
        </button>
      </div>
      <div className="totals-list">
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
        {STAT_TYPES.map((type) => (
          <span key={type}>
            {type}: {playerTotals[type] || 0}
          </span>
        ))}
      </div>
    </div>
  )
}

export default GameReviewStatRow
