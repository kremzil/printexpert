export default function SiteLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 md:py-8 lg:py-10">
      <div className="space-y-6 animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 rounded bg-muted" />

        {/* Title skeleton */}
        <div className="h-8 w-72 rounded bg-muted" />

        {/* Content skeleton */}
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border/50 p-4">
              <div className="aspect-[4/3] rounded-md bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
