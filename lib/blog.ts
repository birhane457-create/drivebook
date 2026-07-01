import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  category: 'students' | 'instructors'
  readTime: string
  tags: string[]
  featured?: boolean
  content: string
}

const CONTENT_DIR = path.join(process.cwd(), 'content/blog')

type BlogFrontMatter = Omit<BlogPost, 'slug' | 'content'>

function parsePost(filename: string): BlogPost {
  const slug = filename.replace('.mdx', '')
  const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), 'utf-8')
  const { data, content } = matter(raw)
  const d = data as BlogFrontMatter

  return {
    slug,
    content,
    title: d.title,
    description: d.description,
    date: d.date,
    author: d.author,
    category: d.category,
    readTime: d.readTime,
    tags: Array.isArray(d.tags) ? d.tags : [],
    featured: d.featured ?? false,
  }
}

export function getAllPosts(): BlogPost[] {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'))
  return files
    .map(parsePost)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    return parsePost(`${slug}.mdx`)
  } catch {
    return null
  }
}

/** Returns the previous and next post relative to the given slug (sorted newest-first) */
export function getAdjacentPosts(slug: string): {
  prev: BlogPost | null
  next: BlogPost | null
} {
  const all = getAllPosts()
  const idx = all.findIndex(p => p.slug === slug)
  return {
    prev: idx < all.length - 1 ? all[idx + 1] : null,   // older post
    next: idx > 0 ? all[idx - 1] : null,                 // newer post
  }
}

/**
 * Returns up to `limit` posts from the same category, excluding the current slug.
 * Falls back to any category if not enough same-category posts exist.
 */
export function getRelatedPosts(slug: string, category: string, limit = 3): BlogPost[] {
  const all = getAllPosts().filter(p => p.slug !== slug)
  const sameCategory = all.filter(p => p.category === category)
  const related = sameCategory.slice(0, limit)
  if (related.length < limit) {
    const others = all.filter(p => p.category !== category).slice(0, limit - related.length)
    related.push(...others)
  }
  return related
}
