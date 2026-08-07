import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full border border-transparent text-[11px] font-normal uppercase tracking-[0.1em] cursor-pointer transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/45 focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-25 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.15]",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[0_10px_28px_-18px_currentColor] hover:-translate-y-px hover:opacity-92 hover:shadow-[0_16px_38px_-22px_currentColor]",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        outline:
          "border-border bg-transparent text-foreground hover:-translate-y-px hover:border-foreground/28 hover:bg-accent/55",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "text-muted-foreground hover:border-hairline hover:bg-accent/70 hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        viewport:
          "border-hairline bg-panel text-muted-foreground backdrop-blur-xl hover:border-border hover:text-foreground",
        viewportActive:
          "border-foreground/20 bg-foreground text-background backdrop-blur-xl hover:opacity-90",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-10 px-4.5 text-[11px]",
        lg: "h-14 px-10 text-[13px]",
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
