// Big 12 + BYU benchmarking constants (derived from SizeAveragesBYU.xlsx)

export const BYU_TEAM_COMPOSITE_BY_YEAR = [
  { year: 2016, avgComposite: 82.06, era: 'Independent' },
  { year: 2017, avgComposite: 82.66, era: 'Independent' },
  { year: 2018, avgComposite: 82.47, era: 'Independent' },
  { year: 2019, avgComposite: 81.99, era: 'Independent' },
  { year: 2020, avgComposite: 81.81, era: 'Independent' },
  { year: 2021, avgComposite: 81.96, era: 'Independent' },
  { year: 2022, avgComposite: 82.79, era: 'Independent' },
  { year: 2023, avgComposite: 83.05, era: 'Big 12' },
  { year: 2024, avgComposite: 84.19, era: 'Big 12' },
  { year: 2025, avgComposite: 85.36, era: 'Big 12' },
]

// Big 12 starter size averages (2025 starters tab -> All-Height & Weight Averages)
// Heights are in inches, weights in pounds.
// WR is now split into slot (SWR) and wideout (WWR). OL into OT/OG. DB into CB/S.
export const BIG12_STARTER_AVG_BY_POSITION = {
  QB: { height_in: 73.8, weight_lb: 210.5 },
  RB: { height_in: 71.2, weight_lb: 207.2 },
  SWR: { height_in: 71.5, weight_lb: 188.9 }, // slot WR
  WWR: { height_in: 73.3, weight_lb: 195.8 }, // wideout WR
  TE: { height_in: 76.2, weight_lb: 245.3 },
  OT: { height_in: 77.3, weight_lb: 311 }, // tackles
  OG: { height_in: 76.5, weight_lb: 310.5 }, // guards (interior OL)
  DE: { height_in: 75.7, weight_lb: 261.6 },
  DT: { height_in: 74.8, weight_lb: 298.8 },
  LB: { height_in: 73.9, weight_lb: 229.8 },
  S: { height_in: 72.7, weight_lb: 197.9 },
  CB: { height_in: 72.1, weight_lb: 187.5 },
}

// BYU NFL averages by position
export const BYU_NFL_AVG_BY_POSITION = {
  QB: { composite: 0.8544, height_in: 73.375, weight_lb: 214, forty: 4.53, hand: 9.26, arm: 30.4583 },
  RB: { composite: 0.8555, height_in: 72.4375, weight_lb: 226.83, forty: 4.5783, hand: 8.975, arm: 31.125 },
  SWR: { composite: 0.8291, height_in: 72.9, weight_lb: 196.3, forty: 4.4886, hand: 9.4063, arm: 32.1883 },
  WWR: { composite: 0.8291, height_in: 72, weight_lb: 212, forty: 4.4886, hand: 9.4063, arm: 32.1883 },
  TE: { composite: 0.8346, height_in: 76.3333, weight_lb: 247.33, forty: 4.8067, hand: 9.46, arm: 32.2917 },
  OT: { composite: 0.8613, height_in: 78.5, weight_lb: 312.3, forty: 5.1175, hand: 10.1429, arm: 33.5179 },
  OG: { composite: 0.8613, height_in: 77, weight_lb: 306, forty: 5.1175, hand: 10.1429, arm: 33.5179 },
  C: { composite: 0.76, height_in: 72, weight_lb: 290, forty: 5.2, hand: 9, arm: 31.25 },
  DT: { composite: 0.8299, height_in: 76, weight_lb: 292.5, forty: 4.92, hand: 9.75, arm: 32.3125 },
  DE: { composite: 0.8186, height_in: 77.1563, weight_lb: 264.75, forty: 4.745, hand: 9.2083, arm: 33.4688 },
  LB: { composite: 0.8532, height_in: 73.975, weight_lb: 235.6, forty: 4.646, hand: 9.375, arm: 32.2 },
  S: { composite: 0.8232, height_in: 72.4, weight_lb: 201.2, forty: 4.454, hand: 9.375, arm: 31.0625 },
  CB: { composite: 0.8232, height_in: 72.3, weight_lb: 190.8, forty: 4.454, hand: 9.375, arm: 31.0625 },
  P: { composite: 0.7781, height_in: 76, weight_lb: 235, forty: null, hand: 8.875, arm: 31.25 },
}

// BYU All-Big 12 averages by position
export const BYU_ALL_BIG12_AVG_BY_POSITION = {
  C: { composite: 0.7781, height_in: 76, weight_lb: 305, forty: null },
  SWR: { composite: 0.8028, height_in: 71.5, weight_lb: 182.5, forty: 4.4867 },
  WWR: { composite: 0.8028, height_in: 75, weight_lb: 209.5, forty: 4.4867 },
  DE: { composite: 0.8418, height_in: 76.3125, weight_lb: 268, forty: 4.715 },
  DT: { composite: 0.8413, height_in: 75, weight_lb: 300, forty: null },
  LB: { composite: 0.8425, height_in: 75, weight_lb: 235, forty: 4.555 },
  OT: { composite: 0.9074, height_in: 77.3, weight_lb: 320.5, forty: 5.2367 },
  OG: { composite: 0.9074, height_in: 74, weight_lb: 300, forty: 5.2367 },
  S: { composite: 0.8233, height_in: 74.5, weight_lb: 207.5, forty: 4.4867 },
  CB: { composite: 0.8233, height_in: 70.8, weight_lb: 182.8, forty: 4.4867 },
  P: { composite: 0.7781, height_in: 76, weight_lb: 235, forty: null },
  RB: { composite: 0.8873, height_in: 74, weight_lb: 220, forty: 4.46 },
  TE: { composite: 0.8599, height_in: 74.5, weight_lb: 248.5, forty: 4.94 },
}

export function normalizeBenchmarkPosition(pos) {
  const p = String(pos || '').toUpperCase().trim()
  if (!p) return null
  // WR splits
  if (p.includes('SLOT') || p === 'SWR' || p === 'WR(SLOT)') return 'SWR'
  if (p.includes('WIDE') || p === 'WWR' || p === 'WR(WIDEOUT)') return 'WWR'
  if (p === 'WR') return 'WWR' // default outside if generic WR is used

  // OL splits
  if (p === 'OT' || p === 'LT' || p === 'RT' || p.includes('TACKLE')) return 'OT'
  if (p === 'OG' || p === 'LG' || p === 'RG' || p.includes('GUARD')) return 'OG'
  if (p === 'C' || p.includes('CENTER')) return 'OG'

  // DL / EDGE
  if (p === 'DL') return 'DT'
  if (p === 'EDGE') return 'DE'

  // DB splits
  if (p === 'CB' || p.includes('CORNER')) return 'CB'
  if (p === 'S' || p === 'FS' || p === 'SS' || p.includes('SAFETY')) return 'S'

  return p
}

