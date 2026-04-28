// 规则完善版。极大地丰富了 RULE_SECTIONS 中的业务规则

// ================================
// 可维护配置区：以后主要改这里
// ================================

// 固定策略名。规则层只关心业务策略，不直接写代理组名。
const POLICY = {
    CN: "POLICY_CN",
    GLOBAL: "POLICY_GLOBAL",
    AI: "POLICY_AI",
    VIDEO: "POLICY_VIDEO",
    DOWNLOAD: "POLICY_DOWNLOAD",
    DEV: "POLICY_DEV",
    BLOCK: "POLICY_BLOCK",
    DEFAULT: "POLICY_DEFAULT"
};

// 运行参数。这里的 url-test 会在客户端运行时按实际延迟自动选择节点。
const RUNTIME_CONFIG = {
    mode: "rule",
    autoTest: {
        type: "url-test",
        url: "https://cp.cloudflare.com/generate_204",
        interval: 300,
        tolerance: 50
    }
};

// 分两群：
// 1. 节点组群：真正自动测速选节点
// 2. 业务组群：给规则命中后落地，也给用户前端手动切换用
const GROUP_NAME = {
    manual: "📋 全部节点",
    fallbackControl: "🛡️ 兜底",
    bizGlobal: "🌏 海外",
    bizAI: "🤖 AI",
    bizVideo: "🎬 视频",
    bizDownload: "⬇️ 下载",
    bizDirect: "🚀 直连",
    bizBlock: "🚫 拦截",
    nodeFallback: "🔄 兜底节点池",
    nodeGeneral: "🌐 通用海外节点",
    nodeAI: "🧠 AI 专用节点",
    nodeVideo: "📺 视频节点池",
    nodeDownload: "💾 下载节点池"
};

// 节点名称和类型的标签规则。机场命名变了，优先改这里。
const TAG_RULES = {
    name: [
        { tag: "地区:美国", keywords: ["美国", "US", "USA", "🇺🇸"] },
        { tag: "地区:日本", keywords: ["日本", "JP", "东京", "大阪", "🇯🇵"] },
        { tag: "地区:新加坡", keywords: ["新加坡", "SG", "狮城", "🇸🇬"] },
        { tag: "地区:香港", keywords: ["香港", "HK", "🇭🇰"] },
        { tag: "地区:台湾", keywords: ["台湾", "TW", "台北", "新北", "🇹🇼"] },
        { tag: "地区:韩国", keywords: ["韩国", "KR", "首尔", "🇰🇷"] },
        { tag: "地区:英国", keywords: ["英国", "UK", "伦敦", "🇬🇧"] },
        { tag: "地区:德国", keywords: ["德国", "DE", "法兰克福", "柏林", "🇩🇪"] },
        { tag: "地区:法国", keywords: ["法国", "FR", "巴黎", "🇫🇷"] },

        { tag: "倍率:低", keywords: ["0.5倍率", "0.5x", "0.5X", "0.5倍"] },

        { tag: "稳定:高", keywords: ["VIP", "移动友好", "专用", "专线"] },
        { tag: "稳定:低", keywords: ["不保证可用", "测试", "试用"] },

        { tag: "用途:AI", keywords: ["ai专用", "openai", "chatgpt", "claude", "gemini", "gpt", "cursor"] },
        { tag: "用途:下载", keywords: ["bt下载", "下载", "torrent", "aria2"] },
        { tag: "用途:游戏", keywords: ["游戏", "game"] },
        { tag: "用途:开发", keywords: ["学术", "github", "开发", "dev"] }
    ],
    type: [
        { tag: "带宽:高", values: ["hysteria", "hysteria2"] }
    ]
};

// 节点组群：节点进哪个自动测速池，完全靠标签池控制。
// includeTags：必须全部命中
// excludeTags：一个都不能命中
// preferTags：仅用于排序展示；真正的节点选择由 url-test 按延迟执行
// fallbackKeys：本池为空时的回退顺序
const NODE_GROUP_RULES = [
    {
        key: "nodeFallback",
        name: GROUP_NAME.nodeFallback,
        includeTags: ["全部节点"],
        excludeTags: ["用途:游戏", "稳定:低"],
        preferTags: ["稳定:高", "地区:香港", "地区:台湾", "地区:日本", "地区:新加坡", "地区:美国"],
        fallbackKeys: ["all"]
    },
    {
        key: "nodeGeneral",
        name: GROUP_NAME.nodeGeneral,
        includeTags: ["全部节点"],
        excludeTags: ["用途:AI", "用途:下载", "用途:游戏", "稳定:低", "倍率:低"],
        preferTags: ["稳定:高", "地区:香港", "地区:台湾", "地区:日本", "地区:新加坡", "地区:美国", "带宽:高"],
        fallbackKeys: ["nodeFallback", "all"]
    },
    {
        key: "nodeAI",
        name: GROUP_NAME.nodeAI,
        includeTags: ["全部节点"],
        excludeTags: ["用途:下载", "用途:游戏", "稳定:低", "倍率:低" ,"地区:香港", "地区:台湾", "地区:越南"],
        preferTags: ["用途:AI", "稳定:高", "地区:美国", "地区:新加坡", "地区:日本", "地区:香港", "地区:台湾", "带宽:高"],
        fallbackKeys: ["nodeGeneral", "nodeFallback", "all"]
    },
    {
        key: "nodeVideo",
        name: GROUP_NAME.nodeVideo,
        includeTags: ["倍率:低"],
        excludeTags: ["用途:AI", "用途:游戏"],
        preferTags: ["带宽:高", "用途:下载", "稳定:高"],
        fallbackKeys: ["nodeFallback", "nodeGeneral", "all"]
    },
    {
        key: "nodeDownload",
        name: GROUP_NAME.nodeDownload,
        includeTags: ["带宽:高"],
        excludeTags: ["用途:AI", "用途:游戏"],
        preferTags: ["用途:下载", "倍率:低", "稳定:高"],
        fallbackKeys: ["nodeVideo", "nodeFallback", "all"]
    }
];

