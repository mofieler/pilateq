"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const boutiqueLabelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      variant: {
        default: "text-[#6b3d32]",
        secondary: "text-[#8b6b5c]",
        muted: "text-[#a6856f]",
        dark: "text-[#4e2b22]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const BoutiqueLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof boutiqueLabelVariants>
>(({ className, variant, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(boutiqueLabelVariants({ variant }), className)}
    {...props}
  />
))
BoutiqueLabel.displayName = LabelPrimitive.Root.displayName

export { BoutiqueLabel }
