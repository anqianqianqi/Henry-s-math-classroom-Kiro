/**
 * A reusable card component for consistent container styling.
 * Uses compound component pattern for flexibility.
 * 
 * @example
 * <Card>
 *   <Card.Header>
 *     <Card.Title>Daily Challenge</Card.Title>
 *   </Card.Header>
 *   <Card.Body>
 *     <p>Challenge description...</p>
 *   </Card.Body>
 *   <Card.Footer>
 *     <Button>Submit</Button>
 *   </Card.Footer>
 * </Card>
 */

import { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { PAPER_BACKGROUND, paperCardStyle } from '@/lib/ui/paperCard'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

interface RootCardProps extends CardProps {
  /**
   * Render the old flat white card with a border and a drop shadow.
   *
   * For dense, tabular screens where painted paper costs more than it gives —
   * the treatment reads as warmth on a dashboard and as noise on an admin list
   * of forty rows.
   */
  plain?: boolean

  /**
   * A painted background for this card, laid over the usual wash.
   *
   * A prop rather than a style override, for the same reason `bare` is one:
   * the treatment is an inline style, and `{...props}` is spread AFTER
   * `style={paperCardStyle}` — so a caller passing `style` replaces the whole
   * thing and silently takes the mask, the grain and the pooling with it. The
   * card would keep its picture and lose its soft edge, which is the one part
   * nobody would think to check.
   *
   * The wash stays underneath rather than being replaced, so a missing file
   * leaves today's plain card instead of a hole.
   */
  surfaceImage?: string

  /**
   * No card chrome at all: no wash, no grain, no mask, no pooling, no lift.
   * The caller supplies every visual it wants.
   *
   * For a Card that is already sitting on something painted — the book pages in
   * the challenge room — where a second sheet of paper on top of the first is
   * exactly the thing to avoid.
   *
   * This has to be a prop rather than a className override, because the
   * treatment is an inline style. `!bg-transparent` compiles to
   * `background-color: transparent !important`, which cannot touch
   * `background-image`, so the wash and its two gradients kept painting and the
   * mask kept feathering the edges of whatever was inside.
   */
  bare?: boolean
}

export function Card({
  children,
  className = '',
  plain = false,
  bare = false,
  surfaceImage,
  ...props
}: RootCardProps) {
  if (bare) {
    return <div className={className} {...props}>{children}</div>
  }

  if (plain) {
    return (
      <div
        className={`bg-white rounded-2xl shadow-md border border-gray-100 transition-all hover:shadow-lg hover:-translate-y-0.5 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }

  /*
    No border and no drop shadow: a mask clips box-shadow outright, and a 1px
    border traces the exact rectangle the soft edge is there to remove. What
    separates the card from the page is now the warm wash and the pooling at
    its rim. Lift on hover is kept — a transform still works — and the pooling
    deepens to replace the shadow that used to do that job.
  */
  /*
    The picture fills the card exactly — `100% 100%`, not `cover`.

    The word is painted into the artwork, so anything trimmed off an edge
    takes part of a word with it. `cover` preserves the picture's proportions
    and pays for it by cropping: the dashboard tile is 2.398 wide-to-tall on a
    desktop, and it was throwing away 13% of the height, centred, which ate
    the bottom of the lettering. Narrower than 1280 the tile becomes about
    1.5 and `cover` would have cropped 36% of the WIDTH instead — straight
    through the middle of the word.

    So the art is authored at the tile's own shape (see public/dashboard-cards)
    and told to fill it. At desktop the two match and nothing is distorted;
    on a narrower screen the picture squashes rather than losing a letter.

    Everything else — mask, mask sizing, pooling — comes through untouched
    from paperCardStyle, so a painted card dissolves along exactly the same
    contour as a plain one.
  */
  const style: CSSProperties = surfaceImage
    ? {
        ...paperCardStyle,
        backgroundImage: `url("${surfaceImage}"), ${PAPER_BACKGROUND}`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : paperCardStyle

  return (
    <div
      className={`paper-card transition-all hover:-translate-y-0.5 ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHeader({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`} {...props}>
      {children}
    </div>
  )
}

function CardTitle({ children, className = '', ...props }: CardProps) {
  return (
    <h3 className={`text-xl font-semibold text-gray-900 ${className}`} {...props}>
      {children}
    </h3>
  )
}

function CardBody({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

function CardFooter({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl ${className}`} {...props}>
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Title = CardTitle
Card.Body = CardBody
Card.Footer = CardFooter
