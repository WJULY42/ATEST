# ATEST
这是一个 无人深空 项目。
总体建议

建议使用 Three.js + 原生 JavaScript ES Modules + CSS，做多文件模块化项目，不强行单文件。

建议通过 Vite 或任意静态服务器运行，也可以用 importmap 从 CDN 加载 Three.js。

建议所有纹理、天空、星云、行星表面、UI 图标都用 Canvas 程序化生成，不依赖外部图片或模型。

建议整体风格走低多边形、霓虹科幻、深空冷色调，配合少量高饱和强调色。

项目结构建议

index.html：入口页面。

src/main.js：启动游戏。

src/style.css：全局样式与 UI。

src/core：Game、Input、Loop、SceneManager。

src/world：Universe、GalaxyGenerator、PlanetGenerator、Terrain、Biome、Weather、DayNight、SpaceStation、Ruins。

src/entities：Ship、Player、Creature、Asteroid。

src/systems：FlightSystem、LandingSystem、ScanSystem、ResourceSystem、InventorySystem、QuestSystem、WarpSystem、SaveSystem。

src/ui：HUD、Menu、StarMap、InventoryUI、Notifications。

src/audio：AudioEngine。

src/utils：SeedRandom、Noise、Pool、MathUtils。

核心系统建议

建议用种子随机数驱动整个宇宙，保证同一 seed 可复现同一星系。

建议星系、行星、卫星、小行星、空间站、遗迹、生物都程序化生成。

建议每个星球拥有独立参数：地形、颜色、大气、重力、资源、天气、昼夜。

建议使用区块或 LOD 思路处理行星地表，避免一次性生成过多几何体。

建议对象池管理小行星、粒子、子弹、采集物、通知，减少频繁创建销毁。

建议加入性能自适应，根据帧率动态降低阴影、粒子、植被密度和绘制距离。

玩法建议

建议太空飞行支持鼠标转向、WASD/方向键、Shift 加速、空格上升、Ctrl 下降。

建议接近星球后按 G 着陆，切换到第一人称地表探索。

建议地表支持奔跑、跳跃、喷射背包、扫描、采集资源、补充燃料/氧气/生命。

建议按 M 打开星图，选择目标星球并进行跃迁。

建议按 Tab 打开背包，按 E 交互，按 F 扫描，按 C 切换视角。

建议加入任务系统，例如探索星球、扫描生物、采集资源、修复飞船、抵达坐标。

HUD 与 UI 建议

建议 HUD 显示速度、高度、燃料、氧气、生命、护盾、坐标、目标、任务、通知、准星、罗盘。

建议开始界面包含新游戏、继续、设置、种子输入。

建议暂停界面包含继续、设置、保存、返回主菜单。

建议死亡后提供重生点选择或最近空间站复活。

建议用 localStorage 保存种子、位置、资源、任务、飞船状态和设置。

视觉与音效建议

建议加入星云、星空、行星环、大气辉光、体积光、粒子、尾焰、扫描波纹、昼夜循环、动态天空。

建议飞船引擎、扫描、跃迁、采集、UI 点击都用 WebAudio 合成音效。

建议扫描时出现波纹和轮廓高亮，采集时出现粒子反馈，跃迁时出现拉伸星空效果。

开发顺序建议

先搭 Three.js 场景、相机、渲染循环、输入系统。

再做太空飞行、飞船控制、HUD。

然后做程序化星系与行星。

接着做着陆、地表探索、资源采集。

再加入星图、跃迁、任务、背包。

最后补视觉特效、音效、存档、性能优化和移动端触控。

## 部署（GitHub Pages）

推送到 `main` 分支后，GitHub Actions（`.github/workflows/deploy.yml`）会自动执行 `npm run build` 并发布到 Pages。
`vite.config.js` 会检测 Pages 构建环境并自动设置 `base = /<仓库名>/`，本地开发不受影响。

仓库设置：Settings → Pages → **Build and deployment** → Source 选择 **GitHub Actions**。

本地预览生产构建：`npm run build && npm run preview`。
