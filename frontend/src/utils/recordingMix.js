// Mixes the user's microphone and the interviewer's voice into one audio track,
// so the interview recording contains both the questions and the answers.
//
// One AudioContext is shared for the whole page: an <audio> element that has been
// routed through it keeps playing through it, even after the recording stops.

let ctx = null
let destination = null   // MediaStreamAudioDestinationNode while a recording is running

function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Returns a stream with the camera video and the mixed audio, ready for MediaRecorder.
// Falls back to the original stream if Web Audio is not available.
export function startRecordingMix(stream) {
  try {
    const ac = getContext()
    destination = ac.createMediaStreamDestination()
    const mic = stream.getAudioTracks()
    if (mic.length) ac.createMediaStreamSource(new MediaStream(mic)).connect(destination)
    return new MediaStream([...stream.getVideoTracks(), ...destination.stream.getAudioTracks()])
  } catch {
    destination = null
    return stream
  }
}

export function stopRecordingMix() {
  destination = null
}

// Call for every interviewer <audio> element before it plays. While recording, its
// sound goes both to the speakers and into the recording; otherwise nothing changes.
export function routeToRecording(audio) {
  if (!destination) return
  try {
    const ac = getContext()
    const source = ac.createMediaElementSource(audio)
    source.connect(ac.destination)   // still audible
    source.connect(destination)      // and recorded
  } catch {
    // The element plays normally; it just won't be in the recording
  }
}
