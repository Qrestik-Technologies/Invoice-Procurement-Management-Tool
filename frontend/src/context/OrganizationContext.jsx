import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCompanies } from '../api/companies';
import { setActiveCompanyId, getActiveCompanyId } from '../api/client';
import { useAuth } from './AuthContext';

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationIdState] = useState(() => getActiveCompanyId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOrganizations = useCallback(async () => {
    if (authLoading || !user) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCompanies();
      const active = (list || []).filter((o) => o.is_active !== false);
      setOrganizations(active);

      const stored = getActiveCompanyId();
      const storedValid = stored && active.some((o) => o.id === stored);
      const userDefault = user.company_id && active.some((o) => o.id === user.company_id)
        ? user.company_id
        : null;

      const nextId = storedValid ? stored : userDefault || active[0]?.id || null;
      setOrganizationIdState(nextId);
      setActiveCompanyId(nextId);
    } catch (err) {
      setOrganizations([]);
      setError(err.response?.data?.detail || 'Could not load organizations');
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    loadOrganizations();
  }, [authLoading, user, loadOrganizations]);

  const setOrganizationId = useCallback((id) => {
    setOrganizationIdState(id);
    setActiveCompanyId(id);
  }, []);

  const organization = useMemo(
    () => organizations.find((o) => o.id === organizationId) || null,
    [organizations, organizationId],
  );

  const value = useMemo(
    () => ({
      organizations,
      organization,
      organizationId,
      setOrganizationId,
      loading,
      error,
      refreshOrganizations: loadOrganizations,
    }),
    [organizations, organization, organizationId, setOrganizationId, loading, error, loadOrganizations],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used inside OrganizationProvider');
  return ctx;
}
