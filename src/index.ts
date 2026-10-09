/**
 * omp-i18n-zh — omp (oh-my-pi) 简体中文扩展
 *
 * 原理：ctx.ui.addAutocompleteProvider(factory) 让我们包裹内置的补全 provider，
 * 拿到 AutocompleteItem[] 后改写 description / nativeDetail / state，再交回渲染。
 *
 * 翻译表在 src/translations.json，改完执行 /zh reload 立即生效，无需重启。
 *
 * 边界（插件 API 够不着的地方，保持英文）：
 *   - label / value：命令名本身。改了会导致补全错位和匹配失败。
 *   - icon / iconName：内置符号名，非文案。
 *   - Tip 提示行、启动 Warning：编译进二进制，不走补全通道。
 *   - 设置面板、状态栏、footer/header：无插件接口。
 *
 * 开关：/zh on | /zh off | /zh reload
 */

import translations from "./translations.json" with { type: "json" };

type Item = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  iconName?: string;
  nativeDetail?: string;
  state?: string;
  hint?: string;
};

type Provider = {
  getSuggestions: (...a: any[]) => Promise<any>;
  applyCompletion: (...a: any[]) => any;
  getInlineHint?: (...a: any[]) => string | null;
  trySyncSlashCompletion?: (...a: any[]) => any;
  trySyncInlineReplace?: (...a: any[]) => any;
};

/** 可变的翻译表状态：/zh reload 会整体替换。 */
let EXACT: Record<string, string> = { ...translations.exact };
let PREFIX: Array<[string, string]> = translations.prefix.map(p => [p[0], p[1]]);
let STATE_FRAGMENTS: Array<[string, string]> = translations.state.map(p => [p[0], p[1]]);
let PREFIX_SORTED: Array<[string, string]> = [];
let STATE_SORTED: Array<[string, string]> = [];

/** 动态文案会追加后缀，最常见的是 /effort 的 "Deep reasoning (~16k tokens) (current)"。 */
const SUFFIXES: Array<[string, string]> = [[" (current)", "（当前）"]];

function resort() {
  // 必须按字面长度降序：让 "none saved" 先于 "none" 命中，
  // 否则会先替换掉 "none"，留下一个没人接的 "saved"。
  PREFIX_SORTED = [...PREFIX].sort((a, b) => b[0].length - a[0].length);
  STATE_SORTED = [...STATE_FRAGMENTS].sort((a, b) => b[0].length - a[0].length);
}
resort();

/**
 * 翻译状态值片段。
 * 逐条扫描：命中最长的片段后跳过其长度，避免 "none" 抢在 "none saved" 前面。
 * 带词边界检查，避免 "on" 命中 "provider" 或 "supercalifragilistic" 里的 on。
 */
function translateState(s: string): string {
  let out = s;
  for (const [en, zh] of STATE_SORTED) {
    let idx = out.indexOf(en);
    while (idx !== -1) {
      const before = idx === 0 ? " " : out[idx - 1];
      const afterIdx = idx + en.length;
      const after = afterIdx >= out.length ? " " : out[afterIdx];
      const isWord = /[A-Za-z]/.test(en[0]);
      const boundaryOk =
        !isWord || (!/[A-Za-z]/.test(before) && !/[A-Za-z]/.test(after));
      if (boundaryOk) {
        out = out.slice(0, idx) + zh + out.slice(afterIdx);
        idx = out.indexOf(en, idx + zh.length);
      } else {
        idx = out.indexOf(en, idx + 1);
      }
    }
  }
  return out;
}

/** 动态文案：匹配可译前缀，剩余部分（通常是 state 值）交给 translateState。 */
function translateDynamic(text: string): string {
  for (const [en, zh] of PREFIX_SORTED) {
    if (text.startsWith(en)) {
      return zh + translateState(text.slice(en.length));
    }
  }
  return text;
}

function translateText(text: string | undefined): string | undefined {
  if (!text) return text;
  const direct = EXACT[text];
  if (direct) return direct;

  for (const [en, zh] of SUFFIXES) {
    if (text.endsWith(en)) {
      const translated = EXACT[text.slice(0, -en.length)];
      if (translated) return translated + zh;
    }
  }

  return translateDynamic(text);
}

