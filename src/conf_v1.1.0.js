// 功能增强版。在 v1 基础上引入了复杂的评分系统 (scoreAI, scoreGeneral) 和多维度排序逻辑

const POLICY = Object.freeze({
    CN: "POLICY_CN",
    GLOBAL: "POLICY_GLOBAL",
    AI: "POLICY_AI",
    VIDEO: "POLICY_VIDEO",
    DOWNLOAD: "POLICY_DOWNLOAD",
    DEV: "POLICY_DEV",
    BLOCK: "POLICY_BLOCK",
    DEFAULT: "POLICY_DEFAULT"
});

const POLICY_TARGET = Object.freeze({
    [POLICY.CN]: "DIRECT",
    [POLICY.GLOBAL]: "AUTO_GENERAL",
    [POLICY.AI]: "AUTO_AI",
    [POLICY.VIDEO]: "AUTO_VIDEO",
    [POLICY.DOWNLOAD]: "AUTO_DOWNLOAD",
    [POLICY.DEV]: "AUTO_GENERAL",
    [POLICY.BLOCK]: "REJECT",
    [POLICY.DEFAULT]: "AUTO_FALLBACK"
});

const AI_REGION_PRIORITY = ["US", "SG", "JP", "HK", "TW", "KR"];
const GENERAL_REGION_PRIORITY = ["HK", "TW", "JP", "SG", "US", "KR", "DE", "UK", "FR", "OTHER"];

const REGION_RULES = [
    { region: "US", pattern: /(?:\bUS\b|\bUSA\b|美国|🇺🇸)/i },
    { region: "JP", pattern: /(?:\bJP\b|日本|东京|大阪|🇯🇵)/i },
    { region: "SG", pattern: /(?:\bSG\b|新加坡|狮城|🇸🇬)/i },
    { region: "HK", pattern: /(?:\bHK\b|香港|🇭🇰)/i },
    { region: "TW", pattern: /(?:\bTW\b|台湾|台北|新北|🇹🇼)/i },
    { region: "KR", pattern: /(?:\bKR\b|韩国|首尔|🇰🇷)/i },
    { region: "UK", pattern: /(?:\bUK\b|英国|伦敦|🇬🇧)/i },
    { region: "DE", pattern: /(?:\bDE\b|德国|法兰克福|柏林|🇩🇪)/i },
    { region: "FR", pattern: /(?:\bFR\b|法国|巴黎|🇫🇷)/i }
];

