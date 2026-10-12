# Offer 牌桌

一个像素牌桌风格的 Offer 比较计算器，使用 React 和 Vite。支持最多四份 Offer：年收入、税费、个人五险一金、权益兑现折扣及加权工时共同决定等效税后时薪。起始的两份 Offer 为虚构、可编辑示例。

在线地址：https://justinwcola.github.io/offer_calculator/

## 网页发布

推送到 `main` 或手动运行 `Deploy GitHub Pages` 工作流，会执行计算测试、生产构建并部署 `dist/` 到 GitHub Pages。仓库的 Settings → Pages 需要将 Source 设置为 GitHub Actions。构建使用相对资源路径，支持仓库子路径访问。

云环境重启后开发服务器需要重新启动；在线网页独立于开发服务器运行。

## 开发

需要 Node.js 22.12 以上（此云环境已验证 Node.js 24.19.0、npm 11.9.0）。

```sh
cd /workspace/offer_calculator
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run dev
```

开发服务器端口为 5173，监听所有接口并严格检查端口冲突。仓库内不需要数据库、后端服务、环境变量或密钥。依赖与构建产物保存在 `node_modules/`、`dist/`；服务进程在新任务中需重新启动。

本地其他位置开发时，进入实际 checkout 目录，使用 `npm ci` 安装即可，不必指定云环境的缓存路径。

```sh
npm test       # Node 内置测试：税率边界、已知结果、缴费、工时、非法输入
npm run build # 生成 dist/ 静态文件
npm run preview # 启动生产构建的本地验证服务器，端口 4173
```

## 使用

- 在牌面直接修改收入、工作日工时及城市，结果即时更新。
- 点击「打出这张牌」或左侧排名，选择本手计分的 Offer；蓝色底数 × 红色倍率等于等效税后时薪。
- 点击时间、成长、生活、兑现或税费系数牌，直接展开并定位对应参数。
- 展开「小丑牌」调整补贴、奖金/股权兑现系数、计税模式、缴费上下限、周末工时与偏好。
- 按等效税后时薪自动排序；有非法或缺失输入的 Offer 显示错误并退出排名。
- 可以新增、复制或移除手牌，保留至少一份；「恢复示例手牌」会替换当前输入。
- 参数仅保存在当前浏览器的 localStorage，不上传到服务器。「导出比较战绩」下载文本摘要。

## 计算方法与限制

计算模块来自 [sherry-roar 的 Offer 等效薪资计算器](https://sherry-roar.github.io/offer-calculate/)，保留原始计算规则。源码位于其 [GitHub Pages 仓库](https://github.com/sherry-roar/sherry-roar.github.io/tree/main/offer-calculate)，来源及 MIT 授权全文见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

```text
折算税后价值 = 各项收入按兑现比例折算之和 − 名义收入对应税费 − 个人五险一金
加权周工时 = 正常工作日工时 + 1.5 × 工作日超出8小时的工时 + 2 × 周末工时
税后855等效 = 折算税后价值 × 成长系数 × 生活偏好系数 × 40 ÷ 加权周工时
等效税后时薪 = 税后855等效 ÷ 2080
```

税后价值包含权益与福利，不等同于现金到账；全年按 52 周比较，没有单独计算假期和通勤。签字费为本年一次性收入。股权单独计税需满足适用政策条件。北京使用 2025 年社保及 2025–2026 年度公积金历史参数，其他城市只提供比例示例，需要自行确认缴费基数上下限。分档为参考项目的娱乐性比较标签。

界面采用灰色游戏 HUD、蓝色 Chips × 红色 Mult、计分动效、中文像素字体和可交互的系数牌。检索参考、设计说明及数值映射见 [DESIGN.md](DESIGN.md)。像素图标和牌桌背景为原创，Cubic 11 字体完整许可随仓库分发。
