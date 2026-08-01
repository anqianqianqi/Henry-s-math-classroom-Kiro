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

import { HTMLAttributes, ReactNode } from 'react'
import { paperCardStyle } from '@/lib/ui/paperCard'

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
}

export function Card({ children, className = '', plain = false, ...props }: RootCardProps) {
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
  return (
    <div
      className={`paper-card transition-all hover:-translate-y-0.5 ${className}`}
      style={paperCardStyle}
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