// 业务组群：前端可见、规则实际命中的组。
// defaults 表示最适配的节点组放在最前面，用户仍可以手动切换到其它组或 DIRECT。
const BUSINESS_GROUP_RULES = [
    {
        key: "fallbackControl",
        name: GROUP_NAME.fallbackControl,
        type: "select",
        defaults: [GROUP_NAME.nodeGeneral, GROUP_NAME.nodeAI, GROUP_NAME.nodeVideo, GROUP_NAME.nodeDownload, GROUP_NAME.nodeFallback, "DIRECT"]
    },
    {
        key: "bizGlobal",
        name: GROUP_NAME.bizGlobal,
        type: "select",
        defaults: [GROUP_NAME.nodeGeneral, GROUP_NAME.nodeFallback, GROUP_NAME.nodeAI, "DIRECT"]
    },
    {
        key: "bizAI",
        name: GROUP_NAME.bizAI,
        type: "select",
        defaults: [GROUP_NAME.nodeAI, GROUP_NAME.nodeGeneral, GROUP_NAME.nodeFallback, "DIRECT"]
    },
    {
        key: "bizVideo",
        name: GROUP_NAME.bizVideo,
        type: "select",
        defaults: [GROUP_NAME.nodeVideo, GROUP_NAME.nodeDownload, GROUP_NAME.nodeFallback, "DIRECT"]
    },
    {
        key: "bizDownload",
        name: GROUP_NAME.bizDownload,
        type: "select",
        defaults: [GROUP_NAME.nodeDownload, GROUP_NAME.nodeVideo, GROUP_NAME.nodeFallback, "DIRECT"]
    },
    {
        key: "bizDirect",
        name: GROUP_NAME.bizDirect,
        type: "select",
        defaults: ["DIRECT", GROUP_NAME.nodeFallback]
    },
    {
        key: "bizBlock",
        name: GROUP_NAME.bizBlock,
        type: "select",
        defaults: ["REJECT", "DIRECT"]
    }
];

// 策略 -> 业务组/动作映射。
const POLICY_TARGET = {
    [POLICY.CN]: GROUP_NAME.bizDirect,
    [POLICY.GLOBAL]: GROUP_NAME.bizGlobal,
    [POLICY.AI]: GROUP_NAME.bizAI,
    [POLICY.VIDEO]: GROUP_NAME.bizVideo,
    [POLICY.DOWNLOAD]: GROUP_NAME.bizDownload,
    [POLICY.DEV]: GROUP_NAME.bizGlobal,
    [POLICY.BLOCK]: GROUP_NAME.bizBlock,
    [POLICY.DEFAULT]: GROUP_NAME.fallbackControl
};

// 规则顺序。规则会按这个顺序输出，避免对象遍历顺序带来歧义。
const RULE_ORDER = [
    POLICY.AI,
    POLICY.VIDEO,
    POLICY.DEV,
    POLICY.DOWNLOAD,
    POLICY.BLOCK,
    POLICY.CN,
    POLICY.DEFAULT
];

