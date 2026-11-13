import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import HomeView from './views/HomeView';
const ApiCatalogView = React.lazy(() => import('./views/ApiCatalogView'));
import ShopsView from './views/ShopsView';
import SourcingView from './views/SourcingView';
import ProductFunctionsView from './views/ProductFunctionsView';
import SkillsView from './views/SkillsView';
import ProductVideoMaterialsView from './views/ProductVideoMaterialsView';
import ProductMaterialsView from './views/ProductMaterialsView';
import ProductCreationQueueView from './views/ProductCreationQueueView';
import CalculatorView from './calculator/CalculatorView';
import ResourcesView from './views/ResourcesView';
import NavigationView from './views/NavigationView';
import TikTokProductsView from './views/TikTokProductsView';
import OrdersView from './views/OrdersView';
import KbLayout from './knowledge/KbLayout';
import KnowledgeBase from './knowledge/components/KnowledgeBase';
import ConversionFunnel from './knowledge/components/ConversionFunnel';
import CrossBorderPlaybook from './knowledge/components/CrossBorderPlaybook';
import PlatformCapabilities from './knowledge/components/PlatformCapabilities';
import MerchantEnrollmentGuide from './knowledge/components/MerchantEnrollmentGuide';
import SupplierChannels from './knowledge/components/SupplierChannels';
import AddShopModal from './components/AddShopModal';
import AuthTokenModal from './components/AuthTokenModal';
import ProductModal from './components/ProductModal';
import SupplierModal from './components/SupplierModal';
import QuickDistributeModal from './components/QuickDistributeModal';
import * as api from './api';
import AuthView from './views/AuthView';
import { tabFromPath, pathFromTab } from './appRoutes';

