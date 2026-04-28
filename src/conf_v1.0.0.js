// 初始正式版。实现了最基础的节点分析、分组和规则硬编码
function main(config) {
    const proxies = config.proxies || [];

    // 如果没有节点，直接返回原配置避免报错
    if (proxies.length === 0) return config;

    // 1. 节点打标签分析
    const proxyTags = proxies.map(p => ({
        name: p.name,
        ...analyzeProxy(p)
    }));

    // 2. 根据标签构建不同业务的节点名称列表
    const lists = buildProxyLists(proxyTags);

    // 3. 构建代理组 (Proxy Groups)
    config["proxy-groups"] = buildProxyGroups(lists);

    // 4. 构建规则 (Rules)
    config["rules"] = buildRules();

    return config;
}

// ==========================================
// 模块 1: 节点能力识别分析 (Tagging)
// ==========================================
function analyzeProxy(proxy) {
    const name = proxy.name || "";
    const type = proxy.type || "";

    let tags = {
        region: 'OTHER',
        cost: 'normal',
        bandwidth: 'normal',
        stability: 'unknown',
        usage: 'general'
    };

    // 1.1 地区识别 (Region)
    if (/US|美国/i.test(name)) tags.region = 'US';
    else if (/JP|日本/i.test(name)) tags.region = 'JP';
    else if (/SG|狮城|新加坡/i.test(name)) tags.region = 'SG';
    else if (/HK|香港/i.test(name)) tags.region = 'HK';
    else if (/TW|台湾/i.test(name)) tags.region = 'TW';
    else if (/KR|韩国/i.test(name)) tags.region = 'KR';
    else if (/UK|英国/i.test(name)) tags.region = 'UK';
    else if (/DE|德国/i.test(name)) tags.region = 'DE';
    else if (/FR|法国/i.test(name)) tags.region = 'FR';

    // 1.2 成本识别 (Cost)
    if (/0\.5|h-|h\d/i.test(name) || name.includes('h-0.5')) tags.cost = 'low';
    else if (/1\.1|2倍|3倍|5倍|10倍/i.test(name)) tags.cost = 'high';

    // 1.3 带宽识别 (Bandwidth)
    if (type === 'hysteria2' || type === 'hysteria') tags.bandwidth = 'high';

    // 1.4 稳定性识别 (Stability)
    if (/VIP|移动友好/i.test(name)) tags.stability = 'high';
    else if (/不保证可用/i.test(name)) tags.stability = 'low';

    // 1.5 用途识别 (Usage)
    if (/ai|gpt/i.test(name)) tags.usage = 'ai';
    else if (/bt|下载/i.test(name)) tags.usage = 'download';
    else if (/游戏|game/i.test(name)) tags.usage = 'game';
    else if (/学术/i.test(name)) tags.usage = 'dev';

    return tags;
}

// ==========================================
// 模块 2: 分组节点池筛选 (Filtering)
// ==========================================
function buildProxyLists(tagsList) {
    let lists = {
        general: [],
        ai: [],
        video: [],
        download: [],
        fallback: []
    };

    // 筛选全量可用兜底节点 (排除不保证可用和高倍率游戏)
    lists.fallback = tagsList
        .filter(t => t.stability !== 'low' && t.usage !== 'game')
        .map(t => t.name);

    // AI 节点池: 优先带 ai 标签的，其次取 US/SG/JP/HK 的高稳定性节点 (不取0.5倍率)
    let aiNodes = tagsList.filter(t => t.usage === 'ai').map(t => t.name);
    if (aiNodes.length < 3) {
        let aiSupplements = tagsList
            .filter(t => t.usage === 'general' && t.cost !== 'low' && t.stability === 'high' && ['US', 'SG', 'JP', 'HK'].includes(t.region))
            .map(t => t.name);
        aiNodes = [...new Set([...aiNodes, ...aiSupplements])]; // 合并去重
    }
    lists.ai = aiNodes;

    // 视频节点池: 优先 0.5倍率，允许吞吐型
    lists.video = tagsList
        .filter(t => t.cost === 'low' || t.bandwidth === 'high')
        .map(t => t.name);

    // 下载节点池: 优先 bt下载标签，其次 hysteria2
    lists.download = tagsList
        .filter(t => t.usage === 'download' || t.bandwidth === 'high' || t.cost === 'low')
        .map(t => t.name);

    // 通用海外节点池: 排除专门业务，尽量不含 0.5倍率，优先 VIP
    lists.general = tagsList
        .filter(t => t.usage !== 'ai' && t.usage !== 'download' && t.usage !== 'game' && t.stability !== 'low')
        .sort((a, b) => (b.stability === 'high' ? 1 : 0) - (a.stability === 'high' ? 1 : 0)) // VIP优先
        .map(t => t.name);

    return lists;
}

