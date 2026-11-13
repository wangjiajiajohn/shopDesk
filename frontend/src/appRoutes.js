export const PAGE_PATHS = Object.freeze({
  home: '/',
  shops: '/shops',
  sourcing: '/sourcing',
  'product-creation-queue': '/product-creation-queue',
  'product-materials': '/product-materials',
  'product-video-materials': '/product-video-materials',
  skills: '/skills',
  'product-functions': '/product-functions',
  calculator: '/calculator',
  resources: '/resources',
  navigation: '/navigation',
  listing: '/tiktok/products',
  orders: '/tiktok/orders',
  'api-catalog': '/api-catalog',
  'kb-methodology': '/knowledge',
  'kb-funnel': '/knowledge/conversion',
  'kb-playbook': '/knowledge/playbook',
  'kb-capabilities': '/knowledge/platform',
  'kb-enrollment': '/knowledge/enrollment',
  'kb-channels': '/knowledge/suppliers',
});

export function tabFromPath(pathname) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  if (path === '/ai-media') return 'product-creation-queue';
  if (path === '/references') return 'product-materials';
  return Object.keys(PAGE_PATHS).find(tab => PAGE_PATHS[tab] === path) || 'home';
}

export function pathFromTab(tab) {
  if (tab === 'ai-media') return PAGE_PATHS['product-creation-queue'];
  if (tab === 'references') return PAGE_PATHS['product-materials'];
  return Object.hasOwn(PAGE_PATHS, tab) ? PAGE_PATHS[tab] : '/';
}
