// 所有环境使用同源接口；开发模式由 Vite/Nginx 代理到指定后端。
const API_BASE = '/api';
const AUTH_BASE = '';

export function getToken() {
  return localStorage.getItem('shopdesk_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('shopdesk_token', token);
  else localStorage.removeItem('shopdesk_token');
}

export async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 && getToken() === token) {
    setToken(null);
    if (!options._silent) window.location.reload();
  }

  if (!response.ok) {
    let errorDetail = '网络请求失败';
    try {
      const err = await response.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch (e) {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// ==================== 认证（fastapi-users） ====================
export const authRegister = (email, password) =>
  fetch(`${AUTH_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '注册失败');
    return r.json();
  });

export const authLogin = (email, password) => {
  const body = new URLSearchParams();
  body.append('username', email);
  body.append('password', password);
  return fetch(`${AUTH_BASE}/auth/jwt/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '邮箱或密码错误');
    return r.json();
  });
};

export const authRequestVerifyToken = (email) =>
  fetch(`${AUTH_BASE}/auth/request-verify-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '发送失败');
    return true;
  });

export const authVerifyCode = (email, code) =>
  fetch(`${AUTH_BASE}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || '验证失败');
    return r.json();
  });

export const authMe = () =>
  fetch(`${AUTH_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  }).then(async (r) => {
    if (!r.ok) {
      const error = new Error(r.status === 401 ? '登录已失效，请重新登录' : '暂时无法校验登录状态，请重试');
      error.status = r.status;
      throw error;
    }
    return r.json();
  });

export const authLogout = () => setToken(null);

// 忘记密码：请求重置验证码
export const authForgotPassword = (email) =>
  fetch(`${AUTH_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json()).detail || '请求失败');
    return true;
  });

