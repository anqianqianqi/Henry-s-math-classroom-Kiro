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

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md border border-gray-100 transition-all hover:shadow-lg hover:-translate-y-0.5 ${className}`}
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
