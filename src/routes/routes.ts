export const ROUTES = {
  PUBLIC: {
    HOME: '/',
    EVENTS: '/events',
    RESULTS: '/results',
    RESULT_DETAIL: (code: string) => `/results/${code}`,
    CHURCH_CHAMPIONSHIP: '/championship/church',
    INDIVIDUAL_CHAMPIONSHIP: '/championship/individual',
    SEARCH: '/search',
  },
  PORTAL: {
    LOGIN: '/portal/login',
    DASHBOARD: '/portal/dashboard',
    CHURCHES: '/portal/churches',
    PARTICIPANTS: '/portal/participants',
    EVENTS: '/portal/events',
    REGISTRATIONS: '/portal/registrations',
    RESULTS: '/portal/results',
    CHAMPIONSHIPS: '/portal/championships',
    AUDIT: '/portal/audit',
  },
} as const;
