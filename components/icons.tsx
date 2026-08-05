import type { ReactNode, SVGProps } from "react";

/**
 * Ikon SVG inline bergaya Lucide (stroke 1.75, viewBox 24).
 * Ditulis manual agar tidak menambah dependensi dan tetap bebas emoji.
 */

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function Icon({ children, className = "h-4 w-4", ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Icon>
);

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
);

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
);

export const Trash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const Copy = (p: IconProps) => (
  <Icon {...p}>
    <rect width="13" height="13" x="8" y="8" rx="2" />
    <path d="M4 16V5a1 1 0 0 1 1-1h11" />
  </Icon>
);

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const Download = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
);

export const AlertTriangle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);

export const AlertCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5" />
    <path d="M12 16h.01" />
  </Icon>
);

export const Rotate = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);

export const Wand = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3 21 12-12" />
    <path d="M15 9 12 6" />
    <path d="M18 3v4M20 5h-4" />
    <path d="M6 14v3M7.5 15.5h-3" />
    <path d="M19 14v3M20.5 15.5h-3" />
  </Icon>
);

export const Terminal = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 8 4 4-4 4" />
    <path d="M13 16h6" />
  </Icon>
);

export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect width="16" height="11" x="4" y="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const Shield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" />
    <path d="m9.5 12 1.8 1.8L15 10" />
  </Icon>
);

export const Route = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M15.5 6H10a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7H8.5" />
  </Icon>
);

export const Split = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h4l4-6h10" />
    <path d="M7 12h4l4 6h6" />
    <path d="m18 3 3 3-3 3" />
    <path d="m18 15 3 3-3 3" />
  </Icon>
);

export const Cpu = (p: IconProps) => (
  <Icon {...p}>
    <rect width="12" height="12" x="6" y="6" rx="2" />
    <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
  </Icon>
);
