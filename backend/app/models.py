import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, JSON, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from .database import Base

class Market(Base):
    """国家市场配置模型（解耦国家、币种、语言与汇率）"""
    __tablename__ = "markets"

    country_code = Column(String(10), primary_key=True, index=True) # 如 'MX'
    name = Column(String(50), nullable=False)                        # 如 '墨西哥'
    default_language = Column(String(10), nullable=False, default="es") # 'es'
    currency = Column(String(10), nullable=False, default="MXN")    # 'MXN'
    exchange_rate_cny = Column(Float, default=2.75)                 # 1 RMB = 2.75 MXN
    platform_commission_rate = Column(Float, default=0.08)          # 平台佣金率 8%
    created_at = Column(DateTime, default=datetime.utcnow)

    shops = relationship("Shop", back_populates="market", cascade="all, delete-orphan")


class Shop(Base):
    """TikTok 店铺实体（支持动态绑定 1, 2, 3, 4 到 50 个店铺）"""
    __tablename__ = "shops"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=True, index=True)
    market_code = Column(String(10), ForeignKey("markets.country_code"), nullable=False)
    shop_name = Column(String(100), nullable=False)                 # 如 'Tienda Moda MX'
    tiktok_shop_id = Column(String(100), unique=True, nullable=False) # 平台店铺识别码
    status = Column(String(20), default="ACTIVE")                   # ACTIVE, EXPIRED, SUSPENDED
    # 已废弃：明文 token 不再写入，真实凭证存 shop_credentials 表（加密）
    auth_token = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    market = relationship("Market", back_populates="shops")
    credential = relationship(
        "ShopCredential",
        back_populates="shop",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ShopCredential(Base):
    """TikTok 店铺授权凭证（1:1）。token 全部加密存储，不出现在普通查询里。"""
    __tablename__ = "shop_credentials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id = Column(String(36), ForeignKey("shops.id"), unique=True, nullable=False, index=True)

    # 授权账号信息（token/get 接口返回）
    open_id = Column(String(100), nullable=True)
    seller_name = Column(String(200), nullable=True)
    seller_base_region = Column(String(20), nullable=True)          # 如 MX / US
    shop_cipher = Column(Text, nullable=True)                       # 业务 API 必需的店铺密文
    granted_scopes = Column(JSON, default=list)                     # 已授权 scope 列表

    # 加密后的 token（security.encrypt_token）
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)

    # 有效期（UTC）。access_token 7 天、refresh_token 约 30 天
    access_token_expire_at = Column(DateTime, nullable=True)
    refresh_token_expire_at = Column(DateTime, nullable=True)

    # UNAUTHORIZED 未授权 / ACTIVE 有效 / EXPIRED 已过期 / REVOKED 被吊销 / INVALID 校验失败
    auth_status = Column(String(20), default="UNAUTHORIZED", index=True)
    last_verified_at = Column(DateTime, nullable=True)              # 最近一次真实 API 校验时间
    last_test_message = Column(Text, nullable=True)                 # 最近校验结果（含 request_id）
    is_dev_shop = Column(Boolean, default=False)                    # 是否 Partner Center 测试店 token

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shop = relationship("Shop", back_populates="credential")


class PlatformAccount(Base):
    """平台账号信息（ERP / 平台登录账号等）。密码类字段加密存储，列表只返回掩码。"""
    __tablename__ = "platform_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=True, index=True)
    platform = Column(String(100), nullable=False, index=True)      # 如 TikTok Shop / 领星 OMS
    purpose = Column(String(100), nullable=True)                    # 用途，如 墨西哥本地店铺
    account = Column(String(255), nullable=False)                   # 登录账号（明文，用于识别）
    contact = Column(String(255), nullable=True)                    # 联系人/邮箱
    url = Column(Text, nullable=True)                               # 登录/平台链接

    # 敏感字段：security.encrypt_token 加密后入库
    password_encrypted = Column(Text, nullable=True)
    secret_encrypted = Column(Text, nullable=True)                  # 二级密钥/安全问答
    pin_encrypted = Column(Text, nullable=True)                     # PIN 码

    note = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Supplier(Base):
    """供货商模型"""
    __tablename__ = "suppliers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)                      # 供应商名称
    contact_name = Column(String(50), nullable=True)                # 联系人
    contact_phone = Column(String(50), nullable=True)               # 电话 / 微信
    platform_url = Column(Text, nullable=True)                      # 1688 / 货源平台链接
    shipping_sla_hours = Column(Integer, default=24)                # 发货时效 (如: 24h, 48h)
    address = Column(String(255), nullable=True)                    # 发货地址
    notes = Column(Text, nullable=True)                             # 备注
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("SourceProduct", back_populates="supplier")


