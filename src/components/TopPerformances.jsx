import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, TrendingUp, Calendar, ChevronRight } from 'lucide-react'
import { performancesApi } from '../utils/api'

function TopPerformances() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTopPerformances()
  }, [])

  async function loadTopPerformances() {
    try {
      setLoading(true)
      const result = await performancesApi.getTopPerformances(5)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <h3><Trophy size={18} /> Top 5 Performances This Week</h3>
        <p className="empty-state">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <h3><Trophy size={18} /> Top 5 Performances This Week</h3>
        <p className="empty-state error">Failed to load: {error}</p>
      </div>
    )
  }

  if (!data || data.performances.length === 0) {
    return (
      <div className="panel">
        <h3><Trophy size={18} /> Top 5 Performances This Week</h3>
        <p className="empty-state">No performances recorded this week yet.</p>
        <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
          <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {data?.week?.label || 'Current week'}
        </p>
      </div>
    )
  }

  const getMedalColor = (index) => {
    switch (index) {
      case 0: return '#FFD700' // Gold
      case 1: return '#C0C0C0' // Silver
      case 2: return '#CD7F32' // Bronze
      default: return '#666'
    }
  }

  const formatStats = (stats) => {
    if (!stats || Object.keys(stats).length === 0) return null
    const highlights = []

    // Prioritize impressive stats (TDs first, then big plays, then yardage)
    if (stats['Rush TD']) highlights.push(`${stats['Rush TD']} Rush TD`)
    if (stats['Rec TD']) highlights.push(`${stats['Rec TD']} Rec TD`)
    if (stats['Pass TD']) highlights.push(`${stats['Pass TD']} Pass TD`)
    if (stats['TD']) highlights.push(`${stats['TD']} TD`)
    if (stats['INT']) highlights.push(`${stats['INT']} INT`)
    if (stats['Sack']) highlights.push(`${stats['Sack']} Sack`)
    if (stats['PBU']) highlights.push(`${stats['PBU']} PBU`)
    if (stats['Tackle Solo']) highlights.push(`${stats['Tackle Solo']} Tackles`)
    // Yardage stats
    if (stats['Reception'] && stats['Reception'] > 0) highlights.push(`${stats['Reception']} Rec Yds`)
    if (stats['Rush'] && stats['Rush'] > 0) highlights.push(`${stats['Rush']} Rush Yds`)

    return highlights.slice(0, 4).join(' • ')
  }

  return (
    <div className="panel top-performances">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}><Trophy size={18} /> Top 5 Performances This Week</h3>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
          {data.week.label}
        </span>
      </div>

      <div className="performances-list">
        {data.performances.map((perf, index) => (
          <div key={`${perf.game.id}-${perf.player.id}`} className="performance-card">
            <div className="rank" style={{ color: getMedalColor(index) }}>
              {index === 0 ? <Trophy size={24} /> : <span className="rank-number">#{index + 1}</span>}
            </div>

            <div className="performance-info">
              <div className="player-name">
                <Link to={`/player/${perf.player.id}`}>{perf.player.name}</Link>
                {perf.player.position && (
                  <span className="position-tag">{perf.player.position}</span>
                )}
              </div>

              <div className="game-info">
                <span className="opponent">vs {perf.game.opponent}</span>
                {perf.game.date && (
                  <span className="date">
                    {new Date(perf.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              {formatStats(perf.stats) && (
                <div className="stat-highlights">
                  {formatStats(perf.stats)}
                </div>
              )}
            </div>

            <div className="scores">
              {perf.grade && (
                <div className="grade-badge" data-grade={perf.grade.charAt(0)}>
                  {perf.grade}
                </div>
              )}
              <div className="composite-score">
                <TrendingUp size={14} />
                {perf.scores.composite}
              </div>
            </div>

            <Link to={`/review/${perf.game.id}`} className="view-link">
              <ChevronRight size={20} />
            </Link>
          </div>
        ))}
      </div>

      {data.totalEvaluated > 5 && (
        <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem' }}>
          Showing top 5 of {data.totalEvaluated} performances evaluated
        </p>
      )}

      <style>{`
        .top-performances .performances-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .top-performances .performance-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 8px;
          transition: background 0.2s;
        }

        .top-performances .performance-card:hover {
          background: var(--bg-tertiary, #eee);
        }

        .top-performances .rank {
          width: 40px;
          text-align: center;
          font-weight: bold;
        }

        .top-performances .rank-number {
          font-size: 1.2rem;
        }

        .top-performances .performance-info {
          flex: 1;
          min-width: 0;
        }

        .top-performances .player-name {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .top-performances .player-name a {
          color: inherit;
          text-decoration: none;
        }

        .top-performances .player-name a:hover {
          text-decoration: underline;
        }

        .top-performances .position-tag {
          font-size: 0.7rem;
          background: var(--accent, #0066cc);
          color: white;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-weight: normal;
        }

        .top-performances .game-info {
          font-size: 0.85rem;
          color: var(--text-muted, #666);
          display: flex;
          gap: 0.5rem;
        }

        .top-performances .stat-highlights {
          font-size: 0.8rem;
          color: var(--text-secondary, #444);
          margin-top: 0.25rem;
        }

        .top-performances .scores {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .top-performances .grade-badge {
          font-weight: bold;
          font-size: 1.1rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          background: var(--bg-tertiary, #ddd);
        }

        .top-performances .grade-badge[data-grade="A"] {
          background: #22c55e;
          color: white;
        }

        .top-performances .grade-badge[data-grade="B"] {
          background: #3b82f6;
          color: white;
        }

        .top-performances .grade-badge[data-grade="C"] {
          background: #f59e0b;
          color: white;
        }

        .top-performances .grade-badge[data-grade="D"],
        .top-performances .grade-badge[data-grade="F"] {
          background: #ef4444;
          color: white;
        }

        .top-performances .composite-score {
          font-size: 0.75rem;
          color: var(--text-muted, #666);
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .top-performances .view-link {
          color: var(--text-muted, #666);
          padding: 0.5rem;
          display: flex;
          align-items: center;
        }

        .top-performances .view-link:hover {
          color: var(--accent, #0066cc);
        }
      `}</style>
    </div>
  )
}

export default TopPerformances
