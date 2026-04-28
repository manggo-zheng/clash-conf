# Clash JS 覆写脚本需求说明书v1

## 一、项目背景

当前使用机场订阅配置作为 Clash 节点来源，但订阅本身存在以下问题：

1. 节点名称、数量、地区分布会动态变化。
2. 订阅自带的业务分组命名不稳定，且语义不准确。
3. 现有分流规则与代理组强耦合，规则行为容易随订阅变化漂移。
4. AI、视频、普通海外、下载等流量没有形成稳定隔离。
5. 同类业务流量可能在不同时间命中不同类型节点，导致：
   - 访问失败
   - 风控触发
   - 延迟波动
   - 吞吐不稳定

因此，需要通过 **Flash 软件中的 JS 覆写脚本**，对订阅配置进行二次加工，构建一套**完全替换原有业务分组和规则**的调度体系。

---

## 二、目标

本项目目标是实现一个基于 JS 的 Clash 配置覆写脚本，满足以下要求：

1. **完全替换原有业务分组与业务规则**
   - 不迁移、不复用订阅自带业务分组。
   - 订阅仅作为“节点池”来源使用。

2. **分离“流量分类”与“节点调度”**
   - 流量分类负责判断请求属于哪类业务。
   - 节点调度负责从节点池中选出合适节点。

3. **提升规则稳定性**
   - 订阅更新后，业务规则结构不变。
   - 只要节点命名规律未完全失真，调度逻辑仍可持续工作。

4. **提升可控性**
   - 每一类流量都有明确出口路径。
   - 规则优先级可解释。
   - 节点选择依据可解释。

5. **支持后续扩展**
   - 后续可增补 DEV / GAME / STREAM 等策略。
   - 后续可加入日志分析闭环，但不属于本期强制交付。

---

## 三、运行环境与输入输出约束

### 3.1 运行环境

脚本运行于 Windows 电脑上的 Flash 软件中，脚本入口形式如下：

```javascript
const main = (config) => {
  return config;
}
```

### 3.2 输入

输入对象为订阅解析后的 Clash 配置对象 `config`，至少包含：

- `proxies`
- `proxy-groups`
- `rules`
- 其他 Clash 配置字段

### 3.3 输出

输出对象仍为合法的 Clash 配置对象。

脚本必须对 `config` 进行覆写，输出新的：

- `proxy-groups`
- `rules`

必要时可补充或调整以下字段：

- `mode`
- `log-level`
- `dns`
- 其他与规则执行直接相关的配置

### 3.4 本期限制

本期脚本只负责：

1. 基于订阅节点构建新分组
2. 基于预定义规则生成新规则
3. 删除或覆盖原有业务分组与业务规则

本期脚本不负责：

1. 实时测速
2. 在线质量评分
3. UI 展示
4. 日志分析导出 Excel
5. 自动修改远端订阅内容

---

## 四、总体设计原则

### 4.1 替换原则

脚本生成的业务分组与规则应视为**唯一有效体系**。  
订阅原有的 AI、视频、国外媒体、节点选择等业务组，不参与迁移，不作为可信输入。

### 4.2 依赖边界

本方案**不依赖订阅自带业务分组名称**，但**依赖订阅节点名称与节点类型**进行能力识别。  
因此本方案不是“完全独立于订阅”，而是：

- **规则层独立于订阅原有业务组**
- **调度层依赖节点名称、倍率关键词、地区关键词、协议类型**

### 4.3 小步可维护

脚本应优先采用简单、可读、可维护的匹配逻辑，不追求复杂评分算法。  
优先保证：

1. 能解释
2. 能维护
3. 能快速补规则
4. 能适应机场节点小幅变动

---

## 五、系统分层

系统分为两层。

### 5.1 流量分类层

职责：把请求分类为固定策略标签。

输入可能包括：

- 域名
- 域名后缀
- 域名关键词
- GEOIP
- GEOSITE
- IP-CIDR
- 可选的 PROCESS 规则（仅在客户端/内核支持时）

