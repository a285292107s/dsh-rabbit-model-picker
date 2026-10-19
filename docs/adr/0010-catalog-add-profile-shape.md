# ADR 0010 — 目录路由添加写最小 profile，协议编辑只给手写路由

- 状态：已采纳（2026-10-19）
- 相关：`src/client/CatalogAddCard.tsx`、`src/client/ModelConfigPage.tsx`、`src/client/modelConfigModel.ts`；
  上游 `@deepseek-ai/dsh-llm-pi-ai/lib/index.js:926-938`
- 取代：此前「点击目录候选行直接写 `apiKeyEnv` + 首个协议」的添加写法

## 背景

本页的「添加模型提供商」原来是一键写 profile：点击休眠提供商就写
`{ apiKeyEnv: <派生引用>, api: <协议 union 第一项> }`。对照官方「模型」页后发现两件事：

1. **写 `api` 不是无害覆盖。** `pi-ai` 只有在 `spec.api === undefined` 时才复用内置目录的 provider
   （`reuseCatalogProvider`）；一旦 profile 里写了 `api`，它会按这个协议另建一个 provider。
   于是给 Anthropic 类目录路由添加时，`openai-completions` 会被当成它的真实协议。
2. **写 `apiKeyEnv` 会改变鉴权路径。** 对 OAuth / 免密钥路由，这会把「提供商用自身认证」改成
   「本页管理的密钥引用」，行上也会被标成缺密钥。

官方对应的做法是：目录添加卡里嵌完整编辑器，用户没填任何字段时写空 profile `{}`
（`materializesNativeProfile`，`client.js:1936-1941`），密钥可空；协议只对手写路由开放
（`ownsIdentity`，`client.js:1993`）。

## 决定

1. 目录候选行的添加改为一张行内卡：可以填 API 密钥与 API 地址，二者都可空。提交时只写用户实际填的字段：
   `baseURL`（非空时）与 `apiKeyEnv`（仅当填了密钥时）；**不写 `api`**。什么都没填就写 `{}`，
   让内置目录的端点、协议、模型与原生鉴权继续生效。
2. 保存密钥时，若该 pi-ai 路由尚未命名 `apiKeyEnv`，先把它绑定到派生引用，再写凭据；
   DeepSeek 路由不写 `apiKeyEnv`。
3. 协议编辑（以及「覆盖 / 恢复默认」）只对 `pi-ai` 且 `declared === true` 的手写路由开放；
   目录路由不再提供协议覆盖入口。
4. 未知适配器的 namespace 不再渲染凭据 / 地址 / 协议等泛化字段，只提示其余字段在
   `cordis.patch.yml`；避免向适配器 schema 不认识的字段写入。

## 取舍

- **放弃「在目录添加时选协议」**：这正是写坏目录路由的入口。需要覆盖协议的部署仍可直接编辑
  `cordis.patch.yml`，与官方一致。
- **目录添加不是完整编辑器**：显示名、模型目录仍走添加后的设置井；添加卡只承担
  「密钥 / 地址」这一类必须一次给全的字段，避免把两种编辑形态混在一张卡里。
- **未知 namespace 只读**：本页不再尝试兼容 schema 未知的适配器；它们自己的设置页（若有）
  仍是权威入口。

## 后果

- 目录添加不再需要二次进入设置井补密钥（地址同理）。
- `api` 不再被本页写进目录路由的 profile；协议继承由内置目录决定。
- 新增 `CatalogAddCard`；`ModelConfigPage` 的旧添加分支删除。
- 校验与文案：密钥非法时在添加卡内阻止提交；未知适配器的提示走 `config.provider.unknown`。
