// 架构重构版。引入了 TAG_RULES 配置驱动模式，将节点识别从硬编码改为标签池

// ================================
// 可维护配置区：后续主要改这里
// ================================

// 固定策略名。规则层使用策略名，最终再映射到代理组或内建动作。
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

// Clash 运行参数。测速地址和间隔也集中在这里维护。
const RUNTIME_CONFIG = {
    mode: "rule",
    autoTest: {
        type: "url-test",
        url: "https://cp.cloudflare.com/generate_204",
        interval: 300,  // 每300秒自动测速一次节点延迟
        tolerance: 50  // 容忍度50毫秒，新节点需比当前最佳快50ms以上才切换
    }
};

// 前端显示用的中文组名。
const GROUP_NAME = {
    entry: "代理总控",
    manual: "手动选择",
    fallback: "兜底节点",
    general: "通用海外",
    ai: "AI 专用",
    video: "视频节点",
    download: "下载节点"
};

// 节点名称 -> 标签。只要机场命名变了，优先改这里。
// 所有标签都走同一个标签池：地区、倍率、稳定性、用途等都统一在这里定义。
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

// 业务组规则。
// 规则含义：
// 1. includeTags：节点必须同时命中这些标签
// 2. excludeTags：节点不能命中这些标签
// 3. preferTags：排序优先级，越靠前越优先
// 4. fallbackKeys：本组为空时依次回退到哪些组
const GROUP_RULES = [
    {
        key: "fallback",
        name: GROUP_NAME.fallback,
        includeTags: ["全部节点"],
        excludeTags: ["用途:游戏", "稳定:低"],
        preferTags: ["稳定:高", "地区:香港", "地区:台湾", "地区:日本", "地区:新加坡", "地区:美国"],
        fallbackKeys: ["all"]
    },
    {
        key: "general",
        name: GROUP_NAME.general,
        includeTags: ["全部节点"],
        excludeTags: ["用途:AI", "用途:下载", "用途:游戏", "稳定:低", "倍率:低"],
        preferTags: ["稳定:高", "地区:香港", "地区:台湾", "地区:日本", "地区:新加坡", "地区:美国", "带宽:高"],
        fallbackKeys: ["fallback", "all"]
    },
    {
        key: "ai",
        name: GROUP_NAME.ai,
        includeTags: ["全部节点"],
        excludeTags: ["用途:下载", "用途:游戏", "稳定:低", "倍率:低", "地区:香港", "地区:台湾", "地区:越南"],
        preferTags: ["用途:AI", "倍率:高", "稳定:高"],
        fallbackKeys: ["general", "fallback", "all"]
    },
    {
        key: "video",
        name: GROUP_NAME.video,
        includeTags: ["倍率:低"],
        excludeTags: ["用途:AI", "用途:游戏"],
        preferTags: ["带宽:高", "用途:下载", "稳定:高"],
        fallbackKeys: ["fallback", "general", "all"]
    },
    {
        key: "download",
        name: GROUP_NAME.download,
        includeTags: ["带宽:高"],
        excludeTags: ["用途:AI", "用途:游戏"],
        preferTags: ["用途:下载", "倍率:低", "稳定:高"],
        fallbackKeys: ["video", "fallback", "all"]
    }
];

// 策略 -> 目标组/动作映射。
const POLICY_TARGET = {
    [POLICY.CN]: "DIRECT",
    [POLICY.GLOBAL]: GROUP_NAME.general,
    [POLICY.AI]: GROUP_NAME.ai,
    [POLICY.VIDEO]: GROUP_NAME.video,
    [POLICY.DOWNLOAD]: GROUP_NAME.download,
    [POLICY.DEV]: GROUP_NAME.general,
    [POLICY.BLOCK]: "REJECT",
    [POLICY.DEFAULT]: GROUP_NAME.fallback
};

