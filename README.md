# Orbital Skill Habitat

> 一个面向太空机器人的"3D 训练场 + 在线学习 + 程序化资产生成"演示系统。在 ISS 轨道场景里收集示范、训练策略、自动生成新任务，并接入 **Tripo3D** 真实文生 3D 接口动态扩展场景资产。

基于 Next.js 15 (App Router) + React Three Fiber + Zustand + Tripo3D Open API 构建，全部状态保存在 Node 进程内存中（适合黑客松/Demo），无需数据库。

---

## 功能概览

### 5 种控制模式

| 模式 | 作用 |
| --- | --- |
| **Manual** | 用 W/A/S/D/Q/E + Space 直接驱动机械臂关节，每次 episode 自动写入示范库 |
| **Replay** | 时间线滑块回放任意一条 episode，用于核对示范质量 |
| **Learn** | 在线 CEM (Cross-Entropy Method) 训练线性策略，SSE 流式推送每个 iteration 的 best fitness 与 reward 曲线 |
| **Auto** | 用已训练好的 policy 在当前任务上自动执行，记录新 episode |
| **Curriculum** | 程序化生成课程任务，按 success rate 自动调整难度，跨任务评估 generalization |

### Tripo3D 真实文生 3D

- `/api/tripo/generate` 直接调用 `https://api.tripo3d.ai/v2/openapi/task` 提交 `text_to_model` 任务
- `/api/tripo/stream/[id]` 通过 **Server-Sent Events** 实时推送进度（progress / status / modelUrl）
- 完成后 GLB 自动加入 Asset Library，一键替换 3D 场景里的目标物体（动态 GLTF 加载）

### 训练 / 评估指标

- 每条 episode 记录 (state, action, reward, terminal)
- 每个 policy 按任务键归档，可在所有任务上 **跨任务评估** 得到 generalization score
- Metrics Dashboard 展示训练曲线、per-task 成功率、最佳 fitness、Episode/Policy 数量

---

## 目录结构

