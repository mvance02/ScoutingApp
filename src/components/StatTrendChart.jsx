import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts'

const CHART_COLORS = {
  totalYards: '#2563eb', // Primary blue
  rushYards: '#16a34a', // Green
  recYards: '#d97706', // Orange
  tackles: '#dc2626', // Red
  tds: '#7c3aed', // Purple
  ints: '#0891b2', // Cyan
  sacks: '#65a30d', // Lime
}

function StatTrendChart({ gameBreakdown, playerPosition }) {
  // Determine which stats to show based on position
  const isOffensivePlayer = useMemo(() => {
    const offensePositions = ['QB', 'RB', 'WR', 'TE', 'OL', 'ATH']
    const pos = (playerPosition || '').toUpperCase()
    return offensePositions.some((p) => pos.includes(p)) || !pos
  }, [playerPosition])

  const isDefensivePlayer = useMemo(() => {
    const defensePositions = ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S', 'EDGE']
    const pos = (playerPosition || '').toUpperCase()
    return defensePositions.some((p) => pos.includes(p))
  }, [playerPosition])

  // Prepare chart data - sort by date ascending for proper trend visualization
  const chartData = useMemo(() => {
    return [...gameBreakdown]
      .sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return -1
        if (!b.date) return 1
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      })
      .map((game, index) => ({
        name: game.opponent || `Game ${index + 1}`,
        date: game.date,
        totalYards: game.totalYards || 0,
        rushYards: game.rushYards || 0,
        recYards: game.recYards || 0,
        tackles: game.tackles || 0,
        tds: game.tds || 0,
        ints: game.ints || 0,
        sacks: game.sacks || 0,
      }))
  }, [gameBreakdown])

  // Custom tooltip with dark mode support
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
          vs {label}
        </p>
        {payload.map((entry, index) => (
          <p
            key={index}
            style={{
              color: entry.color,
              fontSize: '13px',
              margin: '4px 0',
            }}
          >
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    )
  }

  if (chartData.length < 2) {
    return (
      <section className="panel">
        <h3>Performance Trends</h3>
        <p className="empty-state">
          Need at least 2 games to display trends. Currently showing {chartData.length} game(s).
        </p>
      </section>
    )
  }

  return (
    <section className="panel">
      <h3>Performance Trends</h3>

      {/* Offensive Stats Chart */}
      {(isOffensivePlayer || !playerPosition) && (
        <div style={{ marginBottom: '24px' }}>
          <h4
            style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}
          >
            Yards per Game
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '12px' }}
                formatter={(value) => (
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {value}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="totalYards"
                name="Total Yards"
                fill={CHART_COLORS.totalYards}
                fillOpacity={0.1}
                stroke={CHART_COLORS.totalYards}
                strokeWidth={0}
              />
              <Line
                type="monotone"
                dataKey="totalYards"
                name="Total Yards"
                stroke={CHART_COLORS.totalYards}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.totalYards, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="rushYards"
                name="Rush Yards"
                stroke={CHART_COLORS.rushYards}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.rushYards, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="recYards"
                name="Rec Yards"
                stroke={CHART_COLORS.recYards}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.recYards, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Touchdowns Chart */}
      {(isOffensivePlayer || !playerPosition) && (
        <div style={{ marginBottom: '24px' }}>
          <h4
            style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}
          >
            Touchdowns per Game
          </h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="tds"
                name="Touchdowns"
                stroke={CHART_COLORS.tds}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.tds, strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Defensive Stats Chart */}
      {(isDefensivePlayer || !playerPosition) && (
        <div>
          <h4
            style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}
          >
            Defensive Stats per Game
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--color-border)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '12px' }}
                formatter={(value) => (
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {value}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="tackles"
                name="Tackles"
                stroke={CHART_COLORS.tackles}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.tackles, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="ints"
                name="INTs"
                stroke={CHART_COLORS.ints}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.ints, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="sacks"
                name="Sacks"
                stroke={CHART_COLORS.sacks}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.sacks, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default StatTrendChart
