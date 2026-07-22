import type { SVGProps } from "react";

/**
 * Small, original line-art icons for feature/step sections, used in place of
 * plain text bullets. Single shared gradient stroke so they read as one
 * coherent icon set. Purely decorative (aria-hidden by the caller's wrapper).
 */

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      width="28"
      height="28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="icon-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export function MicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="15" y="6" width="10" height="18" rx="5" stroke="url(#icon-grad)" strokeWidth="2" />
      <path
        d="M10 18v2a10 10 0 0 0 20 0v-2"
        stroke="url(#icon-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M20 30v5" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 35h12" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

export function SparkleCalcIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="7" y="10" width="22" height="24" rx="4" stroke="url(#icon-grad)" strokeWidth="2" />
      <path d="M12 16h12" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="23" r="1.6" fill="url(#icon-grad)" />
      <circle cx="20" cy="23" r="1.6" fill="url(#icon-grad)" />
      <circle cx="13" cy="29" r="1.6" fill="url(#icon-grad)" />
      <circle cx="20" cy="29" r="1.6" fill="url(#icon-grad)" />
      <path
        d="M30 6l1.4 3.6L35 11l-3.6 1.4L30 16l-1.4-3.6L25 11l3.6-1.4L30 6Z"
        fill="url(#icon-grad)"
      />
    </IconBase>
  );
}

export function SignatureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="6" y="6" width="28" height="28" rx="5" stroke="url(#icon-grad)" strokeWidth="2" />
      <path
        d="M11 26c2-1 3-3 4-5 1 3 2 5 4 5s2-4 4-7 3 4 6 2"
        stroke="url(#icon-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function InvoiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path
        d="M11 6h14l6 6v22a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="url(#icon-grad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M25 6v6h6" stroke="url(#icon-grad)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 20h14M13 25h14M13 30h9" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

export function PriceListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="7" y="8" width="26" height="24" rx="4" stroke="url(#icon-grad)" strokeWidth="2" />
      <path d="M13 15h6M13 20h14M13 25h14" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27" cy="15" r="2" fill="url(#icon-grad)" />
    </IconBase>
  );
}

export function ChecklistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="8" y="7" width="24" height="26" rx="4" stroke="url(#icon-grad)" strokeWidth="2" />
      <path d="M13 15l2.5 2.5L20 13" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 24l2.5 2.5L20 22" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 15h4M25 24h4" stroke="url(#icon-grad)" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}
