import { useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#0891b2']

function RecruitingClassViz({ players }) {
  const positionData = useMemo(() => {
    const counts = {}
    players.forEach((p) => {
      const pos = p.position || p.offensePosition || p.defensePosition || 'Unknown'
      counts[pos] = (counts[pos] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [players])

  const stateData = useMemo(() => {
    const counts = {}
    players.forEach((p) => {
      const state = p.state || 'Unknown'
      counts[state] = (counts[state] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [players])

  const statusData = useMemo(() => {
    const counts = {}
    players.forEach((p) => {
      const statuses = p.recruitingStatuses || ['Watching']
      statuses.forEach((status) => {
        counts[status] = (counts[status] || 0) + 1
      })
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [players])

  return (
    <div className="recruiting-class-viz">
      <h3>Recruiting Class Visualization</h3>
      <div className="viz-grid">
        <div className="viz-card">
          <h4>By Position</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={positionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {positionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="viz-card">
          <h4>By State (Top 10)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="viz-card">
          <h4>By Status</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default RecruitingClassViz
