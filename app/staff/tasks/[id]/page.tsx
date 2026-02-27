'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Send
} from 'lucide-react';

interface Task {
  id: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
  dueDate: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  notes: Array<{
    id: string;
    note: string;
    isInternal: boolean;
    createdAt: string;
    staff: {
      name: string;
      email: string;
    };
  }>;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  instructorId?: string;
  clientId?: string;
  bookingId?: string;
}

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state for new task creation
  const [formData, setFormData] = useState({
    type: 'GENERAL_INQUIRY',
    category: 'SUPPORT' as 'FINANCIAL' | 'TECHNICAL' | 'SUPPORT',
    priority: 'NORMAL' as 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW',
    title: '',
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    bookingId: '',
    instructorId: '',
    clientId: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // If creating new task, skip fetch
    if (taskId === 'new') {
      setLoading(false);
      return;
    }
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/staff/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data);
      }
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/staff/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchTask();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/staff/tasks/${taskId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote, isInternal })
      });

      if (res.ok) {
        setNewNote('');
        fetchTask();
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-700 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'NORMAL': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-700';
      case 'ASSIGNED': return 'bg-purple-100 text-purple-700';
      case 'IN_PROGRESS': return 'bg-indigo-100 text-indigo-700';
      case 'WAITING_RESPONSE': return 'bg-amber-100 text-amber-700';
      case 'RESOLVED': return 'bg-green-100 text-green-700';
      case 'CLOSED': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading task...</p>
      </div>
    );
  }

  // Show create form for new tasks
  if (taskId === 'new') {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);

      try {
        const res = await fetch('/api/staff/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          const task = await res.json();
          router.push(`/staff/tasks/${task.id}`);
        } else {
          alert('Failed to create task');
        }
      } catch (error) {
        console.error('Failed to create task:', error);
        alert('Failed to create task');
      } finally {
        setCreating(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Create New Task</h1>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Task Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="GENERAL_INQUIRY">General Inquiry</option>
                <option value="COMPLAINT">Complaint</option>
                <option value="REFUND_REQUEST">Refund Request</option>
                <option value="PAYMENT_DISPUTE">Payment Dispute</option>
                <option value="BOOKING_ISSUE">Booking Issue</option>
                <option value="CANCELLATION_REQUEST">Cancellation Request</option>
                <option value="TECHNICAL_ISSUE">Technical Issue</option>
                <option value="ACCOUNT_ISSUE">Account Issue</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="SUPPORT">Support</option>
                <option value="FINANCIAL">Financial</option>
                <option value="TECHNICAL">Technical</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="LOW">Low (3 days)</option>
                <option value="NORMAL">Normal (24 hours)</option>
                <option value="HIGH">High (4 hours)</option>
                <option value="URGENT">Urgent (1 hour)</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief summary of the issue"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue"
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                required
              />
            </div>

            {/* Contact Information */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Full name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+61 4XX XXX XXX"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Link to Entities (Optional) */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Link to Records (Optional)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Link this task to related booking, instructor, or client for easy navigation
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Booking ID
                  </label>
                  <input
                    type="text"
                    value={formData.bookingId}
                    onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                    placeholder="e.g., 507f1f77bcf86cd799439011"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">24-character MongoDB ObjectID</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instructor ID
                  </label>
                  <input
                    type="text"
                    value={formData.instructorId}
                    onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
                    placeholder="e.g., 507f1f77bcf86cd799439011"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">24-character MongoDB ObjectID</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    placeholder="e.g., 507f1f77bcf86cd799439011"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">24-character MongoDB ObjectID</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/staff/dashboard')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Task not found</p>
          <button
            onClick={() => router.push('/staff/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.push('/staff/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
              <p className="text-gray-600 mt-2">{task.description}</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className={`px-4 py-2 rounded-lg text-sm font-semibold border ${getPriorityColor(task.priority)}`}>
                {task.priority} Priority
              </span>
              <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${getStatusColor(task.status)}`}>
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Task Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-semibold text-gray-900">{task.type.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-semibold text-gray-900">{task.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(task.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(task.dueDate).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              {(task.contactName || task.contactEmail || task.contactPhone) && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    {task.contactName && (
                      <p className="text-sm">
                        <span className="text-gray-600">Name:</span>{' '}
                        <span className="font-medium">{task.contactName}</span>
                      </p>
                    )}
                    {task.contactEmail && (
                      <p className="text-sm">
                        <span className="text-gray-600">Email:</span>{' '}
                        <a href={`mailto:${task.contactEmail}`} className="font-medium text-blue-600 hover:underline">
                          {task.contactEmail}
                        </a>
                      </p>
                    )}
                    {task.contactPhone && (
                      <p className="text-sm">
                        <span className="text-gray-600">Phone:</span>{' '}
                        <a href={`tel:${task.contactPhone}`} className="font-medium text-blue-600 hover:underline">
                          {task.contactPhone}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Notes & Updates
              </h2>

              {/* Add Note */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note or update..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Internal note (not visible to customer)</span>
                  </label>
                  <button
                    onClick={addNote}
                    disabled={submitting || !newNote.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Add Note
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-4">
                {task.notes.length > 0 ? (
                  task.notes.map((note) => (
                    <div key={note.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{note.staff.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {note.isInternal && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">
                            Internal
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No notes yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-2">
                {task.status === 'OPEN' && (
                  <button
                    onClick={() => updateTaskStatus('IN_PROGRESS')}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Start Working
                  </button>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <>
                    <button
                      onClick={() => updateTaskStatus('WAITING_RESPONSE')}
                      className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      Waiting for Response
                    </button>
                    <button
                      onClick={() => updateTaskStatus('RESOLVED')}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Mark as Resolved
                    </button>
                  </>
                )}
                {task.status === 'WAITING_RESPONSE' && (
                  <button
                    onClick={() => updateTaskStatus('IN_PROGRESS')}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Resume Work
                  </button>
                )}
                {task.status === 'RESOLVED' && (
                  <button
                    onClick={() => updateTaskStatus('CLOSED')}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Close Task
                  </button>
                )}
              </div>
            </div>

            {/* Assignment */}
            {task.assignedTo && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Assigned To
                </h3>
                <div>
                  <p className="font-semibold text-gray-900">{task.assignedTo.name}</p>
                  <p className="text-sm text-gray-600">{task.assignedTo.email}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {task.assignedTo.department}
                  </span>
                </div>
              </div>
            )}

            {/* Related Links */}
            {(task.bookingId || task.instructorId || task.clientId) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">Related Items</h3>
                <div className="space-y-3">
                  {task.bookingId && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">Booking</p>
                      <a
                        href={`/admin/bookings?search=${task.bookingId}`}
                        className="text-blue-600 hover:underline font-medium flex items-center gap-2"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Booking Details →
                      </a>
                      <p className="text-xs text-gray-500 mt-1">ID: {task.bookingId.slice(0, 8)}...</p>
                    </div>
                  )}
                  {task.instructorId && (
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">Instructor</p>
                      <a
                        href={`/admin/instructors/${task.instructorId}`}
                        className="text-purple-600 hover:underline font-medium flex items-center gap-2"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Instructor Profile →
                      </a>
                      <p className="text-xs text-gray-500 mt-1">ID: {task.instructorId.slice(0, 8)}...</p>
                    </div>
                  )}
                  {task.clientId && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-1">Client</p>
                      <a
                        href={`/admin/clients/${task.clientId}`}
                        className="text-green-600 hover:underline font-medium flex items-center gap-2"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Client Profile →
                      </a>
                      <p className="text-xs text-gray-500 mt-1">ID: {task.clientId.slice(0, 8)}...</p>
                    </div>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {task.bookingId && (
                      <a
                        href={`/admin/bookings?search=${task.bookingId}`}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View History
                      </a>
                    )}
                    {task.contactEmail && (
                      <a
                        href={`mailto:${task.contactEmail}`}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Email Contact
                      </a>
                    )}
                    {task.contactPhone && (
                      <a
                        href={`tel:${task.contactPhone}`}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Call Contact
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
