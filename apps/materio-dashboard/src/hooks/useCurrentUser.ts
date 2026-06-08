import { useEffect, useState } from 'react'

import { getCurrentUser } from '@/api/auth.service'
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface'

export const useCurrentUser = () => {
  const [user, setUser] = useState<ICurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser()

        setUser(currentUser)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    void loadUser()
  }, [])

  return { user, loading }
}
