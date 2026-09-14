// Recent-form score for a player (0-100), averaged over their last two
// tracked finished matches (as returned by api.getPlayerMatches, most
// recent first). Each match scores out of 100:
//   - Result:          win 30 · draw 15 · loss 0
//   - Minutes played:  banded, up to 30 (minutes_played is stored in seconds)
//   - Goals:           10 per goal, capped at 20
//   - Assists:         10 per assist, capped at 20

const MINUTES_BANDS = [
  { maxSeconds: 10 * 60, points: 10 },
  { maxSeconds: 25 * 60, points: 20 },
  { maxSeconds: Infinity, points: 30 }
]

function minutesPoints(secondsPlayed) {
  const secs = Number(secondsPlayed) || 0
  if (secs <= 0) return 0
  const band = MINUTES_BANDS.find((b) => secs <= b.maxSeconds)
  return band.points
}

function resultPoints(match) {
  const isHome = match.is_home !== false
  const ourGoals = isHome ? (match.home_goals ?? 0) : (match.away_goals ?? 0)
  const rivalGoals = isHome ? (match.away_goals ?? 0) : (match.home_goals ?? 0)
  if (ourGoals > rivalGoals) return 30
  if (ourGoals === rivalGoals) return 15
  return 0
}

export function matchFormScore(match) {
  const goalsPoints = Math.min(20, (Number(match.goals) || 0) * 10)
  const assistsPoints = Math.min(20, (Number(match.assists) || 0) * 10)
  return resultPoints(match) + minutesPoints(match.minutes_played) + goalsPoints + assistsPoints
}

// `matches` must be sorted most-recent-first. Returns null when there's no
// finished match to base a score on (e.g. a player who hasn't played yet).
export function playerFormScore(matches) {
  const recent = (matches || []).slice(0, 2)
  if (recent.length === 0) return null
  const total = recent.reduce((sum, m) => sum + matchFormScore(m), 0)
  return Math.round(total / recent.length)
}

// 'up' (good form) · 'flat' (neutral) · 'down' (poor form) — still used for
// the badge's background color, in 3 bands.
export function formTrend(score) {
  if (score == null) return null
  if (score >= 66) return 'up'
  if (score >= 34) return 'flat'
  return 'down'
}

// Continuous needle angle across a 180° semicircle: 0 → straight down (180°),
// 50 → horizontal (90°), 100 → straight up (0°). Unlike formTrend, this isn't
// banded — every score point moves the arrow a little.
export function formRotationDeg(score) {
  if (score == null) return null
  const clamped = Math.max(0, Math.min(100, score))
  return 180 - (clamped / 100) * 180
}
