import { Skeleton } from "@/components/ui/skeleton"

export function ProductPageSkeleton() {
  return (
    <div className="my-4 min-h-screen rounded-2xl bg-background shadow-2xl md:my-8">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="mb-16">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="mb-3 h-10 w-[32rem] max-w-full" />
          <Skeleton className="h-5 w-[40rem] max-w-full" />
          <div className="mt-8">
            <Skeleton className="h-10 w-72 max-w-full" />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />

            <div className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-6 w-36" />
              <Skeleton className="mb-2 h-10 w-full" />
              <Skeleton className="mb-2 h-10 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-3 h-5 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="mb-4 h-6 w-32" />
              <Skeleton className="mb-2 h-9 w-full" />
              <Skeleton className="mb-2 h-9 w-full" />
              <Skeleton className="mb-2 h-9 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-6 grid grid-cols-2 gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>

        <div className="my-12 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        <div className="my-12">
          <Skeleton className="mb-6 h-8 w-56" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
