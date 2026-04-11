import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-base font-semibold transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 dark:focus:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5",
        destructive: "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-700 hover:shadow-xl hover:shadow-red-600/30 hover:-translate-y-0.5 pointer-events-auto",
        outline: "bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800/80 hover:shadow-md hover:-translate-y-0.5",
        ghost: "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300",
        link: "text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "px-8 py-3.5",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
