// Cross-team exercise clipboard: copy exercises on one team's page, paste them
// on another. Backed by localStorage so it survives navigating between teams.
const KEY = 'tf_exercise_clipboard'

export function getExerciseClipboard() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function setExerciseClipboard(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
}
