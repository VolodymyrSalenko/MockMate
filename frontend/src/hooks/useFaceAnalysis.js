import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createBaseline, readSignals, readExpression, steadyExpression, readGesture, isRestless, encodeMoment, TIMELINE_STEP_MS } from '../utils/bodyLanguage'

// Eye corner + iris indices (MediaPipe 478-point mesh)
const L_OUTER = 33,  L_INNER = 133, L_IRIS = 468
const R_INNER = 362, R_OUTER = 263, R_IRIS = 473
const L_TOP = 159, L_BOT = 145, R_TOP = 386, R_BOT = 374

function isLookingAtCamera(landmarks) {
  if (!landmarks || landmarks.length < 478) return false
  const lo = landmarks[L_OUTER], li = landmarks[L_INNER], lIris = landmarks[L_IRIS]
  const ri = landmarks[R_INNER], ro = landmarks[R_OUTER], rIris = landmarks[R_IRIS]
  const lt = landmarks[L_TOP],   lb = landmarks[L_BOT]
  const rt = landmarks[R_TOP],   rb = landmarks[R_BOT]

  const leftH  = (lIris.x - lo.x) / (li.x - lo.x + 1e-6)
  const rightH = (rIris.x - ri.x) / (ro.x - ri.x + 1e-6)
  const leftV  = (lIris.y - lt.y) / (lb.y - lt.y + 1e-6)
  const rightV = (rIris.y - rt.y) / (rb.y - rt.y + 1e-6)

  const hOk = leftH > 0.35 && leftH < 0.65 && rightH > 0.35 && rightH < 0.65
  const vOk = leftV > 0.25 && leftV < 0.65  && rightV > 0.25 && rightV < 0.65
  return hOk && vOk
}

// Landmark-based head pose — avoids unreliable transformation matrix
function getHeadPose(landmarks) {
  if (!landmarks || landmarks.length < 454) return { yaw: 0, pitch: 0 }
  const nose     = landmarks[4]
  const leftEar  = landmarks[234]
  const rightEar = landmarks[454]
  const forehead = landmarks[10]
  const chin     = landmarks[152]

  // Yaw: nose deviation from midpoint between ears, normalised by ear span
  const earMidX = (leftEar.x + rightEar.x) / 2
  const earSpan = Math.abs(rightEar.x - leftEar.x) + 1e-6
  const yaw     = ((nose.x - earMidX) / earSpan) * 90

  // Pitch: nose deviation from expected vertical midpoint of face
  const faceH        = Math.abs(chin.y - forehead.y) + 1e-6
  const expectedNoseY = forehead.y + faceH * 0.57   // nose sits ~57% down the face
  const pitch        = ((nose.y - expectedNoseY) / (faceH * 0.35)) * 30

  return { yaw, pitch }
}

// The WASM runtime must match the installed @mediapipe/tasks-vision version (pinned in package.json)
const WASM_PATH  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

function freshRecent() {
  return { expressions: [], poses: [], baseline: createBaseline(), away: 0, turned: 0, lastIssue: null, issueUntil: 0 }
}

// The red-zone moment happening right now, for the live badge: the same rules as the
// feedback report, with a short hold so the badge does not blink
function liveIssue(recent, { now, answering, eyeOk, headOk, restless, gesture }) {
  recent.away   = answering && !eyeOk  ? recent.away + 1   : 0
  recent.turned = answering && !headOk ? recent.turned + 1 : 0
  const issue =
    restless              ? 'restless' :
    recent.turned >= 5    ? 'turned-away' :   // about a second
    recent.away >= 6      ? 'look-away' :     // about 1.2 seconds
    gesture === 'shake'   ? 'shake' : null
  if (issue) { recent.lastIssue = issue; recent.issueUntil = now + 1000 }
  return issue || (now < recent.issueUntil ? recent.lastIssue : null)
}

