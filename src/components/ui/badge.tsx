import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#4e2b22]/20 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-[#4e2b22] text-[#faf9f7] border-transparent hover:bg-[#6b3d32]",
        secondary:
          "bg-[#ede8e5] text-[#4e2b22] border-[#c4a88a]/30 hover:bg-[#e5dfdb]",
        destructive:
          "bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20 hover:bg-[#c45c4a]/20",
        outline:
          "bg-transparent text-[#6b3d32] border-[#c4a88a]/40 hover:bg-[#ede8e5]/50 hover:text-[#4e2b22]",
        ghost:
          "bg-transparent text-[#8b6b5c] border-transparent hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]",
        success:
          "bg-[#6b8e6b]/15 text-[#4a7c4a] border-[#6b8e6b]/20 hover:bg-[#6b8e6b]/25",
        boutique:
          "bg-gradient-to-r from-[#4e2b22] to-[#6b3d32] text-[#faf9f7] border-transparent shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
