# 赛博上香 (Cyber Incense) — Spec

## 1. Concept & Vision

一个赛博朋克风格的上香祈福 web app。用户可以注册登录，在虚拟香炉前"点燃"电子香，为自己或他人祈福。界面融合霓虹灯光、故障艺术（glitch art）、和东方神秘元素，营造出一种"数字香火、灵魂超度"的氛围。

不是普通的"许愿树"克隆——它有一种诡异的仪式感，像是在赛博空间里进行某种古老的灵魂交易。

## 2. Design Language

### 色彩
- 主背景：`#0a0a0f`（深渊黑）
- 次背景：`#12121a`（暗紫黑）
- 主色：`#ff2d6a`（霓虹粉，模拟霓虹灯管）
- 辅色：`#00f0ff`（电光青）
- 金色点缀：`#ffd700`（电子香火光）
- 文字：`#e0e0e0`（冷白）
- 暗文字：`#6a6a7a`（灰紫）

### 字体
- 标题：Orbitron（Google Font）— 科技感、几何感
- 正文：Noto Sans SC — 中文清晰可读
- 代码/计数：JetBrains Mono — 数字显示

### 动效哲学
- 香火焰持续动画（CSS + Canvas）
- 点击"上香"时的 glitch 效果
- 页面切换时的故障扫描线
- 悬浮时的霓虹 glow

### 视觉元素
- ASCII/Unicode 香炉图案作为 logo
- 扫描线叠加层（scanlines overlay）
- 霓虹发光边框
- 故障艺术的分隔线

## 3. Layout & Structure

```
/ (首页)
├── Hero: 动态香炉动画 + 标语
├── CTA: 登录/注册按钮
└── 近期香火展示（匿名）

/burn (上香页，需登录)
├── 香炉互动区（点击点燃香）
├── 香型选择（事业/爱情/健康/学业）
├── 祈愿文输入
└── 贡献者排行榜（本周）

/me (个人中心，需登录)
├── 我的香火记录
├── 成就系统（首次上香、上香10次等）
└── 注销按钮

/auth (登录/注册页)
├── Tab 切换：登录 / 注册
└── 表单
```

## 4. Features & Interactions

### 认证
- **注册**：用户名、邮箱、密码 → 创建用户，返回 JWT token
- **登录**：邮箱 + 密码 → 返回 JWT token，存入 HttpOnly Cookie
- **登出**：清除 Cookie
- 密码用 bcrypt 加密存储

### 上香流程
1. 选择香型（4选1，对应不同图标和颜色）
2. 输入祈愿文（最多 100 字）
3. 点击"点燃"按钮
4. 动画：香点燃 → 烟雾上升 → 祈愿飘向虚空
5. 记录写入 D1，贡献到排行榜

### 数据模型

**users**
```sql
id          TEXT PRIMARY KEY  -- crypto.randomUUID()
username    TEXT NOT NULL UNIQUE
email       TEXT NOT NULL UNIQUE
password    TEXT NOT NULL     -- bcrypt hash
created_at  INTEGER           -- unix timestamp
```

**incense_logs**
```sql
id          TEXT PRIMARY KEY
user_id     TEXT NOT NULL REFERENCES users(id)
type        TEXT NOT NULL     -- career/love/health/study
wish        TEXT NOT NULL     -- max 100 chars
created_at  INTEGER
```

### 排行榜
- 本周上香次数最多的用户（前10名）
- 显示用户名（脱敏）和次数

### 成就系统
- `first_incense`: 首次上香
- `incense_10`: 上香满10次
- `incense_50`: 上香满50次

## 5. Component Inventory

### NavBar
- 左侧：ASCII 香炉 logo + "赛博上香"
- 右侧：登录前显示"登录/注册"，登录后显示用户名 + "个人中心"
- 背景：半透明黑色，backdrop-blur

### IncenseButton
- 默认：霓虹边框，hover 时发光增强
- Loading：边框闪烁动画
- Disabled：灰暗，无 glow

### WishCard
- 显示香型图标、祈愿文、时间
- 轻微玻璃拟态背景

### GlitchText
- 标题文字，hover 时触发 glitch 效果（CSS clip-path + transform）

## 6. Technical Approach

### 架构
- **Backend**: Cloudflare Workers（TypeScript）
- **Frontend**: 单页 HTML + 内联 CSS/JS（无框架，keep it simple）
- **Database**: Cloudflare D1（SQLite）
- **Auth**: JWT（jose 库）存在 HttpOnly Cookie

### 项目结构
```
cyber-incense/
├── src/
│   ├── index.ts           # 入口，路由分发
│   ├── auth.ts            # 认证相关逻辑
│   ├── incense.ts         # 上香 API
│   ├── db.ts              # D1 初始化
│   └── types.ts           # 类型定义
├── public/
│   ├── index.html         # 首页
│   ├── burn.html           # 上香页
│   ├── me.html             # 个人中心
│   ├── auth.html           # 登录注册页
│   └── style.css          # 共享样式
├── migrations/
│   └── 001_init.sql        # 建表脚本
├── wrangler.toml
└── package.json
```

### API 端点
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 获取当前用户
- `POST /api/incense` — 上香
- `GET /api/incense/leaderboard` — 排行榜
- `GET /api/incense/my` — 我的记录（需登录）

### 部署
- `wrangler d1 create cyber-incense` 创建 D1 数据库
- `wrangler deploy` 部署 Workers
- 环境变量：`AUTH_SECRET`（JWT 密钥）