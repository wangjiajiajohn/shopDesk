// 店铺注册人结构化资料（迁移自 Movae ShopRegistrant.tsx 硬编码常量）
// 来源：MARTINEZESPINOZA 文件夹的证件正面及 SAT 文件，本地资料不在线更新

export const REGISTRANT_HEADER = {
  title: '店铺注册人',
  subtitle: 'MARTINEZESPINOZA · 注册资料',
};

// 身份信息：来源证件正面及 SAT 文件
export const IDENTITY_FIELDS = [
  ['姓名', 'MARIO LEONARDO MARTINEZ ESPINOZA'],
  ['名字', 'MARIO LEONARDO'],
  ['父姓 / 母姓', 'MARTINEZ / ESPINOZA'],
  ['出生日期', '1995-06-27'],
  ['性别（证件记载）', 'H'],
  ['CURP', 'MAEM950627HNLRSR07'],
  ['选民编号', 'MRESMR95062719H700'],
  ['证件签发 / 有效年份', '2018 / 2028'],
  ['登记年份', '2013 02'],
  ['州 / 市 / 地区 / 分区', '19 / 006 / 0001 / 2209'],
  ['地址', 'CHIHUAHUA 126, FRACCIONAMIENTO SAN ANDRES, CIUDAD APODACA, NUEVO LEON, 66640'],
];

// 税务信息：来源 SAT.pdf，签发于 2022-07-12
export const TAX_FIELDS = [
  ['RFC', 'MAEM950627D17'],
  ['idCIF', '21060017842'],
  ['文件名称', 'CONSTANCIA DE SITUACIÓN FISCAL'],
  ['签发地点 / 日期', 'APODACA, NUEVO LEON · 2022-07-12'],
  ['登记状态（文件记载）', 'ACTIVO'],
  ['开始经营 / 状态变更日期', '2014-03-20'],
  ['经济活动 / 比例', 'Asalariado（受薪人员） / 100%'],
  ['税制', 'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios'],
  ['税制起始日期', '2014-03-20'],
  ['申报义务', 'Declaración anual de ISR. Personas Físicas.'],
  ['文件记载截止时间', '次年 4 月 30 日前'],
  ['义务起始日期', '2016-01-01'],
  ['街道类型 / 名称 / 门牌号', 'CALLE / CHIHUAHUA / 126'],
  ['社区 / 城市 / 州 / 邮编', 'FRACCIONAMIENTO SAN ANDRES / APODACA / NUEVO LEON / 66640'],
  ['交叉街道', 'FRONTERA NORTE / CHIHUAHUA'],
  ['商业名称、室号、电话、税务邮箱', '文件未填写'],
];
