import React from 'react'

// Subtle futsal-court motif (center circle + two areas) used as a faint
// decorative backdrop on the brand-gradient screens (landing, login, etc).
export default function PitchLines() {
  return (
    <div className="pitch-lines" aria-hidden="true">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <circle cx="600" cy="400" r="140" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="600" cy="400" r="4" fill="currentColor" />
        <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="2" />
        <rect x="20" y="220" width="180" height="360" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="1000" y="220" width="180" height="360" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  )
}
