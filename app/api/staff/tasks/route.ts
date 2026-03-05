import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
// GET - Fetch tasks for staff member
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');

    // Build filter
    const where: any = {};
    
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        notes: {
          include: {
            staff: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: [
        { priority: 'asc' }, // URGENT first
        { createdAt: 'desc' }
      ],
      take: 100
    });

    // Calculate stats
    const stats = {
      total: tasks.length,
      open: tasks.filter(t => t.status === 'OPEN').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      urgent: tasks.filter(t => t.priority === 'URGENT').length,
      high: tasks.filter(t => t.priority === 'HIGH').length
    };

    return NextResponse.json({ tasks, stats });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new task
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const {
      type,
      category,
      priority,
      title,
      description,
      instructorId,
      clientId,
      bookingId,
      userId: relatedUserId,
      contactName,
      contactEmail,
      contactPhone,
      autoAssign = true
    } = body;

    // Validate required fields
    if (!type || !category || !priority || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate due date based on priority
    const now = new Date();
    let dueDate = new Date(now);
    switch (priority) {
      case 'URGENT':
        dueDate.setHours(now.getHours() + 1);
        break;
      case 'HIGH':
        dueDate.setHours(now.getHours() + 4);
        break;
      case 'NORMAL':
        dueDate.setHours(now.getHours() + 24);
        break;
      case 'LOW':
        dueDate.setDate(now.getDate() + 3);
        break;
    }

    // Auto-assign to staff member if enabled
    let assignedToId = null;
    let assignedAt = null;
    
    if (autoAssign) {
      // Find staff member with lowest load in the appropriate department
      const availableStaff = await prisma.staffMember.findFirst({
        where: {
          department: category,
          isActive: true,
          currentLoad: { lt: prisma.staffMember.fields.maxCapacity }
        },
        orderBy: { currentLoad: 'asc' }
      });

      if (availableStaff) {
        assignedToId = availableStaff.id;
        assignedAt = new Date();
        
        // Increment staff load
        await prisma.staffMember.update({
          where: { id: availableStaff.id },
          data: { currentLoad: { increment: 1 } }
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        type,
        category,
        priority,
        title,
        description,
        instructorId,
        clientId,
        bookingId,
        userId: relatedUserId,
        contactName,
        contactEmail,
        contactPhone,
        assignedToId,
        assignedAt,
        autoAssigned: autoAssign && !!assignedToId,
        dueDate,
        status: assignedToId ? 'ASSIGNED' : 'OPEN'
      },
      include: {
        assignedTo: {
          select: {
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