const main = (config) => {
    const proxies = Array.isArray(config.proxies)
        ? config.proxies.filter((proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim())
        : [];

    if (!proxies.length) {
        return config;
    }

    const proxyTags = proxies.map((proxy) => ({
        name: proxy.name,
        type: proxy.type || "",
        ...analyzeProxy(proxy)
    }));

    const lists = buildProxyLists(proxyTags);

    config.mode = "rule";
    config["proxy-groups"] = buildProxyGroups(lists);
    config.rules = buildRules();

    return config;
};

function analyzeProxy(proxy) {
    const name = String(proxy.name || "");
    const type = String(proxy.type || "");

    return {
        region: detectRegion(name),
        cost: detectCost(name),
        bandwidth: detectBandwidth(type),
        stability: detectStability(name),
        usage: detectUsage(name)
    };
}

function detectRegion(name) {
    for (const rule of REGION_RULES) {
        if (rule.pattern.test(name)) {
            return rule.region;
        }
    }

    return "OTHER";
}

function detectCost(name) {
    if (/0(?:\.|．)5\s*(?:倍率|x)/i.test(name)) {
        return "low";
    }

    return "normal";
}

function detectBandwidth(type) {
    if (type === "hysteria2" || type === "hysteria") {
        return "high";
    }

    return "normal";
}

function detectStability(name) {
    if (/不保证可用|测试|试用/i.test(name)) {
        return "low";
    }

    if (/VIP|移动友好|专用|专线/i.test(name)) {
        return "high";
    }

    return "unknown";
}

function detectUsage(name) {
    if (/(?:ai专用|openai|chatgpt|claude|gemini|\bgpt\b|cursor)/i.test(name)) {
        return "ai";
    }

    if (/(?:bt下载|torrent|aria2|下载)/i.test(name)) {
        return "download";
    }

    if (/(?:游戏|game)/i.test(name)) {
        return "game";
    }

    if (/(?:学术|github|开发|\bdev\b)/i.test(name)) {
        return "dev";
    }

    return "general";
}

function buildProxyLists(tagsList) {
    const all = sortWith(tagsList, compareFallback).map((item) => item.name);

    const fallbackPrimary = sortWith(
        tagsList.filter((item) => item.usage !== "game" && item.stability !== "low"),
        compareFallback
    );
    const fallbackSecondary = sortWith(
        tagsList.filter((item) => item.usage !== "game"),
        compareFallback
    );

    const generalPrimary = sortWith(
        tagsList.filter(
            (item) =>
                item.usage !== "ai" &&
                item.usage !== "download" &&
                item.usage !== "game" &&
                item.cost !== "low" &&
                item.stability !== "low"
        ),
        compareGeneral
    );
    const generalSecondary = sortWith(
        tagsList.filter(
            (item) =>
                item.usage !== "ai" &&
                item.usage !== "download" &&
                item.usage !== "game" &&
                item.stability !== "low"
        ),
        compareGeneral
    );

    const aiPrimary = sortWith(
        tagsList.filter((item) => item.usage === "ai" && item.cost !== "low" && item.stability !== "low"),
        compareAI
    );
    const aiPreferredStable = sortWith(
        tagsList.filter(
            (item) =>
                item.usage !== "download" &&
                item.usage !== "game" &&
                item.cost !== "low" &&
                item.stability === "high" &&
                AI_REGION_PRIORITY.includes(item.region)
        ),
        compareAI
    );
    const aiPreferred = sortWith(
        tagsList.filter(
            (item) =>
                item.usage !== "download" &&
                item.usage !== "game" &&
                item.cost !== "low" &&
                item.stability !== "low" &&
                AI_REGION_PRIORITY.includes(item.region)
        ),
        compareAI
    );
    const aiStable = sortWith(
        tagsList.filter(
            (item) =>
                item.usage !== "download" &&
                item.usage !== "game" &&
                item.cost !== "low" &&
                item.stability !== "low"
        ),
        compareAI
    );

    const videoPrimary = sortWith(
        tagsList.filter(
            (item) =>
                item.cost === "low" &&
                item.usage !== "download" &&
                item.usage !== "ai" &&
                item.usage !== "game"
        ),
        compareVideo
    );
    const videoSecondary = sortWith(
        tagsList.filter((item) => item.cost === "low" && item.usage !== "ai" && item.usage !== "game"),
        compareVideo
    );
    const videoFallback = sortWith(
        tagsList.filter(
            (item) =>
                item.bandwidth === "high" &&
                item.usage !== "download" &&
                item.usage !== "ai" &&
                item.usage !== "game" &&
                item.stability !== "low"
        ),
        compareVideo
    );

    const downloadPrimary = sortWith(
        tagsList.filter((item) => item.usage === "download"),
        compareDownload
    );
    const downloadHighBandwidth = sortWith(
        tagsList.filter(
            (item) => item.bandwidth === "high" && item.usage !== "ai" && item.usage !== "game"
        ),
        compareDownload
    );
    const downloadLowCost = sortWith(
        tagsList.filter((item) => item.cost === "low" && item.usage !== "ai" && item.usage !== "game"),
        compareDownload
    );

    let aiList = aiPrimary.slice();
    aiList = extendList(aiList, aiPreferredStable, 4);
    aiList = extendList(aiList, aiPreferred, 6);
    aiList = extendList(aiList, aiStable, 8);

    let downloadList = downloadPrimary.slice();
    downloadList = extendList(downloadList, downloadHighBandwidth, 4);
    downloadList = extendList(downloadList, downloadLowCost, 8);

    return {
        all,
        fallback: namesOf(firstNonEmpty(fallbackPrimary, fallbackSecondary, tagsList)),
        general: namesOf(firstNonEmpty(generalPrimary, generalSecondary, fallbackPrimary, tagsList)),
        ai: namesOf(firstNonEmpty(aiList, aiPreferredStable, aiPreferred, aiStable, fallbackPrimary, tagsList)),
        video: namesOf(firstNonEmpty(videoPrimary, videoSecondary, videoFallback, fallbackPrimary, tagsList)),
        download: namesOf(firstNonEmpty(downloadList, downloadHighBandwidth, downloadLowCost, fallbackPrimary, tagsList))
    };
}

function buildProxyGroups(lists) {
    const autoConfig = {
        type: "url-test",
        url: "https://cp.cloudflare.com/generate_204",
        interval: 300,
        tolerance: 50
    };

    return [
        {
            name: "PROXY",
            type: "select",
            proxies: ["AUTO_GENERAL", "AUTO_AI", "AUTO_VIDEO", "AUTO_DOWNLOAD", "AUTO_FALLBACK", "MANUAL"]
        },
        {
            name: "MANUAL",
            type: "select",
            proxies: safeProxyNames(lists.all, lists.fallback, lists.general)
        },
        {
            name: "AUTO_GENERAL",
            ...autoConfig,
            proxies: safeProxyNames(lists.general, lists.fallback, lists.all)
        },
        {
            name: "AUTO_AI",
            ...autoConfig,
            proxies: safeProxyNames(lists.ai, lists.general, lists.fallback, lists.all)
        },
        {
            name: "AUTO_VIDEO",
            ...autoConfig,
            proxies: safeProxyNames(lists.video, lists.fallback, lists.general, lists.all)
        },
        {
            name: "AUTO_DOWNLOAD",
            ...autoConfig,
            proxies: safeProxyNames(lists.download, lists.fallback, lists.general, lists.all)
        },
        {
            name: "AUTO_FALLBACK",
            ...autoConfig,
            proxies: safeProxyNames(lists.fallback, lists.general, lists.all)
        }
    ];
}

function buildRules() {
    const rules = [
        rule("DOMAIN", "gemini.google.com", POLICY.AI),
        rule("DOMAIN", "makersuite.google.com", POLICY.AI),
        rule("DOMAIN", "api.github.com", POLICY.DEV),
        rule("DOMAIN", "raw.githubusercontent.com", POLICY.DEV),

        rule("DOMAIN-SUFFIX", "openai.com", POLICY.AI),
        rule("DOMAIN-SUFFIX", "oaistatic.com", POLICY.AI),
        rule("DOMAIN-SUFFIX", "oaiusercontent.com", POLICY.AI),
        rule("DOMAIN-SUFFIX", "chatgpt.com", POLICY.AI),
        rule("DOMAIN-SUFFIX", "claude.ai", POLICY.AI),
        rule("DOMAIN-SUFFIX", "anthropic.com", POLICY.AI),
        rule("DOMAIN-SUFFIX", "ai.google.dev", POLICY.AI),
        rule("DOMAIN-SUFFIX", "openrouter.ai", POLICY.AI),

        rule("DOMAIN-SUFFIX", "youtube.com", POLICY.VIDEO),
        rule("DOMAIN-SUFFIX", "youtu.be", POLICY.VIDEO),
        rule("DOMAIN-SUFFIX", "netflix.com", POLICY.VIDEO),

        rule("DOMAIN-SUFFIX", "github.com", POLICY.DEV),
        rule("DOMAIN-SUFFIX", "githubusercontent.com", POLICY.DEV),

        rule("GEOSITE", "category-ads-all", POLICY.BLOCK),
        rule("GEOSITE", "category-ai-!cn", POLICY.AI),
        rule("GEOSITE", "github", POLICY.DEV),
        rule("GEOSITE", "youtube", POLICY.VIDEO),
        rule("GEOSITE", "netflix", POLICY.VIDEO),

        rule("DOMAIN-KEYWORD", "gemini", POLICY.AI),
        rule("DOMAIN-KEYWORD", "anthropic", POLICY.AI),
        rule("DOMAIN-KEYWORD", "torrent", POLICY.DOWNLOAD),
        rule("DOMAIN-KEYWORD", "tracker", POLICY.DOWNLOAD),
        rule("DOMAIN-KEYWORD", "aria2", POLICY.DOWNLOAD),

        rule("DOMAIN-SUFFIX", "local", POLICY.CN),
        rule("IP-CIDR", "0.0.0.0/8", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR", "10.0.0.0/8", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR", "100.64.0.0/10", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR", "127.0.0.0/8", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR", "169.254.0.0/16", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR", "172.16.0.0/12", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR", "192.168.0.0/16", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR6", "::1/128", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR6", "fc00::/7", POLICY.CN, ["no-resolve"]),
        rule("IP-CIDR6", "fe80::/10", POLICY.CN, ["no-resolve"]),
        rule("GEOIP", "private", POLICY.CN, ["no-resolve"]),
        rule("GEOIP", "LAN", POLICY.CN, ["no-resolve"]),
        rule("GEOSITE", "CN", POLICY.CN),
        rule("GEOIP", "CN", POLICY.CN, ["no-resolve"]),

        matchRule(POLICY.DEFAULT)
    ];

    return rules.map(serializeRule);
}

function rule(type, value, policy, options) {
    return {
        type,
        value,
        policy,
        options: Array.isArray(options) ? options : []
    };
}

function matchRule(policy) {
    return {
        type: "MATCH",
        policy,
        options: []
    };
}

function serializeRule(item) {
    const target = POLICY_TARGET[item.policy] || item.policy;

    if (item.type === "MATCH") {
        return ["MATCH", target].concat(item.options).join(",");
    }

    return [item.type, item.value, target].concat(item.options).join(",");
}

function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
        const list = dedupeByName(arguments[index]);
        if (list.length > 0) {
            return list;
        }
    }

    return [];
}

