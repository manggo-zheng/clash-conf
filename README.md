# Clash 配置覆写脚本

> ⚠️ **免责声明**
> 
> 1. 本项目仅用于**网络技术学习、研究和交流**，请勿用于任何非法用途
> 2. 使用本脚本产生的任何后果由使用者**自行承担**，与项目作者无关
> 3. 请遵守《中华人民共和国网络安全法》及相关法律法规，**合法使用网络**
> 4. 本项目的代码和技术分享不构成任何形式的建议或引导
> 5. 如涉及版权问题，请联系作者删除相关内容

## 📖 项目简介

本项目提供了一系列 Clash 配置覆写脚本（Override Scripts），用于自动化处理代理节点分组、智能测速和规则分流。通过标签系统识别节点属性，自动将节点分配到最优的业务组群，实现智能化的流量管理。

主要目的就是为了访问gemini和copilot，而自带的规则太傻了；

## ✨ 核心特性

- **智能节点识别**：基于节点名称和类型自动打标签（地区、倍率、稳定性、用途等）
- **自动测速选优**：使用 `url-test` 策略自动选择延迟最低的节点
- **业务分流**：针对 AI、视频、下载、开发等不同场景优化路由规则
- **配置驱动**：所有规则、标签、分组策略均可通过配置文件维护，无需修改核心逻辑
- **容错回退**：节点池为空时自动回退到其他可用池，确保配置始终可用
- **连接日志记录**：提供 Python 脚本监听 Clash API，自动记录连接信息和日志到 SQLite 数据库

## 📦 版本说明

本项目采用语义化版本号（Semantic Versioning）命名：

### v2.3.0 (conf_v2.3.0.js) - 最新版 ⭐
- **架构**：节点池与业务组分离设计（v2.2.0 架构优化版）
- **新增**：AI 节点池使用独立的测速目标（gstatic.com），避免触发 AI 服务风控
- **适用场景**：长期使用，需要精细化分流且关注 AI 服务稳定性的场景

### v2.2.0 (conf_v2.2.0.js)
- **架构**：节点池与业务组分离设计
- **特性**：
  - 完善的标签系统（地区、倍率、稳定性、带宽、用途）
  - 详细的业务规则配置（AI、视频、下载、拦截、国内）
  - 支持 GEOSITE/GEOIP 规则集
  - 异常处理机制，防止规则加载失败导致中断
- **适用场景**：长期使用，需要精细化分流的场景

### v2.1.0 (conf_v2.1.0.js)
- **架构**：引入节点组群与业务组群分离
- **特性**：
  - 节点组群负责自动测速
  - 业务组群负责规则落地和手动切换
  - 支持灵活的 defaults 配置
- **适用场景**：需要清晰区分测速池和业务组的场景

### v2.0.0 (conf_v2.0.0.js)
- **架构**：标签系统重构版
- **特性**：
  - 从硬编码改为配置驱动的标签池
  - 统一的 TAG_RULES 配置区
  - 简化的评分排序逻辑
- **适用场景**：追求代码可维护性的场景

### v1.1.0 (conf_v1.1.0.js)
- **架构**：评分系统增强版
- **特性**：
  - 复杂的多维度评分算法（scoreAI, scoreGeneral 等）
  - 精细的节点排序逻辑
  - 基于地区优先级的节点选择
- **适用场景**：需要对节点进行精细排序的场景

### v1.0.0 (conf_v1.0.0.js)
- **架构**：初始基础版
- **特性**：
  - 基础的节点分析功能
  - 简单的过滤和分组逻辑
  - 硬编码的规则配置
- **适用场景**：快速原型验证或简单场景

## 🚀 使用方法

### 1. 选择脚本版本

根据你的需求选择合适的脚本版本（推荐使用最新的 `conf_v2.3.0.js`）。

### 2. 配置覆写

在 Clash 客户端（如 Clash for Windows、Clash Verge、FlClash 等）中：

1. 导入你的订阅链接
2. 在"覆写"或"Script"选项中启用 JavaScript 覆写
3. 将选定的脚本内容粘贴到覆写编辑器中
4. 保存并重新加载配置

### 3. 自定义配置

#### 💡 设计理念

传统 Clash 配置的痛点：
- **规则僵化**：硬编码的域名列表难以维护，新增服务需要手动添加规则
- **节点选择盲目**：无法根据节点特性（地区、稳定性、用途）智能分流
- **GEOSITE 依赖**：内置规则库更新滞后，新出现的 AI 服务无法及时覆盖

本脚本的核心思路：**「标签驱动 + 配置分离」**

