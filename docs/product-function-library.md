# 商品功能词库

共享资源 → 商品功能词库，地址 `/product-functions`。所有店铺共用当前账号词库，不跨账号共享。

手动选类目、填写市场和范围，复制Skill执行指令交给Codex。此按钮不会直接启动代理或定时采集。Skill为本机 `product-function-learning`；学习完成通过POST `/api/product-functions/runs`合并，也可导入JSON。每个词必须有来源平台、商品标题、链接及原文摘录；同任务ID重复提交不重复写入，新任务增量合并保留旧词和来源。GET `/api/product-functions`回读。

商品创建页面按货源category_name与词库category精确匹配，使用同一类目名称（例如女士文胸）；选中后保存到当前商品设置。无匹配学习词时不将别的类目词混进来。请求失败显示错误，不代表采集已完成。

后端新增product_function_libraries账号级表，启动create_all建表，不重置旧数据。当前尚未采集真实学习结果。接口已部署，数据库已备份；隔离数据库验证重复任务、读后写入与账号隔离，前端验证类目可选择及已登录空词库读取。
