import { useState, useEffect, useCallback } from 'react';

interface User {
  name: string;
  email: string;
}

interface UseAuthResult {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    setUser(null);
  }, []);

  return { user, loading, logout };
}
