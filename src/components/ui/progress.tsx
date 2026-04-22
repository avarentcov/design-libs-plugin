import * as React from 'react'
import { cn } from '../../lib/utils'

/** Лёгкий progress-bar в стиле shadcn. Без @radix-ui — экономим bundle. */
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number // 0–100
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => {
    const v = Math.max(0, Math.min(100, value))
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
        {...props}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', indicatorClassName ?? 'bg-primary')}
          style={{ width: `${v}%` }}
        />
      </div>
    )
  },
)
Progress.displayName = 'Progress'

export { Progress }
