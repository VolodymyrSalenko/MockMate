// Minimal stroke SVG icons — strokeWidth 1.5, no fill, currentColor
const props = (className = 'w-4 h-4') => ({
  className,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
})

export const IconMic = ({ className }) => (
  <svg {...props(className)}><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></svg>
)
export const IconBarChart = ({ className }) => (
  <svg {...props(className)}><path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/></svg>
)
export const IconList = ({ className }) => (
  <svg {...props(className)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
)
export const IconStar = ({ className }) => (
  <svg {...props(className)}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
)
export const IconTrophy = ({ className }) => (
  <svg {...props(className)}><path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/><path d="M12 15v6M9 21h6"/></svg>
)
export const IconFlame = ({ className }) => (
  <svg {...props(className)}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
)
export const IconUser = ({ className }) => (
  <svg {...props(className)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)
export const IconZap = ({ className }) => (
  <svg {...props(className)}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>
)
export const IconBriefcase = ({ className }) => (
  <svg {...props(className)}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v.01M12 16v.01"/></svg>
)
export const IconGlobe = ({ className }) => (
  <svg {...props(className)}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
)
export const IconAward = ({ className }) => (
  <svg {...props(className)}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
)
export const IconGraduation = ({ className }) => (
  <svg {...props(className)}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
)
export const IconTarget = ({ className }) => (
  <svg {...props(className)}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
)
export const IconMail = ({ className }) => (
  <svg {...props(className)}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
)
export const IconPhone = ({ className }) => (
  <svg {...props(className)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.07 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
)
export const IconMapPin = ({ className }) => (
  <svg {...props(className)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
)
export const IconLink = ({ className }) => (
  <svg {...props(className)}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
)
export const IconCheckCircle = ({ className }) => (
  <svg {...props(className)}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
)
export const IconXCircle = ({ className }) => (
  <svg {...props(className)}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
)
