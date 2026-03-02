import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const design = await prisma.design.findUnique({
    where: { id: params.id },
    select: { image: true, contentType: true },
  });

  if (!design || !design.image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(design.image, {
    status: 200,
    headers: {
      "Content-Type": design.contentType || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