// 业务规则配置。后续补规则主要改这里，不需要改主体逻辑。
const RULE_SECTIONS = [
    //
    [
        { type: "DOMAIN", value: "gemini.google.com", policy: POLICY.AI },
        { type: "DOMAIN", value: "makersuite.google.com", policy: POLICY.AI },
        { type: "DOMAIN", value: "api.github.com", policy: POLICY.DEV },
        { type: "DOMAIN", value: "raw.githubusercontent.com", policy: POLICY.DEV }
    ],
    [
        { type: "DOMAIN-SUFFIX", value: "openai.com", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "oaistatic.com", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "oaiusercontent.com", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "chatgpt.com", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "claude.ai", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "anthropic.com", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "ai.google.dev", policy: POLICY.AI },
        { type: "DOMAIN-SUFFIX", value: "openrouter.ai", policy: POLICY.AI },

        { type: "DOMAIN-SUFFIX", value: "youtube.com", policy: POLICY.VIDEO },
        { type: "DOMAIN-SUFFIX", value: "youtu.be", policy: POLICY.VIDEO },
        { type: "DOMAIN-SUFFIX", value: "netflix.com", policy: POLICY.VIDEO },

        { type: "DOMAIN-SUFFIX", value: "github.com", policy: POLICY.DEV },
        { type: "DOMAIN-SUFFIX", value: "githubusercontent.com", policy: POLICY.DEV }
    ],
    [
        { type: "GEOSITE", value: "category-ads-all", policy: POLICY.BLOCK },
        { type: "GEOSITE", value: "category-ai-!cn", policy: POLICY.AI },
        { type: "GEOSITE", value: "github", policy: POLICY.DEV },
        { type: "GEOSITE", value: "youtube", policy: POLICY.VIDEO },
        { type: "GEOSITE", value: "netflix", policy: POLICY.VIDEO },

        { type: "DOMAIN-KEYWORD", value: "gemini", policy: POLICY.AI },
        { type: "DOMAIN-KEYWORD", value: "anthropic", policy: POLICY.AI },
        { type: "DOMAIN-KEYWORD", value: "torrent", policy: POLICY.DOWNLOAD },
        { type: "DOMAIN-KEYWORD", value: "tracker", policy: POLICY.DOWNLOAD },
        { type: "DOMAIN-KEYWORD", value: "aria2", policy: POLICY.DOWNLOAD }
    ],
    [
        { type: "DOMAIN-SUFFIX", value: "local", policy: POLICY.CN },
        { type: "IP-CIDR", value: "0.0.0.0/8", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR", value: "10.0.0.0/8", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR", value: "100.64.0.0/10", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR", value: "127.0.0.0/8", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR", value: "169.254.0.0/16", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR", value: "172.16.0.0/12", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR", value: "192.168.0.0/16", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "::1/128", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "fc00::/7", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "fe80::/10", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "GEOIP", value: "private", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "GEOIP", value: "LAN", policy: POLICY.CN, options: ["no-resolve"] },
        { type: "GEOSITE", value: "CN", policy: POLICY.CN },
        { type: "GEOIP", value: "CN", policy: POLICY.CN, options: ["no-resolve"] }
    ],
    [
        { type: "MATCH", policy: POLICY.DEFAULT }
    ]
];

// ================================
// 主流程：脚本只保留必要逻辑
// ================================