function extendList(base, supplement, minCount) {
    const current = dedupeByName(base);

    if (current.length >= minCount) {
        return current;
    }

    return dedupeByName(current.concat(supplement));
}

function sortWith(list, comparator) {
    return dedupeByName(list.slice().sort(comparator));
}

function dedupeByName(list) {
    const source = Array.isArray(list) ? list : [];
    const seen = new Set();

    return source.filter((item) => {
        if (!item || !item.name || seen.has(item.name)) {
            return false;
        }

        seen.add(item.name);
        return true;
    });
}

function namesOf(list) {
    return dedupeByName(list).map((item) => item.name);
}

function safeProxyNames() {
    for (let index = 0; index < arguments.length; index += 1) {
        const list = Array.isArray(arguments[index]) ? arguments[index] : [];
        const output = [];
        const seen = new Set();

        for (const name of list) {
            if (typeof name === "string" && name && !seen.has(name)) {
                seen.add(name);
                output.push(name);
            }
        }

        if (output.length > 0) {
            return output;
        }
    }

    return [];
}

function compareAI(a, b) {
    return compareScore(scoreAI(b), scoreAI(a), a.name, b.name);
}

function compareGeneral(a, b) {
    return compareScore(scoreGeneral(b), scoreGeneral(a), a.name, b.name);
}