1. **标签系统**：从节点名称中提取特征（如"美国"、"VIP"、"AI专用"），为每个节点打上多维标签
2. **策略抽象**：规则层只关心业务策略（如 `POLICY_AI`），不直接绑定具体代理组
3. **动态映射**：通过 `POLICY_TARGET` 将策略映射到实际的业务组，实现灵活切换
4. **配置驱动**：所有规则、标签、分组逻辑都在顶部配置区，修改无需触碰核心代码

#### 📊 核心数据结构详解

##### (1) TAG_RULES - 节点标签规则

```javascript
const TAG_RULES = {
    name: [
        { 
            tag: "地区:美国",                    // 标签名（后续分组时使用）
            keywords: ["美国", "US", "USA", "🇺🇸"]  // 匹配关键词（支持中文/英文/emoji）
        },
        { 
            tag: "稳定:高", 
            keywords: ["VIP", "移动友好", "专用", "专线"]  // 命中任一关键词即打标
        }
    ],
    type: [
        { 
            tag: "带宽:高", 
            values: ["hysteria", "hysteria2"]  // 根据节点协议类型打标
        }
    ]
};
```

**工作原理**：
- 遍历所有节点，检查节点名称是否包含 `keywords` 中的任意关键词
- 如果命中，为该节点添加对应的 `tag`
- 一个节点可以拥有多个标签（如同时是"地区:美国"和"稳定:高"）
- 未命中的节点会获得默认标签（如"地区:其他"、"用途:通用"）

**使用场景**：
- 机场改名后，只需在 `keywords` 数组中添加新名称
- 新增标签维度（如"倍率:极低"），直接在数组中添加新规则

##### (2) NODE_GROUP_RULES - 节点池分组规则

```javascript
const NODE_GROUP_RULES = [
    {
        key: "nodeAI",                              // 内部标识符
        name: GROUP_NAME.nodeAI,                    // 前端显示的组名（如"🧠 AI 专用节点"）
        includeTags: ["全部节点"],                  // 必须包含的标签（AND 逻辑）
        excludeTags: ["用途:下载", "稳定:低"],      // 不能包含的标签（NOT 逻辑）
        preferTags: ["用途:AI", "稳定:高"],         // 排序优先级（越靠前权重越高）
        fallbackKeys: ["nodeGeneral", "all"]        // 本池为空时的回退顺序
    }
];
```

**筛选流程**：
1. **包含过滤**：节点必须拥有 `includeTags` 中的所有标签
2. **排除过滤**：节点不能拥有 `excludeTags` 中的任意标签
3. **排序**：根据 `preferTags` 计算得分，优先展示高匹配度节点
4. **回退**：如果筛选结果为空，依次尝试 `fallbackKeys` 指定的其他池

**示例**：
- AI 节点池要求：排除香港/台湾节点（避免延迟高）、排除低倍率节点（保证质量）
- 视频节点池要求：必须是"倍率:低"节点（省钱）、排除游戏节点（避免占用带宽）

##### (3) BUSINESS_GROUP_RULES - 业务组配置

```javascript
const BUSINESS_GROUP_RULES = [
    {
        key: "bizAI",
        name: GROUP_NAME.bizAI,                     // 前端显示名（如"🤖 AI"）
        type: "select",                             // 组类型（select=手动切换，url-test=自动测速）
        defaults: [
            GROUP_NAME.nodeAI,                      // 首选：AI 专用节点池（自动测速）
            GROUP_NAME.nodeGeneral,                 // 备选：通用海外节点
            "DIRECT"                                // 兜底：直连
        ]
    }
];
```

**作用**：
- 这是用户在前端看到的可切换组
- `defaults` 定义了可选的下拉选项，按推荐程度排序
- 用户可以手动切换到其他节点池或 DIRECT

##### (4) RULE_SECTIONS - 业务规则配置

```javascript
const RULE_SECTIONS = {
    [POLICY.AI]: [  // POLICY.AI 是策略标识符，不直接写组名
        { type: "DOMAIN-SUFFIX", value: "openai.com" },
        { type: "DOMAIN-KEYWORD", value: "gemini" },
        { type: "GEOSITE", value: "category-ai-!cn" }  // 规则集兜底
    ]
};
```

**规则类型说明**：
- `DOMAIN`：精确匹配完整域名（如 `gemini.google.com`）
- `DOMAIN-SUFFIX`：匹配域名后缀（如 `openai.com` 匹配 `api.openai.com`）
- `DOMAIN-KEYWORD`：匹配包含关键词的域名（如 `gemini` 匹配 `gemini.google.com`）
- `GEOSITE`：使用预定义的规则集（需客户端内置 geosite.dat）
- `IP-CIDR` / `GEOIP`：基于 IP 地址的规则

