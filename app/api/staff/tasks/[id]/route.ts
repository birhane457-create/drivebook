import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

// GET - Fetch single task
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Guard invalid ids (e.g. the UI route '/staff/tasks/new')
    const id = params.id;
    if (!id || id === 'new') {
      // Return null for "new" route (no DB call)
      return NextResponse.json(null);
    }

    // Validate MongoDB ObjectId (24 hex chars)
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
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
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update task
export async function PATCH(
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

    if (!user || (!user.staffMember && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { status, priority, assignedToId, resolution } = body;

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: { assignedTo: true }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData: any = {};
    
    if (status) {
      updateData.status = status;
      
      // If resolving, add resolution data
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = user.staffMember?.id || user.id;
        
        if (resolution) {
          updateData.resolution = resolution;
        }
        
        // Calculate resolution time
        const createdAt = new Date(task.createdAt);
        const resolvedAt = new Date();
        const hours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        updateData.resolutionTimeHours = hours;
        
        // Decrement staff load if assigned
        if (task.assignedToId) {
          await prisma.staffMember.update({
            where: { id: task.assignedToId },
            data: {
              currentLoad: { decrement: 1 },
              tasksCompleted: { increment: 1 }
            }
          });
        }
      }
      
      // If moving to IN_PROGRESS, record first response time
      if (status === 'IN_PROGRESS' && !task.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }
    }
    
    if (priority) updateData.priority = priority;
    
    // Handle reassignment
    if (assignedToId !== undefined) {
      // Decrement old staff load
      if (task.assignedToId && task.assignedToId !== assignedToId) {
        await prisma.staffMember.update({
          where: { id: task.assignedToId },
          data: { currentLoad: { decrement: 1 } }
        });
      }
      
      // Increment new staff load
      if (assignedToId) {
        await prisma.staffMember.update({
          where: { id: assignedToId },
          data: { currentLoad: { increment: 1 } }
        });
        updateData.assignedToId = assignedToId;
        updateData.assignedAt = new Date();
        updateData.status = 'ASSIGNED';
      } else {
        updateData.assignedToId = null;
        updateData.assignedAt = null;
        updateData.status = 'OPEN';
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
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
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete task
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Decrement staff load if assigned
    if (task.assignedToId) {
      await prisma.staffMember.update({
        where: { id: task.assignedToId },
        data: { currentLoad: { decrement: 1 } }
      });
    }

    await prisma.task.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
