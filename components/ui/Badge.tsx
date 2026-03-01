/**
 * A cute badge component for labels and status indicators
 * 
 * @example
 * <Badge variant="success">✓ Active</Badge>
 * <Badge variant="info">✨ New</Badge>
 */

import { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'info' | 'error' | 'purple' | 'blue'
  children: ReactNode
}

export function Badge({ 
  variant = 'info', 
  className = '', 
  children, 
  ...props 
}: BadgeProps) {
  const variantStyles = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
  }
  
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
