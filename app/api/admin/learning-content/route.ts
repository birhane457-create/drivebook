import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET — list all content
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const content = await prisma.learningContent.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ content });
}

// POST — create new content item
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, tipText, videoUrl, thumbnailUrl, category, difficulty, pdaCodes, durationSec } = body;

  if (!title || !tipText || !category || !Array.isArray(pdaCodes)) {
    return NextResponse.json({ error: 'title, tipText, category, pdaCodes required' }, { status: 400 });
  }

  const item = await prisma.learningContent.create({
    data: {
      title,
      description: description ?? '',
      tipText,
      videoUrl: videoUrl ?? null,
      thumbnailUrl: thumbnailUrl ?? null,
      category,
      difficulty: difficulty ?? 'basic',
      pdaCodes: pdaCodes.map(Number),
      durationSec: durationSec ?? null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
