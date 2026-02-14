import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { loadPlayers } from '../utils/storage'
import { playersApi } from '../utils/api'

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'C', 'S', 'K', 'P']

// Helper to get recruiting statuses (handles both array and single value)
function getStatuses(player) {
  if (Array.isArray(player.recruiting_statuses)) {
    return player.recruiting_statuses
  }
  if (player.recruiting_status) {
    return [player.recruiting_status]
  }
  if (player.recruitingStatus) {
    return Array.isArray(player.recruitingStatus) ? player.recruitingStatus : [player.recruitingStatus]
  }
  return ['Watching']
}

// Helper to check if player is committed
function isCommitted(player) {
  const statuses = getStatuses(player)
  return statuses.includes('Committed') || statuses.includes('Signed')
}

// Helper to check if player is offered
function isOffered(player) {
  const statuses = getStatuses(player)
  return statuses.includes('Offered') || statuses.includes('Offer')
}

// Helper to get player position
function getPosition(player) {
  return (player.position || player.offense_position || player.offensePosition || 
          player.defense_position || player.defensePosition || '').toUpperCase()
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: '14px' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: '4px 0', fontSize: '13px', color: entry.color || '#2563eb' }}>
          {entry.name || 'Value'}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  )
}

function Analytics() {
  const [players, setPlayers] = useState([])
  const [statusHistories, setStatusHistories] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const playersData = await loadPlayers()
        setPlayers(playersData)

        // Fetch status history for committed players
        const committedPlayers = playersData.filter(isCommitted)
        const histories = {}
        await Promise.all(
          committedPlayers.map(async (p) => {
            try {
              const history = await playersApi.getStatusHistory(p.id)
              histories[p.id] = history
            } catch {
              histories[p.id] = []
            }
          })
        )
        setStatusHistories(histories)
      } catch (err) {
        console.error('Error loading analytics data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 1. Composite Rating by Position for Committed Players (Bar Graph)
  const committedRatingByPosition = useMemo(() => {
    const committedPlayers = players.filter((p) => isCommitted(p) && p.compositeRating != null)
    const posMap = {}
    
    committedPlayers.forEach((p) => {
      const pos = getPosition(p)
      if (!pos) return
      if (!posMap[pos]) posMap[pos] = []
      posMap[pos].push(parseFloat(p.compositeRating || p.composite_rating))
    })
    
    return POSITION_ORDER
      .filter((pos) => posMap[pos]?.length > 0)
      .map((pos) => {
        const ratings = posMap[pos]
        const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length
        return { 
          position: pos, 
          avgRating: parseFloat(avg.toFixed(2)), 
          count: ratings.length,
          maxRating: Math.max(...ratings),
          minRating: Math.min(...ratings),
        }
      })
  }, [players])

  // 2. Time-to-Commit (Days from offer to commit)
  const timeToCommit = useMemo(() => {
    const days = []
    Object.entries(statusHistories).forEach(([playerId, history]) => {
      if (!history || history.length === 0) return
      const sorted = [...history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at))
      let offeredDate = null
      let committedDate = null
      
      sorted.forEach((entry) => {
        const newStatus = Array.isArray(entry.new_status) ? entry.new_status : [entry.new_status]
        const oldStatus = Array.isArray(entry.old_status) ? entry.old_status : [entry.old_status]
        
        if ((newStatus.includes('Offered') || newStatus.includes('Offer')) && !offeredDate) {
          offeredDate = new Date(entry.changed_at)
        }
        if ((newStatus.includes('Committed') || newStatus.includes('Signed')) && 
            !oldStatus?.includes('Committed') && !oldStatus?.includes('Signed')) {
          committedDate = new Date(entry.changed_at)
        }
      })
      
      if (offeredDate && committedDate && committedDate > offeredDate) {
        const diff = Math.round((committedDate - offeredDate) / (1000 * 60 * 60 * 24))
        days.push(diff)
      }
    })
    
    if (days.length === 0) return { avg: null, min: null, max: null, count: 0, median: null }
    
    const sorted = [...days].sort((a, b) => a - b)
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    
    return {
      avg: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
      min: Math.min(...days),
      max: Math.max(...days),
      median: Math.round(median),
      count: days.length,
    }
  }, [statusHistories])

  // 3. Commit-to-Offer Rate
  const commitToOffer = useMemo(() => {
    const offered = players.filter(isOffered).length
    const committed = players.filter(isCommitted).length
    const rate = offered > 0 ? parseFloat(((committed / offered) * 100).toFixed(1)) : 0
    return { offered, committed, rate, pending: offered - committed }
  }, [players])

  // 4. Top Player Composite Rating by Position
  const topPlayersByPosition = useMemo(() => {
    const posMap = {}
    
    players.forEach((p) => {
      const rating = p.compositeRating || p.composite_rating
      if (rating == null) return
      const pos = getPosition(p)
      if (!pos) return
      
      if (!posMap[pos]) posMap[pos] = []
      posMap[pos].push({
        id: p.id,
        name: p.name,
        school: p.school || '',
        rating: parseFloat(rating),
        statuses: getStatuses(p),
      })
    })
    
    // Sort each position by rating and take top 3
    Object.keys(posMap).forEach((pos) => {
      posMap[pos].sort((a, b) => b.rating - a.rating)
      posMap[pos] = posMap[pos].slice(0, 3)
    })
    
    return posMap
  }, [players])

  if (loading) {
    return (
      <div className="page">
        <p>Loading analytics...</p>
      </div>
    )
  }

  return (
    <div className="page analytics-page">
      <header className="page-header">
        <div>
          <h2>Analytics Dashboard</h2>
          <p>Recruiting insights and performance metrics</p>
        </div>
      </header>

      {/* Composite Rating by Position for Committed Players */}
      <section className="panel analytics-card">
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>Composite Rating by Position</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
            Average composite rating for committed players by position
          </p>
        </div>
        {committedRatingByPosition.length === 0 ? (
          <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            No committed players with composite ratings yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={committedRatingByPosition} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
              <XAxis 
                dataKey="position" 
                tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'Composite Rating', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'var(--color-text-secondary)' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgRating" name="Avg Rating" radius={[8, 8, 0, 0]}>
                {committedRatingByPosition.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.avgRating >= 88 ? '#16a34a' : entry.avgRating >= 85 ? '#2563eb' : '#dc2626'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {committedRatingByPosition.length > 0 && (
          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Total: {committedRatingByPosition.reduce((sum, p) => sum + p.count, 0)} committed players
          </div>
        )}
      </section>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {/* Time-to-Commit */}
        <section className="panel analytics-card">
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Time to Commit</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Average days from offer to commitment
          </p>
          {timeToCommit.count === 0 ? (
            <p className="empty-state" style={{ padding: '20px', textAlign: 'center', fontSize: '13px' }}>
              No offer-to-commit history available
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Average</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {timeToCommit.avg}
                  <span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '4px' }}>days</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Fastest</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: '#16a34a' }}>{timeToCommit.min}</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Slowest</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: '#dc2626' }}>{timeToCommit.max}</div>
                </div>
              </div>
              {timeToCommit.median && (
                <div style={{ padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Median: {timeToCommit.median} days · Based on {timeToCommit.count} player{timeToCommit.count !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Commit-to-Offer Rate */}
        <section className="panel analytics-card">
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Commit-to-Offer Rate</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Percentage of offered players who committed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Commit Rate</span>
              <span style={{ fontSize: '32px', fontWeight: 700, color: commitToOffer.rate >= 50 ? '#16a34a' : '#2563eb' }}>
                {commitToOffer.rate}%
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Committed</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{commitToOffer.committed}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Pending</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{commitToOffer.pending}</div>
              </div>
            </div>
            <div style={{ padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {commitToOffer.offered} total offered
            </div>
          </div>
        </section>
      </div>

      {/* Top Players by Position */}
      <section className="panel analytics-card" style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>Top Players by Position</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
            Top 3 players by composite rating for each position
          </p>
        </div>
        {Object.keys(topPlayersByPosition).length === 0 ? (
          <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            No players with composite ratings yet
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {POSITION_ORDER.filter(pos => topPlayersByPosition[pos]?.length > 0).map((pos) => (
              <div key={pos} style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {pos}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topPlayersByPosition[pos].map((player, idx) => (
                    <div key={player.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px',
                      background: idx === 0 ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                      borderRadius: '6px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: idx === 0 ? 600 : 500, marginBottom: '2px' }}>
                          {player.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {player.school || 'No school'}
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        color: player.rating >= 88 ? '#16a34a' : player.rating >= 85 ? '#2563eb' : '#dc2626',
                        marginLeft: '12px',
                      }}>
                        {player.rating.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Analytics
