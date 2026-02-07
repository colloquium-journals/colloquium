import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/lib/api';

interface UserAccessResponse {
  canSeeSubmissions: boolean;
  reason: 'public' | 'admin' | 'involved' | 'no_involvement';
}

interface UseUserAccessResult {
  canSeeSubmissions: boolean;
  reason: string;
  loading: boolean;
}

export function useUserAccess(): UseUserAccessResult {
  const { isAuthenticated } = useAuth();
  const [canSeeSubmissions, setCanSeeSubmissions] = useState(true);
  const [reason, setReason] = useState<string>('public');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAccess = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/settings/user-access`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data: UserAccessResponse = await response.json();
          setCanSeeSubmissions(data.canSeeSubmissions);
          setReason(data.reason);
        } else {
          // Default to showing submissions on error
          setCanSeeSubmissions(true);
          setReason('public');
        }
      } catch (error) {
        console.error('Error fetching user access:', error);
        // Default to showing submissions on error
        setCanSeeSubmissions(true);
        setReason('public');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAccess();
  }, [isAuthenticated]);

  return { canSeeSubmissions, reason, loading };
}