export default function App() {
  const [currentTab, setCurrentTabState] = useState(() => tabFromPath(window.location.pathname));
  const setCurrentTab = tab => {
    const path = pathFromTab(tab);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setCurrentTabState(tabFromPath(path));
  };
  useEffect(() => {
    const onPopState = () => setCurrentTabState(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    const path = pathFromTab(currentTab);
    if (window.location.pathname !== path) window.history.replaceState(null, '', path + window.location.search + window.location.hash);
  }, [currentTab]);
  const [currentShopId, setCurrentShopId] = useState('');
  const [orderContext, setOrderContext] = useState(null);

  // 核心数据状态
  const [markets, setMarkets] = useState([]);
  const [shops, setShops] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 认证状态
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const token = api.getToken();
    setAuthError(''); setAuthChecking(true);
    if (!token) { setAuthChecking(false); return; }
    api.authMe().then(user => {
      if (!active || api.getToken() !== token) return;
      setAuthUser(user); setAuthChecking(false);
    }).catch(error => {
      if (!active || api.getToken() !== token) return;
      if (error.status === 401) { api.setToken(null); setAuthUser(null); }
      else setAuthError('暂时无法连接服务器，登录信息已保留。请重试，无需重新输入密码。');
      setAuthChecking(false);
    });
    return () => { active = false; };
  }, [authAttempt]);

  const handleAuthSuccess = () => { setAuthChecking(true); setAuthAttempt(value => value + 1); };

  const handleLogout = () => {
    api.authLogout();
    setAuthUser(null);
    // 登出时清空所有业务数据，防止切换账号后残留上一账号的数据
    setShops([]);
    setSuppliers([]);
    setProducts([]);
    setMarkets([]);
    setCredentials([]);
    setAuthConfig({ is_configured: false });
  };

  // 弹窗状态
  const [isAddShopOpen, setIsAddShopOpen] = useState(false);
  const [authModalShop, setAuthModalShop] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [authConfig, setAuthConfig] = useState({ is_configured: false });
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [presetSupplierId, setPresetSupplierId] = useState(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [distributeProduct, setDistributeProduct] = useState(null);

  // Toast 提示
  const [toast, setToast] = useState({ show: false, text: '', icon: '✓' });

  const showToast = (text, icon = '✓') => {
    setToast({ show: true, text, icon });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // 初始化拉取数据
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [mkts, shps, supps, creds, cfg] = await Promise.all([
        api.getMarkets(),
        api.getShops(),
        api.getSuppliers(),
        api.getCredentials().catch(() => []),
        api.getAuthConfigStatus().catch(() => ({ is_configured: false }))
      ]);
      setMarkets(mkts);
      setShops(shps);
      setSuppliers(supps);
      setCredentials(creds);
      setAuthConfig(cfg);
    } catch (err) {
      console.error('加载数据失败:', err);
      showToast(`加载数据失败: ${err.message}`, '✕');
    } finally {
      setLoading(false);
    }
  };

  // 只刷新授权状态（弹窗内操作后调用，不重载整页数据）
  const refreshCredentials = async () => {
    try {
      const creds = await api.getCredentials();
      setCredentials(creds);
    } catch (err) {
      console.error('刷新授权状态失败:', err);
    }
  };

  const shopPreferenceKey = authUser?.id ? `shopdesk:last-shop:${authUser.id}` : null;
  useEffect(() => {
    if (!authUser || !shops.length) { setCurrentShopId(''); return; }
    setCurrentShopId(current => {
      const remembered = shopPreferenceKey ? localStorage.getItem(shopPreferenceKey) : null;
      return shops.some(shop => shop.id === current) ? current : shops.find(shop => shop.id === remembered)?.id || shops[0].id;
    });
  }, [authUser?.id, shops, shopPreferenceKey]);
  useEffect(() => {
    if (shopPreferenceKey && shops.some(shop => shop.id === currentShopId)) localStorage.setItem(shopPreferenceKey, currentShopId);
  }, [currentShopId, shopPreferenceKey, shops]);
  const selectShop = id => { setOrderContext(null); setCurrentShopId(id); };
  const scopedShops = shops.filter(shop => shop.id === currentShopId);

  const credentialMap = Object.fromEntries(credentials.map(c => [c.shop_id, c]));

  // 初始化拉取数据 —— 仅在登录成功后执行，避免未登录时 401 触发重载死循环
  useEffect(() => {
    if (authUser) {
      loadAllData();
    } else {
      // 未登录状态清空数据，避免上一账号数据残留
      setShops([]);
      setSuppliers([]);
      setProducts([]);
      setMarkets([]);
      setCredentials([]);
      setAuthConfig({ is_configured: false });
    }
  }, [authUser]);

  // 店铺增删处理
  const handleAddShop = async (shopData) => {
    const newShop = await api.createShop(shopData);
    setShops(prev => [...prev, newShop]);
    showToast(`成功绑定店铺: ${newShop.shop_name}`);
  };

  const handleDeleteShop = async (shopId, shopName) => {
    if (!confirm(`确定要解绑店铺 "${shopName}" 吗？`)) return;
    try {
      await api.deleteShop(shopId);
      setShops(prev => prev.filter(s => s.id !== shopId));
      if (currentShopId === shopId) setCurrentShopId('ALL');
      showToast(`已成功解绑: ${shopName}`);
    } catch (err) {
      showToast(err.message, '✕');
    }
  };

  // 货源商品增改删处理
  const handleSaveProduct = async (productData) => {
    if (editingProduct) {
      const updated = await api.updateSourceProduct(editingProduct.id, productData);
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      showToast(`已更新商品: ${updated.title}`);
    } else {
      const created = await api.createSourceProduct(productData);
      setProducts(prev => [created, ...prev]);
      showToast(`已录入新商品: ${created.title}`);
    }
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (productId, title) => {
    if (!confirm(`确定要删除货源商品 "${title}" 吗？`)) return;
    try {
      await api.deleteSourceProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      showToast(`已删除商品: ${title}`);
    } catch (err) {
      showToast(err.message, '✕');
    }
  };

  // SKU/素材变动后按 SPU 重拉（后端会同步聚合 SPU 库存）
  const handleRefreshProduct = async (productId) => {
    const fresh = await api.getSourceProduct(productId);
    setProducts(prev => prev.map(p => (p.id === productId ? fresh : p)));
    return fresh;
  };

  // 供应商增删处理
  const handleAddSupplier = async (suppData) => {
    const created = await api.createSupplier(suppData);
    setSuppliers(prev => [created, ...prev]);
    showToast(`已添加供应商: ${created.name}`);
    return created;
  };

  const handleDeleteSupplier = async (suppId, name) => {
    if (!confirm(`确定要删除供货商 "${name}" 吗？`)) return;
    try {
      await api.deleteSupplier(suppId);
      setSuppliers(prev => prev.filter(s => s.id !== suppId));
      showToast(`已删除供货商: ${name}`);
    } catch (err) {
      showToast(err.message, '✕');
    }
  };

  return (
    authChecking ? (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">加载中…</div>
    ) : authError ? (
      <div className="h-screen flex flex-col gap-4 items-center justify-center bg-slate-50 text-slate-700 text-sm"><p role="alert">{authError}</p><button className="px-4 py-2 rounded-lg bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={()=>setAuthAttempt(value=>value+1)}>重试连接</button></div>
    ) : !authUser ? (
      <AuthView onAuthSuccess={handleAuthSuccess} />
    ) : (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* 顶部全局导航 */}
      <Navbar
        markets={markets}
        shops={shops}
        currentShopId={currentShopId}
        onSelectShop={selectShop}
        onOpenAddShop={() => setIsAddShopOpen(true)}
        onNavigateTab={setCurrentTab}
        authUser={authUser}
        onLogout={handleLogout}
      />

      {/* 主工作区：固定高度链，滚动只发生在右侧 main 内 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左侧侧边栏 */}
        <Sidebar 
          currentTab={currentTab} 
          onSelectTab={setCurrentTab} 
        />

        {/* 右侧视口：唯一纵向滚动容器 */}
        <main className={`flex-1 min-w-0 min-h-0 p-6 ${['sourcing', 'product-creation-queue', 'product-video-materials', 'product-functions', 'skills'].includes(currentTab) ? 'overflow-hidden' : currentTab === 'calculator' ? 'overflow-y-auto md:overflow-hidden' : 'overflow-y-auto'}`}>
          {(loading || (shops.length > 0 && !currentShopId)) && !['sourcing', 'product-creation-queue', 'product-materials', 'product-video-materials', 'product-functions', 'skills', 'calculator', 'navigation', 'api-catalog'].includes(currentTab) && !currentTab.startsWith('kb-') ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-xs">
              正在加载工作台数据...
            </div>
          ) : (
            <>
              {currentTab === 'api-catalog' && <React.Suspense fallback={<p role="status">正在打开接口资料库…</p>}><ApiCatalogView credentials={credentials} selectedShopId={currentShopId}/></React.Suspense>}
              {currentTab === 'home' && (
                <HomeView
                  shops={shops}
                  products={products}
                  markets={markets}
                  showToast={showToast}
                  onNavigateTab={setCurrentTab}
                  onOpenAddShop={() => setIsAddShopOpen(true)}
                  selectedShopId={currentShopId}
                  onOpenOrder={(shopId, orderId, attention, deadlineBucket) => {
                    setOrderContext({ shopId, orderId, attention, deadlineBucket });
                    setCurrentTab('orders');
                  }}
                />
              )}

              {currentTab === 'shops' && (
                <ShopsView
                  markets={markets}
                  shops={shops}
                  credentialMap={credentialMap}
                  onRefreshShops={loadAllData}
                  onOpenAddShop={() => setIsAddShopOpen(true)}
                  onDeleteShop={handleDeleteShop}
                  onOpenAuth={(shop) => setAuthModalShop(shop)}
                />
              )}

              {currentTab === 'sourcing' && (
                <SourcingView
                  products={products}
                  suppliers={suppliers}
                  onOpenAddProduct={(supplierId) => {
                    setEditingProduct(null);
                    setPresetSupplierId(supplierId || null);
                    if (supplierId) setIsProductModalOpen(true);
                    else setIsSupplierModalOpen(true);
                  }}
                  onEditProduct={async (p) => {
                    try {
                    const detail = await api.getSourceProduct(p.id);
                    setEditingProduct(detail);
                    setPresetSupplierId(null);
                    setIsProductModalOpen(true);
                    } catch (error) { showToast(`读取商品详情失败: ${error.message}`, '✕'); }
                  }}
                  onDeleteProduct={handleDeleteProduct}
                  onOpenSupplierModal={() => setIsSupplierModalOpen(true)}
                />
              )}

              {currentTab === 'product-creation-queue' && (
                <ProductCreationQueueView
                  ownerId={authUser?.id}
                  products={products}
                  suppliers={suppliers}
                  onNavigateSourcing={() => setCurrentTab('sourcing')}
                  onEditProduct={async (p) => {
                    try {
                      const detail = await api.getSourceProduct(p.id);
                      setEditingProduct(detail);
                      setPresetSupplierId(null);
                      setIsProductModalOpen(true);
                    } catch (error) { showToast(`读取商品详情失败: ${error.message}`, '✕'); }
                  }}
                  onDeleteProduct={handleDeleteProduct}
                />
              )}

              {['product-materials', 'references'].includes(currentTab) && <ProductMaterialsView />}
              {currentTab === 'product-video-materials' && <ProductVideoMaterialsView />}
              {currentTab === 'product-functions' && <ProductFunctionsView />}
              {currentTab === 'skills' && <SkillsView ownerId={authUser?.id} />}

              {currentTab === 'calculator' && (
                <CalculatorView />
              )}

              {currentTab === 'navigation' && (
                <NavigationView onNavigateTab={setCurrentTab} />
              )}

              {currentTab === 'resources' && (
                <ResourcesView key={currentShopId} shops={scopedShops} showToast={showToast} />
              )}

              {/* 知识库：六个二级目录各自独立页面，共用 KbLayout 作用域 */}
              {currentTab === 'kb-methodology' && (
                <KbLayout><KnowledgeBase /></KbLayout>
              )}
              {currentTab === 'kb-funnel' && (
                <KbLayout><ConversionFunnel /></KbLayout>
              )}
              {currentTab === 'kb-playbook' && (
                <KbLayout><CrossBorderPlaybook /></KbLayout>
              )}
              {currentTab === 'kb-capabilities' && (
                <KbLayout><PlatformCapabilities /></KbLayout>
              )}
              {currentTab === 'kb-enrollment' && (
                <KbLayout><MerchantEnrollmentGuide /></KbLayout>
              )}
              {currentTab === 'kb-channels' && (
                <KbLayout><SupplierChannels /></KbLayout>
              )}

              {currentTab === 'listing' && (
                <TikTokProductsView key={currentShopId} shops={scopedShops} showToast={showToast} />
              )}

              {currentTab === 'orders' && (
                <OrdersView key={currentShopId} shops={scopedShops} showToast={showToast} initialContext={{ ...orderContext, shopId: currentShopId }} />
              )}


            </>
          )}
        </main>
      </div>

      {/* 模态弹窗集 */}
      <AddShopModal
        isOpen={isAddShopOpen}
        onClose={() => setIsAddShopOpen(false)}
        onSubmit={handleAddShop}
        markets={markets}
      />

      <AuthTokenModal
        isOpen={!!authModalShop}
        onClose={() => setAuthModalShop(null)}
        shop={authModalShop}
        credential={authModalShop ? credentialMap[authModalShop.id] : null}
        configStatus={authConfig}
        onChanged={refreshCredentials}
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSubmit={handleSaveProduct}
        suppliers={suppliers}
        initialData={editingProduct}
        presetSupplierId={presetSupplierId}
      />

      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        suppliers={suppliers}
        onAddSupplier={handleAddSupplier}
        onDeleteSupplier={handleDeleteSupplier}
        onAddProductForSupplier={(supplierId) => {
          setEditingProduct(null);
          setPresetSupplierId(supplierId);
          setIsSupplierModalOpen(false);
          setIsProductModalOpen(true);
        }}
      />

      <QuickDistributeModal
        isOpen={!!distributeProduct}
        onClose={() => setDistributeProduct(null)}
        product={distributeProduct}
        shops={shops}
        onNotify={showToast}
      />

      {/* 全局 Toast 提示 */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs flex items-center gap-2 z-50 animate-bounce">
          <span>{toast.icon}</span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
    )
  );
}
