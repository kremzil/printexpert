import { Skeleton } from "@/components/ui/skeleton"

export function CatalogPageSkeleton() {
  return (
    <div className="w-full">
      <div className="my-4 min-h-screen rounded-2xl bg-background shadow-2xl md:my-8">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-44" />
          </div>

          <div className="mb-8 space-y-3">
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-5 w-[32rem] max-w-full" />
          </div>

          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Skeleton className="h-10 w-full lg:w-96" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-28" />
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-4">
            <div className="hidden lg:col-span-1 lg:block">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div
                    key={`catalog-skeleton-card-${index}`}
                    className="space-y-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
