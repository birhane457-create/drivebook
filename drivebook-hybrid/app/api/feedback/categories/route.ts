import { NextRequest, NextResponse } from 'next/server';
import { getAllCategories } from '@/lib/config/feedback-codes';

/**
 * Get all feedback categories and codes
 * Public endpoint - no auth required for reading categories
 */
export async function GET(req: NextRequest) {
  try {
    const categories = getAllCategories();

    // Transform into response format
    const response = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      feedbacks: Object.entries(category.codes).map(([code, text]) => ({
        code: Number(code),
        text,
      })),
    }));

    return NextResponse.json({
      success: true,
      categories: response,
      total: categories.length,
    });
  } catch (error) {
    console.error('Error fetching feedback categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