// 防崩溃保障函数
function safeProxies(targetList, fallbackList) {
    if (targetList && targetList.length > 0) return targetList;
    if (fallbackList && fallbackList.length > 0) return fallbackList;
    return ["DIRECT"];
}

// ==========================================
// 模块 3: 构建新策略组 (Proxy Groups)
// ==========================================
function buildProxyGroups(lists) {
    // 基础的 URL-Test 自动测速配置
    const autoCfg = {
        type: "url-test",
        url: "https://cp.cloudflare.com",
        interval: 300,
        tolerance: 50
    };

    return [
        // 顶级手动控制层
        {
            name: "🚀 节点选择",
            type: "select",
            proxies: ["AUTO_GENERAL", "AUTO_AI", "AUTO_VIDEO", "AUTO_DOWNLOAD", "DIRECT", "REJECT", ...safeProxies(lists.general, lists.fallback)]
        },
        // 各个自动化业务组
        {
            name: "AUTO_GENERAL",
            ...autoCfg,
            proxies: safeProxies(lists.general, lists.fallback)
        },
        {
            name: "AUTO_AI",
            ...autoCfg,
            proxies: safeProxies(lists.ai, lists.general)
        },
        {
            name: "AUTO_VIDEO",
            ...autoCfg,
            proxies: safeProxies(lists.video, lists.fallback)
        },
        {
            name: "AUTO_DOWNLOAD",
            ...autoCfg,
            proxies: safeProxies(lists.download, lists.fallback)
        },
        {
            name: "AUTO_FALLBACK",
            ...autoCfg,
            proxies: safeProxies(lists.fallback, ["DIRECT"])
        }
    ];
}

// ==========================================
// 模块 4: 静态规则重构 (Rules)
// ==========================================
function buildRules() {
    return [
        // ====== SECTION 0: 精确映射规则 ======
        "DOMAIN-SUFFIX,openai.com,AUTO_AI",
        "DOMAIN-SUFFIX,chatgpt.com,AUTO_AI",
        "DOMAIN-SUFFIX,claude.ai,AUTO_AI",
        "DOMAIN-SUFFIX,anthropic.com,AUTO_AI",
        "DOMAIN-KEYWORD,gemini,AUTO_AI",
        "DOMAIN-SUFFIX,ai.google.dev,AUTO_AI",
        "DOMAIN-SUFFIX,makersuite.google.com,AUTO_AI",

        "DOMAIN-SUFFIX,youtube.com,AUTO_VIDEO",
        "DOMAIN-SUFFIX,youtu.be,AUTO_VIDEO",
        "DOMAIN-SUFFIX,netflix.com,AUTO_VIDEO",

        "DOMAIN-SUFFIX,github.com,AUTO_GENERAL",
        "DOMAIN-SUFFIX,api.github.com,AUTO_GENERAL",
        "DOMAIN-SUFFIX,raw.githubusercontent.com,AUTO_GENERAL",

        // ====== SECTION 1: 高优先级业务规则 ======
        "GEOSITE,category-ads-all,REJECT",
        "GEOSITE,openai,AUTO_AI",
        "GEOSITE,youtube,AUTO_VIDEO",
        "GEOSITE,netflix,AUTO_VIDEO",
        "DOMAIN-KEYWORD,torrent,AUTO_DOWNLOAD",
        "DOMAIN-KEYWORD,tracker,AUTO_DOWNLOAD",

        // ====== SECTION 2: 国内与直连规则 ======
        "DOMAIN-SUFFIX,local,DIRECT",
        "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
        "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
        "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
        "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
        "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
        "IP-CIDR6,::1/128,DIRECT,no-resolve",
        "IP-CIDR6,fc00::/7,DIRECT,no-resolve",
        "IP-CIDR6,fe80::/10,DIRECT,no-resolve",
        "GEOSITE,cn,DIRECT",
        "GEOIP,CN,DIRECT",

        // ====== SECTION 3: 默认规则兜底 ======
        "MATCH,AUTO_FALLBACK"
    ];
}