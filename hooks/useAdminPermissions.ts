'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Permission } from '@/lib/rbac/permissions'

interface AdminPermissionsState {
  loading: boolean
  isSuperAdmin: boolean
  permissions: string[]
  staffMember: {
    id: string
    name: string
    department: string
    maxRefundAmount: number
  } | null
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let cache: { data: AdminPermissionsState; fetchedAt: number } | null = null

/**
 * useAdminPermissions
 *
 * Fetches and caches the current admin user's permission array.
 * Used by AdminNav to filter navigation items.
 *
 * IMPORTANT: This hook is for UX (showing/hiding nav items) ONLY.
 * All real authorization enforcement happens server-side via checkPermission().
 *
 * SUPER_ADMIN: isSuperAdmin=true, permissions=['*'], can() always returns true.
 * ADMIN with no StaffMember: permissions=[], can() always returns false.
 * ADMIN with StaffMember: can() checks against their actual permissions array.
 */
export function useAdminPermissions() {
  const [state, setState] = useState<AdminPermissionsState>({
    loading: true,
    isSuperAdmin: false,
    permissions: [],
    staffMember: null,
  })

  const fetchPermissions = useCallback(async (force = false) => {
    // Return cached result if fresh
    if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      setState({ ...cache.data, loading: false })
      return
    }

    try {
      const res = await fetch('/api/admin/me/permissions', { credentials: 'include' })
      if (!res.ok) {
        setState({ loading: false, isSuperAdmin: false, permissions: [], staffMember: null })
        return
      }
      const data = await res.json()
      const next: AdminPermissionsState = {
        loading: false,
        isSuperAdmin: data.isSuperAdmin ?? false,
        permissions: data.permissions ?? [],
        staffMember: data.staffMember ?? null,
      }
      cache = { data: next, fetchedAt: Date.now() }
      setState(next)
    } catch {
      setState({ loading: false, isSuperAdmin: false, permissions: [], staffMember: null })
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  /**
   * Check if the current admin has a specific permission.
   * SUPER_ADMIN always returns true.
   * Returns false while loading.
   */
  const can = useCallback(
    (permission: Permission | string): boolean => {
      if (state.loading) return false
      if (state.isSuperAdmin) return true
      return state.permissions.includes(permission)
    },
    [state]
  )

  /**
   * Check if the current admin has ANY of the listed permissions.
   */
  const canAny = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (state.loading) return false
      if (state.isSuperAdmin) return true
      return permissions.some((p) => state.permissions.includes(p))
    },
    [state]
  )

  /**
   * Invalidate cache and re-fetch (call after permission changes).
   */
  const refresh = useCallback(() => {
    cache = null
    fetchPermissions(true)
  }, [fetchPermissions])

  return {
    loading: state.loading,
    isSuperAdmin: state.isSuperAdmin,
    permissions: state.permissions,
    staffMember: state.staffMember,
    can,
    canAny,
    refresh,
  }
}