function main(config) {
    const proxies = Array.isArray(config.proxies)
        ? config.proxies.filter((proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim())
        : [];

    if (!proxies.length) {
        return config;
    }

    const taggedProxies = proxies.map(tagProxy);
    const proxyPools = buildProxyPools(taggedProxies);

    config.mode = RUNTIME_CONFIG.mode;
    config["proxy-groups"] = buildProxyGroups(proxyPools);
    config.rules = buildRules();

    return config;
}

// 给每个节点打标签。标签统一进一个 Set，后续所有组都只看标签，不再看复杂条件。
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
        if (rule.values.some((value) => value === type)) {
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

    return {
        name,
        type,
        tags
    };
}

// 先生成全部节点池，再按组规则生成业务池。
function buildProxyPools(taggedProxies) {
    const pools = {
        all: sortNames(taggedProxies, [])
    };

    GROUP_RULES.forEach((rule) => {
        const matched = taggedProxies
            .filter((proxy) => hasAllTags(proxy.tags, rule.includeTags) && hasNoTags(proxy.tags, rule.excludeTags))
            .sort((left, right) => scoreProxy(right, rule.preferTags) - scoreProxy(left, rule.preferTags));

        pools[rule.key] = matched.length
            ? uniqueNames(matched.map((proxy) => proxy.name))
            : resolveFallbackPool(rule.fallbackKeys, pools);
    });

    return pools;
}

// 构建前端展示的代理组。这里只保留一个总控组、一个手动组和几个业务自动组。
function buildProxyGroups(pools) {
    const autoTest = RUNTIME_CONFIG.autoTest;

    return [
        {
            name: GROUP_NAME.entry,
            type: "select",
            proxies: [
                GROUP_NAME.general,
                GROUP_NAME.ai,
                GROUP_NAME.video,
                GROUP_NAME.download,
                GROUP_NAME.fallback,
                GROUP_NAME.manual
            ]
        },
        {
            name: GROUP_NAME.manual,
            type: "select",
            proxies: pools.all
        },
        {
            name: GROUP_NAME.general,
            ...autoTest,
            proxies: pools.general
        },
        {
            name: GROUP_NAME.ai,
            ...autoTest,
            proxies: pools.ai
        },
        {
            name: GROUP_NAME.video,
            ...autoTest,
            proxies: pools.video
        },
        {
            name: GROUP_NAME.download,
            ...autoTest,
            proxies: pools.download
        },
        {
            name: GROUP_NAME.fallback,
            ...autoTest,
            proxies: pools.fallback
        }
    ];
}

// 规则也完全走配置。主体逻辑只负责把 policy 翻译成最终目标。
function buildRules() {
    return RULE_SECTIONS
        .flat()
        .map((rule) => serializeRule(rule));
}

function serializeRule(rule) {
    const target = POLICY_TARGET[rule.policy] || POLICY_TARGET[POLICY.DEFAULT];
    const options = Array.isArray(rule.options) ? rule.options : [];

    if (rule.type === "MATCH") {
        return ["MATCH", target].concat(options).join(",");
    }

    return [rule.type, rule.value, target].concat(options).join(",");
}

// ================================
// 小工具函数：保持少量、够用即可
// ================================

function containsText(text, keyword) {
    if (!keyword) {
        return false;
    }

    return String(text).toLowerCase().includes(String(keyword).toLowerCase());
}

function hasAllTags(tagSet, includeTags) {
    return includeTags.every((tag) => tagSet.has(tag));
}

function hasNoTags(tagSet, excludeTags) {
    return excludeTags.every((tag) => !tagSet.has(tag));
}

// 同一个标签池下，preferTags 只负责排序，不负责是否入组选中。
function scoreProxy(proxy, preferTags) {
    return preferTags.reduce((score, tag, index) => {
        if (!proxy.tags.has(tag)) {
            return score;
        }

        return score + (preferTags.length - index);
    }, 0);
}

function resolveFallbackPool(fallbackKeys, pools) {
    for (const key of fallbackKeys) {
        if (Array.isArray(pools[key]) && pools[key].length) {
            return pools[key];
        }
    }

    return [];
}

function sortNames(taggedProxies, preferTags) {
    return uniqueNames(
        taggedProxies
            .slice()
            .sort((left, right) => scoreProxy(right, preferTags) - scoreProxy(left, preferTags))
            .map((proxy) => proxy.name)
    );
}

function uniqueNames(names) {
    return [...new Set(names.filter((name) => typeof name === "string" && name))];
}

if (typeof module !== "undefined") {
    module.exports = { main };
}
