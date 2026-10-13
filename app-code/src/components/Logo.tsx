export default function Logo({ size = 32, className }: { size?: number; className?: string }) {
 return (
 <svg
 width={size}
 height={size}
 viewBox="0 0 32 32"
 className={className}
 role="img"
 aria-label="BugHub"
 >
 <defs>
 <linearGradient id="bughubLogo" x1="0" y1="0" x2="1" y2="1">
 <stop offset="0" stopColor="#4f46e5" />
 <stop offset="1" stopColor="#2563eb" />
 </linearGradient>
 </defs>
 <rect width="32" height="32" rx="9" fill="url(#bughubLogo)" />
 <circle cx="16" cy="16" r="6.4" fill="none" stroke="#ffffff" strokeWidth="1.8" />
 <circle cx="16" cy="16" r="1.9" fill="#ffffff" />
 <path
 d="M16 3.4v3.6M16 25v3.6M3.4 16H7M25 16h3.6"
 stroke="#ffffff"
 strokeWidth="1.8"
 strokeLinecap="round"
 />
 </svg>
 );
}