\`\`\`
app/
├── api/
│   ├── tasks/                # 课程任务 CRUD + 程序化生成
│   ├── episodes/             # 示范 + 自动 episode 列表 / 详情
│   ├── policies/             # 策略列表
│   │   ├── train/            # CEM 训练 (SSE)
│   │   └── evaluate/         # 跨任务评估
│   ├── metrics/              # 聚合指标
│   ├── assets/               # 资产库 (Tripo 生成结果)
│   └── tripo/
│       ├── generate/         # 提交 text_to_model 任务
│       └── stream/[id]/      # 进度 SSE
├── page.tsx                  # 主控制台 (3D 场景 + 模式面板 + 资产面板)
├── layout.tsx
├── error.tsx / not-found.tsx
└── globals.css
components/
├── scene/                    # R3F 场景：ISS 轨道、机械臂、目标物
├── modes/                    # 5 个模式面板
├── ui/                       # Button / Card / Tabs / Slider 等原语
├── generation-panel.tsx      # Tripo3D 流式生成 UI + 资产库
├── metrics-panel.tsx         # 训练 / 评估指标
├── task-selector.tsx         # 任务切换
├── mode-switcher.tsx         # 5 模式切换
├── mode-panel.tsx            # 当前模式渲染容器
├── scene-loader.tsx          # 动态 import 3D 场景 (避免 SSR)
└── data-bootstrap.tsx        # 启动时拉取 tasks/policies/episodes
lib/
├── simulator.ts              # 物理模拟（重力 / 阻尼 / 关节 / 抓取 / 奖励）
├── policy.ts                 # 策略表示 + CEM 优化器
├── curriculum.ts             # 课程任务生成 + 难度推进
├── server-store.ts           # Node 进程内内存存储
├── store.ts                  # Zustand 客户端状态机（含 sim tick 驱动）
├── tripo.ts                  # Tripo3D Open API 封装
├── types.ts                  # 全局类型
└── utils.ts                  # cn() 工具
\`\`\`

---

## 快速开始

### 环境变量

| Key | 必填 | 说明 |
| --- | --- | --- |
| `TRIPO_API_KEY` | 是 | Tripo3D Open API key，用于真实文生 3D。可在 [Tripo Platform](https://platform.tripo3d.ai/) 申请 |

在 v0 内点击右上角 **Vars** 添加；本地运行时放进 `.env.local`：

\`\`\`
TRIPO_API_KEY=tsk_xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

### 本地启动

\`\`\`bash
npm install
npm run dev
\`\`\`

打开 http://localhost:3000，左上角选模式 → 中间 3D 场景 → 右侧 Generation / Metrics / Tasks。

### 构建

\`\`\`bash
npm run build
npm start
\`\`\`

---

## 核心原理

### 物理模拟

`lib/simulator.ts` 是确定性的步进式模拟器：

- **状态**：3 个关节角度 + 角速度、夹爪开合、目标物 6-DoF 位姿、抓取标志
- **动作**：6 维向量 (3 关节扭矩 + 夹爪指令 + 末端 ΔX/ΔY 软偏移)
- **每步** 计算正向运动学 → 末端位置 → 与目标距离 → 检测抓取 → 应用重力/阻尼 → 输出 reward (距离衰减 + 抓取奖励 + 到达目标加成 - 能量惩罚)

每个 episode 是一串 `(state, action, reward)`，可被回放、用于训练，也可由 policy 推理自动产生。

### 在线学习 (CEM)

`lib/policy.ts` 把策略表示为线性矩阵 `W ∈ R^{action × state}`：

1. 维护参数分布 `μ, σ`
2. 每个 iteration：从 `N(μ, σ²)` 采样 `populationSize` 个候选 → 在仿真里跑一段 → 计算回报
3. 取 top-K 精英重新拟合 `μ, σ`
4. SSE 把 `iteration / bestFitness / mean reward` 实时推到前端绘制曲线

接口：`POST /api/policies/train` (流式)、`POST /api/policies/evaluate`。

### 课程生成

`lib/curriculum.ts` 根据当前最佳 policy 在已有任务上的成功率生成新任务：

- 成功率高 → 收紧目标半径、增加目标距离、缩短时间预算
- 成功率低 → 放宽参数，避免梯度消失

### Tripo3D 接入

`lib/tripo.ts` 封装两个动作：

\`\`\`ts
submitTextToModel(prompt) → { taskId }   // POST /v2/openapi/task
pollTask(taskId)          → { status, progress, modelUrl? } // GET /v2/openapi/task/:id
\`\`\`

`/api/tripo/stream/[id]` 在 Edge-friendly Node runtime 里以 1.5s 间隔轮询，再把进度以 SSE 形式推给浏览器；模型 URL 拿到后写入 `server-store` 的 Asset Library。前端 `<TargetObject>` 用 `useGLTF` 动态加载，无需重启。

> 注意：API key 在服务端读取时使用了 `.trim()`，避免环境变量末尾换行 / 空格导致 401。

---

## API 速查

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/tasks` | 列出当前课程任务 |
| POST | `/api/tasks` | 由当前 policy 表现生成下一关 |
| GET | `/api/episodes` | 全部 episode（含 mode 标签） |
| GET | `/api/episodes/[id]` | 单条 episode 详情（含完整轨迹） |
| GET | `/api/policies` | 策略列表 |
| POST | `/api/policies/train` | **SSE** 流式训练，body: `{ iterations, populationSize, taskId? }` |
| POST | `/api/policies/evaluate` | 跨任务评估，body: `{ policyId }` |
| GET | `/api/metrics` | 聚合 dashboard 数据 |
| GET | `/api/assets` | Asset Library |
| POST | `/api/tripo/generate` | 提交文生 3D，body: `{ prompt, kind }` |
| GET | `/api/tripo/stream/[id]` | **SSE** 进度流 |

---

## 数据持久化

为了让 Demo 启动即用，全部状态保存在 **Node 进程内存** (`lib/server-store.ts`)。重启服务即清空——这是有意为之。如要持久化，把 `server-store.ts` 替换成 Supabase / Postgres / Redis 适配层即可，业务层 API 不需要改动。

---

## 技术栈

- **Next.js 15** App Router + React 19
- **React Three Fiber** + `@react-three/drei` 渲染 3D 场景与 GLTF
- **Zustand** 客户端状态 + 仿真 tick 驱动
- **Tailwind CSS 3** + 少量 shadcn/ui 风格原语
- **Tripo3D Open API** 真实文生 3D
- **lucide-react** 图标
- TypeScript 全程严格模式

---

## License

仅用于演示与学习。3D 模型来自 Tripo3D 用户生成内容，遵循其[使用条款](https://platform.tripo3d.ai/)。
