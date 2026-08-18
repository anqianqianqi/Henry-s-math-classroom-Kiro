import { describe, it, expect } from 'vitest'
import {
  detectWorkBox, findCardBottom, findGutter, findWorkRows, rowProfile, type Pixels,
} from '@/lib/solutions/detect'

/** A blank sheet of slightly-off-white scanned paper. */
function sheet(width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    // Neutral: R and B equal, so nothing reads as warm.
    data[i] = 248; data[i + 1] = 248; data[i + 2] = 248; data[i + 3] = 255
  }
  return { data, width, height }
}

function fill(px: Pixels, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) {
  for (let y = Math.max(0, y0); y < Math.min(px.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(px.width, x1); x++) {
      const i = (y * px.width + x) * 4
      data(px, i, rgb)
    }
  }
}

function data(px: Pixels, i: number, [r, g, b]: [number, number, number]) {
  px.data[i] = r; px.data[i + 1] = g; px.data[i + 2] = b; px.data[i + 3] = 255
}

const CREAM: [number, number, number] = [250, 243, 226]   // the problem card
const INK: [number, number, number] = [40, 40, 45]        // pencil or print
const GREY: [number, number, number] = [130, 130, 130]    // the footer URL

/**
 * A sheet shaped like the real printout: a cream card in bands (banner, two
 * wording panels, tag row) with pale gaps between them, handwriting below, and
 * a grey footer at the very bottom.
 */
function printedSheet(width = 400, height = 1000) {
  const px = sheet(width, height)
  fill(px, 20, 30, width - 20, 90, CREAM)     // banner
  fill(px, 20, 100, width - 20, 200, CREAM)   // English panel
  fill(px, 20, 210, width - 20, 310, CREAM)   // Chinese panel
  fill(px, 20, 320, width - 20, 350, CREAM)   // tag chips
  // Handwriting, well below the card.
  fill(px, 60, 450, width - 80, 460, INK)
  fill(px, 60, 520, width - 120, 530, INK)
  fill(px, 60, 600, width - 150, 610, INK)
  fill(px, 20, 975, width - 20, 982, GREY)    // footer URL
  return px
}

describe('rowProfile', () => {
  it('separates warm card rows from ink rows', () => {
    const px = printedSheet()
    const p = rowProfile(px, undefined)
    expect(p.warm[150]).toBeGreaterThan(0.8)   // inside a wording panel
    expect(p.ink[150]).toBeLessThan(0.05)
    expect(p.ink[455]).toBeGreaterThan(0.5)    // a line of working
    expect(p.warm[455]).toBeLessThan(0.05)
  })

  it('sees plain paper as neither', () => {
    const p = rowProfile(sheet(200, 200), undefined)
    expect(Math.max(...p.warm)).toBe(0)
    expect(Math.max(...p.ink)).toBe(0)
  })
})

describe('findCardBottom', () => {
  // The fault from the real crops: stopping at the first gap in the card put
  // the boundary above the Chinese panel, so printed text came along.
  it('takes the LAST band of the card, not the first', () => {
    const px = printedSheet()
    const bottom = findCardBottom(rowProfile(px, undefined), px.height)
    expect(bottom).not.toBeNull()
    expect(bottom!).toBeGreaterThanOrEqual(340)   // past the tag chips
    expect(bottom!).toBeLessThan(360)
  })

  it('returns null when there is no card', () => {
    const px = sheet(300, 800)
    fill(px, 40, 400, 260, 410, INK)
    expect(findCardBottom(rowProfile(px, undefined), px.height)).toBeNull()
  })

  it('ignores warmth far down the sheet', () => {
    const px = printedSheet()
    fill(px, 20, 900, 380, 940, CREAM)   // a coffee stain, or a second card
    const bottom = findCardBottom(rowProfile(px, undefined), px.height)
    expect(bottom!).toBeLessThan(400)
  })
})

describe('findWorkRows', () => {
  it('spans the first to the last line of working', () => {
    const px = printedSheet()
    const p = rowProfile(px, undefined)
    const rows = findWorkRows(p, findCardBottom(p, px.height), px.height)
    expect(rows!.top).toBeGreaterThanOrEqual(450)
    expect(rows!.top).toBeLessThan(460)
    // The other fault from the real crops: ending early and clipping the
    // final line. The bottom must reach the last stroke.
    expect(rows!.bottom).toBeGreaterThanOrEqual(600)
  })

  it('leaves the footer out of it', () => {
    const px = printedSheet()
    const p = rowProfile(px, undefined)
    const rows = findWorkRows(p, findCardBottom(p, px.height), px.height)
    expect(rows!.bottom).toBeLessThan(960)
  })

  it('is null for a sheet with the card but nothing written', () => {
    const px = sheet(400, 1000)
    fill(px, 20, 30, 380, 350, CREAM)
    const p = rowProfile(px, undefined)
    expect(findWorkRows(p, findCardBottom(p, px.height), px.height)).toBeNull()
  })
})

