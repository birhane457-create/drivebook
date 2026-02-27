import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Only admins can access this endpoint
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true } },
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
        bookings: {
          orderBy: { startTime: 'desc' },
          include: {
            client: {
              select: {
                name: true,
                email: true,
                phone: true,
              }
            }
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            client: {
              select: {
                name: true,
              }
            }
          }
        }
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Admin instructor fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instructor' },
      { status: 500 }
    );
  }
}
