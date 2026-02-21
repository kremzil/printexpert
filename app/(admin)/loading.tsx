export default function AdminLoading() {
  return (
    <div className="flex-1 p-6">
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg border border-border/50 bg-card p-4">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="mt-3 h-6 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-64 rounded-lg border border-border/50 bg-card" />
      </div>
    </div>
  )
}
