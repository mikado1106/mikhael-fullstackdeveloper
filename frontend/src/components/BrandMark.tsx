const boxSize = { md: 'h-7 w-7', lg: 'h-10 w-10' } as const;
const iconSize = { md: 'h-4 w-4', lg: 'h-6 w-6' } as const;
const textSize = { md: 'text-lg', lg: 'text-2xl' } as const;

export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex items-center justify-center rounded-lg bg-brand-600 text-white ${boxSize[size]}`}
      >
        <svg
          className={iconSize[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      </span>
      <span className={`font-bold tracking-tight text-slate-900 ${textSize[size]}`}>
        Indo<span className="text-brand-600">Kerja</span>
      </span>
    </span>
  );
}
