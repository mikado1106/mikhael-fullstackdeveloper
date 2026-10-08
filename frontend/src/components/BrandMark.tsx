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
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      </span>
      <span className={`font-bold tracking-tight text-slate-900 ${textSize[size]}`}>
        Loker<span className="text-brand-600">Kita</span>
      </span>
    </span>
  );
}
