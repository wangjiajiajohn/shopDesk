# OpenAI接入（2026-11-13）

使用后端已有环境配置OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_DEFAULT_MODEL，不读取或返回密钥给浏览器。保留现有模型配置gpt-4o-mini，未擅自升级模型。未安装新依赖。

新增已登录用户接口GET /api/ai/status（仅报告配置，不声称连接成功）、POST /api/ai/responses（text、最多10个HTTPS image_urls、max_output_tokens）。现有/chat也增加登录要求。Responses请求store=false，返回文字、模型和令牌用量，非完整响应拒绝当成功；新接口上游错误转换为简短提示，不透传原始响应。

本机使用已有密钥GET官方/models成功，极小Responses真实调用成功：14输入+2输出=16令牌。仅测试联通，未生成商品素材。另有3项离线MockTransport测试验证请求路径、图片输入、store=false、用量、非完整响应和HTTP错误。

服务器已部署代码，但直连api.openai.com失败，socket网络检查OSError101；尚未解决其网络连通性。不能报告服务器AI可用，不能启动批量任务。官方额度是否绑定现有密钥所属组织、剩余额度、结算归属均未验证。未运行生图、商品创建或TikTok发布。

官方资料：
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/chatgpt-api-credits
