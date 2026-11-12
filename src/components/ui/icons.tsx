import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LockIcon = (p: P) => (
  <Base {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Base>
);
export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const XIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);
export const GlobeIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </Base>
);
export const PlayIcon = (p: P) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </Base>
);
export const StopIcon = (p: P) => (
  <Base {...p} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Base>
);
export const PinIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Base>
);
export const MapIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </Base>
);
export const CameraIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 8.5A2 2 0 0 1 6 6.5h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </Base>
);
export const PencilIcon = (p: P) => (
  <Base {...p}>
    <path d="M15.5 4.5l4 4L8 20H4v-4z" />
  </Base>
);
export const TrashIcon = (p: P) => (
  <Base {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7" />
  </Base>
);
export const FlipIcon = (p: P) => (
  <Base {...p}>
    <path d="M20 12a8 8 0 1 1-2.35-5.65M20 4.5v4h-4" />
  </Base>
);
export const HeartIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 19.5s-7-4.3-8.8-8.4C2 8 3.8 5 6.9 5c1.9 0 3.3 1.1 4 2.3h2.2C13.8 6.1 15.2 5 17.1 5 20.2 5 22 8 20.8 11.1 19 15.2 12 19.5 12 19.5z" />
  </Base>
);
export const StarIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  </Base>
);
export const SunIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Base>
);
export const MoonIcon = (p: P) => (
  <Base {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Base>
);
export const SunriseIcon = (p: P) => (
  <Base {...p}>
    <path d="M7 17a5 5 0 0 1 10 0M3 17h18M5 21h14M12 3v6M9 6l3-3 3 3M4.2 11.2l1.4 1.4M19.8 11.2l-1.4 1.4" />
  </Base>
);
export const SunsetIcon = (p: P) => (
  <Base {...p}>
    <path d="M7 17a5 5 0 0 1 10 0M3 17h18M5 21h14M12 9V3M9 6l3 3 3-3M4.2 11.2l1.4 1.4M19.8 11.2l-1.4 1.4" />
  </Base>
);
export const ArrowRightIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const PauseIcon = (p: P) => (
  <Base {...p} fill="currentColor" stroke="none">
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
  </Base>
);
export const SkipIcon = (p: P) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M5 6.2v11.6a.8.8 0 0 0 1.25.66L14 13v4.8a.8.8 0 0 0 1.6 0V6.2a.8.8 0 0 0-1.6 0V11L6.25 5.54A.8.8 0 0 0 5 6.2z" />
    <rect x="17" y="5.4" width="2.2" height="13.2" rx="1" />
  </Base>
);
export const RouteIcon = (p: P) => (
  <Base {...p}>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" strokeDasharray="2.2 2.4" />
  </Base>
);
export const AlbumIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </Base>
);
