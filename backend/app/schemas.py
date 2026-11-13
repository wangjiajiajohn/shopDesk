from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field

# ----------------- 市场 Schemas -----------------
class MarketBase(BaseModel):
    country_code: str = Field(..., example="MX")
    name: str = Field(..., example="墨西哥")
    default_language: str = Field(default="es")
    currency: str = Field(default="MXN")
    exchange_rate_cny: float = Field(default=2.75)
    platform_commission_rate: float = Field(default=0.08)

class MarketCreate(MarketBase):
    pass

class MarketResponse(MarketBase):
    created_at: datetime
    class Config:
        from_attributes = True

# ----------------- 店铺 Schemas -----------------
class ShopBase(BaseModel):
    market_code: str = Field(default="MX")
    shop_name: str = Field(..., example="Tienda Moda MX")
    tiktok_shop_id: str = Field(..., example="749201938102")
    status: str = Field(default="ACTIVE")

class ShopCreate(ShopBase):
    auth_token: Optional[str] = None

class ShopResponse(ShopBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True


# ----------------- TikTok 授权 Schemas -----------------
class ManualTokenCreate(BaseModel):
    """测试店手动录入 token（Partner Center 开发店页面生成）。"""
    shop_id: str
    access_token: str = Field(..., min_length=10, description="access token，必填")
    refresh_token: Optional[str] = Field(None, description="refresh token，有则填")
    access_token_expire_in: Optional[int] = Field(
        None, description="剩余有效秒数，不填默认按 7 天计"
    )
    refresh_token_expire_in: Optional[int] = Field(
        None, description="refresh 剩余秒数，不填默认按 30 天计"
    )
    is_dev_shop: bool = True


class CredentialResponse(BaseModel):
    """对外的凭证状态（绝不返回原始 token）。"""
    shop_id: str
    auth_status: str
    seller_name: Optional[str] = None
    seller_base_region: Optional[str] = None
    open_id_masked: Optional[str] = None
    has_refresh_token: bool = False
    is_dev_shop: bool = False
    granted_scopes: List[Any] = []
    access_token_expire_at: Optional[datetime] = None
    refresh_token_expire_at: Optional[datetime] = None
    last_verified_at: Optional[datetime] = None
    last_test_message: Optional[str] = None

    class Config:
        from_attributes = True


class AuthTestResult(BaseModel):
    ok: bool
    auth_status: str
    message: str
    request_id: Optional[str] = None
    matched_shops: List[Any] = []
    verified_at: datetime

# ----------------- 供应商 Schemas -----------------
class SupplierBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    platform_url: Optional[str] = None
    shipping_sla_hours: int = 24
    address: Optional[str] = None
    notes: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True

# ----------------- 货源 SKU 变体 Schemas -----------------
class SourceProductSkuBase(BaseModel):
    sku_code: str = Field(..., max_length=100, description="内部/SKU 编码，兼作 TikTok seller_sku")
    attributes: List[Any] = []                   # [{"name":"颜色","value":"黑"}]
    supplier_sku_code: Optional[str] = None
    supply_price: Optional[float] = None        # 一口价；空则回退 SPU 阶梯价
    currency: Optional[str] = None
    stock_quantity: int = 0
    image_asset_id: Optional[str] = None
    sort_order: int = 0

class SourceProductSkuCreate(SourceProductSkuBase):
    pass

class SourceProductSkuUpdate(BaseModel):
    attributes: Optional[List[Any]] = None
    supplier_sku_code: Optional[str] = None
    supply_price: Optional[float] = None
    currency: Optional[str] = None
    stock_quantity: Optional[int] = None
    image_asset_id: Optional[str] = None
    sort_order: Optional[int] = None

class SourceProductSkuResponse(SourceProductSkuBase):
    id: str
    source_product_id: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


# ----------------- 商品素材 Schemas -----------------
class ProductAssetResponse(BaseModel):
    id: str
    source_product_id: str
    shop_id: Optional[str] = None
    role: str
    source_type: str
    sku_code: Optional[str] = None
    local_url: Optional[str] = None
    tts_uri: Optional[str] = None
    tts_uploaded_at: Optional[datetime] = None
    prompt: Optional[str] = None
    reference_id: Optional[str] = None
    batch_no: Optional[str] = None
    sort_order: int = 0
    created_at: datetime
    class Config:
        from_attributes = True


# ----------------- 货源商品 Schemas -----------------
class SourceProductBase(BaseModel):
    supplier_id: Optional[str] = None
    title: str
    sku_code: str
    category_name: str = "通用"
    tiktok_category_id: Optional[str] = None     # TikTok 官方叶子类目 ID，可空（兼容历史数据）
    source_url: Optional[str] = None
    main_image: Optional[str] = None
    images: List[str] = []
    composition: Optional[str] = None                  # 商品成分（如"锦纶62%, 氨纶38%"）
    size_chart: Optional[Any] = None                    # 尺码表 {"columns":[...], "rows":[[...],...]}
    source_data: Optional[dict] = None                 # 来源与提取结果，原图不被生成稿覆盖
    supply_price: Optional[float] = None                # SPU 级一口采购价
    supply_currency: Optional[str] = None
    # RMB 阶梯价：1688 模式必填；一口价供应商（MXN）留空，价格在 SKU 级
    price_tier_1: Optional[float] = None
    price_tier_2: Optional[float] = None
    price_tier_3: Optional[float] = None
    customs_declaration: Optional[Any] = None
    weight_g: int = 200
    package_length_cm: float = 20.0
    package_width_cm: float = 15.0
    package_height_cm: float = 3.0
    stock_quantity: int = 999
    specs: List[Any] = []
    is_active: bool = True                          # 爬虫同步在架状态；False=货源已消失，打无库存标签保留
    last_synced_at: Optional[datetime] = None

class SourceProductCreate(SourceProductBase):
    pass

class SourceProductUpdate(BaseModel):
    supplier_id: Optional[str] = None
    title: Optional[str] = None
    category_name: Optional[str] = None
    tiktok_category_id: Optional[str] = None
    source_url: Optional[str] = None
    main_image: Optional[str] = None
    images: Optional[List[str]] = None
    composition: Optional[str] = None
    size_chart: Optional[Any] = None
    source_data: Optional[dict] = None
    supply_price: Optional[float] = None
    price_tier_1: Optional[float] = None
    price_tier_2: Optional[float] = None
    price_tier_3: Optional[float] = None
    supply_currency: Optional[str] = None
    customs_declaration: Optional[Any] = None
    weight_g: Optional[int] = None
    package_length_cm: Optional[float] = None
    package_width_cm: Optional[float] = None
    package_height_cm: Optional[float] = None
    stock_quantity: Optional[int] = None
    specs: Optional[List[Any]] = None

class SourceProductResponse(SourceProductBase):
    id: str
    created_at: datetime
    updated_at: datetime
    supplier: Optional[SupplierResponse] = None
    skus: List[SourceProductSkuResponse] = []
    assets: List[ProductAssetResponse] = []

    # 计算字段
    volume_cm3: Optional[float] = None
    volume_weight_g: Optional[float] = None
    is_bulky: Optional[bool] = None
    tier_2_discount_percent: Optional[float] = None
    tier_3_discount_percent: Optional[float] = None
    is_picked: Optional[bool] = None                # 当前账号是否已加入预销售清单

    class Config:
        from_attributes = True


# ----------------- 刊登草稿 Schemas -----------------
class ListingDraftBase(BaseModel):
    shop_id: str
    source_product_id: str
    title_es: Optional[str] = None
    description_es: Optional[str] = None
    tiktok_category_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    asset_selection: dict = {}
    sku_overrides: dict = {}
    product_attributes: List[Any] = []

class ListingDraftCreate(ListingDraftBase):
    pass

class ListingDraftUpdate(BaseModel):
    title_es: Optional[str] = None
    description_es: Optional[str] = None
    tiktok_category_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    asset_selection: Optional[dict] = None
    sku_overrides: Optional[dict] = None
    product_attributes: Optional[List[Any]] = None
    status: Optional[str] = None

class ListingDraftResponse(ListingDraftBase):
    id: str
    status: str
    tiktok_product_id: Optional[str] = None
    version: int
    payload_snapshot: Optional[Any] = None
    check_result: Optional[Any] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


# ----------------- 平台账号 Schemas（资料库） -----------------
class PlatformAccountBase(BaseModel):
    platform: str = Field(..., max_length=100)
    purpose: Optional[str] = None
    account: str = Field(..., max_length=255)
    contact: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None
    sort_order: int = 0

class PlatformAccountCreate(PlatformAccountBase):
    # 明文入参，路由层加密后入库
    password: Optional[str] = None
    secret: Optional[str] = None
    pin: Optional[str] = None

class PlatformAccountUpdate(BaseModel):
    platform: Optional[str] = None
    purpose: Optional[str] = None
    account: Optional[str] = None
    contact: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None
    sort_order: Optional[int] = None
    # 传 None/缺省 = 不变；传空串 = 清空；传非空 = 替换
    password: Optional[str] = None
    secret: Optional[str] = None
    pin: Optional[str] = None

class PlatformAccountResponse(PlatformAccountBase):
    id: str
    shop_id: str
    # 只回掩码与"是否存在"，永不回密文
    password_masked: Optional[str] = None
    secret_masked: Optional[str] = None
    pin_masked: Optional[str] = None
    has_password: bool = False
    has_secret: bool = False
    has_pin: bool = False
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class RevealRequest(BaseModel):
    # password / secret / pin
    field: str = Field(..., pattern="^(password|secret|pin)$")


# ----------------- TikTok 线上店铺商品 Schemas -----------------
class ShopProductResponse(BaseModel):
    """本地落库的 TikTok 商品快照（不含 raw_payload 巨字段，列表轻量）。"""
    id: str
    shop_id: str
    tiktok_product_id: str
    title: str
    status: str
    has_draft: bool = False
    sku_count: int = 0
    main_image_url: Optional[str] = None
    main_image_large_url: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_path: Optional[str] = None
    category_name_zh: Optional[str] = None       # zh-CN 字典译名（路由层按 category_id 填充）
    price_currency: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    inventory_total: int = 0
    skus: List[Any] = []
    tiktok_create_time: Optional[int] = None
    tiktok_update_time: Optional[int] = None
    synced_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductCategoryNode(BaseModel):
    """店铺在用类目的中文树节点（基于官方 parent_id 重建，文案取自 zh-CN 类目字典）。

    所有层级节点都带官方 category_id（前端选中后按 id 做子树筛选）；
    product_count 为整棵子树商品数；path 是中文完整类目链，仅用于悬浮展示。
    """
    name: str
    path: str
    product_count: int
    category_id: str
    children: List["ProductCategoryNode"] = []


class ProductPage(BaseModel):
    """服务端分页商品列表。"""
    items: List[ShopProductResponse]
    total: int
    page: int
    page_size: int
    status_counts: dict           # 该店铺全部商品的状态计数，不受当前筛选影响
    category_tree: List[ProductCategoryNode] = []
    category_locale: str = "zh-CN"   # 类目字典语言；字典未就绪时为空树


ProductCategoryNode.model_rebuild()


class CategorySyncResult(BaseModel):
    """一次类目字典同步的统计结果。"""
    region: str
    locale: str
    total: int
    created: int
    updated: int
    synced_at: datetime


class ProductSyncResult(BaseModel):
    """一次同步动作的统计结果。"""
    shop_id: str
    status_filter: str
    fetched: int
    created: int
    updated: int
    total_count: Optional[int] = None
    image_fetched: int = 0          # 本次补全主图的商品数
    image_errors: int = 0           # 主图拉取失败数（不阻断同步）
    synced_at: datetime


# ----------------- TikTok 线上订单 Schemas -----------------
class OrderSyncResult(BaseModel):
    shop_id: str
    range_days: int
    fetched: int
    created: int
    updated: int
    synced_at: datetime


class OrderSummary(BaseModel):
    """首页经营指标：按店铺所在市场时区（墨西哥城 UTC-6）的自然日聚合。"""
    shop_id: str
    timezone: str
    date: str                                 # 市场时区当日日期 YYYY-MM-DD
    # 今日
    today_gmv: float                          # 成交口径：排除 UNPAID/CANCELLED 的实付额合计
    currency: Optional[str] = None
    today_paid_order_count: int               # 计入 GMV 的订单数
    today_total_order_count: int             # 今日全部状态订单数
    today_avg_order_value: float             # 客单价 = GMV / 成交订单数
    awaiting_fulfillment_count: int          # 待发货/待揽收（运营待办）
    # 昨日（环比用）
    yesterday_gmv: float
    yesterday_paid_order_count: int
    gmv_change_pct: Optional[float] = None   # 环比百分比，昨日为 0 时为空
    synced_at: Optional[datetime] = None