// answeringRef.current is true while the candidate answers; the timeline marks those moments
export function useFaceAnalysis(videoRef, enabled, answeringRef) {
  const [metrics, setMetrics] = useState({
    eyeContactPct: 0, headStabilityPct: 0,
    isAnalyzing: false, samplesCount: 0, expression: 'neutral', gesture: null, issue: null, timeline: null,
  })

  const landmarkerRef    = useRef(null)
  const statsRef         = useRef({ eyeContactFrames: 0, stableFrames: 0, total: 0 })
  const intervalRef      = useRef(null)
  const lastTimeRef      = useRef(-1)
  // Recent readings for steady labels, and the per-moment timeline the recording plays back with
  const recentRef        = useRef(freshRecent())
  const timelineRef      = useRef(null)

  useEffect(() => {
    let cancelled = false
    FilesetResolver.forVisionTasks(WASM_PATH).then(vision =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      })
    ).then(lm => {
      if (cancelled) { lm.close(); return }
      landmarkerRef.current = lm
    }).catch(() => {/* silently fail — analysis just won't run */})
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const analyze = useCallback(() => {
    const video = videoRef.current
    const lm    = landmarkerRef.current
    if (!video || !lm || video.readyState < 2) return
    if (video.currentTime === lastTimeRef.current) return
    lastTimeRef.current = video.currentTime

    try {
      const result = lm.detectForVideo(video, performance.now())
      if (!result.faceLandmarks?.length) return

      const landmarks      = result.faceLandmarks[0]
      const eyeOk          = isLookingAtCamera(landmarks)
      const { yaw, pitch } = getHeadPose(landmarks)
      const headOk         = Math.abs(yaw) < 22 && Math.abs(pitch) < 20
      const now            = performance.now()
      const recent         = recentRef.current
      const signals        = readSignals(result.faceBlendshapes?.[0], landmarks)
      recent.expressions = [...recent.expressions.slice(-4), readExpression(signals, recent.baseline)]
      recent.baseline.add(signals)
      recent.poses       = [...recent.poses.filter(p => now - p.t < 3000), { t: now, yaw, pitch }]
      const expression     = steadyExpression(recent.expressions)
      const gesture        = readGesture(recent.poses.filter(p => now - p.t < 2000))
      const restless       = isRestless(recent.poses.filter(p => now - p.t < 1600))
      const answering      = !!answeringRef?.current
      const issue          = liveIssue(recent, { now, answering, eyeOk, headOk, restless, gesture })

      const s = statsRef.current
      s.total++
      if (eyeOk)  s.eyeContactFrames++
      if (headOk) s.stableFrames++

      const eyePct  = Math.round((s.eyeContactFrames / s.total) * 100)
      const headPct = Math.round((s.stableFrames       / s.total) * 100)

      const tl = timelineRef.current
      if (tl) tl.samples[Math.round((now - tl.start) / TIMELINE_STEP_MS)] = encodeMoment({ eye: eyeOk, steady: headOk, expression, gesture, answering, restless })

      setMetrics({
        eyeContactPct:    eyePct,
        headStabilityPct: headPct,
        isAnalyzing:      true,
        samplesCount:     s.total,
        expression,
        gesture,
        issue,
        timeline:         { step: TIMELINE_STEP_MS, samples: tl.samples },
      })
    } catch { /* ignore transient frame errors */ }
  }, [videoRef, answeringRef])

  // Start / stop analysis interval
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (!enabled) return
    intervalRef.current = setInterval(analyze, 200) // 5 fps
    return () => clearInterval(intervalRef.current)
  }, [enabled, analyze])

  // Reset counters when webcam turns on
  useEffect(() => {
    if (enabled) {
      statsRef.current = { eyeContactFrames: 0, stableFrames: 0, total: 0 }
      lastTimeRef.current = -1
      recentRef.current = freshRecent()
      // Starts with the camera, as the recording does, so moments line up with the video
      timelineRef.current = { start: performance.now(), samples: [] }
      setMetrics({ eyeContactPct: 0, headStabilityPct: 0, isAnalyzing: false, samplesCount: 0, expression: 'neutral', gesture: null, timeline: null })
    }
  }, [enabled])

  return metrics
}