输出必须是固定策略标签之一：

- `POLICY_CN`
- `POLICY_GLOBAL`
- `POLICY_AI`
- `POLICY_VIDEO`
- `POLICY_DOWNLOAD`
- `POLICY_DEV`
- `POLICY_BLOCK`
- `POLICY_DEFAULT`

### 5.2 节点调度层

职责：为每个策略标签映射到一个稳定的代理组。

输出代理组固定为：

- `AUTO_GENERAL`
- `AUTO_AI`
- `AUTO_VIDEO`
- `AUTO_DOWNLOAD`
- `AUTO_FALLBACK`
- `DIRECT`
- `REJECT`

策略映射关系固定如下：

- `POLICY_CN -> DIRECT`
- `POLICY_GLOBAL -> AUTO_GENERAL`
- `POLICY_AI -> AUTO_AI`
- `POLICY_VIDEO -> AUTO_VIDEO`
- `POLICY_DOWNLOAD -> AUTO_DOWNLOAD`
- `POLICY_DEV -> AUTO_GENERAL`
- `POLICY_BLOCK -> REJECT`
- `POLICY_DEFAULT -> AUTO_FALLBACK`

---

## 六、节点能力识别规则

### 6.1 识别输入

节点能力识别基于以下信息：

1. 节点名称 `proxy.name`
2. 节点类型 `proxy.type`

### 6.2 节点标签模型

每个节点在脚本内应被识别出以下标签中的若干项：

- `region`
- `cost`
- `bandwidth`
- `stability`
- `usage`

### 6.3 地区识别

根据节点名称中的国家/地区关键词识别 `region`，至少支持：

- `US`
- `JP`
- `SG`
- `HK`
- `TW`
- `KR`
- `DE`
- `FR`
- `UK`
- `OTHER`

示例关键词：

- 美国 / US -> `US`
- 日本 / JP -> `JP`
- 新加坡 / SG -> `SG`
- 香港 / HK -> `HK`
- 台湾 / TW -> `TW`
- 韩国 / KR -> `KR`

### 6.4 成本识别

根据名称中的倍率关键词识别 `cost`：

- 包含 `0.5倍率` -> `low`
- 包含 `1.1倍率` / `2倍率` / `3倍率` / `5倍率` / `10倍率` -> `normal`
- 未识别 -> `unknown`

### 6.5 带宽识别

根据协议类型识别 `bandwidth`：

- `hysteria2` -> `high`
- 其他类型 -> `normal`

### 6.6 稳定性识别

根据名称关键词识别 `stability`：

- 包含 `VIP` -> `high`
- 包含 `移动友好` -> `high`
- 包含 `不保证可用` -> `low`
- 未识别 -> `unknown`

### 6.7 用途识别

根据名称关键词识别 `usage`：

- 包含 `ai专用` -> `ai`
- 包含 `bt下载` -> `download`
- 包含 `游戏` -> `game`
- 包含 `谷歌学术` -> `dev`
- 未识别 -> `general`

---

## 七、代理组设计

脚本必须生成一套全新的代理组，并覆盖原有业务组。

### 7.1 固定输出代理组

必须生成以下代理组：

1. `AUTO_GENERAL`
2. `AUTO_AI`
3. `AUTO_VIDEO`
4. `AUTO_DOWNLOAD`
5. `AUTO_FALLBACK`
6. `DIRECT`
7. `REJECT`
8. 可选：一个总入口选择组，例如 `PROXY`

### 7.2 AUTO_GENERAL

用途：普通海外流量。

节点来源：

- 所有可用海外节点
- 排除明显 AI 专用节点
- 排除明显下载专用节点
- 排除高倍率游戏专用节点

推荐筛选：

- 尽量排除 `0.5倍率`
- 优先 `VIP`、`移动友好`
- 可保留 `US / JP / SG / HK / TW / KR`

### 7.3 AUTO_AI

用途：国外 AI 专用流量。

节点来源：

