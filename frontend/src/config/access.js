// Which roles may open each route. Used by the router and the sidebar so the
// two can't drift apart. Routes not listed here are open to any logged-in user.
export const ROLES = {
  ADMIN:                     'admin',
  WAREHOUSE_SUPERVISOR:      'warehouse_supervisor',
  SORTING_SUPERVISOR:        'sorting_supervisor',
  DECOLORIZATION_SUPERVISOR: 'decolorization_supervisor',
  DRYING_SUPERVISOR:         'drying_supervisor',
};

export const ROUTE_ROLES = {
  '/dashboard':      [ROLES.ADMIN],
  '/warehouse':      [ROLES.ADMIN, ROLES.WAREHOUSE_SUPERVISOR],
  '/sorting':        [ROLES.ADMIN, ROLES.SORTING_SUPERVISOR],
  '/decolorization': [ROLES.ADMIN, ROLES.DECOLORIZATION_SUPERVISOR],
  '/drying':         [ROLES.ADMIN, ROLES.DRYING_SUPERVISOR],
  '/sales':          [ROLES.ADMIN],
  '/reports':        [ROLES.ADMIN],
  '/users':          [ROLES.ADMIN],
};

export const canAccess = (role, path) =>
  !ROUTE_ROLES[path] || ROUTE_ROLES[path].includes(role);
