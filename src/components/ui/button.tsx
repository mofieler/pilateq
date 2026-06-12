import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32] shadow-[0_4px_14px_rgba(78,43,34,0.25)] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5",
        outline:
          "border-[#c4a88a]/40 bg-[#ede8e5]/60 text-[#4e2b22] hover:bg-[#ede8e5] hover:border-[#c4a88a]/60 backdrop-blur-sm",
        secondary:
          "bg-[#ede8e5] text-[#4e2b22] hover:bg-[#e5dfdb] shadow-sm",
        ghost:
          "hover:bg-[#ede8e5]/50 hover:text-[#4e2b22] text-[#8b6b5c]",
        destructive:
          "bg-[#c45c4a]/10 text-[#c45c4a] hover:bg-[#c45c4a]/20 hover:text-[#b54a38]",
        link: "text-[#4e2b22] underline-offset-4 hover:underline font-medium",
        boutique: "bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] text-[#faf9f7] hover:from-[#5a3228] hover:to-[#7a4538] shadow-[0_4px_14px_rgba(78,43,34,0.25)] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1.5 rounded-lg px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2.5 px-6 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-xl [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
