import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
// POST - Add note to task
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { staffMember: true }
    });

    if (!user?.staffMember) {
      return NextResponse.json({ error: 'Not a staff member' }, { status: 403 });
    }

    const body = await req.json();
    const { note, isInternal = true, attachments = [] } = body;

    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const taskNote = await prisma.taskNote.create({
      data: {
        taskId: params.id,
        staffId: user.staffMember.id,
        note,
        isInternal,
        attachments
      },
      include: {
        staff: {
          select: {
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    return NextResponse.json(taskNote, { status: 201 });
  } catch (error) {
    console.error('Error creating task note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
