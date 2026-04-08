/**
 * Isometric cube-face SVG icons for view preset buttons — light theme.
 * Each icon shows a 3D cube with the relevant face highlighted in accent purple.
 */

type ViewFace = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' | 'iso'

interface Props {
  face: ViewFace
  size?: number
}

export function ViewCubeIcon({ face, size = 16 }: Props) {
  // Isometric projection points in a 20×20 viewbox
  const top = '10,2'
  const tr  = '18,6.5'
  const br  = '18,13.5'
  const bot = '10,18'
  const bl  = '2,13.5'
  const tl  = '2,6.5'

  const topFace   = `${top} ${tr} 10,10 ${tl}`
  const rightFace = `${tr} ${br} ${bot} 10,10`
  const leftFace  = `${tl} 10,10 ${bot} ${bl}`

  // Neutral (unlit) face colors — subtle for light bg
  const dTop    = 'rgba(0,0,0,0.07)'
  const dRight  = 'rgba(0,0,0,0.04)'
  const dLeft   = 'rgba(0,0,0,0.02)'
  const dStroke = 'rgba(0,0,0,0.22)'

  // Accent (active face) — purple
  const aFill   = 'rgba(124,58,237,0.28)'
  const aStroke = 'rgba(124,58,237,0.75)'

  // ISO — all faces tinted equally
  const iTop    = 'rgba(124,58,237,0.18)'
  const iRight  = 'rgba(124,58,237,0.12)'
  const iLeft   = 'rgba(124,58,237,0.07)'
  const iStroke = 'rgba(124,58,237,0.50)'

  let tc = dTop,   ts = dStroke
  let rc = dRight, rs = dStroke
  let lc = dLeft,  ls = dStroke

  if      (face === 'top'    || face === 'bottom') { tc = aFill; ts = aStroke }
  else if (face === 'right'  || face === 'left'  ) { rc = aFill; rs = aStroke }
  else if (face === 'front'  || face === 'back'  ) { lc = aFill; ls = aStroke }
  else if (face === 'iso') {
    tc = iTop; ts = iStroke
    rc = iRight; rs = iStroke
    lc = iLeft; ls = iStroke
  }

  let transform: string | undefined
  if (face === 'back' || face === 'left')  transform = 'scale(-1,1) translate(-20,0)'
  if (face === 'bottom')                   transform = 'scale(1,-1) translate(0,-20)'

  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <g transform={transform}>
        <polygon points={topFace}   fill={tc} stroke={ts} strokeWidth="0.8" strokeLinejoin="round" />
        <polygon points={rightFace} fill={rc} stroke={rs} strokeWidth="0.8" strokeLinejoin="round" />
        <polygon points={leftFace}  fill={lc} stroke={ls} strokeWidth="0.8" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
