import { useOrganization } from '../context/OrganizationContext';

/**
 * Page title + subtitle scoped to the active organization.
 */
export function usePageMeta(title, pageDescription = '') {
  const { organization } = useOrganization();
  const orgName = organization?.name || 'No organization selected';

  return {
    title,
    organizationName: orgName,
    description: pageDescription
      ? `${orgName} — ${pageDescription}`
      : orgName,
  };
}
