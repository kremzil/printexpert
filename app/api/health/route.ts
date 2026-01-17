import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const prisma = getPrisma();
  await prisma.$queryRaw`SELECT 1`;
  return Response.json({ ok: true });
}
