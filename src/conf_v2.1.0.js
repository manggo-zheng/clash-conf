// 业务细化版。进一步拆分了“节点组群”与“业务组群”，并细化了 BUSINESS_GROUP_RULES

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
    [POLICY.AI]: [
        { type: "DOMAIN", value: "gemini.google.com" },
        { type: "DOMAIN", value: "makersuite.google.com" },
        { type: "DOMAIN-SUFFIX", value: "openai.com" },
        { type: "DOMAIN-SUFFIX", value: "oaistatic.com" },
        { type: "DOMAIN-SUFFIX", value: "oaiusercontent.com" },
        { type: "DOMAIN-SUFFIX", value: "chatgpt.com" },
        { type: "DOMAIN-SUFFIX", value: "claude.ai" },
        { type: "DOMAIN-SUFFIX", value: "anthropic.com" },
        { type: "DOMAIN-SUFFIX", value: "ai.google.dev" },
        { type: "DOMAIN-SUFFIX", value: "googleapis.com" },
        { type: "DOMAIN-SUFFIX", value: "aistudio.google.com" },
        { type: "DOMAIN-SUFFIX", value: "openrouter.ai" },
        { type: "GEOSITE", value: "category-ai-!cn" },
        { type: "DOMAIN-KEYWORD", value: "gemini" },
        { type: "DOMAIN-KEYWORD", value: "anthropic" },
    ],
    [POLICY.VIDEO]: [
        { type: "DOMAIN-SUFFIX", value: "youtube.com" },
        { type: "DOMAIN-SUFFIX", value: "youtu.be" },
        { type: "DOMAIN-SUFFIX", value: "netflix.com" },
        { type: "GEOSITE", value: "youtube" },
        { type: "GEOSITE", value: "netflix" },
        { type: "DOMAIN-SUFFIX", value: "x.com" },
        { type: "DOMAIN-SUFFIX", value: "twitter.com" },
        { type: "GEOSITE", value: "twitter" }
    ],
    [POLICY.DEV]: [
        { type: "DOMAIN", value: "api.github.com" },
        { type: "DOMAIN", value: "raw.githubusercontent.com" },
        { type: "DOMAIN-SUFFIX", value: "github.com" },
        { type: "DOMAIN-SUFFIX", value: "githubusercontent.com" },
        { type: "GEOSITE", value: "github" }
    ],
    [POLICY.DOWNLOAD]: [
        { type: "DOMAIN-KEYWORD", value: "torrent" },
        { type: "DOMAIN-KEYWORD", value: "tracker" },
        { type: "DOMAIN-KEYWORD", value: "aria2" }
    ],
    [POLICY.BLOCK]: [
        { type: "GEOSITE", value: "category-ads-all" }
    ],
    [POLICY.CN]: [
        { type: "DOMAIN-SUFFIX", value: "local" },
        { type: "IP-CIDR", value: "0.0.0.0/8", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "10.0.0.0/8", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "100.64.0.0/10", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "127.0.0.0/8", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "169.254.0.0/16", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "172.16.0.0/12", options: ["no-resolve"] },
        { type: "IP-CIDR", value: "192.168.0.0/16", options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "::1/128", options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "fc00::/7", options: ["no-resolve"] },
        { type: "IP-CIDR6", value: "fe80::/10", options: ["no-resolve"] },
        { type: "GEOIP", value: "private", options: ["no-resolve"] },
        { type: "GEOIP", value: "LAN", options: ["no-resolve"] },
        { type: "GEOSITE", value: "CN" },
        { type: "GEOIP", value: "CN", options: ["no-resolve"] }
    ],
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