function compareVideo(a, b) {
    return compareScore(scoreVideo(b), scoreVideo(a), a.name, b.name);
}

function compareDownload(a, b) {
    return compareScore(scoreDownload(b), scoreDownload(a), a.name, b.name);
}

function compareFallback(a, b) {
    return compareScore(scoreFallback(b), scoreFallback(a), a.name, b.name);
}

function compareScore(leftScore, rightScore, leftName, rightName) {
    if (leftScore !== rightScore) {
        return leftScore - rightScore;
    }

    return String(leftName).localeCompare(String(rightName));
}

function scoreAI(item) {
    return (
        (item.usage === "ai" ? 30 : 0) +
        scoreStability(item) * 6 +
        scoreRegion(item, AI_REGION_PRIORITY) * 4 +
        scoreNonLowCost(item) * 5 +
        scoreBandwidth(item)
    );
}

function scoreGeneral(item) {
    return (
        scoreStability(item) * 6 +
        scoreNonLowCost(item) * 6 +
        scoreRegion(item, GENERAL_REGION_PRIORITY) * 2 +
        scoreBandwidth(item)
    );
}

function scoreVideo(item) {
    return (
        (item.cost === "low" ? 20 : 0) +
        (item.usage === "download" ? -8 : 0) +
        scoreBandwidth(item) * 3 +
        scoreStability(item) * 2
    );
}

function scoreDownload(item) {
    return (
        (item.usage === "download" ? 24 : 0) +
        scoreBandwidth(item) * 8 +
        (item.cost === "low" ? 6 : 0) +
        scoreStability(item) * 2
    );
}

function scoreFallback(item) {
    return (
        scoreStability(item) * 6 +
        scoreNonLowCost(item) * 3 +
        (item.usage === "game" ? -10 : 0)
    );
}

function scoreStability(item) {
    if (item.stability === "high") {
        return 3;
    }

    if (item.stability === "unknown") {
        return 2;
    }

    return 1;
}

function scoreNonLowCost(item) {
    return item.cost === "low" ? 0 : 2;
}

function scoreBandwidth(item) {
    return item.bandwidth === "high" ? 2 : 1;
}

function scoreRegion(item, priority) {
    const index = priority.indexOf(item.region);
    return index === -1 ? 0 : priority.length - index;
}

if (typeof module !== "undefined") {
    module.exports = { main };
}
