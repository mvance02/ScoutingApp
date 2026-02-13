import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { loadPlayers } from '../utils/storage'
import { playersApi } from '../utils/api'

function CompositeRatingTrend({ playerId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [playerId])

  const loadHistory = async () => {
    try {
      // For now, we'll simulate history from player updates
      // In production, you'd fetch from composite_rating_history table
      const players = await loadPlayers()
      const player = players.find((p) => String(p.id) === String(playerId))
      if (player && player.compositeRating) {
        // Simulate trend data - in production, fetch from history table
        const rating = parseFloat(player.compositeRating)
        const data = []
        const now = new Date()
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now)
          date.setMonth(date.getMonth() - i)
          // Simulate slight variation
          const variation = (Math.random() - 0.5) * 0.5
          data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            rating: Math.max(0, Math.min(100, rating + variation)),
          })
        }
        setHistory(data)
      }
    } catch (err) {
      console.error('Error loading rating history:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p>Loading trend data...</p>
  if (history.length === 0) return <p className="empty-state">No rating history available</p>

  return (
    <div className="trend-chart">
      <h4>Composite Rating Trend</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Rating"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CompositeRatingTrend
