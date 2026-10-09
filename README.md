# omp-i18n-zh

把 [omp](https://omp.sh/)（oh-my-pi 编码代理）的**斜杠命令菜单、参数补全、选中说明**翻译成简体中文。

非官方社区扩展。基于 omp 的公开扩展 API 实现，无需修改或重新编译 omp 本体。

```
❯ ⬢  model             模型：xiaomi/mimo-v2.6-flash
   🛡  security          规划、执行、检查、导入并对比 OMP 原生安全扫描
   🎛  settings          打开设置菜单
   🗺  plan              计划模式：关闭
   🎯 goal              目标模式：关闭
```

## 安装

### 作为插件安装（推荐）

```sh
omp plugin install omp-i18n-zh
```

安装后重启 omp，斜杠菜单即为中文。

### 手动放置

```sh
git clone https://github.com/BAISD007/omp-i18n-zh.git ~/.omp/agent/extensions/omp-i18n-zh
```

若手动放置的是仓库根目录，请把 `src/index.ts` 复制到 `~/.omp/agent/extensions/`：

```sh
cp ~/.omp/agent/extensions/omp-i18n-zh/src/index.ts ~/.omp/agent/extensions/omp-i18n-zh.ts
```

### 临时试用单个文件

```sh
omp -e /path/to/omp-i18n-zh/src/index.ts
```

## 用法

会话内输入 `/zh` 切换：

| 命令 | 作用 |
| --- | --- |
| `/zh` | 开/关切换 |
| `/zh on` | 开启中文 |
| `/zh off` | 关闭（切回英文） |

## 覆盖范围

**会翻译：**

- `/` 主菜单里所有命令的描述（约 60 条）
- 参数补全下拉项：`/effort` `/todo` `/goal` `/mcp` `/memory` `/skills` `/advisor` `/security` `/shake` `/ssh` `/collab` `/modelpreset` 等（约 120 条）
- 选中条目时显示的补充说明（`nativeDetail`）
- 输入命令后的灰色参数提示（inline hint）
- 动态状态文案：`Plan: off` → `计划模式：关闭`、`Tools: 12 active / 20 available` → `工具：12 已启用 / 20 可用`

**不会翻译（插件 API 够不着）：**

| 内容 | 原因 |
| --- | --- |
| 命令名本身（`/model`、`/plan` …） | 改了会导致补全错位、匹配失败 |
| 图标 | 内置符号名，非文案 |
| Tip 提示行 | 编译进二进制，不走补全通道 |
| 启动 Warning 等通知 | 文案由宿主写死，插件只能自己发通知 |
| 设置面板 | 无扩展接口 |
| 状态栏、footer / header | `setFooter` / `setHeader` 在交互模式下是 no-op |
| 参数用法提示（`<objective>`、`[--scope project\|user]`） | 实际要输入的语法，翻译会误导 |

## 工作原理

omp 的扩展 API 提供 `ctx.ui.addAutocompleteProvider(factory)`，允许包裹内置的补全 provider。本扩展在包裹层拿到 `AutocompleteItem[]`，改写其中的 `description` / `nativeDetail` / `state`，再交回渲染。

`label`、`value`、`icon` 一律不动 —— 前两者决定补全行为和输入回填。

翻译表是普通 JS 对象（`src/index.ts` 里的 `EXACT`），改文案不需要重新编译：

- 静态文案：`EXACT["Open settings menu"] = "打开设置菜单"`
- 动态文案：在 `PREFIX` 里加一条前缀规则，状态值部分原样保留
- 状态片段：在 `STATE_FRAGMENTS` 里加，**按字面长度降序匹配**（必须让 `"none saved"` 先于 `"none"` 命中，否则会留下没人接的 `saved`）

新增条目时注意边界：模型 id、URL、上下文数字（`1% (6,782/1,048,576)`）不应被翻译。词边界检查已处理 `supercalifragilistic` 里 `on` 不被误拆这类情况。

## 兼容性

需要 omp >= 16（`addAutocompleteProvider` 自 v16 起提供）。在 omp v18.8.6 上开发与测试。

omp 更新后如果界面文案有变化，新出现的英文条目会直接显示英文 —— 往 `EXACT` 里补一条即可。欢迎提 issue 或 PR 带上截图。

## 参与贡献

翻译文案改进欢迎 PR。请在 PR 描述里附上改动前后的截图。

## 许可

MIT，见 [LICENSE](./LICENSE)。

本项目是第三方社区扩展，与 oh-my-pi 作者无隶属关系。