- 优先名称中带 `ai专用`
- 若不足，则从普通节点中补充

必须满足：

- 排除 `0.5倍率`
- 排除明显下载节点
- 排除明显游戏节点
- 优先地区：`US > SG > JP > HK`

优先原则：

1. 可用性
2. 稳定性
3. 地区优先级
4. 延迟

### 7.4 AUTO_VIDEO

用途：视频流量。

节点来源：

- 优先 `0.5倍率`
- 允许使用吞吐型节点
- 可包含部分不稳定但成本低的节点

特点：

- 成本优先
- 吞吐优先
- 稳定性要求低于 AI

### 7.5 AUTO_DOWNLOAD

用途：下载 / BT。

节点来源：

- 优先 `hysteria2`
- 优先名称带 `bt下载`
- 可接受低倍率节点

特点：

- 最大吞吐优先
- 成本优先
- 稳定性要求最低

### 7.6 AUTO_FALLBACK

用途：所有未分类流量的兜底出口。

节点来源：

- 所有非明显异常节点
- 尽量包含较广覆盖地区

特点：

- 追求稳妥，不追求精细业务隔离

---

## 八、规则设计

### 8.1 规则生成原则

规则顺序必须严格遵循：

1. 精确映射规则
2. 高优先级业务规则
3. 一般业务规则
4. 国内/局域网/保留地址规则
5. GEOIP / GEOSITE 地域规则
6. 默认规则

### 8.2 输出规则结构

最终规则结构应分为以下逻辑区段：

#### SECTION 0：精确映射规则

用于高优先级、不能误分流的网站。

至少包含：

**AI**
- `openai.com`
- `chatgpt.com`
- `claude.ai`
- `anthropic.com`
- `gemini.google.com`
- `ai.google.dev`
- `makersuite.google.com`

**VIDEO**
- `youtube.com`
- `youtu.be`
- `netflix.com`

**DEV**
- `github.com`
- `api.github.com`
- `raw.githubusercontent.com`

#### SECTION 1：高优先级业务规则

- AI 相关 GEOSITE / DOMAIN-SUFFIX / DOMAIN-KEYWORD
- 视频相关 GEOSITE
- 下载相关 DOMAIN-KEYWORD / PROCESS（如果支持）
- 开发相关站点

#### SECTION 2：国内与直连规则

- 局域网地址
- 私有 IP
- `DOMAIN-SUFFIX,local`
- 中国站点 `GEOSITE,CN`
- 中国 IP `GEOIP,CN`

#### SECTION 3：默认规则

- `MATCH` -> `AUTO_FALLBACK`

---

## 九、关键业务规则要求

### 9.1 国内流量

必须直连。

包括：

- 局域网
- 私有网段
- 国内域名
- 国内 GEOIP

映射：

- `POLICY_CN -> DIRECT`

### 9.2 AI 流量

必须独立分组，不与普通海外和视频混用。

至少覆盖：

- OpenAI
- ChatGPT
- Claude
- Anthropic
- Gemini
- Google AI Studio
- Cursor 相关服务（如后续确认域名可加入）

映射：

- `POLICY_AI -> AUTO_AI`

### 9.3 视频流量

至少覆盖：

- YouTube
- Netflix
- 其他后续可扩展流媒体域名

映射：

- `POLICY_VIDEO -> AUTO_VIDEO`

### 9.4 下载流量

至少支持：

- 名称或关键词明显为 BT/下载的规则
- 可选 PROCESS 规则
- 可选端口推断，但不建议作为强规则核心

映射：

- `POLICY_DOWNLOAD -> AUTO_DOWNLOAD`

### 9.5 开发流量

至少覆盖：

- GitHub
- GitHub API
- 原始代码下载域名

映射：

- `POLICY_DEV -> AUTO_GENERAL`

---

## 十、非域名流量处理

### 10.1 处理目标

对以下无法直接通过域名识别的流量，采用保守策略：

1. 纯 IP 访问
2. 无 SNI 的 TLS
3. UDP / QUIC
4. TUN 模式下的进程流量