class SourceProduct(Base):
    """货源商品库模型（含 1/2/3 件采购阶梯价与物理体积重）"""
    __tablename__ = "source_products"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=True, index=True)
    supplier_id = Column(String(36), ForeignKey("suppliers.id"), nullable=True)
    title = Column(String(255), nullable=False)                     # 货源商品名称
    sku_code = Column(String(50), unique=True, nullable=False)      # 内部货号 SP-2024-XXX
    category_name = Column(String(100), default="通用")             # 类目（中文叶子名，保留原文本语义）
    tiktok_category_id = Column(String(32), nullable=True, index=True)  # 关联 TikTok 官方叶子类目 ID，旧数据为空
    source_url = Column(Text, nullable=True)                        # 采购原链接
    main_image = Column(Text, nullable=True)                        # 货源主图
    images = Column(JSON, default=list)                             # 轮播副图列表

    # 核心阶梯价 (RMB)。1688 类供应商使用；MXN 一口价供应商（如深圳源创 OMS）可为空，
    # 价格下沉到 source_product_skus.supply_price
    price_tier_1 = Column(Float, nullable=True)                     # 1件单价
    price_tier_2 = Column(Float, nullable=True)                     # 2件单价
    price_tier_3 = Column(Float, nullable=True)                     # 3件单价

    # 一口价供应商的结算币种（如 MXN）；为空表示沿用 RMB 阶梯价模式
    supply_currency = Column(String(10), nullable=True)
    # 报关资料整体留坑（申报中英名/申报价/报关属性/海关编码/平台 PID），本期不做报关流程
    customs_declaration = Column(JSON, nullable=True)

    # 物理属性 (用于计算跨境运费与抛货体积重)
    weight_g = Column(Integer, nullable=False, default=200)         # 实重 (克)
    package_length_cm = Column(Float, default=20.0)                 # 长 (cm)
    package_width_cm = Column(Float, default=15.0)                  # 宽 (cm)
    package_height_cm = Column(Float, default=3.0)                  # 高 (cm)

    stock_quantity = Column(Integer, default=999)                   # 现货可用库存（SKU 库存聚合缓存）
    specs = Column(JSON, default=list)                              # 规格 (颜色, 尺码等)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="products")
    skus = relationship(
        "SourceProductSku",
        back_populates="source_product",
        cascade="all, delete-orphan",
        order_by="SourceProductSku.sort_order",
    )
    assets = relationship(
        "ProductAsset",
        back_populates="source_product",
        cascade="all, delete-orphan",
        order_by="ProductAsset.sort_order",
    )


