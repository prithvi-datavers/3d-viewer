/**
 * Isometric cube-face SVG icons for view preset buttons.
 * Each icon shows a 3D cube with the relevant face highlighted in cyan.
 */

type ViewFace = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' | 'iso'

interface Props {
  face: ViewFace
  size?: number
}

export function ViewCubeIcon({ face, size = 16 }: Props) {
  // Isometric cube in 20×20 viewbox
  // Six points of the hexagonal outline + center intersection point
  const top = '10,2'
  const tr  = '18,6.5'
  const br  = '18,13.5'
  const bot = '10,18'
  const bl  = '2,13.5'
  const tl  = '2,6.5'
  const ctr = '10,10'  // front-bottom vertex (where three faces meet)

  // Three visible faces of the isometric cube
  const topFace   = `${top} ${tr} ${ctr} ${tl}`
  const rightFace = `${tr} ${br} ${bot} ${ctr}`
  const leftFace  = `${tl} ${ctr} ${bot} ${bl}`

  // Base dim colors (neutral)
  const dTop    = 'rgba(255,255,255,0.10)'
  const dRight  = 'rgba(255,255,255,0.06)'
  const dLeft   = 'rgba(255,255,255,0.04)'
  const dStroke = 'rgba(255,255,255,0.18)'

  // Accent (highlighted)
  const aFill   = 'rgba(0,212,255,0.42)'
  const aStroke = 'rgba(0,212,255,0.85)'

  // ISO equal tints
  const iTop    = 'rgba(0,212,255,0.20)'
  const iRight  = 'rgba(0,212,255,0.13)'
  const iLeft   = 'rgba(0,212,255,0.08)'
  const iStroke = 'rgba(0,212,255,0.45)'

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

  // Mirror for "opposite" views: back↔front, left↔right, bottom↔top
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
        <polygon points={topFace}   fill={tc} stroke={ts} strokeWidth="0.75" strokeLinejoin="round" />
        <polygon points={rightFace} fill={rc} stroke={rs} strokeWidth="0.75" strokeLinejoin="round" />
        <polygon points={leftFace}  fill={lc} stroke={ls} strokeWidth="0.75" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