### 10.2 处理优先级

#### 第一优先：已知保留网段与局域网

- 私有地址 -> `DIRECT`

#### 第二优先：GEOIP

- `GEOIP,CN` -> `DIRECT`
- 非 CN IP 不直接强制归类为 AI / VIDEO / DOWNLOAD
- 非 CN IP 默认归入 `POLICY_GLOBAL` 或 `POLICY_DEFAULT`

#### 第三优先：可选弱推断

仅在规则足够明确时使用：

- 明显下载相关进程 -> `POLICY_DOWNLOAD`
- 明显 AI 相关站点的已知 IP -> `POLICY_AI`

#### 第四优先：兜底

- 未识别 -> `POLICY_DEFAULT`

### 10.3 设计原则

不依赖脆弱的端口猜测，不将“QUIC = 视频”写成强规则。  
本期优先避免误判，不追求覆盖所有非域名场景。

---

## 十一、对原配置的处理策略

### 11.1 保留内容

从订阅配置中保留：

- `proxies`
- 非业务基础配置字段

### 11.2 覆盖内容

脚本应完全覆盖：

- 原有 `proxy-groups`
- 原有 `rules`

### 11.3 不迁移项

以下订阅原生业务组不参与迁移：

- AI 类组
- 视频类组
- 国外媒体类组
- 游戏类组
- 自带自动选择组
- 其他语义化业务组

原因：

- 命名不稳定
- 语义不准确
- 业务边界不可信

---

## 十二、实现建议

### 12.1 推荐脚本结构

脚本内部建议拆为以下逻辑模块：

1. `normalizeConfig`
2. `analyzeProxy`
3. `buildProxyGroups`
4. `buildRules`
5. `applyOverrides`

### 12.2 推荐做法

- 用数组和纯函数构建分组
- 用关键词表驱动地区识别
- 用简单规则驱动倍率识别
- 尽量避免复杂嵌套逻辑
- 生成结果前做空数组兜底检查

### 12.3 错误处理

脚本需考虑以下异常情况：

1. `config.proxies` 为空
2. 某类分组筛选结果为空
3. 节点名称不包含任何地区信息
4. 节点类型未知
5. 原配置缺少 `proxy-groups` 或 `rules`

兜底原则：

- 某专用组为空时，可回退到 `AUTO_FALLBACK`
- 整体不可中断，必须返回合法配置对象

---

## 十三、验收标准

脚本交付后，必须满足以下验收标准：

1. 能在 Flash 软件的 JS 覆写入口中直接运行。
2. 输入订阅配置后，能成功返回合法 Clash 配置。
3. 原有业务分组被完全替换。
4. 新配置中至少存在：
   - `AUTO_GENERAL`
   - `AUTO_AI`
   - `AUTO_VIDEO`
   - `AUTO_DOWNLOAD`
   - `AUTO_FALLBACK`
5. AI 流量命中 `AUTO_AI`。
6. 视频流量命中 `AUTO_VIDEO`。
7. 国内流量命中 `DIRECT`。
8. 未命中流量命中 `AUTO_FALLBACK`。
9. 节点命名发生一般性变化时，脚本仍能通过关键词完成基础分组。
10. 即使某一类节点为空，脚本也不会报错退出。

---

## 十四、非本期范围

以下内容不属于当前 JS 覆写脚本的强制交付范围：

1. 日志分析脚本
2. Excel 统计导出
3. 自动规则学习
4. 实时测速
5. 节点评分算法
6. TUN 模式配置联动
7. SNI 嗅探配置联动
8. 自动订阅修正

这些内容可以作为下一阶段扩展。

---

## 十五、后续扩展方向

后续可新增：

1. `POLICY_GAME`
2. `POLICY_STREAM`
3. `POLICY_SCHOLAR`
4. 基于日志的规则补全
5. 针对 Cursor / IDE / Git 工具的进程规则
6. 更精细的 AI 专线优先级模型
