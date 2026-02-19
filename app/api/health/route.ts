import { getPrisma } from "@/lib/prisma";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const getHandler = async () => {
  const prisma = getPrisma();
  const startedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatencyMs = Date.now() - startedAt;
  const version =
    process.env.APP_VERSION ?? process.env.npm_package_version ?? "0.1.0";
  return Response.json({
    ok: true,
    version,
    uptimeSec: Math.floor(process.uptime()),
    dbLatencyMs,
  });
};

export const GET = withObservedRoute("GET /api/health", getHandler);
