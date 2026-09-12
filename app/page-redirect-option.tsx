// OPTION: Replace app/page.tsx with this to redirect to /book
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/book')
}