/** 改写单个补全条目。只动文案，label / value / icon 一律不碰。 */
function translateItem(it: Item): Item {
  const next: Item = { ...it };
  const d = translateText(it.description);
  if (d !== it.description) next.description = d;
  const nd = translateText(it.nativeDetail);
  if (nd !== it.nativeDetail) next.nativeDetail = nd;
  if (it.state) {
    const st = translateDynamic(it.state);
    if (st !== it.state) next.state = st;
  }
  return next;
}

// ---- 运行时状态 ----
let enabled = true;
const renderers: Array<() => void> = [];

function repaint() {
  for (const r of renderers) {
    try {
      r();
    } catch {
      /* 某些模式无 requestRender，忽略 */
    }
  }
}

/**
 * /zh reload：绕过 import 缓存重新读 translations.json。
 * 加时间戳 query 让模块系统当成新 URL 重新求值。
 */
async function reloadTranslations(): Promise<{ ok: boolean; message: string }> {
  try {
    const url = new URL("./translations.json", import.meta.url);
    url.searchParams.set("_", String(Date.now()));
    const mod: any = await import(url.href);
    const next = mod.default ?? mod;

    if (!next || typeof next !== "object" || !next.exact) {
      return { ok: false, message: "翻译表格式不对：缺少 exact 字段" };
    }
    const count = Object.keys(next.exact).length;
    if (count === 0) {
      return { ok: false, message: "翻译表是空的，已保留原有内容" };
    }

    EXACT = { ...next.exact };
    PREFIX = (next.prefix ?? []).map((p: string[]) => [p[0], p[1]]);
    STATE_FRAGMENTS = (next.state ?? []).map((p: string[]) => [p[0], p[1]]);
    resort();

    return {
      ok: true,
      message: `翻译表已重载：${count} 条`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `重载失败：${msg}（已保留原有翻译）` };
  }
}

export default function ompZh(pi: any) {
  pi.registerCommand("zh", {
    description: "斜杠菜单汉化开关：/zh on、/zh off、/zh reload",
    handler: async (args: string, ctx: any) => {
      const a = (args ?? "").trim().toLowerCase();

      if (a === "reload") {
        const { ok, message } = await reloadTranslations();
        if (ok) repaint();
        ctx.ui.notify(message, ok ? "info" : "error");
        return;
      }

      if (a === "off" || a === "0" || a === "false") enabled = false;
      else if (a === "on" || a === "1" || a === "true") enabled = true;
      else if (a === "toggle") enabled = !enabled;
      else if (a === "status") {
        // status 走下面的 notify，不改开关
      }

      if (a !== "status") repaint();
      ctx.ui.notify(
        a === "status"
          ? `斜杠命令菜单：${enabled ? "中文" : "英文"}`
          : enabled
            ? "斜杠命令菜单：中文"
            : "Slash menu: English",
        "info",
      );
    },
  });

  pi.on("session_start", async (_e: any, ctx: any) => {
    ctx.ui.addAutocompleteProvider((current: Provider) => ({
      async getSuggestions(...args: any[]) {
        const res = await (current.getSuggestions as any)(...args);
        if (!enabled || !res || !Array.isArray(res.items)) return res;
        return { ...res, items: res.items.map((it: Item) => translateItem(it)) };
      },

      applyCompletion(...args: any[]) {
        return (current.applyCompletion as any)(...args);
      },

      // inline hint：打 /model 后输入框里那行灰色提示
      getInlineHint(...args: any[]) {
        const h = current.getInlineHint?.(...args);
        if (!enabled || !h) return h ?? null;
        return translateText(h) ?? null;
      },

      trySyncSlashCompletion(...args: any[]) {
        const res = current.trySyncSlashCompletion?.(...args);
        if (!enabled || !res || !Array.isArray(res.items)) return res ?? null;
        return {
          ...res,
          items: res.items.map((it: Item) => translateItem(it)),
        };
      },
    }));

    renderers.push(() => {
      try {
        ctx.ui.requestRender?.();
      } catch {
        /* 忽略 */
      }
    });
  });
}