import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/45 focus-visible:ring-offset-3 focus-visible:ring-offset-background active:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-25 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_18px_-14px_rgba(15,15,20,0.35)] hover:-translate-y-px hover:opacity-92",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        outline:
          "border-border bg-transparent text-foreground hover:-translate-y-px hover:border-foreground/28 hover:bg-accent/55",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "text-muted-foreground hover:border-hairline hover:bg-accent/70 hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        viewport: "bg-panel/78 text-foreground/75 hover:bg-panel/95 hover:text-foreground",
        viewportActive: "bg-foreground/92 text-background hover:bg-foreground",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-10 px-4 text-[10px]",
        lg: "h-13 px-8 text-[11px]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
