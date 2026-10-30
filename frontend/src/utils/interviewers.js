// Interviewers the user can pick. The ElevenLabs voice IDs live on the backend;
// here each voice only has a key, a label and a short pre-recorded sample.
// `listening` / `talking` are looping videos; when a file is missing the tile
// falls back to the photo, and then to the initial on a coloured background.

export const INTERVIEWERS = [
  {
    id: 'alex',
    name: 'Alex',
    photo: '/interviewers/alex/photo.jpg',
    idle: '/interviewers/alex/idle.jpg',
    listening: '/interviewers/alex/listening.mp4',
    talking: '/interviewers/alex/talking.mp4',
    background: '#adbecf',
    voices: [
      { id: 'antoni', label: 'Antoni', description: 'Warm and balanced' },
      { id: 'brian',  label: 'Brian',  description: 'Deep and calm' },
      { id: 'daniel', label: 'Daniel', description: 'British, confident' },
      { id: 'eric',   label: 'Eric',   description: 'Smooth and friendly' },
    ],
  },
  {
    id: 'emma',
    name: 'Emma',
    photo: '/interviewers/emma/photo.jpg',
    idle: '/interviewers/emma/idle.jpg',
    listening: '/interviewers/emma/listening.mp4',
    talking: '/interviewers/emma/talking.mp4',
    background: '#aebdcd',
    voices: [
      { id: 'matilda', label: 'Matilda', description: 'Warm and friendly' },
      { id: 'sarah',   label: 'Sarah',   description: 'Soft and clear' },
      { id: 'alice',   label: 'Alice',   description: 'British, confident' },
      { id: 'lily',    label: 'Lily',    description: 'British, gentle' },
    ],
  },
]

export const DEFAULT_INTERVIEWER = 'alex'

export function getInterviewer(id) {
  return INTERVIEWERS.find(i => i.id === id) || INTERVIEWERS[0]
}

export function voiceSample(interviewerId, voiceId) {
  return `/interviewers/${interviewerId}/voices/${voiceId}.mp3`
}

// The voice choice is a per-browser preference; the first voice is the default
const voiceKey = (interviewerId) => `mockmate_voice_${interviewerId}`

export function getVoice(interviewerId) {
  const interviewer = getInterviewer(interviewerId)
  try {
    const saved = localStorage.getItem(voiceKey(interviewer.id))
    if (interviewer.voices.some(v => v.id === saved)) return saved
  } catch {}
  return interviewer.voices[0].id
}

export function setVoice(interviewerId, voiceId) {
  try { localStorage.setItem(voiceKey(interviewerId), voiceId) } catch {}
}