describe('findGutter', () => {
  it('finds the middle of a two-up scan', () => {
    const px = sheet(800, 600)
    fill(px, 20, 20, 370, 580, CREAM)     // left sheet
    fill(px, 430, 20, 780, 580, CREAM)    // right sheet
    fill(px, 60, 300, 340, 310, INK)
    fill(px, 470, 300, 750, 310, INK)
    const g = findGutter(px)
    expect(g).not.toBeNull()
    expect(g!).toBeGreaterThan(360)
    expect(g!).toBeLessThan(440)
  })

  it('does not invent one on a single sheet', () => {
    // A single printed sheet: the card spans the middle, so no column down
    // the centre is free of the sheet even where nothing is written.
    const px = sheet(800, 600)
    fill(px, 30, 20, 770, 200, CREAM)
    for (let y = 260; y < 560; y += 8) fill(px, 40, y, 700, y + 3, INK)
    expect(findGutter(px)).toBeNull()
  })
})

describe('detectWorkBox', () => {
  it('boxes the working and nothing above it', () => {
    const px = printedSheet()
    const box = detectWorkBox(px)!
    expect(box).not.toBeNull()
    // Starts below the card: 350/1000 plus a small margin either way.
    expect(box.y).toBeGreaterThan(0.4)
    expect(box.y).toBeLessThan(0.46)
    // Reaches the last line at 610/1000.
    expect(box.y + box.h).toBeGreaterThan(0.6)
    // And stops short of the footer.
    expect(box.y + box.h).toBeLessThan(0.95)
  })

  it('stays inside the page', () => {
    const box = detectWorkBox(printedSheet())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(1)
    expect(box.y + box.h).toBeLessThanOrEqual(1)
  })

  it('returns null for an unanswered sheet', () => {
    const px = sheet(400, 1000)
    fill(px, 20, 30, 380, 350, CREAM)
    expect(detectWorkBox(px)).toBeNull()
  })

  it('takes the correct half of a two-up scan', () => {
    const px = sheet(800, 1000)
    // Two sheets, working only under the right one.
    fill(px, 20, 30, 370, 350, CREAM)
    fill(px, 430, 30, 780, 350, CREAM)
    fill(px, 470, 500, 750, 515, INK)

    const right = detectWorkBox(px, 'right')!
    expect(right.x).toBeGreaterThan(0.5)

    // The left sheet has nothing written under it.
    expect(detectWorkBox(px, 'left')).toBeNull()
  })
})

/**
 * The real palette, and the two lighting cases that broke a fixed threshold.
 *
 * The card background this site prints is #F6F0E6, R−B of 16 — narrow enough
 * that a cool scan drops under any absolute figure and a warm one lifts the
 * paper over it. Both are ordinary outcomes of photographing homework.
 */
function realSheet(shift: [number, number, number] = [0, 0, 0], width = 400, height = 1000) {
  const add = ([r, g, b]: [number, number, number]): [number, number, number] =>
    [Math.min(255, r + shift[0]), Math.min(255, g + shift[1]), Math.min(255, b + shift[2])]

  const PAPER_WHITE = add([252, 252, 252])
  const CARD_BG = add([246, 240, 230])     // #F6F0E6
  const PANEL = add([255, 253, 248])       // #FFFDF8, barely warm at all
  const BORDER = add([221, 212, 199])      // #DDD4C7

  const px = sheet(width, height)
  fill(px, 0, 0, width, height, PAPER_WHITE)
  fill(px, 20, 30, width - 20, 350, CARD_BG)          // the card
  fill(px, 34, 100, width - 34, 200, PANEL)           // English panel inside it
  fill(px, 34, 210, width - 34, 300, PANEL)           // Chinese panel
  fill(px, 20, 30, width - 20, 33, BORDER)            // card edges
  fill(px, 20, 347, width - 20, 350, BORDER)
  fill(px, 60, 450, width - 80, 462, INK)             // working
  fill(px, 60, 560, width - 140, 572, INK)
  fill(px, 20, 975, width - 20, 982, GREY)            // footer
  return px
}

describe('the real printed palette', () => {
  it('finds the card edge on a neutral scan', () => {
    const px = realSheet()
    const bottom = findCardBottom(rowProfile(px), px.height)
    expect(bottom).not.toBeNull()
    expect(bottom!).toBeGreaterThan(340)
    expect(bottom!).toBeLessThan(360)
  })

  // Cool white balance: an absolute threshold of 14 loses a card at R−B 16.
  it('still finds it when the scan runs cool', () => {
    const px = realSheet([0, 2, 10])
    const bottom = findCardBottom(rowProfile(px), px.height)
    expect(bottom).not.toBeNull()
    expect(bottom!).toBeGreaterThan(340)
    expect(bottom!).toBeLessThan(360)
  })

  // Warm lamp or yellowed paper: an absolute threshold calls the whole page card.
  it('still finds it when the whole sheet is yellowed', () => {
    const px = realSheet([14, 6, 0])
    const bottom = findCardBottom(rowProfile(px), px.height)
    expect(bottom).not.toBeNull()
    expect(bottom!).toBeGreaterThan(340)
    expect(bottom!).toBeLessThan(360)
  })

  it('crops below the card and around the working, in every light', () => {
    for (const shift of [[0, 0, 0], [0, 2, 10], [14, 6, 0]] as [number, number, number][]) {
      const px = realSheet(shift)
      const box = detectWorkBox(px)!
      expect(box, `shift ${shift}`).not.toBeNull()
      expect(box.y, `shift ${shift} top`).toBeGreaterThan(0.42)
      expect(box.y + box.h, `shift ${shift} bottom`).toBeGreaterThan(0.56)
      expect(box.y + box.h, `shift ${shift} footer`).toBeLessThan(0.95)
    }
  })
})
