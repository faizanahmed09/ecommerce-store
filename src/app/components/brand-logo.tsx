import Image from "next/image";

import { cn } from "@/src/app/lib/utils";

type BrandLogoProps = {
  className?: string;
  inverted?: boolean;
  eager?: boolean;
};

export function BrandLogo({ className, inverted = false, eager = false }: BrandLogoProps) {
  return (
    <span className={cn("relative block aspect-[1351/644] shrink-0 overflow-hidden", className)}>
      <Image
        src="/haani-threads-logo-shorter-h.png"
        alt=""
        width={1448}
        height={1086}
        loading={eager ? "eager" : "lazy"}
        className={cn("absolute max-w-none transition-[filter] duration-200", inverted && "brightness-0 invert")}
        style={{ left: "-5.7%", top: "-45.34%", width: "107.18%", height: "auto" }}
      />
    </span>
  );
}