**映射关系**：
```javascript
POLICY_TARGET[POLICY.AI] → GROUP_NAME.bizAI → 用户可选择 nodeAI/nodeGeneral/DIRECT
```

#### 🔧 实际配置示例

**场景 1：添加新的 AI 服务**

```javascript
// 在 RULE_SECTIONS[POLICY.AI] 中添加
{ type: "DOMAIN-SUFFIX", value: "kimi.moonshot.cn" },  // Kimi 智能助手
{ type: "DOMAIN-SUFFIX", value: "yi.ai" },              // 月之暗面
```

**场景 2：新增节点标签维度**

```javascript
// 在 TAG_RULES.name 中添加
{ 
    tag: "线路:IEPL", 
    keywords: ["IEPL", "iplc", "专线"] 
}
```

**场景 3：调整 AI 节点池筛选条件**

```javascript
// 修改 NODE_GROUP_RULES 中 nodeAI 的配置
{
    key: "nodeAI",
    excludeTags: [
        "用途:下载", 
        "稳定:低", 
        "倍率:低",
        "地区:香港",   // 新增：排除香港节点
        "地区:台湾"    // 新增：排除台湾节点
    ],
    preferTags: [
        "用途:AI",     // 最高优先级：明确标注 AI 专用的节点
        "稳定:高",     // 其次：VIP/专线节点
        "地区:美国"    // 再次：美国节点（延迟相对较低）
    ]
}
```

**场景 4：为特定业务创建独立节点池**

```javascript
// 在 NODE_GROUP_RULES 中添加新规则
{
    key: "nodeGame",
    name: "🎮 游戏节点池",
    includeTags: ["全部节点"],
    excludeTags: ["用途:AI", "用途:下载"],
    preferTags: ["用途:游戏", "稳定:高", "地区:日本", "地区:韩国"],
    fallbackKeys: ["nodeFallback", "all"]
}

// 在 BUSINESS_GROUP_RULES 中添加对应业务组
{
    key: "bizGame",
    name: "🎮 游戏加速",
    type: "select",
    defaults: [GROUP_NAME.nodeGame, GROUP_NAME.nodeFallback, "DIRECT"]
}

// 在 POLICY 和 POLICY_TARGET 中添加映射
const POLICY = {
    // ... 其他策略
    GAME: "POLICY_GAME"
};

const POLICY_TARGET = {
    // ... 其他映射
    [POLICY.GAME]: GROUP_NAME.bizGame
};
```

## 📋 默认业务策略说明

| 策略名 | 说明 | 默认目标 |
|--------|------|----------|
| POLICY_AI | AI 服务（ChatGPT、Claude、Gemini 等） | 🤖 AI 专用节点 |
| POLICY_VIDEO | 视频流媒体（YouTube、Netflix、TikTok 等） | 🎬 视频节点池 |
| POLICY_DOWNLOAD | 下载/P2P（BT、Torrent、PT 等） | 💾 下载节点池 |
| POLICY_DEV | 开发/学术（GitHub、StackOverflow 等） | 🌏 海外节点 |
| POLICY_BLOCK | 广告/追踪器拦截 | 🚫 拦截 |
| POLICY_CN | 中国大陆直连 | 🚀 直连 |
| POLICY_DEFAULT | 兜底规则 | 🛡️ 兜底节点池 |

## 🏷️ 标签系统

脚本会自动为节点打上以下标签：

- **地区标签**：地区:美国、地区:日本、地区:新加坡等
- **倍率标签**：倍率:低（0.5倍）、倍率:常规
- **稳定性标签**：稳定:高（VIP/专线）、稳定:低（测试节点）、稳定:未知
- **带宽标签**：带宽:高（Hysteria/Hysteria2）、带宽:常规
- **用途标签**：用途:AI、用途:下载、用途:游戏、用途:开发、用途:通用

## 📝 注意事项

1. **GEOSITE 规则**：部分 GEOSITE 值可能不在你的 geosite.dat 文件中，脚本已添加异常处理，会在控制台输出警告
2. **节点命名**：确保机场节点名称包含关键词（如"美国"、"VIP"、"AI专用"等），以便正确识别
3. **规则顺序**：规则按 `RULE_ORDER` 数组顺序生效，优先级从高到低
4. **兼容性**：仅支持支持 JavaScript 覆写的 Clash 客户端

## 📊 连接日志记录工具

项目提供了 `src/log/` 目录下的日志记录工具，用于监控和记录 Clash 的连接信息。