// 业务规则配置。按业务策略分组，后续维护直接改对应业务块。
const RULE_SECTIONS = {
    // AI
    [POLICY.AI]: [
        // --- Google AI / Gemini ---
        { type: "DOMAIN", value: "gemini.google.com" },         // Gemini 网页版
        { type: "DOMAIN", value: "makersuite.google.com" },     // Google AI Studio (旧版开发者域名)
        { type: "DOMAIN-SUFFIX", value: "aistudio.google.com" },// Google AI Studio (新版开发者域名)
        { type: "DOMAIN-SUFFIX", value: "ai.google.dev" },      // Google AI 开发者文档与资源
        { type: "DOMAIN-SUFFIX", value: "googleapis.com" },     // Google API (包含 Gemini API 请求)
        { type: "DOMAIN-KEYWORD", value: "gemini" },            // 匹配包含 gemini 关键词的域名

        // --- OpenAI / ChatGPT ---
        { type: "DOMAIN-SUFFIX", value: "openai.com" },         // OpenAI 官网及 API
        { type: "DOMAIN-SUFFIX", value: "chatgpt.com" },        // ChatGPT 新版网页域名
        { type: "DOMAIN-SUFFIX", value: "oaistatic.com" },      // OpenAI 静态资源CDN
        { type: "DOMAIN-SUFFIX", value: "oaiusercontent.com" }, // OpenAI 用户生成内容与插件资源
        { type: "DOMAIN-KEYWORD", value: "openai" },            // 匹配包含 openai 关键词的域名
        { type: "DOMAIN-KEYWORD", value: "chatgpt" },           // 匹配包含 chatgpt 关键词的域名

        // --- Anthropic / Claude ---
        { type: "DOMAIN-SUFFIX", value: "anthropic.com" },      // Anthropic 官网及 API
        { type: "DOMAIN-SUFFIX", value: "claude.ai" },          // Claude 网页版
        { type: "DOMAIN-KEYWORD", value: "anthropic" },         // 匹配包含 anthropic 关键词的域名

        // --- API 聚合平台 ---
        { type: "DOMAIN-SUFFIX", value: "openrouter.ai" },      // OpenRouter 多模型 API 聚合平台

        // --- Microsoft Copilot / GitHub Copilot ---
        { type: "DOMAIN-SUFFIX", value: "copilot.microsoft.com" },     // 微软 Copilot 网页版
        { type: "DOMAIN-SUFFIX", value: "api.githubcopilot.com" },     // GitHub Copilot API
        { type: "DOMAIN-SUFFIX", value: "copilot.githubusercontent.com" }, // GitHub Copilot 资源
        { type: "DOMAIN-KEYWORD", value: "copilot" },                  // 匹配包含 copilot 关键词的域名

        // --- Perplexity (AI 搜索引擎) ---
        { type: "DOMAIN-SUFFIX", value: "perplexity.ai" },      // Perplexity 官网及服务
        { type: "DOMAIN-KEYWORD", value: "perplexity" },        // 匹配包含 perplexity 关键词的域名

        // --- Poe (Quora 旗下的多模型AI聚合平台) ---
        { type: "DOMAIN-SUFFIX", value: "poe.com" },            // Poe 网页版及服务

        // --- Meta AI / Llama ---
        { type: "DOMAIN-SUFFIX", value: "meta.ai" },            // Meta AI 官网
        { type: "DOMAIN-SUFFIX", value: "llama2.ai" },          // Llama 体验站

        // --- xAI (马斯克的 Grok) ---
        { type: "DOMAIN-SUFFIX", value: "x.ai" },               // xAI 官网
        { type: "DOMAIN-SUFFIX", value: "grok.com" },           // Grok 网页版

        // --- 开发者与开源社区 (HuggingFace, Mistral, Cohere 等) ---
        { type: "DOMAIN-SUFFIX", value: "huggingface.co" },     // Hugging Face 社区及 API
        { type: "DOMAIN-SUFFIX", value: "mistral.ai" },         // Mistral AI 官网及 API
        { type: "DOMAIN-SUFFIX", value: "cohere.com" },         // Cohere AI 官网及 API
        { type: "DOMAIN-SUFFIX", value: "replicate.com" },      // Replicate 模型托管平台

        // --- 图像与视频生成 (Midjourney, Runway, Civitai 等) ---
        { type: "DOMAIN-SUFFIX", value: "midjourney.com" },     // Midjourney 官网
        { type: "DOMAIN-SUFFIX", value: "runwayml.com" },       // Runway 视频生成
        { type: "DOMAIN-SUFFIX", value: "civitai.com" },        // Civitai (C站) AI 绘图模型社区
        { type: "DOMAIN-SUFFIX", value: "pika.art" },           // Pika 视频生成

        // --- 音频与音乐生成 (Suno, Udio) ---
        { type: "DOMAIN-SUFFIX", value: "suno.com" },           // Suno 音乐生成
        { type: "DOMAIN-SUFFIX", value: "suno.ai" },            // Suno 备用域名
        { type: "DOMAIN-SUFFIX", value: "udio.com" },           // Udio 音乐生成

        // --- 其他常用 AI 工具 (Phind, Character.ai, DeepL) ---
        { type: "DOMAIN-SUFFIX", value: "phind.com" },          // Phind 程序员专用 AI 搜索
        { type: "DOMAIN-SUFFIX", value: "character.ai" },       // Character.ai 角色扮演
        { type: "DOMAIN-SUFFIX", value: "deepl.com" },          // DeepL AI 翻译

        // --- 地理位置与规则集兜底 ---
        { type: "GEOSITE", value: "category-ai-!cn" }           // 匹配路由规则库中所有非中国大陆的 AI 服务
    ],
    // 视频
    [POLICY.VIDEO]: [
        // --- YouTube ---
        { type: "DOMAIN-SUFFIX", value: "youtube.com" },        // YouTube 主域名
        { type: "DOMAIN-SUFFIX", value: "youtu.be" },           // YouTube 短链接
        { type: "DOMAIN-SUFFIX", value: "googlevideo.com" },    // YouTube 核心视频流传输域名 (极重要)
        { type: "DOMAIN-SUFFIX", value: "ytimg.com" },          // YouTube 封面与静态图片 CDN
        { type: "GEOSITE", value: "youtube" },                  // YouTube 规则集兜底

        // --- Netflix ---
        { type: "DOMAIN-SUFFIX", value: "netflix.com" },        // Netflix 主域名
        { type: "DOMAIN-SUFFIX", value: "nflximg.net" },        // Netflix 图片 CDN
        { type: "DOMAIN-SUFFIX", value: "nflxext.com" },        // Netflix 静态资源
        { type: "DOMAIN-SUFFIX", value: "nflxvideo.net" },      // Netflix 核心视频流传输域名 (极重要)
        { type: "GEOSITE", value: "netflix" },                  // Netflix 规则集兜底

        // --- X (Twitter) 包含大量视频流 ---
        { type: "DOMAIN-SUFFIX", value: "x.com" },              // X 主域名
        { type: "DOMAIN-SUFFIX", value: "twitter.com" },        // Twitter 旧域名
        { type: "DOMAIN-SUFFIX", value: "twimg.com" },          // Twitter 图片与视频媒体 CDN
        { type: "GEOSITE", value: "twitter" },                  // Twitter 规则集兜底

        // --- TikTok (抖音海外版) ---
        { type: "DOMAIN-SUFFIX", value: "tiktok.com" },         // TikTok 主域名
        { type: "DOMAIN-SUFFIX", value: "tiktokv.com" },        // TikTok 视频接口
        { type: "DOMAIN-SUFFIX", value: "tiktokcdn.com" },      // TikTok 视频 CDN
        { type: "GEOSITE", value: "tiktok" },                   // TikTok 规则集兜底

        // --- Twitch (全球最大游戏直播平台) ---
        { type: "DOMAIN-SUFFIX", value: "twitch.tv" },          // Twitch 主域名
        { type: "DOMAIN-SUFFIX", value: "ttvnw.net" },          // Twitch 直播流媒体 CDN
        { type: "DOMAIN-SUFFIX", value: "jtvnw.net" },          // Twitch 静态及视频资源
        { type: "GEOSITE", value: "twitch" },                   // Twitch 规则集兜底

        // --- Disney+ ---
        { type: "DOMAIN-SUFFIX", value: "disneyplus.com" },     // Disney+ 主域名
        { type: "DOMAIN-SUFFIX", value: "dssott.com" },         // Disney 流媒体后端传输
        { type: "GEOSITE", value: "disney" },                   // Disney 规则集兜底

        // --- Amazon Prime Video ---
        { type: "DOMAIN-SUFFIX", value: "primevideo.com" },     // Prime Video 官网及流媒体
        { type: "DOMAIN-SUFFIX", value: "aiv-cdn.net" },        // Prime Video CDN
        { type: "GEOSITE", value: "primevideo" },               // Prime Video 规则集兜底

        // --- HBO Max / Max ---
        { type: "DOMAIN-SUFFIX", value: "max.com" },            // Max 新版主域名
        { type: "DOMAIN-SUFFIX", value: "hbomax.com" },         // HBO Max 旧版/地区域名
        { type: "GEOSITE", value: "hbo" },                      // HBO 规则集兜底

        // --- 其他主流视频流媒体 (Hulu, Vimeo, Crunchyroll 等) ---
        { type: "DOMAIN-SUFFIX", value: "hulu.com" },           // Hulu 流媒体
        { type: "DOMAIN-SUFFIX", value: "vimeo.com" },          // Vimeo 视频分享平台
        { type: "DOMAIN-SUFFIX", value: "crunchyroll.com" },    // Crunchyroll 动漫流媒体平台
        { type: "DOMAIN-SUFFIX", value: "bilibili.tv" }         // Bilibili 海外版
    ],
    // 开发、学术
    [POLICY.DEV]: [
        // --- GitHub ---
        { type: "DOMAIN", value: "api.github.com" },            // GitHub API
        { type: "DOMAIN", value: "raw.githubusercontent.com" }, // GitHub 原始文件 (常用于一键安装脚本)
        { type: "DOMAIN-SUFFIX", value: "github.com" },         // GitHub 主域名
        { type: "DOMAIN-SUFFIX", value: "githubusercontent.com" }, // GitHub 用户生成内容
        { type: "DOMAIN-SUFFIX", value: "githubassets.com" },   // GitHub 静态资源 CDN (解决页面加载不全)
        { type: "DOMAIN-SUFFIX", value: "github.io" },          // GitHub Pages 静态网站
        { type: "GEOSITE", value: "github" },                   // GitHub 规则集兜底

        // --- 其他代码托管与协作 ---
        { type: "DOMAIN-SUFFIX", value: "gitlab.com" },         // GitLab 主域名
        { type: "DOMAIN-SUFFIX", value: "bitbucket.org" },      // Bitbucket 主域名

        // --- 开发者问答、博客与社区 ---
        { type: "DOMAIN-SUFFIX", value: "stackoverflow.com" },  // Stack Overflow 问答社区
        { type: "DOMAIN-SUFFIX", value: "stackexchange.com" },  // Stack Exchange 问答网络
        { type: "DOMAIN-SUFFIX", value: "medium.com" },         // Medium 博客 (包含大量海外技术文章)
        { type: "DOMAIN-SUFFIX", value: "dev.to" },             // 开发者技术社区
        { type: "DOMAIN-SUFFIX", value: "v2ex.com" },           // V2EX 程序员/创意工作者社区

        // --- 环境、包管理与镜像库 (Docker, NPM, Python, Go等) ---
        { type: "DOMAIN-SUFFIX", value: "docker.com" },         // Docker 官网及文档
        { type: "DOMAIN-SUFFIX", value: "docker.io" },          // Docker Hub 镜像拉取
        { type: "DOMAIN-SUFFIX", value: "npmjs.com" },          // NPM Node 包管理
        { type: "DOMAIN-SUFFIX", value: "npmjs.org" },          // NPM 注册表及资源
        { type: "DOMAIN-SUFFIX", value: "pypi.org" },           // PyPI Python 包管理
        { type: "DOMAIN-SUFFIX", value: "pythonhosted.org" },   // PyPI 托管资源
        { type: "DOMAIN-SUFFIX", value: "golang.org" },         // Go 语言官网及依赖
        { type: "DOMAIN-SUFFIX", value: "pkg.go.dev" },         // Go 语言包检索
        { type: "DOMAIN-SUFFIX", value: "crates.io" },          // Rust 包管理

        // --- 学术与科研 ---
        { type: "DOMAIN", value: "scholar.google.com" },        // Google 学术搜索
        { type: "DOMAIN-SUFFIX", value: "arxiv.org" },          // arXiv 预印本文献库
        { type: "DOMAIN-SUFFIX", value: "researchgate.net" },   // ResearchGate 学术社交与文献网络
        { type: "DOMAIN-SUFFIX", value: "nature.com" },         // Nature 自然期刊官网
        { type: "DOMAIN-SUFFIX", value: "sciencemag.org" },     // Science 科学期刊官网
        { type: "DOMAIN-SUFFIX", value: "ieee.org" },           // IEEE 电子工程师学会及文献库
        { type: "DOMAIN-KEYWORD", value: "sci-hub" }            // 匹配 Sci-Hub (通杀各后缀镜像站，下论文必备)
    ],
    // 下载
    [POLICY.DOWNLOAD]: [
        // --- 核心下载与 P2P 关键词 (国际通用) ---
        { type: "DOMAIN-KEYWORD", value: "torrent" },           // 匹配包含 torrent 关键词的域名 (BT 种子)
        { type: "DOMAIN-KEYWORD", value: "tracker" },           // 匹配包含 tracker 关键词的域名 (BT 追踪器)
        { type: "DOMAIN-KEYWORD", value: "aria2" },             // 匹配包含 aria2 关键词的域名 (开源下载工具)
        { type: "DOMAIN-KEYWORD", value: "announce" },          // BT Tracker 常用通讯端点关键词
        { type: "DOMAIN-KEYWORD", value: "magnet" },            // 磁力链接相关关键词
        { type: "DOMAIN-KEYWORD", value: "ed2k" },              // 电驴 (eDonkey) 网络相关关键词

        // --- 海外主流 P2P 客户端官网及通讯服务 ---
        { type: "DOMAIN-SUFFIX", value: "bitcomet.com" },       // 比特彗星 (BitComet) 官网及服务
        { type: "DOMAIN-SUFFIX", value: "qbittorrent.org" },    // qBittorrent 官网及服务
        { type: "DOMAIN-SUFFIX", value: "transmissionbt.com" }, // Transmission 官网及服务
        { type: "DOMAIN-SUFFIX", value: "utorrent.com" },       // uTorrent 官网及服务
        { type: "DOMAIN-SUFFIX", value: "bittorrent.com" },     // BitTorrent 官网及服务

        // --- 海外常见公共 Tracker 域名 (用于精准识别并分离 BT 流量) ---
        { type: "DOMAIN-SUFFIX", value: "openbittorrent.com" }, // 大型海外公共 BT 追踪器
        { type: "DOMAIN-SUFFIX", value: "publicbt.com" },       // 大型海外公共 BT 追踪器
        { type: "DOMAIN-SUFFIX", value: "opentrackr.org" },     // 知名开源 BT 追踪器
        { type: "DOMAIN-SUFFIX", value: "trakx.net" },          // 常见 BT 追踪器后缀

        // --- 规则集兜底 ---
        { type: "GEOSITE", value: "category-pt" }               // 匹配 Private Tracker (私有种子站/海外PT站) 流量
    ],
    // 拦截
    [POLICY.BLOCK]: [
        // --- 规则集兜底 (全能型拦截库) ---
        { type: "GEOSITE", value: "category-ads-all" },         // 涵盖全球大部分已知广告域名
        { type: "GEOSITE", value: "category-ads" },             // 基础广告

        // --- 全球主流广告与追踪引擎 (Google, Meta, Amazon等) ---
        { type: "DOMAIN-SUFFIX", value: "doubleclick.net" },    // Google 核心广告
        { type: "DOMAIN-SUFFIX", value: "googleadservices.com" },
        { type: "DOMAIN-SUFFIX", value: "googlesyndication.com" },
        { type: "DOMAIN-SUFFIX", value: "google-analytics.com" }, // Google 统计
        { type: "DOMAIN-SUFFIX", value: "googletagmanager.com" }, // Google 标签管理
        { type: "DOMAIN-SUFFIX", value: "googleadsserving.com" },
        { type: "DOMAIN-SUFFIX", value: "facebook.net" },       // Meta/Facebook 追踪像素
        { type: "DOMAIN-SUFFIX", value: "facebook.com" },       // (注意：如需使用FB请删此行，通常用于拦截网页嵌套的FB插件)
        { type: "DOMAIN-SUFFIX", value: "fbcdn.net" },          // Meta 追踪
        { type: "DOMAIN-SUFFIX", value: "amazon-adsystem.com" }, // 亚马逊广告
        { type: "DOMAIN-SUFFIX", value: "adnxs.com" },          // AppNexus (全球核心广告分发商)
        { type: "DOMAIN-SUFFIX", value: "scorecardresearch.com" }, // 知名第三方数据研究追踪
        { type: "DOMAIN-SUFFIX", value: "quantserve.com" },     // 流量统计追踪
        { type: "DOMAIN-SUFFIX", value: "moatads.com" },        // 广告验证与追踪

        // --- 国内大厂广告与隐私搜集 (百度, 字节, 腾讯, 阿里) ---
        { type: "DOMAIN-SUFFIX", value: "pos.baidu.com" },      // 百度移动广告
        { type: "DOMAIN-SUFFIX", value: "union.baidu.com" },    // 百度广告联盟
        { type: "DOMAIN-SUFFIX", value: "cpro.baidu.com" },     // 百度联盟广告
        { type: "DOMAIN-SUFFIX", value: "p.pstatp.com" },       // 字节跳动静态资源 (含广告)
        { type: "DOMAIN-SUFFIX", value: "ad.toutiao.com" },     // 今日头条/抖音广告
        { type: "DOMAIN-SUFFIX", value: "pglstatp-toutiao.com" }, // 穿山甲广告插件 (极多APP集成)
        { type: "DOMAIN-SUFFIX", value: "ad.api.xiaomi.com" },  // 小米系统广告
        { type: "DOMAIN-SUFFIX", value: "ad.intl.xiaomi.com" }, // 小米海外版广告
        { type: "DOMAIN-SUFFIX", value: "track.uc.cn" },        // UC 浏览器追踪
        { type: "DOMAIN-SUFFIX", value: "mmstat.com" },         // 阿里/淘宝系通用追踪统计 (极多)
        { type: "DOMAIN-SUFFIX", value: "gdt.qq.com" },         // 腾讯广点通广告
        { type: "DOMAIN-SUFFIX", value: "e.qq.com" },           // 腾讯广告
        { type: "DOMAIN-SUFFIX", value: "trace.qq.com" },       // 腾讯追踪

        // --- 移动端 SDK 与报错日志 (常见于各类 APP 后台上传) ---
        { type: "DOMAIN-SUFFIX", value: "umeng.com" },          // 友盟统计 (国内覆盖率最高)
        { type: "DOMAIN-SUFFIX", value: "umengcloud.com" },     // 友盟云
        { type: "DOMAIN-SUFFIX", value: "jpush.cn" },           // 极光推送 (含统计功能)
        { type: "DOMAIN-SUFFIX", value: "jiguang.cn" },         // 极光云
        { type: "DOMAIN-SUFFIX", value: "getui.com" },          // 个推统计
        { type: "DOMAIN-SUFFIX", value: "crashlytics.com" },    // 崩溃日志上传
        { type: "DOMAIN-SUFFIX", value: "sentry.io" },          // 错误监控
        { type: "DOMAIN-SUFFIX", value: "bugsnag.com" },        // 错误上报
        { type: "DOMAIN-SUFFIX", value: "adjust.com" },         // 全球移动营销统计
        { type: "DOMAIN-SUFFIX", value: "appsflyer.com" },      // 全球移动营销统计

        // --- 操作系统级隐私上传与测速 (微软, 苹果等) ---
        { type: "DOMAIN-SUFFIX", value: "telemetry.microsoft.com" }, // Windows 统计上报
        { type: "DOMAIN-SUFFIX", value: "vortex.data.microsoft.com" }, // 微软数据采集
        { type: "DOMAIN-SUFFIX", value: "settings-win.data.microsoft.com" },
        { type: "DOMAIN-SUFFIX", value: "telemetry.sdk.bing.com" },
        { type: "DOMAIN-SUFFIX", value: "metrics.icloud.com" }, // 苹果统计
        { type: "DOMAIN-SUFFIX", value: "api-adservices.apple.com" }, // 苹果搜索广告接口
        { type: "DOMAIN-SUFFIX", value: "iadsdk.apple.com" },   // 苹果广告 SDK

        // --- 视频平台特定广告域名 ---
        { type: "DOMAIN-SUFFIX", value: "da.mgtv.com" },        // 芒果TV广告
        { type: "DOMAIN-SUFFIX", value: "valda.rt.mgtv.com" },  // 芒果TV
        { type: "DOMAIN-SUFFIX", value: "ad.iqiyi.com" },       // 爱奇艺广告
        { type: "DOMAIN-SUFFIX", value: "t7z.cupid.iqiyi.com" }, // 爱奇艺投放控制
        { type: "DOMAIN-SUFFIX", value: "ad.m.iqiyi.com" },     // 爱奇艺移动端
        { type: "DOMAIN-SUFFIX", value: "atm.youku.com" },      // 优酷广告

        // --- 通用关键词拦截 (威力巨大，小心误杀) ---
        { type: "DOMAIN-KEYWORD", value: "analytics" },         // 匹配所有包含分析的域名
        { type: "DOMAIN-KEYWORD", value: "telemetry" },         // 匹配所有包含遥测的域名
        { type: "DOMAIN-KEYWORD", value: "adservice" },         // 匹配所有包含广告服务的域名
        { type: "DOMAIN-KEYWORD", value: "adsystem" },          // 匹配所有包含广告系统的域名
        { type: "DOMAIN-KEYWORD", value: "adserver" },          // 匹配所有包含广告服务器的域名
        { type: "DOMAIN-KEYWORD", value: "track" },             // 匹配所有包含追踪的域名
        { type: "DOMAIN-KEYWORD", value: "log-upload" },        // 匹配所有包含日志上传的域名
        { type: "DOMAIN-KEYWORD", value: "metrics" },           // 匹配所有包含指标统计的域名
    ],
    // 国内
    [POLICY.CN]: [
        // --- 本地与局域网域名 ---
        { type: "DOMAIN-SUFFIX", value: "local" },              // 本地网络域名 (如 mDNS/Bonjour)
        { type: "DOMAIN-SUFFIX", value: "localhost" },          // 本地主机名
        { type: "DOMAIN", value: "localhost" },                 // 本地主机名
        { type: "DOMAIN-SUFFIX", value: "lan" },                // 常见局域网后缀
        { type: "DOMAIN-SUFFIX", value: "router.asus.com" },    // 华硕路由器后台
        { type: "DOMAIN-SUFFIX", value: "tplogin.cn" },         // TP-Link 路由器后台

        // --- 中国大陆顶级域名 (兜底所有国内注册局域名) ---
        { type: "DOMAIN-SUFFIX", value: "cn" },                 // 包含 .cn, .com.cn, .gov.cn, .edu.cn 等

        // --- 国内网盘与文件分享 (使用 .com/.net 后缀，防漏网且防大流量消耗) ---
        { type: "DOMAIN-KEYWORD", value: "lanzou" },            // 蓝奏云 (经常更换后缀如 lanzoui.com, lanzoux.com，用关键词最稳)
        { type: "DOMAIN-SUFFIX", value: "123pan.com" },         // 123云盘 (极易被识别为国外网站而走代理)
        { type: "DOMAIN-SUFFIX", value: "aliyundrive.com" },    // 阿里云盘
        { type: "DOMAIN-SUFFIX", value: "alipan.com" },         // 阿里云盘新域名
        { type: "DOMAIN-SUFFIX", value: "baidupcs.com" },       // 百度网盘核心下载节点
        { type: "DOMAIN-SUFFIX", value: "weiyun.com" },         // 腾讯微云

        // --- 国内学术、开发者与技术社区 ---
        { type: "DOMAIN-SUFFIX", value: "cnki.net" },           // 中国知网 (严禁海外IP访问，写论文必加直连)
        { type: "DOMAIN-SUFFIX", value: "gitee.com" },          // 码云 (国内版 GitHub)
        { type: "DOMAIN-SUFFIX", value: "csdn.net" },           // CSDN 开发者社区

        // --- 远程控制与内网穿透 (必须直连以保证极低延迟) ---
        { type: "DOMAIN-SUFFIX", value: "oray.com" },           // 花生壳 / 向日葵官网
        { type: "DOMAIN-SUFFIX", value: "oray.net" },           // 花生壳 / 向日葵服务
        { type: "DOMAIN-SUFFIX", value: "sunlogin.net" },       // 向日葵远控核心服务
        { type: "DOMAIN-SUFFIX", value: "cpolar.com" },         // 国内常用内网穿透工具

        // --- 其他极易漏掉的国内服务与静态 CDN ---
        { type: "DOMAIN-SUFFIX", value: "hdslb.com" },          // Bilibili 核心静态资源与视频 CDN (防B站图片加载不出)
        { type: "DOMAIN-SUFFIX", value: "doubanio.com" },       // 豆瓣图片与静态 CDN
        { type: "DOMAIN-SUFFIX", value: "smzdm.com" },          // 什么值得买
        { type: "DOMAIN-SUFFIX", value: "taptap.com" },         // TapTap 游戏社区

        // --- 局域网与保留 IPv4 地址 (必须包含 no-resolve 防止触发不必要的 DNS 解析) ---
        { type: "IP-CIDR", value: "0.0.0.0/8", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "10.0.0.0/8", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "100.64.0.0/10", options: ["no-resolve"] },   // 运营商级 NAT (CGNAT)
        { type: "IP-CIDR", value: "127.0.0.0/8", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "169.254.0.0/16", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "172.16.0.0/12", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "192.168.0.0/16", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "224.0.0.0/4", options: ["no-resolve"] },     // 组播地址
        { type: "IP-CIDR", value: "240.0.0.0/4", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "255.255.255.255/32", options: ["no-resolve"] },

        // --- 局域网与保留 IPv6 地址 (必须包含 no-resolve) ---
        { type: "IP-CIDR6", value: "::1/128", options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "fc00::/7", options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "fe80::/10", options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "ff00::/8", options: ["no-resolve"] },

        // --- 规则集兜底 (局域网) ---
        { type: "GEOIP", value: "private", options: ["no-resolve"] },
        { type: "GEOIP", value: "LAN", options: ["no-resolve"] },

        // --- 规则集兜底 (中国大陆) ---
        { type: "GEOSITE", value: "CN" },
        { type: "GEOIP", value: "CN", options: ["no-resolve"] }
    ],
    // 兜底
    [POLICY.DEFAULT]: [
        { type: "MATCH" }
    ]
};