class SourceProductSku(Base):
    """货源商品变体（颜色×尺码矩阵）。

    供应商 OMS 普遍只有平铺 SKU、没有 SPU 层，SPU 由导入器按命名规律归并。
    sku_code 同时作为 TikTok 创建商品时的 seller_sku（全局唯一、稳定可读）。
    """
    __tablename__ = "source_product_skus"
    __table_args__ = (
        UniqueConstraint("source_product_id", "sku_code", name="uq_spu_sku_code"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_product_id = Column(String(36), ForeignKey("source_products.id"), nullable=False, index=True)

    sku_code = Column(String(100), unique=True, nullable=False)     # 内部/SKU 编码（如拼音 slug），兼作 seller_sku
    attributes = Column(JSON, default=list)                         # [{"name":"颜色","value":"黑"},{"name":"尺码","value":"M"}]
    supplier_sku_code = Column(String(100), nullable=True, index=True)  # 供应商内部商品编码（如 P5L00073）

    # SKU 级一口价（MXN/CNY）；为空时回退 SPU 阶梯价
    supply_price = Column(Float, nullable=True)
    currency = Column(String(10), nullable=True)

    stock_quantity = Column(Integer, default=0, nullable=False)     # 变体现货（供应商可用/共享库存）
    image_asset_id = Column(String(36), nullable=True)              # 软关联 ProductAsset.id，不加硬 FK
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_product = relationship("SourceProduct", back_populates="skus")


class ProductAsset(Base):
    """商品素材台账（供应商原图/参考改造/AI 生成）。

    local_url 为本地路径或供应商 CDN 外链（未上传态）；调 TikTok upload 接口后
    回写 tts_uri，为空即未上传。SKU 图通过 sku_code 挂变体。
    """
    __tablename__ = "product_assets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_product_id = Column(String(36), ForeignKey("source_products.id"), nullable=False, index=True)
    shop_id = Column(String(36), ForeignKey("shops.id"), nullable=True, index=True)  # 上传 TTS 后绑定目标店铺

    # main 主图 / sub 副图 / sku 变体图 / detail 详情图 / size_chart 尺码表 / certification 认证图
    role = Column(String(20), nullable=False, index=True)
    # supplier_raw 供应商原图 / reference_remix 参考改造 / ai_generated AI 生成
    source_type = Column(String(20), nullable=False, default="supplier_raw")
    sku_code = Column(String(100), nullable=True, index=True)

    local_url = Column(Text, nullable=True)
    tts_uri = Column(Text, nullable=True)
    tts_uploaded_at = Column(DateTime, nullable=True)

    # AI 生成溯源
    prompt = Column(Text, nullable=True)
    reference_id = Column(String(64), nullable=True)
    batch_no = Column(String(64), nullable=True, index=True)

    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_product = relationship("SourceProduct", back_populates="assets")


class ListingDraft(Base):
    """刊登加工态：一个货源 SPU 铺到 N 个店铺即 N 份草稿。

    组装链路：货源层（成本/规格/库存）+ 素材层（已上传 tts_uri）+ 本草稿
    （西语文案/售价/类目）→ assembler 拼 TikTok payload → listing_check → create(AS_DRAFT)。
    """
    __tablename__ = "listing_drafts"
    __table_args__ = (
        UniqueConstraint("shop_id", "source_product_id", name="uq_shop_source_draft"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id = Column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    source_product_id = Column(String(36), ForeignKey("source_products.id"), nullable=False, index=True)

    title_es = Column(String(500), nullable=True)                  # 西语标题（汉字由后端拦截）
    description_es = Column(Text, nullable=True)                    # 西语详情
    tiktok_category_id = Column(String(32), nullable=True)          # 创建前实时拉类目校验，不依赖本地缓存
    warehouse_id = Column(String(64), nullable=True)

    asset_selection = Column(JSON, default=dict)                    # {"main":[asset_id...],"sku_images":{"sku_code":asset_id}}
    sku_overrides = Column(JSON, default=dict)                      # {"sku_code":{"price_mxn":..,"quantity":..}}
    product_attributes = Column(JSON, default=list)                 # 叶子类目 schema 要求的类目属性

    payload_snapshot = Column(JSON, nullable=True)                  # 最后组装的完整请求体，留痕复现
    check_result = Column(JSON, nullable=True)                      # listing_check 硬校验问题清单
    # editing 编辑中 / check_failed 校验未过 / draft_created 草稿已建 / listed 已上架 / failed 失败
    status = Column(String(20), default="editing", nullable=False, index=True)
    tiktok_product_id = Column(String(32), nullable=True)           # 创建成功回写
    version = Column(Integer, default=0, nullable=False)            # 乐观锁

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShopProduct(Base):
    """TikTok 线上店铺商品（从 Open API 同步的快照，区别于本地货源 SourceProduct）。"""
    __tablename__ = "shop_products"
    __table_args__ = (
        UniqueConstraint("shop_id", "tiktok_product_id", name="uq_shop_tiktok_product"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id = Column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    tiktok_product_id = Column(String(32), nullable=False, index=True)  # 平台数字 ID

    # 刊登链路回链：线上商品由哪个货源 SPU/草稿创建（历史同步数据为空）
    source_product_id = Column(String(36), nullable=True, index=True)
    listing_draft_id = Column(String(36), nullable=True)

    title = Column(String(500), nullable=False)
    status = Column(String(40), nullable=False, index=True)             # ACTIVATE/DRAFT/SELLER_DEACTIVATED 等
    has_draft = Column(Boolean, default=False)
    sku_count = Column(Integer, default=0)

    # 商品详情接口补全的第一张主图（thumb 300x300 用于列表；CDN 长期地址，只对缺图商品拉取）
    main_image_url = Column(String(1000), nullable=True)
    main_image_large_url = Column(String(1000), nullable=True)

    # 商品叶子类目（详情接口 category_chains 提取，西语本地名）
    category_id = Column(String(32), nullable=True, index=True)
    category_name = Column(String(200), nullable=True)
    category_path = Column(String(500), nullable=True)       # 完整类目链，用 / 连接，便于悬浮查看

    # 从 SKU 聚合的价格区间与库存（币种如 MXN；无 SKU 时为空）
    price_currency = Column(String(10), nullable=True)
    min_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    inventory_total = Column(Integer, default=0)

    skus = Column(JSON, default=list)                # SKU 快照（id/seller_sku/price/inventory）
    raw_payload = Column(JSON, nullable=True)        # 接口原始商品数据，供后续详情扩展

    # TikTok 侧时间（秒级时间戳）
    tiktok_create_time = Column(Integer, nullable=True)
    tiktok_update_time = Column(Integer, nullable=True)

    synced_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TikTokCategory(Base):
    """TikTok 官方类目字典（region 级缓存，locale 固定 zh-CN）。

    数据源 GET /product/202309/categories?locale=zh-CN，category_id/parent_id 为
    语言无关的官方数字 ID；商品表 shop_products.category_id 关联本表取中文名。
    """
    __tablename__ = "tiktok_categories"
    __table_args__ = (
        UniqueConstraint("region", "category_id", name="uq_region_category"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    region = Column(String(10), nullable=False, index=True)              # 如 MX，同区域多店铺共享
    category_id = Column(String(32), nullable=False, index=True)         # 官方数字类目 ID
    parent_id = Column(String(32), nullable=True)                        # 官方父 ID，根节点为 "0"
    local_name = Column(String(200), nullable=False)                     # zh-CN 本地名
    is_leaf = Column(Boolean, default=False)
    locale = Column(String(10), nullable=False, default="zh-CN")
    synced_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShopOrder(Base):
    """TikTok 线上订单快照（按订单号 upsert）。

    隐私红线：只存运营所需白名单字段，buyer_email / recipient_address / user_id
    等买家身份与联系方式一律不入库（与 Movae 只读订单实现同口径）。
    """
    __tablename__ = "shop_orders"
    __table_args__ = (
        UniqueConstraint("shop_id", "tiktok_order_id", name="uq_shop_tiktok_order"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id = Column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    tiktok_order_id = Column(String(32), nullable=False, index=True)

    status = Column(String(40), nullable=False, index=True)           # UNPAID/AWAITING_SHIPMENT/IN_TRANSIT/COMPLETED...
    currency = Column(String(10), nullable=True)                      # 如 MXN
    # payment 拆解（字符串金额已转 float；total_amount 为买家实付额）
    total_amount = Column(Float, default=0.0)
    sub_total = Column(Float, nullable=True)
    shipping_fee = Column(Float, nullable=True)
    platform_discount = Column(Float, nullable=True)
    seller_discount = Column(Float, nullable=True)

    item_count = Column(Integer, default=0)
    line_items = Column(JSON, default=list)                           # 白名单商品明细（无买家信息）
    is_cod = Column(Boolean, default=False)                           # 货到付款
    shipping_type = Column(String(40), nullable=True)
    fulfillment_type = Column(String(40), nullable=True)

    # TikTok 侧秒级时间戳
    paid_time = Column(Integer, nullable=True)
    tiktok_create_time = Column(Integer, nullable=True, index=True)
    tiktok_update_time = Column(Integer, nullable=True)

    synced_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(SQLAlchemyBaseUserTableUUID, Base):
    """用户表（fastapi-users 提供 id/email/hashed_password/is_active/is_superuser/is_verified）"""
    __tablename__ = "user"
    created_at = Column(DateTime, default=datetime.utcnow)