### 功能特性

- **实时监听**：通过 WebSocket 监听 Clash API 的连接和日志流
- **SQLite 存储**：将所有连接信息和日志写入 SQLite 数据库，便于后续分析
- **单例保护**：使用 Windows Mutex 和锁文件机制，确保全局只有一个实例运行
- **后台运行**：支持以隐藏窗口模式运行，不干扰日常使用
- **自动重连**：WebSocket 断开后自动重连，保证数据完整性
- **可扩展性**：支持改造为云数据库方案，添加设备 ID 字段即可实现团队级流量监控与分析

### 文件说明

#### clash_logger.py

核心的日志记录器，主要功能：

1. **连接监控**：每 2 秒轮询 `/connections` API，捕获活跃连接和已关闭连接
2. **日志监听**：通过 WebSocket 订阅 `/logs` 端点，实时记录 Clash 日志
3. **数据存储**：
   - `connections` 表：记录连接的完整信息（源/目标 IP、端口、进程、规则链、流量等）
   - `logs` 表：记录 Clash 的运行日志（时间、类型、内容）
4. **优雅退出**：Ctrl+C 停止时自动保存所有活跃连接的关闭时间

**依赖安装**：
```bash
pip install websockets aiohttp
```

#### run.ps1

Windows PowerShell 启动脚本，提供：

1. **重复运行检测**：通过锁文件检查是否已有实例在运行
2. **进程验证**：检查锁文件中 PID 对应的进程是否存活
3. **自动清理**：检测到过期锁文件时自动清理
4. **隐藏窗口**：使用 `pythonw.exe` 以无窗口模式运行
5. **友好提示**：显示启动状态和数据库路径

**使用方法**：
```powershell
# 直接运行
.\run.ps1

# 或在 PowerShell 中执行
powershell -ExecutionPolicy Bypass -File run.ps1
```

### 数据库结构

#### connections 表

| 字段 | 说明 |
|------|------|
| id | 连接唯一标识 |
| network | 网络类型（tcp/udp） |
| type | 连接类型 |
| host | 目标域名 |
| destinationIP | 目标 IP |
| destinationPort | 目标端口 |
| sourceIP | 源 IP |
| sourcePort | 源端口 |
| process | 发起进程的进程名 |
| processPath | 进程完整路径 |
| remoteDestination | 远程目标地址 |
| upload | 上传流量（字节） |
| download | 下载流量（字节） |
| start_time | 连接开始时间 |
| close_time | 连接关闭时间 |
| duration_s | 连接持续时间（秒） |
| chains | 代理链（JSON 数组） |
| rule | 匹配的规则 |
| rulePayload | 规则负载 |
| inboundName | 入站名称 |

#### logs 表

| 字段 | 说明 |
|------|------|
| id | 自增主键 |
| time | 日志时间 |
| type | 日志类型（info/warning/error/debug） |
| payload | 日志内容 |

### 使用场景

1. **流量分析**：统计各应用的流量使用情况
2. **规则调试**：查看哪些连接匹配了哪些规则
3. **异常排查**：通过日志定位连接失败原因
4. **性能优化**：分析连接持续时间和流量分布
5. **审计记录**：保留完整的网络连接历史

### 注意事项

1. **Clash API 配置**：确保 Clash 客户端开启了 External Controller（默认端口 9090）
2. **数据库路径**：如需修改数据库位置，编辑 `clash_logger.py` 中的 `DB_PATH` 常量
3. **FlClash 兼容**：默认配置针对 FlClash 客户端，其他客户端可能需要调整路径
4. **权限要求**：首次运行可能需要管理员权限访问 Clash API
5. **资源占用**：长时间运行会累积大量数据，建议定期清理或归档旧数据

### 数据查询示例

```sql
-- 查看最近 10 条连接记录
SELECT * FROM connections ORDER BY start_time DESC LIMIT 10;

-- 统计某进程的总流量
SELECT process, SUM(upload + download) as total_bytes 
FROM connections 
GROUP BY process 
ORDER BY total_bytes DESC;

-- 查找访问特定域名的连接
SELECT * FROM connections WHERE host LIKE '%openai.com%';

-- 查看错误日志
SELECT * FROM logs WHERE type = 'error' ORDER BY time DESC;
```

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进脚本！

🤗 使用的时候请在覆写脚本命名前加上前缀`manggo` 🤗

## 📄 许可证

本项目仅供学习和个人使用。

---

**提示**：如果你刚开始使用，建议从 `conf_v2.3.0.js` 开始，它提供了最完善的功能和最友好的配置方式，并针对 AI 服务进行了专项优化。
