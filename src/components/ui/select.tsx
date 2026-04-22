import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Lite-реализация select: нативный <select> со стилями shadcn.
 * Radix-версия слишком тяжёлая для Figma-iframe; нативный элемент надёжен.
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-8 w-full items-center rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >{children}</select>
  ),
)
Select.displayName = 'Select'

export { Select }