// ================================
// 主流程
// ================================

/**
 * Flash 覆写脚本入口。
 * 输入订阅配置，输出替换了代理组和规则的新配置。
 */
function main(config) {
    const proxies = Array.isArray(config.proxies)
        ? config.proxies.filter((proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim())
        : [];

    if (!proxies.length) {
        return config;
    }

    const taggedProxies = proxies.map(tagProxy);
    const nodePools = buildNodePools(taggedProxies);

    config.mode = RUNTIME_CONFIG.mode;
    config["proxy-groups"] = buildProxyGroups(nodePools);
    config.rules = buildRules();

    return config;
}

/**
 * 给单个节点打标签。
 * 所有后续分组都只基于 tags 运行，不再在分组阶段写杂乱判断。
 */
function tagProxy(proxy) {
    const name = String(proxy.name || "");
    const type = String(proxy.type || "");
    const tags = new Set(["全部节点"]);

    TAG_RULES.name.forEach((rule) => {
        if (rule.keywords.some((keyword) => containsText(name, keyword))) {
            tags.add(rule.tag);
        }
    });

    TAG_RULES.type.forEach((rule) => {
        if (rule.values.includes(type)) {
            tags.add(rule.tag);
        }
    });

    if (![...tags].some((tag) => tag.startsWith("地区:"))) {
        tags.add("地区:其他");
    }
    if (![...tags].some((tag) => tag.startsWith("用途:"))) {
        tags.add("用途:通用");
    }
    if (!tags.has("倍率:低")) {
        tags.add("倍率:常规");
    }
    if (!tags.has("稳定:高") && !tags.has("稳定:低")) {
        tags.add("稳定:未知");
    }
    if (!tags.has("带宽:高")) {
        tags.add("带宽:常规");
    }

    return { name, type, tags };
}

/**
 * 根据标签池生成节点组群。
 * 这里只构建“自动测速节点池”，不负责业务规则落地。
 */
function buildNodePools(taggedProxies) {
    const pools = {
        all: uniqueNames(taggedProxies.map((proxy) => proxy.name))
    };

    NODE_GROUP_RULES.forEach((rule) => {
        const matched = taggedProxies
            .filter((proxy) => hasAllTags(proxy.tags, rule.includeTags) && hasNoTags(proxy.tags, rule.excludeTags))
            .sort((left, right) => scoreProxy(right, rule.preferTags) - scoreProxy(left, rule.preferTags));

        pools[rule.key] = matched.length
            ? uniqueNames(matched.map((proxy) => proxy.name))
            : resolveFallbackPool(rule.fallbackKeys, pools);
    });

    return pools;
}

/**
 * 生成最终的 Clash 代理组。
 * 这一步同时生成：
 * 1. 节点组群（url-test）
 * 2. 业务组群（select）
 */
function buildProxyGroups(nodePools) {
    const groups = [
        {
            name: GROUP_NAME.manual,
            type: "select",
            proxies: nodePools.all
        }
    ];

    BUSINESS_GROUP_RULES.forEach((rule) => {
        groups.push({
            name: rule.name,
            type: rule.type,
            proxies: uniqueNames(rule.defaults.concat([GROUP_NAME.manual]))
        });
    });

    NODE_GROUP_RULES.forEach((rule) => {
        groups.push({
            name: rule.name,
            type: RUNTIME_CONFIG.autoTest.type,
            url: RUNTIME_CONFIG.autoTest.url,
            interval: RUNTIME_CONFIG.autoTest.interval,
            tolerance: RUNTIME_CONFIG.autoTest.tolerance,
            proxies: nodePools[rule.key]
        });
    });

    return groups;
}

/**
 * 按业务策略配置生成规则。
 * 规则顺序由 RULE_ORDER 控制，具体条目由 RULE_SECTIONS 控制。
 */
function buildRules() {
    const rules = [];

    RULE_ORDER.forEach((policy) => {
        const section = Array.isArray(RULE_SECTIONS[policy]) ? RULE_SECTIONS[policy] : [];

        section.forEach((rule) => {
            rules.push(serializeRule(policy, rule));
        });
    });

    return rules;
}

/**
 * 把单条规则配置序列化成 Clash 规则字符串。
 */
function serializeRule(policy, rule) {
    const target = POLICY_TARGET[policy] || GROUP_NAME.fallbackControl;
    const options = Array.isArray(rule.options) ? rule.options : [];

    if (rule.type === "MATCH") {
        return ["MATCH", target].concat(options).join(",");
    }

    return [rule.type, rule.value, target].concat(options).join(",");
}

/**
 * 文本包含判断。统一转小写，避免大小写问题。
 */
function containsText(text, keyword) {
    return String(text).toLowerCase().includes(String(keyword).toLowerCase());
}

/**
 * 判断节点是否同时命中所有必需标签。
 */
function hasAllTags(tagSet, includeTags) {
    return includeTags.every((tag) => tagSet.has(tag));
}

/**
 * 判断节点是否避开所有排除标签。
 */
function hasNoTags(tagSet, excludeTags) {
    return excludeTags.every((tag) => !tagSet.has(tag));
}

/**
 * 节点排序分数。
 * 这里只影响列表顺序和首选展示，不决定 url-test 的最终测速结果。
 * 实际延迟与 timeout 风险，运行时由 Clash 的 url-test 接管。
 */
function scoreProxy(proxy, preferTags) {
    return preferTags.reduce((score, tag, index) => {
        if (!proxy.tags.has(tag)) {
            return score;
        }

        return score + (preferTags.length - index);
    }, 0);
}

/**
 * 节点池为空时，按配置回退到其它池。
 */
function resolveFallbackPool(fallbackKeys, pools) {
    for (const key of fallbackKeys) {
        if (Array.isArray(pools[key]) && pools[key].length) {
            return pools[key];
        }
    }

    return [];
}

/**
 * 去重并清理空节点名。
 */
function uniqueNames(names) {
    return [...new Set(names.filter((name) => typeof name === "string" && name))];
}

if (typeof module !== "undefined") {
    module.exports = { main };
}
