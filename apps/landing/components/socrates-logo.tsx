import Image from "next/image";

import { cn } from "../lib/utils";

export function SocratesLogo({
  variant = "nav",
  className,
}: {
  variant?: "nav" | "footer";
  className?: string;
}) {
  return (
    <Image
      src="/socrates-ai-logo.png"
      alt=""
      width={500}
      height={500}
      priority={variant === "nav"}
      className={cn(
        "w-auto shrink-0 object-contain",
        variant === "nav" && "h-9",
        variant === "footer" && "h-8",
        className
      )}
    />
  );
}
