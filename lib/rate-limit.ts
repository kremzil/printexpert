import "server-only";

import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

type ConsumeRateLimitOptions = {
  windowMs: number;
  limit: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

const globalForRateLimit = globalThis as unknown as {
  rateLimitPruneAt?: number;
};

async function pruneExpiredEntries(now: Date) {
  const last = globalForRateLimit.rateLimitPruneAt ?? 0;
  const nowMs = now.getTime();

  // Keep table bounded without doing extra work on every request.
  if (nowMs - last < 60 * 60 * 1000) return;
  globalForRateLimit.rateLimitPruneAt = nowMs;

  const threshold = new Date(nowMs - 24 * 60 * 60 * 1000);
  await prisma.rateLimitEntry.deleteMany({
    where: { resetAt: { lt: threshold } },
  });
}

export async function consumeRateLimit(
  key: string,
  options: ConsumeRateLimitOptions
): Promise<RateLimitDecision> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowMs);

  await pruneExpiredEntries(now);

  // 1) If the window has expired, reset it in-place.
  const reset = await prisma.rateLimitEntry.updateMany({
    where: { key, resetAt: { lte: now } },
    data: { count: 1, resetAt },
  });

  if (reset.count > 0) {
    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  // 2) Create a new entry (first hit in window).
  try {
    await prisma.rateLimitEntry.create({
      data: { key, count: 1, resetAt },
    });
    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      resetAt,
      retryAfterSeconds: 0,
    };
  } catch (error) {
    // Ignore a concurrent create and continue with the update path.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  // 3) Increment only if we are still below the limit.
  const incremented = await prisma.rateLimitEntry.updateMany({
    where: { key, resetAt: { gt: now }, count: { lt: options.limit } },
    data: { count: { increment: 1 } },
  });

  if (incremented.count > 0) {
    const row = await prisma.rateLimitEntry.findUnique({
      where: { key },
      select: { count: true, resetAt: true },
    });

    return {
      allowed: true,
      remaining: row ? Math.max(options.limit - row.count, 0) : 0,
      resetAt: row?.resetAt ?? resetAt,
      retryAfterSeconds: 0,
    };
  }

  // 4) Denied.
  const row = await prisma.rateLimitEntry.findUnique({
    where: { key },
    select: { resetAt: true },
  });

  const effectiveResetAt = row?.resetAt ?? resetAt;
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((effectiveResetAt.getTime() - now.getTime()) / 1000)
  );

  return {
    allowed: false,
    remaining: 0,
    resetAt: effectiveResetAt,
    retryAfterSeconds,
  };
}