// 重置密码：邮箱 + 验证码 + 新密码
export const authResetPassword = (email, code, password) =>
  fetch(`${AUTH_BASE}/auth/reset-password-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, password }),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json()).detail || '重置失败');
    return r.json();
  });

// 市场相关
export const getMarkets = () => request('/markets');

// 店铺相关
export const getShops = (marketCode) => {
  const query = marketCode ? `?market_code=${marketCode}` : '';
  return request(`/shops${query}`);
};
export const createShop = (data) => request('/shops', { method: 'POST', body: JSON.stringify(data) });
export const deleteShop = (shopId) => request(`/shops/${shopId}`, { method: 'DELETE' });

// TikTok 真实授权相关
export const getAuthConfigStatus = () => request('/tiktok/auth/config-status');
export const getCredentials = () => request('/tiktok/auth/credentials');
export const saveManualToken = (data) => request('/tiktok/auth/manual-token', { method: 'POST', body: JSON.stringify(data) });
export const testToken = (shopId) => request(`/tiktok/auth/${shopId}/test`, { method: 'POST' });
export const refreshToken = (shopId) => request(`/tiktok/auth/${shopId}/refresh`, { method: 'POST' });
export const revokeCredential = (shopId) => request(`/tiktok/auth/${shopId}`, { method: 'DELETE' });

// 供应商相关
export const getSuppliers = () => request('/suppliers');
export const createSupplier = (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) });
export const updateSupplier = (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSupplier = (id) => request(`/suppliers/${id}`, { method: 'DELETE' });

// 货源商品相关
export const getSourceProducts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/source-products${query ? `?${query}` : ''}`);
};
export const updateSalesQueue = (ids, operation = 'add') => request(`/source-products/sales-queue?operation=${operation}`, { method: 'POST', body: JSON.stringify(ids) });
export const getSourceProductPage = (params = {}) => request(`/source-products/page?${new URLSearchParams(params)}`);
export const getSourceProduct = (id) => request(`/source-products/${id}`);
export const createSourceProduct = (data) => request('/source-products', { method: 'POST', body: JSON.stringify(data) });
export const updateSourceProduct = (id, data) => request(`/source-products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSourceProduct = (id) => request(`/source-products/${id}`, { method: 'DELETE' });

// 预销售清单（账号级选品结果）
export const getPresalePicks = () => request('/presale-picks');
export const addPresalePick = (productId) =>
  request(`/presale-picks/${productId}`, { method: 'POST' });
export const removePresalePick = (productId) =>
  request(`/presale-picks/${productId}`, { method: 'DELETE' });

// 货源 SKU 变体（颜色×尺码矩阵的单元格）
export const getProductSkus = (productId) => request(`/source-products/${productId}/skus`);
export const createProductSku = (productId, data) =>
  request(`/source-products/${productId}/skus`, { method: 'POST', body: JSON.stringify(data) });
export const updateProductSku = (productId, skuId, data) =>
  request(`/source-products/${productId}/skus/${skuId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProductSku = (productId, skuId) =>
  request(`/source-products/${productId}/skus/${skuId}`, { method: 'DELETE' });

// 货源素材（只读，支持按 role 过滤）
export const getProductAssets = (productId, role) => {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return request(`/source-products/${productId}/assets${query}`);
};

// TikTok 线上店铺商品（Open API 同步落库）
export const syncShopProducts = (shopId, status = 'ALL') =>
  request(`/tiktok/shops/${shopId}/products/sync?status=${encodeURIComponent(status)}`, { method: 'POST' });
export const syncShopCategories = (shopId) =>
  request(`/tiktok/shops/${shopId}/categories/sync`, { method: 'POST' });
export const getTiktokCategoryTree = (region = 'MX') =>
  request(`/tiktok/categories/tree?region=${encodeURIComponent(region)}`);
export const getShopProducts = (shopId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/tiktok/shops/${shopId}/products${query ? `?${query}` : ''}`);
};

// TikTok 线上订单与首页 GMV 聚合
export const syncShopOrders = (shopId, days = 7) =>
  request(`/tiktok/shops/${shopId}/orders/sync?days=${days}`, { method: 'POST' });
export const getOrderSummary = (shopId) =>
  request(`/tiktok/shops/${shopId}/orders/summary`);
export const getShopOrders = (shopId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/tiktok/shops/${shopId}/orders${query ? `?${query}` : ''}`);
};

// 店铺资料库：平台账号（传 shop_id 时按店铺过滤；运营导航不传则汇总当前账号全部店铺）
export const getPlatformAccounts = (shopId) =>
  request(`/resources/accounts${shopId ? `?shop_id=${encodeURIComponent(shopId)}` : ''}`);
export const createPlatformAccount = (shopId, data) =>
  request(`/resources/accounts?shop_id=${encodeURIComponent(shopId)}`, { method: 'POST', body: JSON.stringify(data) });
export const updatePlatformAccount = (id, data) => request(`/resources/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePlatformAccount = (id) => request(`/resources/accounts/${id}`, { method: 'DELETE' });
export const revealAccountField = (id, field) => request(`/resources/accounts/${id}/reveal`, { method: 'POST', body: JSON.stringify({ field }) });

// 店铺资料库：证件/Logo 文件（含私有图片预览，统一携带登录凭证）
export const getResourceFiles = (shopId) =>
  request(`/resources/files?shop_id=${encodeURIComponent(shopId)}`);
export const fileDownloadUrl = (category, name, shopId) =>
  `${API_BASE}/resources/files/download?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}&shop_id=${encodeURIComponent(shopId)}`;
export async function fetchResourceFile(category, name, shopId) {
  const token = getToken();
  const response = await fetch(fileDownloadUrl(category, name, shopId), {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('文件读取失败');
  return response.blob();
}

// 注册人资料（按店铺隔离）
export const getRegistrant = (shopId) =>
  request(`/registrant?shop_id=${encodeURIComponent(shopId)}`);
export const updateRegistrant = (shopId, data) =>
  request(`/registrant?shop_id=${encodeURIComponent(shopId)}`, { method: 'PUT', body: JSON.stringify(data) });

// 公开文件上传（商品图片等）
export async function uploadResourceFile(file, category = 'product-images') {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/resources/upload?category=${encodeURIComponent(category)}`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '上传失败');
  return data;
}

// 首页履约监控（账号隔离的本地平台快照）
export const getOrderMonitor = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined));
  return request(`/tiktok/order-monitor?${query}`);
};

export const getReturnMonitor = (shopId = 'ALL') => request(`/tiktok/return-monitor?shop_id=${encodeURIComponent(shopId)}`);

// Account-shared product function vocabulary.
export const getProductFunctions = () => request('/product-functions');
export const importProductFunctionRun = run => request('/product-functions/runs', { method: 'POST', body: JSON.stringify(run) });

export const getCreationConfig = id => request(`/product-creation-configs/${encodeURIComponent(id)}`);
export const saveCreationConfig = (id, config, revision) => request(`/product-creation-configs/${encodeURIComponent(id)}`, {method:'PUT', body:JSON.stringify({config, expected_revision:revision})});
