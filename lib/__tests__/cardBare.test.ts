import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Card } from '@/components/ui/Card'

/**
 * The painted-paper treatment is an inline style, so a className cannot switch
 * it off — which is how the challenge room's book pages ended up with a cream
 * card painted on top of the paper they were already sitting on.
 *
 * `!bg-transparent` looks like it should work and does not: Tailwind compiles
 * it to `background-color: transparent`, and the wash lives in
 * `background-image`. These tests assert the inline style is *absent*, which is
 * the only thing that actually removes it.
 *
 * JSX would put this file at .tsx, which vitest's `include` excludes — hence
 * createElement.
 */

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(Card, props as any, 'x'))

describe('Card', () => {
  it('paints wash, grain and mask by default', () => {
    const html = render({})
    expect(html).toContain('background-image')
    expect(html).toContain('mask-image')
    expect(html).toContain('box-shadow')
  })

  it('is NOT made transparent by !bg-transparent — the bug this replaced', () => {
    // .bg-transparent compiles to `background-color: transparent` (checked in
    // the built stylesheet). The wash is background-image, so it survived, and
    // the card kept rendering as cream paper on top of the book's paper.
    const html = render({ className: '!bg-transparent !shadow-none !border-0' })
    expect(html).toContain('background-image')
    expect(html).toContain('mask-image')
  })

  it('emits no inline style at all when bare', () => {
    // Not "transparent" — absent. A background-color declaration would leave
    // the two gradients and the grain still painting.
    expect(render({ bare: true })).not.toContain('style=')
  })

  it('drops the mask when bare, so nothing inside gets feathered', () => {
    // The mask is why the Submit button's edges dissolved: it clips whatever
    // sits within ~13px of the card's rim, fill or no fill.
    expect(render({ bare: true })).not.toContain('mask')
  })

  it('keeps the caller className when bare', () => {
    expect(render({ bare: true, className: 'mb-4 rounded-2xl' })).toContain('mb-4 rounded-2xl')
  })

  it('does not carry the paper-card hover rule when bare', () => {
    // .paper-card:hover re-adds the pooling from globals.css, which an inline
    // style cannot express and therefore cannot remove either.
    expect(render({ bare: true })).not.toContain('paper-card')
    expect(render({})).toContain('paper-card')
  })

  it('still supports plain, which is a white card and not a bare one', () => {
    const html = render({ plain: true })
    expect(html).toContain('bg-white')
    expect(html).not.toContain('style=')
  })
})
