// Mixes the user's microphone and the interviewer's voice into one audio track,
// so the interview recording contains both the questions and the answers.
//
// One AudioContext is shared for the whole page. Every interviewer line plays through
// a "voice bus" in it, so a recording that starts mid-line still gets the rest of it.

let ctx = null
let voiceBus = null      // every interviewer line goes through here: to the speakers and, while recording, into the recording
let current = null       // the interviewer line playing now
let lastLineUrl = null   // the latest line that finished, so a recording that starts after it can still include it
let recap = null         // that line replaying into a recording
let destination = null   // MediaStreamAudioDestinationNode of the running recording

function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function getVoiceBus() {
  const ac = getContext()
  if (!voiceBus) {
    voiceBus = ac.createGain()
    voiceBus.connect(ac.destination)
  }
  return voiceBus
}

// Call when the interview opens, so the context is running before the first line plays
export function prepareRecordingMix() {
  try { getContext() } catch { /* no Web Audio: lines play normally */ }
}

// Returns a stream with the camera video and the mixed audio for MediaRecorder,
// and a stop function for when that recording ends.
// Falls back to the original stream if Web Audio is not available.
export function startRecordingMix(stream) {
  try {
    const ac = getContext()
    const dest = ac.createMediaStreamDestination()
    const mic = stream.getAudioTracks()
    if (mic.length) ac.createMediaStreamSource(new MediaStream(mic)).connect(dest)
    if (voiceBus) voiceBus.connect(dest)
    destination = dest
    const stop = () => {
      try { voiceBus?.disconnect(dest) } catch { /* already disconnected */ }
      if (destination === dest) destination = null
    }
    return { stream: new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]), stop }
  } catch {
    return { stream, stop: () => {} }
  }
}

// Call for every interviewer <audio> element before it plays
export function routeToRecording(audio) {
  try {
    const ac = getContext()
    // Routed through a suspended context it would be silent; it then plays normally, unrecorded
    if (ac.state !== 'running') return
    stopLastLineInRecording()
    const bus = getVoiceBus()
    if (destination) bus.connect(destination)   // the first line may create the bus mid-recording
    ac.createMediaElementSource(audio).connect(bus)
    current = audio
  } catch {
    // The element plays normally; it just won't be in the recording
  }
}

// Call when an interviewer line has finished; the previous one is released
export function keepLastLine(url) {
  if (lastLineUrl && lastLineUrl !== url) URL.revokeObjectURL(lastLineUrl)
  lastLineUrl = url
}

// When the camera turns on after the question was asked, put the question at the start
// of the recording. It goes into the recording only, not to the speakers.
export function addLastLineToRecording() {
  if (!destination || !lastLineUrl) return
  if (current && !current.paused && !current.ended) return   // a line is playing and being recorded already
  try {
    const ac = getContext()
    const audio = new Audio(lastLineUrl)
    ac.createMediaElementSource(audio).connect(destination)
    audio.play().catch(() => {})
    recap = audio
  } catch {
    // The recording just starts without the question
  }
}

// The replayed question must not run over the answer or the next line
export function stopLastLineInRecording() {
  recap?.pause()
  recap = null
}
