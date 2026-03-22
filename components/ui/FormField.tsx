/**
 * A composite component combining Label + Input + Error message.
 * Reusable form field for consistent form styling.
 * 
 * @example
 * <FormField
 *   label="Email"
 *   type="email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error={errors.email}
 *   required
 * />
 */

import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  helperText?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, required, id, type, ...props }, ref) => {
    const fieldId = id || label.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const [showPassword, setShowPassword] = useState(false)
    
    return (
      <div className="w-full">
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="relative">
          <Input
            ref={ref}
            id={fieldId}
            type={isPassword && showPassword ? 'text' : type}
            error={error}
            required={required}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    )
  }
)

FormField.displayName = 'FormField'
