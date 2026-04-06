// Skeleton loading — placeholders animés pendant le chargement

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-surface-200 dark:bg-surface-800 rounded-xl ${className}`} />
}

export function MatchCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-800/60">
      {/* Date placeholder */}
      <div className="flex justify-center mb-3">
        <SkeletonBlock className="h-3 w-28 rounded-full" />
      </div>
      {/* Teams + score inputs */}
      <div className="flex items-center gap-3">
        {/* Team A */}
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <SkeletonBlock className="w-8 h-8 rounded-full" />
          <SkeletonBlock className="h-2.5 w-14 rounded-full" />
        </div>
        {/* Score inputs */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SkeletonBlock className="w-11 h-11 rounded-lg" />
          <div className="w-2" />
          <SkeletonBlock className="w-11 h-11 rounded-lg" />
        </div>
        {/* Team B */}
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <SkeletonBlock className="w-8 h-8 rounded-full" />
          <SkeletonBlock className="h-2.5 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function RankingRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <SkeletonBlock className="w-5 h-4 rounded" />
      <SkeletonBlock className="w-8 h-8 rounded-full" />
      <SkeletonBlock className="h-3 flex-1 rounded-full max-w-[120px]" />
      <SkeletonBlock className="h-3 w-10 rounded-full ml-auto" />
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center pt-8 gap-6 w-full">
      {/* Avatar */}
      <SkeletonBlock className="w-24 h-24 rounded-full" />
      {/* Pseudo + score */}
      <div className="flex flex-col items-center gap-2">
        <SkeletonBlock className="h-5 w-32 rounded-full" />
        <SkeletonBlock className="h-8 w-20 rounded-full" />
      </div>
      {/* Stats grid */}
      <div className="w-full grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <SkeletonBlock key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {/* Buttons */}
      <SkeletonBlock className="w-full h-12 rounded-xl" />
      <SkeletonBlock className="w-full h-12 rounded-xl" />
    </div>
  )
}
