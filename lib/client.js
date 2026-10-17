window.__ModuleLoader__.load({
  id: "dsh-rabbit-model-picker",
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    "use strict";
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    
    // src/client/index.ts
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);
    
    // src/client/adapterCatalog.ts
    var ADAPTER_CATALOGS = [
      { providers: ["dsh-opencode-go"], namespace: "opencodeGoModels" }
    ];
    async function readCatalog(ctx, namespace) {
      const face = ctx.get(`remote.${namespace}`);
      if (typeof face?.read !== "function") {
        throw new Error(`the ${namespace} remote is not mounted`);
      }
      const result = await face.read();
      if (!result.ok) return [];
      const models = result.value?.models;
      return Array.isArray(models) ? models : [];
    }
    
    // src/client/contract.ts
    function rowKey(provider, model) {
      return `${provider}/${model}`;
    }
    
    // src/client/snapshotEq.ts
    function sameSnapshot(left, right) {
      if (Object.is(left, right)) return true;
      if (typeof left !== "object" || typeof right !== "object") return false;
      if (left === null || right === null) return false;
      if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        if (left.length !== right.length) return false;
        return left.every((item, index) => sameSnapshot(item, right[index]));
      }
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every(
        (key) => Object.hasOwn(right, key) && sameSnapshot(left[key], right[key])
      );
    }
    
    // src/client/capabilities.ts
    var INITIAL_SNAPSHOT = { routes: {} };
    function positiveInteger(value) {
      return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : void 0;
    }
    function routeCapabilityOf(model) {
      const declared = Array.isArray(model.inputModalities) ? model.inputModalities.filter((modality) => typeof modality === "string") : [];
      const inputModalities = declared.length === 0 ? void 0 : declared;
      const contextWindow = positiveInteger(model.contextWindow);
      const maxTokens = positiveInteger(model.maxTokens);
      if (inputModalities === void 0 && contextWindow === void 0 && maxTokens === void 0) return null;
      return {
        ...inputModalities === void 0 ? {} : { inputModalities },
        ...contextWindow === void 0 ? {} : { contextWindow },
        ...maxTokens === void 0 ? {} : { maxTokens }
      };
    }
    var CapabilityStore = class {
      /**
       * @param llm - resolves the LLM Remote face, or null when this deployment
       *   mounts none. A RESOLVER rather than the face itself because the Remote
       *   namespaces mount asynchronously: reading it when a route is asked for is
       *   what keeps the wiring independent of activation order.
       */
      constructor(llm) {
        this.llm = llm;
      }
      listeners = /* @__PURE__ */ new Set();
      sources = [];
      /** Providers a read has been dispatched for. */
      asked = /* @__PURE__ */ new Set();
      /** Providers whose read is still in flight. */
      inflight = /* @__PURE__ */ new Set();
      /** Asked, but the read never reached an answer: the next open tries again. */
      unanswered = /* @__PURE__ */ new Set();
      /** Providers whose in-flight read predates a reader registered for them. */
      requeue = /* @__PURE__ */ new Set();
      routes = {};
      snapshot = INITIAL_SNAPSHOT;
      directory = null;
      /** Subscribe to snapshot changes. @param listener - called after any change. */
      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      }
      /**
       * The current snapshot, stable until something changes.
       * @returns the snapshot handed to React.
       */
      getSnapshot() {
        return this.snapshot;
      }
      /**
       * Read these providers' routes.
       *
       * Called from a render path (the menu opening, the panel mounting), so it only
       * schedules work: a provider already answered costs nothing, and a failure
       * leaves the facts absent rather than surfacing an error — these facts are
       * decoration on a surface that already works without them. A provider whose
       * earlier ask never reached an answer is asked again.
       * @param providers - provider route ids whose models are on screen.
       */
      ensure(providers) {
        for (const provider of providers) {
          if (provider.length === 0) continue;
          if (this.asked.has(provider) && !this.unanswered.has(provider)) continue;
          this.asked.add(provider);
          this.unanswered.delete(provider);
          void this.read(provider);
        }
      }
      /**
       * Add an adapter-owned catalog reader.
       *
       * Registered by the wiring, which may land AFTER the picker has already asked
       * for the routes this reader answers for (the picker's first ask races plugin
       * activation); those asks are re-run here, which is what keeps mount order
       * irrelevant. A reader whose adapter is not installed simply never answers.
       * @param source - the reader and the routes it claims.
       */
      addSource(source) {
        this.sources.push(source);
        for (const provider of source.providers) {
          if (this.inflight.has(provider)) {
            this.requeue.add(provider);
            continue;
          }
          if (!this.asked.has(provider) && !this.unanswered.has(provider)) continue;
          this.asked.delete(provider);
          this.unanswered.delete(provider);
          this.ensure([provider]);
        }
      }
      /**
       * Interrogate one provider, once.
       *
       * Both outcomes — an answer and a failure — settle the ask the same way, so the
       * settle is written once at the end rather than per branch. That is not
       * tidiness: the requeue below is a decision about the ASK, and it is exactly as
       * true of an ask that failed as of one that answered (see
       * {@link requeueRacingReader}).
       * @param provider - provider route id.
       */
      async read(provider) {
        if (this.inflight.has(provider)) return;
        this.inflight.add(provider);
        let models = null;
        try {
          models = await this.fetch(provider);
        } catch {
          this.unanswered.add(provider);
        }
        this.inflight.delete(provider);
        if (models !== null && Array.isArray(models)) {
          for (const model of models) {
            if (typeof model?.id !== "string" || model.id.length === 0) continue;
            const capability = routeCapabilityOf(model);
            if (capability !== null) this.routes[rowKey(provider, model.id)] = capability;
          }
        }
        this.publish();
        this.requeueRacingReader(provider);
      }
      /**
       * Re-run an ask that a reader registered while it was in flight could not see.
       *
       * THE RACE THIS CLOSES. A reader is registered by the wiring, which may land
       * after the picker has already asked for the routes that reader answers for —
       * `addSource` documents that as the ordinary case, not an edge one. The running
       * read cannot carry the reader's facts, so it is parked and re-run once it
       * settles.
       *
       * It is called on BOTH settle paths, and that is the whole point. Hanging it off
       * the success path alone left two defects in one place: a reader that arrived
       * during an ask that FAILED — which is precisely the async-mount race this
       * store exists to absorb, an unmounted LLM face or a dead transport — was never
       * re-run, so the mount order the store promises to be independent of decided
       * whether the facts ever arrived; and the parked entry stayed in the requeue set
       * forever, so it later forced a SECOND read of a provider that had already been
       * answered, breaking the one-call-per-provider-per-page-load budget below.
       *
       * `asked` and `unanswered` are both cleared before the re-ask so it is a real
       * fresh ask: `ensure` skips a provider it believes it has already asked, and the
       * re-run must not inherit either verdict from the read that went out without
       * this reader.
       * @param provider - the provider whose ask just settled.
       */
      requeueRacingReader(provider) {
        if (!this.requeue.delete(provider)) return;
        this.asked.delete(provider);
        this.unanswered.delete(provider);
        this.ensure([provider]);
      }
      /**
       * Read one provider's published models through whichever way in applies.
       * @param provider - provider route id.
       * @returns its models; an EMPTY list is an answer ("published none"), and an
       *   answered provider is never asked again.
       * @throws when no answer arrived at all — the LLM face is not mounted yet,
       *   the provider directory read failed, the transport rejected. `read` marks
       *   the ask retryable instead of consuming it.
       */
      async fetch(provider) {
        const source = this.sources.find((candidate) => candidate.providers.includes(provider));
        if (source !== void 0) return await source.read();
        const llm = this.llm();
        const discover = llm?.discoverModels;
        if (llm === null || llm === void 0 || discover === void 0) {
          throw new Error("the llm remote is not mounted");
        }
        const directory = await this.providers(llm);
        const entry = directory.find((candidate) => candidate.provider === provider);
        if (entry === void 0 || entry.declared === true) return [];
        const result = await discover.call(llm, entry.settingsNs, { provider });
        return result.ok ? result.value : [];
      }
      /**
       * The provider directory, read once and shared by every later lookup.
       * @param llm - the LLM face to read it from.
       * @returns the directory.
       * @throws when the directory read fails — a failed read must not be cached as
       *   an empty answer (see `read`).
       */
      async providers(llm) {
        if (this.directory !== null) return this.directory;
        const result = await llm.listConfigurableProviders();
        if (!result.ok) throw new Error(result.error.message);
        this.directory = result.value;
        return result.value;
      }
      /**
       * Replace the snapshot and wake every subscriber — but only when the answer
       * actually differs from the one in hand.
       *
       * WHY THE GUARD. `useSyncExternalStore` re-renders a component when the
       * snapshot it reads stops being `Object.is`-equal to the last one it saw, and
       * this store's snapshot is built here, so comparing references can never help:
       * every publish would hand React a new object. Comparing the CONTENT is
       * therefore the only way to avoid the re-render, and it is worth avoiding —
       * a read that answers "this provider published nothing" lands here with an
       * unchanged payload, and the model list would otherwise re-render for it.
       *
       * `routes` is copied only when something is published, so a no-op publish keeps
       * handing back the very same snapshot object.
       */
      publish() {
        const next = { routes: { ...this.routes } };
        if (sameSnapshot(this.snapshot, next)) return;
        this.snapshot = next;
        for (const listener of this.listeners) listener();
      }
    };
    
    // src/client/dictionary.ts
    var NS = "dsh-rabbit-model-picker";
    var zh = {
      "provider.account": "DeepSeek 账号",
      "provider.all": "全部",
      "provider.group": "模型提供商",
      // The rail scopes the LIST, never the search: a query that hits models under
      // another provider says how many instead of reading as "no such model".
      "provider.elsewhere": "其他提供商还有 {count} 个匹配",
      "provider.showAll": "显示全部",
      "provider.failed": "加载失败",
      "empty.provider": "该提供商没有可用模型。",
      "empty.providerSearch": "这个提供商里没有匹配的模型。",
      "trigger.fallback": "请选择模型",
      "trigger.loading": "正在加载模型…",
      "trigger.selectAria": "请选择模型",
      // The trigger shows `provider/model` (§5.26), so the sentence names both: the
      // provider is what tells two same-named models apart, and a screen reader user
      // gets the same two-part identity the visible label carries.
      "trigger.aria": "选择模型，当前 {provider}/{model}",
      "trigger.ariaEffort": "选择模型，当前 {provider}/{model}，推理等级 {effort}",
      "menu.aria": "模型与推理等级",
      "menu.model": "模型",
      "search.placeholder": "搜索模型…",
      "search.clear": "清除搜索",
      "effort.providerDefault": "Default",
      "badge.text.on": "文字输入",
      "badge.text.off": "不支持文字输入",
      "badge.image.on": "图片输入",
      "badge.image.off": "不支持图片输入",
      // "推理" is the verb form of the fact the column states, and the stem of the
      // panel's "推理等级" — the strip's key and the section title therefore call
      // the same concept by the same word (CONTEXT.md: 推理等级, matching the host's
      // own zh copy for `reasoning effort`).
      "badge.effort.on": "支持推理",
      "badge.effort.off": "不支持推理",
      "badge.context": "上下文窗口 {value}",
      "badge.rowAria": "{model}，{facts}",
      // The key to the strip's four columns, read once per card (see §5.24). One
      // short noun per fact, in the same order the columns are drawn: the words name
      // the columns so the row's glyphs do not have to be learned by hovering.
      "badge.key.text": "文字",
      "badge.key.image": "图片",
      "badge.key.effort": "推理",
      "badge.key.context": "窗口",
      "badge.keyAria": "每一行右侧陈述的四个事实",
      "status.loading": "正在刷新模型列表…",
      "error.action": "模型操作失败：{message}",
      "error.sessionInUse": "当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。",
      "action.reload": "重新加载",
      "warning.groupLoad": "{name} 加载失败：{message}",
      "search.empty": "没有匹配的模型。",
      "empty.models": "没有可用的模型。",
      "settings.open": "模型参数",
      "settings.openDeclared": "已自定义",
      "settings.openNoModel": "先选择模型，再编辑它的参数",
      "settings.openAria": "编辑 {model} 的模型参数",
      "settings.aria": "{model} 的模型参数",
      "settings.reset": "恢复默认",
      "settings.resetAria": "把 {model} 的参数恢复为适配器默认",
      "settings.resetNothing": "这条模型声明里没有可恢复的改动",
      "settings.listJoin": "、",
      "settings.loading": "正在读取当前参数…",
      "settings.busy": "正在应用这次选择，参数暂时不能改…",
      "settings.unavailable": "这个部署没有挂载设置服务，参数面板只能查看（推理等级仍可用）。",
      "settings.loadFailed": "读不到当前设置：{message}",
      "settings.unaddressable": "这个模型来自适配器内置目录，没有可编辑的声明，只能查看。",
      "settings.readonly": "当前配置不接受表单修改，参数面板只能查看。",
      "settings.writeFailed": "设置服务拒绝了这次修改：{message}",
      "settings.target": "写入位置：{ns} · {path}",
      "settings.input.title": "输入类型",
      "settings.input.text": "文字",
      "settings.input.image": "图片",
      "settings.input.audio": "音频",
      "settings.input.video": "视频",
      "settings.input.pdf": "PDF",
      "settings.input.declared": "已声明：{list}",
      "settings.input.default": "尚未声明，当前按适配器默认：{list}",
      "settings.input.defaultUnknown": "尚未声明，也没有适配器默认；实际输入类型由适配器内部决定。",
      "settings.input.capability": "适配器内置目录公布：{list}",
      "settings.input.needOne": "至少要保留一项输入类型；要回到默认请用「恢复默认」。",
      "settings.context.title": "上下文窗口",
      "settings.context.declared": "已声明；留空并回车 = 恢复适配器默认",
      "settings.context.default": "尚未声明；适配器声明的兜底值是 {value}，实际容量由它内部决定",
      "settings.context.capability": "适配器内置目录公布：{value}（不可编辑）",
      "settings.context.unset": "尚未声明，也没有兜底值；只有这里填了才会覆盖适配器内部的值。",
      "settings.context.invalid": "读不出这个数值：请写 128K、1M 或 131072，范围 1024–10485760",
      "settings.effort.title": "推理等级",
      "settings.note": "输入类型与上下文窗口会直接写进适配器对这个模型的声明，立即生效，与「设置 → 模型」页改的是同一处；推理等级是会话级设置，不写进声明。"
    };
    var en = {
      "provider.account": "DeepSeek Account",
      "provider.all": "All",
      "provider.group": "Model providers",
      "provider.elsewhere": "{count} more matching models in other providers",
      "provider.showAll": "Show all",
      "provider.failed": "Failed to load",
      "empty.provider": "This provider has no available models.",
      "empty.providerSearch": "No matching models in this provider.",
      "trigger.fallback": "Select model",
      "trigger.loading": "Loading models…",
      "trigger.selectAria": "Select model",
      "trigger.aria": "Select model, current {provider}/{model}",
      "trigger.ariaEffort": "Select model, current {provider}/{model}, reasoning effort {effort}",
      "menu.aria": "Model and reasoning effort",
      "menu.model": "Model",
      "search.placeholder": "Search models…",
      "search.clear": "Clear search",
      "effort.providerDefault": "Default",
      "badge.text.on": "Text input",
      "badge.text.off": "No text input",
      "badge.image.on": "Image input",
      "badge.image.off": "No image input",
      "badge.effort.on": "Supports reasoning",
      "badge.effort.off": "No reasoning",
      "badge.context": "Context window {value}",
      "badge.rowAria": "{model}: {facts}",
      "badge.key.text": "Text",
      "badge.key.image": "Images",
      "badge.key.effort": "Reasoning",
      "badge.key.context": "Window",
      "badge.keyAria": "The four facts each row states",
      "status.loading": "Refreshing model list…",
      "error.action": "Model operation failed: {message}",
      "error.sessionInUse": "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.",
      "action.reload": "Reload",
      "warning.groupLoad": "{name} failed to load: {message}",
      "search.empty": "No matching models.",
      "empty.models": "No models available.",
      "settings.open": "Model parameters",
      "settings.openDeclared": "customized",
      "settings.openNoModel": "Select a model first, then edit its parameters",
      "settings.openAria": "Edit parameters of {model}",
      "settings.aria": "Model parameters for {model}",
      "settings.reset": "Restore defaults",
      "settings.resetAria": "Restore the adapter defaults for {model}",
      "settings.resetNothing": "This model has no declared change to restore",
      "settings.listJoin": ", ",
      "settings.loading": "Reading the current parameters…",
      "settings.busy": "Applying this selection; the parameters cannot be changed for a moment…",
      "settings.unavailable": "This deployment mounts no settings service, so the panel is view-only (reasoning effort still works).",
      "settings.loadFailed": "Cannot read the current settings: {message}",
      "settings.unaddressable": "This model comes from the adapter’s installed catalog and has no declaration to edit, so it is view-only.",
      "settings.readonly": "This configuration does not accept changes; the parameters are view-only.",
      "settings.writeFailed": "The settings service refused this change: {message}",
      "settings.target": "Written to: {ns} · {path}",
      "settings.input.title": "Input types",
      "settings.input.text": "Text",
      "settings.input.image": "Image",
      "settings.input.audio": "Audio",
      "settings.input.video": "Video",
      "settings.input.pdf": "PDF",
      "settings.input.declared": "Declared: {list}",
      "settings.input.default": "Not declared yet; the adapter default is: {list}",
      "settings.input.defaultUnknown": "Not declared, and the adapter states no default; the adapter decides which input types it serves.",
      "settings.input.capability": "The adapter’s installed catalog publishes: {list}",
      "settings.input.needOne": "Keep at least one input type; use “Restore defaults” to go back to the default.",
      "settings.context.title": "Context window",
      "settings.context.declared": "Declared; clear it and press Enter to fall back to the adapter default",
      "settings.context.default": "Not declared; the adapter states a fallback of {value}, but the capacity it actually uses is its own decision",
      "settings.context.capability": "The adapter’s installed catalog publishes {value} (not editable)",
      "settings.context.unset": "Not declared, and there is no fallback; only a value here overrides whatever the adapter uses internally.",
      "settings.context.invalid": "That is not a capacity: use 128K, 1M or 131072, between 1024 and 10485760",
      "settings.effort.title": "Reasoning effort",
      "settings.note": "Input types and the context window are written straight into the adapter’s declaration for this model and take effect immediately — the same place Settings → Models edits. The reasoning effort is a session setting and is not written into the declaration."
    };
    function interpolate(template, params) {
      if (params === void 0) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
    }
    function localTranslate() {
      const language = typeof document === "undefined" ? "" : document.documentElement.lang;
      const dictionary = language.toLowerCase().startsWith("zh") ? zh : en;
      return (key, params) => interpolate(dictionary[key] ?? en[key] ?? key, params);
    }
    var dictionaries = { zh, en };
    
    // src/client/ModelConfigPage.tsx
    var import_react3 = require("react");
    
    // src/client/modelConfigCopy.ts
    var KEYS = {
      // --- page chrome ----------------------------------------------------------
      // AUTHORED: ours is the new parallel tab; the official `nav`/`title` are
      // 模型 / Models and stay with the official page.
      "config.nav": "config.nav",
      // AUTHORED, same reason (the official page separates nav from title too).
      "config.title": "config.title",
      // AUTHORED, all three: the ready statement `.dmc-readout` counts the rows' own
      // `data-state` — the page's one live sentence — and the official page has no
      // counting sentence to copy. They REPLACE `config.intro` (official `intro`
      // :3232/:3369), retired with the rewrite because "enter your API keys" stated
      // nothing the ten rows did not already state. `{count}` / `{issues}` follow the
      // existing `{name}` interpolation habit. See `docs/design-model-config-tab.md` §11.
      "config.summary.ready": "config.summary.ready",
      "config.summary.attention": "config.summary.attention",
      "config.summary.none": "config.summary.none",
      // Official: onboardingTitle :3357/:3494. Q13 does NOT copy the official
      // onboarding CARD; this is the page-top hint that replaces it, and its wording
      // is the official sentence rather than a new one.
      "config.empty.title": "config.empty.title",
      // Official: onboardingDescription :3358/:3495.
      "config.empty.description": "config.empty.description",
      // Official: loadFailed :3260/:3397.
      "config.loadFailed": "config.loadFailed",
      // Official: retry :3262/:3399.
      "config.retry": "config.retry",
      // Official: readOnly :3259/:3396.
      "config.readOnly": "config.readOnly",
      // Official: conflict :3261/:3398. Host verbatim, so its zh says 「这张卡片」; the
      // official sentence assumes the official card, and D1 applies it to OUR row or
      // catalog region. Kept verbatim on purpose — if the surface word must change, it changes
      // here, once, and the gate stays green.
      "config.conflict": "config.conflict",
      // --- provider row: auto-retry policy --------------------------------------
      // AUTHORED, all sixteen: the official Models page has no retry-policy editor,
      // so this vocabulary is ours. It arrived with the retry EDITOR, which used to be
      // a card in the official page and now opens inline under this page's own row
      // (docs/design-model-config-tab.md): the trigger word, the two field labels and
      // their units, the doubling rule that replaces the deleted bar chart, the two
      // figures that state the schedule (first wait / longest total), the
      // declared-versus-inherited state, the reset verb, the saved line, the two
      // validation sentences and the read-only notice. `{count}` is the only
      // placeholder any of them takes. Save / saving are deliberately NOT repeated
      // here — the editor reuses `config.apply` / `config.applying`.
      "config.retryPolicy.trigger": "config.retryPolicy.trigger",
      // AUTHORED (§5.35): the settings well states 自动重试 as a labelled FIELD, so the
      // action inside it cannot repeat the field's own name — it says 修改 / Edit and
      // the editor below it states the policy in force.
      "config.retryPolicy.edit": "config.retryPolicy.edit",
      "config.retryPolicy.retries": "config.retryPolicy.retries",
      "config.retryPolicy.retriesUnit": "config.retryPolicy.retriesUnit",
      "config.retryPolicy.cap": "config.retryPolicy.cap",
      "config.retryPolicy.capUnit": "config.retryPolicy.capUnit",
      "config.retryPolicy.doubling": "config.retryPolicy.doubling",
      "config.retryPolicy.recovery": "config.retryPolicy.recovery",
      "config.retryPolicy.declared": "config.retryPolicy.declared",
      "config.retryPolicy.inherits": "config.retryPolicy.inherits",
      "config.retryPolicy.first": "config.retryPolicy.first",
      "config.retryPolicy.total": "config.retryPolicy.total",
      "config.retryPolicy.always": "config.retryPolicy.always",
      "config.retryPolicy.reset": "config.retryPolicy.reset",
      "config.retryPolicy.saved": "config.retryPolicy.saved",
      "config.retryPolicy.badRetries": "config.retryPolicy.badRetries",
      "config.retryPolicy.badCap": "config.retryPolicy.badCap",
      "config.retryPolicy.unavailable": "config.retryPolicy.unavailable",
      // --- provider row: identity and credential --------------------------------
      // Official: provider :3250/:3387.
      "config.provider.label": "config.provider.label",
      // Official: deepSeekAccount :3230/:3367.
      "config.account.name": "config.account.name",
      // Official: accountSignedIn :3258/:3395.
      "config.account.signedIn": "config.account.signedIn",
      // AUTHORED: the same account row when the session is NOT signed in. The official
      // page only ever draws the signed-in state, so it has no word for the other one.
      "config.account.signedOut": "config.account.signedOut",
      // --- provider row: the verdict word ---------------------------------------
      // AUTHORED, all four: the official row states a credential DOT and never a word
      // (`client.js:2574-2578`), so this vocabulary is ours. It states the host's own
      // facts instead of inventing an action: `ready` = can serve requests,
      // `missingKey` = the named/derived reference has no value, `dormant` = the
      // route's live/dormant state (CONTEXT.md「休眠提供商」, the host's own word
      // `dormant`), `unavailable` = the catch-all. 已停用 / Disabled is FORBIDDEN here:
      // the host has no enable/disable action at all (`docs/settings-models-tab-
      // feasibility.md` §7.5), so that word would claim an action that does not exist.
      "config.verdict.ready": "config.verdict.ready",
      "config.verdict.missingKey": "config.verdict.missingKey",
      "config.verdict.dormant": "config.verdict.dormant",
      "config.verdict.unavailable": "config.verdict.unavailable",
      // Official: credentialConfigured :3256/:3393.
      "config.credential.configured": "config.credential.configured",
      // Official: credentialMissing :3257/:3394.
      "config.credential.missing": "config.credential.missing",
      // AUTHORED (§5.35): the row's settings well states the credential as ONE short
      // word beside its two actions, because the field's own label already says 凭据.
      // The long official sentences above would repeat that label as a sentence.
      "config.credential.configuredShort": "config.credential.configuredShort",
      "config.credential.missingShort": "config.credential.missingShort",
      // AUTHORED (§5.35): the label of that field in the settings well — the well is a
      // three-field form (凭据 / API 协议 / 自动重试), so each field needs a name.
      "config.credential.label": "config.credential.label",
      // AUTHORED (§5.35): the session route is the one row whose credential comes from
      // the signed-in account instead of a key this page could write.
      "config.credential.session": "config.credential.session",
      // Official: keyInput :3263/:3400. Also the label of the replace entry, which is
      // the field the official card always shows.
      "config.key.input": "config.key.input",
      // AUTHORED: the entry that replaces a stored key. The official card has no such
      // verb because its field is always on screen; A6 needs one, because ours shows
      // status only until the user asks to replace.
      "config.key.replace": "config.key.replace",
      // AUTHORED (brief §14 D1): the credential cell's own clear verb. Without it the
      // row stated 删除 twice — once here (clear the stored key) and once for the
      // provider's lifecycle (delete its profile) — and a reviewer read that as a
      // duplicated delete entry. No placeholder.
      "config.key.clear": "config.key.clear",
      // AUTHORED (§5.35): the SHORT verbs of the settings well, where the field label
      // (凭据) already names the object, so 替换 API 密钥 / 清除密钥 would repeat it. The
      // long forms above stay: the catalog region and the row's own aria labels still use them.
      "config.key.replaceShort": "config.key.replaceShort",
      "config.key.clearShort": "config.key.clearShort",
      // AUTHORED (§5.35): the credential field's PRIMARY action on a row that owes a
      // key — the only place this page asks for a value rather than reporting one.
      "config.key.add": "config.key.add",
      // Official: keyReveal :3264/:3401.
      "config.key.reveal": "config.key.reveal",
      // Official: keyHide :3265/:3402.
      "config.key.hide": "config.key.hide",
      // Official: keyPlaceholder :3266/:3403.
      "config.key.placeholder": "config.key.placeholder",
      // Official: keyPlaceholderFallback :3267/:3404. `{hint}` is the env var name.
      "config.key.placeholderFallback": "config.key.placeholderFallback",
      // Official: keyPlaceholderSaved :3268/:3405.
      "config.key.placeholderSaved": "config.key.placeholderSaved",
      // Official: keyFallbackDetected :3270/:3407. `{hint}`.
      "config.key.fallbackDetected": "config.key.fallbackDetected",
      // Official: keyFallbackDetectedHidden :3271/:3408.
      "config.key.fallbackDetectedHidden": "config.key.fallbackDetectedHidden",
      // Official: keyFallbackMissing :3269/:3406. `{hint}`.
      "config.key.fallbackMissing": "config.key.fallbackMissing",
      // Official: keyFallbackUnchecked :3272/:3409.
      "config.key.fallbackUnchecked": "config.key.fallbackUnchecked",
      // Official: keyHelp :3273/:3410. `{env}` is the ordered fallback list.
      "config.key.help": "config.key.help",
      // Official: keyBlank :3312/:3449.
      "config.key.blank": "config.key.blank",
      // Official: keyBlankNew :3313/:3450.
      "config.key.blankNew": "config.key.blankNew",
      // Official: keyIllegalCharacters :3314/:3451.
      "config.key.illegal": "config.key.illegal",
      // Official: authHelp :3274/:3411.
      "config.authHelp": "config.authHelp",
      // --- endpoint and protocol -------------------------------------------------
      // Official: baseUrl :3276/:3413.
      "config.baseUrl.label": "config.baseUrl.label",
      // Official: baseUrlDefault :3277/:3414.
      "config.baseUrl.default": "config.baseUrl.default",
      // Official: baseUrlEnvironment :3278/:3415. `{env}`.
      "config.baseUrl.environment": "config.baseUrl.environment",
      // Official: baseUrlConfigured :3279/:3416.
      "config.baseUrl.configured": "config.baseUrl.configured",
      // Official: baseUrlPlaceholder :3280/:3417. `{url}`: the current value.
      "config.baseUrl.placeholder": "config.baseUrl.placeholder",
      // Official: customBaseUrlInvalid :3346/:3483.
      "config.baseUrl.invalid": "config.baseUrl.invalid",
      // Official: customNeedsBaseUrl :3345/:3482.
      "config.baseUrl.required": "config.baseUrl.required",
      // Official: customBaseUrlPlaceholder :3348/:3485.
      "config.baseUrl.placeholderGateway": "config.baseUrl.placeholderGateway",
      // Official: customAnthropicBaseUrlPlaceholder :3349/:3486.
      "config.baseUrl.placeholderAnthropic": "config.baseUrl.placeholderAnthropic",
      // Official: customApi :3340/:3477.
      "config.api.label": "config.api.label",
      // Official: customApiUnset :3341/:3478.
      "config.api.unset": "config.api.unset",
      // Official: protocolOpenAiCompletions :3342/:3479.
      "config.api.openaiCompletions": "config.api.openaiCompletions",
      // Official: protocolOpenAiResponses :3343/:3480.
      "config.api.openaiResponses": "config.api.openaiResponses",
      // Official: protocolAnthropicMessages :3344/:3481.
      "config.api.anthropicMessages": "config.api.anthropicMessages",
      // --- hand-declared provider (custom model API) -----------------------------
      // Official: customRoute :3335/:3472.
      "config.route.label": "config.route.label",
      // Official: customRouteHint :3336/:3473.
      "config.route.hint": "config.route.hint",
      // Official: customRouteInvalid :3337/:3474.
      "config.route.invalid": "config.route.invalid",
      // Official: customRouteTaken :3338/:3475.
      "config.route.taken": "config.route.taken",
      // Official: customDisplayName :3339/:3476.
      "config.route.displayName": "config.route.displayName",
      // Official: customNeedsModels :3347/:3484.
      "config.route.needsModels": "config.route.needsModels",
      // Official: create :3351/:3488.
      "config.route.create": "config.route.create",
      // Official: creating :3352/:3489.
      "config.route.creating": "config.route.creating",
      // --- provider lifecycle ----------------------------------------------------
      // Official: add :3242/:3379.
      "config.add": "config.add",
      // Official: addMode :3243/:3380.
      "config.add.mode": "config.add.mode",
      // Official: addCatalog :3244/:3381.
      "config.add.catalog": "config.add.catalog",
      // Official: addCustom :3245/:3382.
      "config.add.custom": "config.add.custom",
      // Official: addCatalogHint :3246/:3383.
      "config.add.catalogHint": "config.add.catalogHint",
      // Official: addCustomHint :3247/:3384.
      "config.add.customHint": "config.add.customHint",
      // Official: addCatalogExhausted :3248/:3385.
      "config.add.catalogExhausted": "config.add.catalogExhausted",
      // Official: addCustomUnavailable :3249/:3386.
      "config.add.customUnavailable": "config.add.customUnavailable",
      // Official: edit :3233/:3370.
      "config.edit": "config.edit",
      // AUTHORED (§5.35): the row's one door. The official page edits providers inside
      // a card that is always open; this page keeps the ledger scan line clean and
      // opens the row's settings well from this one word, which is why it needs a
      // word of its own rather than reusing 编辑 (that verb is for a field value).
      "config.manage": "config.manage",
      // Official: editProvider :3234/:3371. `{provider}`.
      "config.editProvider": "config.editProvider",
      // Official: remove :3235/:3372.
      "config.remove": "config.remove",
      // Official: removeProvider :3236/:3373. `{provider}`.
      "config.removeProvider": "config.removeProvider",
      // Official: deleteTitle :3237/:3374. `{provider}`.
      "config.delete.title": "config.delete.title",
      // Official: deleteDescription :3238/:3375. `{provider}`.
      "config.delete.description": "config.delete.description",
      // Official: deleteDescriptionWithCredential :3239/:3376. The 「连带删除 API
      // 密钥」 branch (B3): the row may delete the stored key too. `{provider}`.
      "config.delete.descriptionWithCredential": "config.delete.descriptionWithCredential",
      // Official: deleteConfirm :3240/:3377. `{provider}`.
      "config.delete.confirm": "config.delete.confirm",
      // Official: deleting :3241/:3378. `{provider}`.
      "config.deleting": "config.deleting",
      // Official: apply :3253/:3390 (zh 保存).
      "config.apply": "config.apply",
      // Official: applying :3254/:3391 (zh 保存中…).
      "config.applying": "config.applying",
      // Official: cancel :3252/:3389.
      "config.cancel": "config.cancel",
      // Official: savedProvider :3255/:3392. `{provider}`.
      "config.savedProvider": "config.savedProvider",
      // Official: customized :3275/:3412.
      "config.customized": "config.customized",
      // Official: customTag :3334/:3471.
      "config.customTag": "config.customTag",
      // --- model catalog (the row region) --------------------------------------------
      // Official: models :3283/:3420 (zh 模型目录).
      "config.models.label": "config.models.label",
      // Official: modelsInherited :3284/:3421.
      "config.models.inherited": "config.models.inherited",
      // AUTHORED (§5.35): the scan line's model cell states the provider's OWN catalog
      // size, and a provider with none inherits the adapter's list — the long official
      // sentence above would not fit a 64px column, so the cell says 默认 / Default and
      // the button's title carries the full sentence. `{count}`.
      "config.models.count": "config.models.count",
      "config.models.default": "config.models.default",
      // Official: modelsCustomized :3285/:3422.
      "config.models.customized": "config.models.customized",
      // Official: modelsEmpty :3311/:3448.
      "config.models.empty": "config.models.empty",
      // Official: resetModels :3286/:3423 (zh 恢复默认模型).
      "config.models.reset": "config.models.reset",
      // AUTHORED (§5.37): the catalog is the row's inline disclosure now, so its one
      // action folds the region back into the row instead of closing a panel. The
      // three guard keys are the page's answer to "this draft is not saved yet": the
      // region must never disappear under an edit without the user saying so.
      "config.catalog.collapse": "config.catalog.collapse",
      "config.catalog.unsaved": "config.catalog.unsaved",
      "config.catalog.keepEditing": "config.catalog.keepEditing",
      "config.catalog.discard": "config.catalog.discard",
      // Official: model :3287/:3424.
      "config.model.label": "config.model.label",
      // Official: modelAdvanced :3295/:3432.
      "config.model.advanced": "config.model.advanced",
      // Official: modelInputTypes :3296/:3433.
      "config.model.inputTypes": "config.model.inputTypes",
      // Official: modelInputText :3297/:3434.
      "config.model.inputText": "config.model.inputText",
      // Official: modelInputImage :3298/:3435.
      "config.model.inputImage": "config.model.inputImage",
      // Official: addModel :3309/:3446.
      "config.model.add": "config.model.add",
      // Official: removeModel :3310/:3447.
      "config.model.remove": "config.model.remove",
      // Official: modelId :3288/:3425.
      "config.model.id": "config.model.id",
      // Official: modelName :3289/:3426.
      "config.model.name": "config.model.name",
      // Official: modelNamePlaceholder :3290/:3427.
      "config.model.namePlaceholder": "config.model.namePlaceholder",
      // Official: contextWindow :3291/:3428.
      "config.model.contextWindow": "config.model.contextWindow",
      // Official: contextWindowPlaceholder :3292/:3429 (使用提供商默认值).
      "config.model.contextWindowPlaceholder": "config.model.contextWindowPlaceholder",
      // Official: maxTokens :3293/:3430 (最大输出 token 数).
      "config.model.maxTokens": "config.model.maxTokens",
      // Official: maxTokensPlaceholder :3294/:3431 (使用提供商默认值).
      "config.model.maxTokensPlaceholder": "config.model.maxTokensPlaceholder",
      // AUTHORED (§5.36): the region is a ROSTER now — one line per model — so the two
      // capacity overrides are stated as facts beside the model, with these two short
      // field names instead of the official eight-character labels. `{value}` is the
      // stored draft literal ("1M", "128K"), shown as typed because this page never
      // parses a capacity it is only carrying.
      "config.model.contextShort": "config.model.contextShort",
      "config.model.outputShort": "config.model.outputShort",
      // AUTHORED (§5.36): both overrides empty means "use the provider's capacity", and
      // the roster line says so once instead of leaving the fact line blank.
      "config.model.capacityDefault": "config.model.capacityDefault",
      // AUTHORED (§5.36): a model row added but not named yet still needs an identity on
      // its roster line; this is that placeholder word, not a field label.
      "config.model.newLabel": "config.model.newLabel",
      // --- model validation ------------------------------------------------------
      // Official: modelIdRequired :3315/:3452. `validateModels` -> 'idEmpty'
      // (see VALIDATION_KEYS).
      "config.model.idRequired": "config.model.idRequired",
      // Official: modelIdDuplicate :3316/:3453. `validateModels` -> 'idDuplicate'.
      "config.model.idDuplicate": "config.model.idDuplicate",
      // Official: modelNameInvalid :3317/:3454.
      "config.model.nameInvalid": "config.model.nameInvalid",
      // Official: modelContextInvalid :3318/:3455.
      "config.model.contextWindowInvalid": "config.model.contextWindowInvalid",
      // Official: modelMaxTokensInvalid :3319/:3456.
      "config.model.maxTokensInvalid": "config.model.maxTokensInvalid",
      // Official: modelCapacityInvalid :3321/:3458.
      "config.model.capacityInvalid": "config.model.capacityInvalid",
      // Official: modelDuplicate :3322/:3459. Distinct from modelIdDuplicate: the
      // official page states the rule in two places and both strings exist.
      "config.model.duplicate": "config.model.duplicate",
      // --- reasoning levels ------------------------------------------------------
      // Official: modelReasoning :3299/:3436.
      "config.reasoning.label": "config.reasoning.label",
      // Official: modelReasoningLevel :3300/:3437.
      "config.reasoning.level": "config.reasoning.level",
      // Official: modelReasoningValue :3301/:3438.
      "config.reasoning.value": "config.reasoning.value",
      // Official: modelReasoningHelp :3302/:3439.
      "config.reasoning.help": "config.reasoning.help",
      // Official: modelReasoningHelpText :3303/:3440.
      "config.reasoning.helpText": "config.reasoning.helpText",
      // Official: modelReasoningNeedsLevel :3304/:3441. Validation one of two (C3).
      "config.reasoning.needsLevel": "config.reasoning.needsLevel",
      // Official: modelReasoningValueRequired :3305/:3442. Validation two of two.
      "config.reasoning.valueRequired": "config.reasoning.valueRequired",
      // Official: modelReasoningAdd :3306/:3443.
      "config.reasoning.add": "config.reasoning.add",
      // Official: modelReasoningRemove :3307/:3444.
      "config.reasoning.remove": "config.reasoning.remove",
      // AUTHORED: the wire level id the official page renders raw (`'off'` in its
      // source, `client.js:266`). A protocol name, not a translation — identical in
      // both dictionaries on purpose.
      "config.reasoning.off": "config.reasoning.off",
      // Official: modelReasoningOffValuePlaceholder :3308/:3445 (关闭思考).
      "config.reasoning.offPlaceholder": "config.reasoning.offPlaceholder",
      // --- model discovery -------------------------------------------------------
      // Official: fetchModels :3323/:3460 (获取可用模型).
      "config.fetch.action": "config.fetch.action",
      // Official: fetching :3324/:3461 (正在询问提供商…).
      "config.fetch.fetching": "config.fetch.fetching",
      // Official: fetchNeedsBaseUrl :3325/:3462.
      "config.fetch.needsBaseUrl": "config.fetch.needsBaseUrl",
      // Official: fetchEmpty :3326/:3463.
      "config.fetch.empty": "config.fetch.empty",
      // Official: fetchTitle :3327/:3464 (选择要添加的模型).
      "config.fetch.title": "config.fetch.title",
      // Official: fetchDescription :3328/:3465.
      "config.fetch.description": "config.fetch.description",
      // Official: fetchSearch :3329/:3466.
      "config.fetch.search": "config.fetch.search",
      // Official: fetchNoMatches :3330/:3467.
      "config.fetch.noMatches": "config.fetch.noMatches",
      // Official: fetchSelectAll :3331/:3468.
      "config.fetch.selectAll": "config.fetch.selectAll",
      // Official: fetchDeselectAll :3332/:3469.
      "config.fetch.deselectAll": "config.fetch.deselectAll",
      // Official: fetchAdopt :3333/:3470 (添加所选).
      "config.fetch.adopt": "config.fetch.adopt",
      // AUTHORED (brief §13.2): the discovery list prints one counting sentence for the
      // whole candidate set. `{count}` is the candidate total, `{inCatalog}` the number
      // already in the catalog. The placeholder is `{inCatalog}` on purpose — NOT
      // `{present}`, which would collide with the `data-present` row hook the same
      // list uses for its per-row state.
      "config.fetch.count": "config.fetch.count"
    };
    var VALIDATION_KEYS = {
      idEmpty: KEYS["config.model.idRequired"],
      idDuplicate: KEYS["config.model.idDuplicate"]
    };
    var zh2 = {
      "config.nav": "模型配置",
      "config.title": "模型配置",
      "config.summary.ready": "{count} 个提供商，全部可用",
      "config.summary.attention": "{count} 个提供商可用，{issues} 个需要处理",
      "config.summary.none": "尚未添加任何提供商",
      "config.empty.title": "添加一个 API Key 开始使用",
      "config.empty.description": "配置 DeepSeek 官方模型，即可开始使用。",
      "config.loadFailed": "加载提供商目录失败",
      "config.retry": "重试",
      "config.readOnly": "当前部署的设置文档为只读。",
      "config.conflict": "这张卡片打开期间，这些设置已被其他地方改动。请关闭后重新打开，在当前值上编辑。",
      // AUTHORED (see the KEYS group above): the inline auto-retry editor's whole
      // vocabulary. Same order as `KEYS` and `en`, key for key.
      "config.retryPolicy.trigger": "自动重试",
      "config.retryPolicy.edit": "修改",
      "config.retryPolicy.retries": "重试次数",
      "config.retryPolicy.retriesUnit": "次",
      "config.retryPolicy.cap": "间隔上限",
      "config.retryPolicy.capUnit": "秒",
      "config.retryPolicy.doubling": "每次等待翻倍，直到触达上限。",
      "config.retryPolicy.recovery": "中文限流文案（如「请求过于频繁」）也按这里设置重试。",
      "config.retryPolicy.declared": "已单独设置",
      "config.retryPolicy.inherits": "使用默认值",
      "config.retryPolicy.first": "首次等待 {count}",
      "config.retryPolicy.total": "最长合计 {count}",
      "config.retryPolicy.always": "此提供商设为无限重试，次数不影响它。",
      "config.retryPolicy.reset": "恢复默认",
      "config.retryPolicy.saved": "已保存",
      "config.retryPolicy.badRetries": "请输入 0 到 {count} 之间的整数。",
      "config.retryPolicy.badCap": "请输入 0.5 到 {count} 之间的秒数。",
      "config.retryPolicy.unavailable": "此部署已只读，无法修改重试设置。",
      "config.provider.label": "提供商",
      "config.account.name": "DeepSeek 账号",
      "config.account.signedIn": "已登录",
      "config.account.signedOut": "会话未登录",
      "config.verdict.ready": "可用",
      "config.verdict.missingKey": "缺密钥",
      "config.verdict.dormant": "未注册",
      "config.verdict.unavailable": "不可用",
      "config.credential.configured": "API 密钥已配置",
      "config.credential.missing": "API 密钥缺失",
      "config.credential.configuredShort": "已配置",
      "config.credential.missingShort": "未配置",
      "config.credential.label": "凭据",
      "config.credential.session": "由账号提供",
      "config.key.input": "API 密钥",
      "config.key.replace": "替换 API 密钥",
      "config.key.clear": "清除密钥",
      "config.key.replaceShort": "替换",
      "config.key.clearShort": "清除",
      "config.key.add": "填写密钥",
      "config.key.reveal": "显示密钥",
      "config.key.hide": "隐藏密钥",
      "config.key.placeholder": "输入 API 密钥",
      "config.key.placeholderFallback": "留空使用环境认证（{hint}）",
      "config.key.placeholderSaved": "留空使用已保存凭据",
      "config.key.fallbackDetected": "已检测到环境变量（{hint}）",
      "config.key.fallbackDetectedHidden": "已检测到环境变量",
      "config.key.fallbackMissing": "未检测到环境变量。请填写 API 密钥，或设置环境变量 {hint}。",
      "config.key.fallbackUnchecked": "环境凭据状态尚未确认",
      "config.key.help": "优先使用已保存的凭据。此处显示的环境后备按以下顺序排列：{env}。来源依次为启动环境、$cwd/.env、$DSH_HOME/.env。",
      "config.key.blank": "请输入 API 密钥；留空则保持已存储的密钥。",
      "config.key.blankNew": "请输入 API 密钥；若该提供商以其他方式鉴权，可以留空。",
      "config.key.illegal": "该 API 密钥格式错误，请检查。",
      "config.authHelp": "认证说明",
      "config.baseUrl.label": "API 地址",
      "config.baseUrl.default": "没有默认地址",
      "config.baseUrl.environment": "提供方地址配置：{env}",
      "config.baseUrl.configured": "由提供方配置地址",
      "config.baseUrl.placeholder": "{url}",
      "config.baseUrl.invalid": "请输入有效的 HTTP 或 HTTPS 地址。",
      "config.baseUrl.required": "自定义模型 API 需要填写 API 地址。",
      "config.baseUrl.placeholderGateway": "https://gateway.example/v1",
      "config.baseUrl.placeholderAnthropic": "https://gateway.example",
      "config.api.label": "API 协议",
      "config.api.unset": "未选择",
      "config.api.openaiCompletions": "OpenAI Chat Completions",
      "config.api.openaiResponses": "OpenAI Responses",
      "config.api.anthropicMessages": "Anthropic Messages",
      "config.route.label": "Provider ID",
      "config.route.hint": "以小写字母开头的标识，在请求中唯一标识该提供商，并用于派生凭据名。",
      "config.route.invalid": "需以小写字母开头，之后可用小写字母、数字和短横线。",
      "config.route.taken": "已有提供商使用了这个 ID。",
      "config.route.displayName": "显示名称",
      "config.route.needsModels": "自定义模型 API 至少需要一个模型。",
      "config.route.create": "创建提供商",
      "config.route.creating": "创建中…",
      "config.add": "添加模型提供商",
      "config.add.mode": "添加方式",
      "config.add.catalog": "第三方模型提供商",
      "config.add.custom": "自定义模型 API",
      "config.add.catalogHint": "从内置目录中选择 OpenAI、Anthropic、Kimi 等提供商，填入其 API 密钥即可使用。",
      "config.add.customHint": "连接中转站、自部署服务或其他兼容 OpenAI / Anthropic 协议的接口，需填写 API 地址、协议和模型。",
      "config.add.catalogExhausted": "目录中的提供商都已添加。",
      "config.add.customUnavailable": "没有可用的 API 协议。",
      "config.edit": "编辑",
      "config.manage": "管理",
      "config.editProvider": "编辑 {provider}",
      "config.remove": "删除",
      "config.removeProvider": "删除 {provider}",
      "config.delete.title": "删除 {provider}？",
      "config.delete.description": "删除 {provider} 会移除其配置；其使用的凭证（如有）由其他位置管理，将会保留。",
      "config.delete.descriptionWithCredential": "删除 {provider} 会移除其配置和存储的 API 密钥。",
      "config.delete.confirm": "删除 {provider}",
      "config.deleting": "正在删除 {provider}…",
      "config.apply": "保存",
      "config.applying": "保存中…",
      "config.cancel": "取消",
      "config.savedProvider": "已保存 {provider}。",
      "config.customized": "自定义设置",
      "config.customTag": "自定义",
      "config.models.label": "模型目录",
      "config.models.inherited": "正在使用适配器默认模型",
      "config.models.count": "{count} 个模型",
      "config.models.default": "默认",
      "config.models.customized": "已自定义模型目录",
      "config.models.empty": "模型选择器中将不显示任何模型；目录外 ID 仍可直接发送。",
      "config.models.reset": "恢复默认模型",
      "config.catalog.collapse": "收起",
      "config.catalog.unsaved": "有未保存的模型修改。",
      "config.catalog.keepEditing": "继续编辑",
      "config.catalog.discard": "放弃修改",
      "config.model.label": "模型",
      "config.model.advanced": "模型选项",
      "config.model.inputTypes": "输入类型",
      "config.model.inputText": "文本",
      "config.model.inputImage": "图片",
      "config.model.add": "添加模型",
      "config.model.remove": "删除模型",
      "config.model.id": "模型 ID",
      "config.model.name": "显示名称",
      "config.model.namePlaceholder": "留空时使用模型 ID",
      "config.model.contextWindow": "上下文窗口",
      "config.model.contextWindowPlaceholder": "使用提供商默认值",
      "config.model.maxTokens": "最大输出 token 数",
      "config.model.maxTokensPlaceholder": "使用提供商默认值",
      "config.model.contextShort": "上下文",
      "config.model.outputShort": "输出",
      "config.model.capacityDefault": "使用默认容量",
      "config.model.newLabel": "新模型",
      "config.model.idRequired": "模型 ID 不能为空。",
      "config.model.idDuplicate": "模型 ID 不能重复。",
      "config.model.nameInvalid": "显示名称不能为空。",
      "config.model.contextWindowInvalid": "上下文窗口必须是正数，例如 131072、256K 或 1M。",
      "config.model.maxTokensInvalid": "最大输出 token 数必须是正数，例如 8192、64K 或 1M。",
      "config.model.capacityInvalid": "容量需为数字，可加 K 或 M 后缀。",
      "config.model.duplicate": "每个模型 ID 只能出现一次。",
      "config.reasoning.label": "推理等级",
      "config.reasoning.level": "档位",
      "config.reasoning.value": "API 参数值",
      "config.reasoning.help": "推理等级说明",
      "config.reasoning.helpText": "API 参数值会写入请求的推理强度字段（如 OpenAI 的 reasoning_effort），默认与档位名相同；如有不同，以模型提供商的 API 文档为准。Off 表示关闭思考，不需要填写参数值；配置中已写入的值会保留并发送。",
      "config.reasoning.needsLevel": "至少添加一个 Off 以外的档位；不需要思考请关闭推理等级。",
      "config.reasoning.valueRequired": "Off 以外的档位都需要填写 API 参数值，且参数值不能为空字符串。",
      "config.reasoning.add": "添加档位",
      "config.reasoning.remove": "删除档位",
      "config.reasoning.off": "Off",
      "config.reasoning.offPlaceholder": "关闭思考",
      "config.fetch.action": "获取可用模型",
      "config.fetch.fetching": "正在询问提供商…",
      "config.fetch.needsBaseUrl": "请先填写 API 地址，再获取。",
      "config.fetch.empty": "该提供商没有列出任何模型，请手动添加。",
      "config.fetch.title": "选择要添加的模型",
      "config.fetch.description": "以下是模型提供商的可用模型，勾选要添加的模型。",
      "config.fetch.search": "搜索模型",
      "config.fetch.noMatches": "没有匹配的模型。",
      "config.fetch.selectAll": "全选",
      "config.fetch.deselectAll": "取消全选",
      "config.fetch.adopt": "添加所选",
      "config.fetch.count": "共 {count} 个候选，其中 {inCatalog} 个已在目录里"
    };
    var en2 = {
      "config.nav": "Model configuration",
      "config.title": "Model configuration",
      "config.summary.ready": "{count} providers, all usable",
      "config.summary.attention": "{count} usable, {issues} need attention",
      "config.summary.none": "No providers added yet",
      "config.empty.title": "Add an API key to get started",
      "config.empty.description": "Configure the official DeepSeek provider to start building.",
      "config.loadFailed": "Loading the provider directory failed",
      "config.retry": "Retry",
      "config.readOnly": "The settings document is read-only in this deployment.",
      "config.conflict": "Someone else changed these settings while this card was open. Close it and reopen to edit the current values.",
      // AUTHORED (see the KEYS group above): the inline auto-retry editor's whole
      // vocabulary. Same order as `KEYS` and `zh`, key for key.
      "config.retryPolicy.trigger": "Auto-retry",
      "config.retryPolicy.edit": "Edit",
      "config.retryPolicy.retries": "Retries",
      "config.retryPolicy.retriesUnit": "times",
      "config.retryPolicy.cap": "Wait cap",
      "config.retryPolicy.capUnit": "s",
      "config.retryPolicy.doubling": "Each wait doubles until it reaches the cap.",
      "config.retryPolicy.recovery": "Chinese rate-limit wording is retried on these settings too.",
      "config.retryPolicy.declared": "Set here",
      "config.retryPolicy.inherits": "Using defaults",
      "config.retryPolicy.first": "first wait {count}",
      "config.retryPolicy.total": "longest total {count}",
      "config.retryPolicy.always": "This provider retries without limit; the count does not apply.",
      "config.retryPolicy.reset": "Restore default",
      "config.retryPolicy.saved": "Saved",
      "config.retryPolicy.badRetries": "Enter a whole number between 0 and {count}.",
      "config.retryPolicy.badCap": "Enter between 0.5 and {count} seconds.",
      "config.retryPolicy.unavailable": "This deployment is read-only; retry settings cannot be changed.",
      "config.provider.label": "Provider",
      "config.account.name": "DeepSeek Account",
      "config.account.signedIn": "Signed in",
      "config.account.signedOut": "Not signed in",
      "config.verdict.ready": "Ready",
      "config.verdict.missingKey": "Missing key",
      "config.verdict.dormant": "Not registered",
      "config.verdict.unavailable": "Unavailable",
      "config.credential.configured": "API key configured",
      "config.credential.missing": "API key missing",
      "config.credential.configuredShort": "Configured",
      "config.credential.missingShort": "Not configured",
      "config.credential.label": "Credential",
      "config.credential.session": "Provided by your account",
      "config.key.input": "API key",
      "config.key.replace": "Replace API key",
      "config.key.clear": "Clear key",
      "config.key.replaceShort": "Replace",
      "config.key.clearShort": "Clear",
      "config.key.add": "Add key",
      "config.key.reveal": "Show secret",
      "config.key.hide": "Hide secret",
      "config.key.placeholder": "Enter your API key",
      "config.key.placeholderFallback": "Leave blank to use env as auth ({hint})",
      "config.key.placeholderSaved": "Leave blank to use saved credentials",
      "config.key.fallbackDetected": "Env var detected. ({hint})",
      "config.key.fallbackDetectedHidden": "Env var detected.",
      "config.key.fallbackMissing": "Env var not detected. Enter an API key, or configure {hint} in your env.",
      "config.key.fallbackUnchecked": "Environment credential status has not been confirmed.",
      "config.key.help": "Saved credentials are used first. Environment fallbacks shown here, in order: {env}. Sources are launch environment, $cwd/.env, then $DSH_HOME/.env.",
      "config.key.blank": "Enter the API key, or leave the field empty to keep the stored one.",
      "config.key.blankNew": "Enter the API key, or leave the field empty if this provider authenticates another way.",
      "config.key.illegal": "This API key is not in a valid format. Please check it.",
      "config.authHelp": "Authentication details",
      "config.baseUrl.label": "Base URL",
      "config.baseUrl.default": "No default endpoint",
      "config.baseUrl.environment": "Provider endpoint configuration: {env}",
      "config.baseUrl.configured": "Provider-configured endpoint",
      "config.baseUrl.placeholder": "{url}",
      "config.baseUrl.invalid": "Enter a valid HTTP or HTTPS URL.",
      "config.baseUrl.required": "A custom provider needs a base URL.",
      "config.baseUrl.placeholderGateway": "https://gateway.example/v1",
      "config.baseUrl.placeholderAnthropic": "https://gateway.example",
      "config.api.label": "API protocol",
      "config.api.unset": "Not selected",
      "config.api.openaiCompletions": "OpenAI Chat Completions",
      "config.api.openaiResponses": "OpenAI Responses",
      "config.api.anthropicMessages": "Anthropic Messages",
      "config.route.label": "Provider ID",
      "config.route.hint": "Lowercase identifier, starting with a letter, that uniquely names this provider in requests and as its credential name.",
      "config.route.invalid": "Start with a lowercase letter; then lowercase letters, digits, and dashes.",
      "config.route.taken": "A provider already uses this ID.",
      "config.route.displayName": "Display name",
      "config.route.needsModels": "A custom provider needs at least one model.",
      "config.route.create": "Create provider",
      "config.route.creating": "Creating…",
      "config.add": "Add model provider",
      "config.add.mode": "How to add",
      "config.add.catalog": "Third-party model provider",
      "config.add.custom": "Custom model API",
      "config.add.catalogHint": "Pick OpenAI, Anthropic, Kimi, or another provider from the built-in catalog and enter its API key.",
      "config.add.customHint": "Connect a relay, a self-hosted server, or any other OpenAI- or Anthropic-compatible endpoint by its base URL, protocol, and models.",
      "config.add.catalogExhausted": "Every catalog provider is already configured.",
      "config.add.customUnavailable": "No API protocol is available to declare.",
      "config.edit": "Edit",
      "config.manage": "Manage",
      "config.editProvider": "Edit {provider}",
      "config.remove": "Delete",
      "config.removeProvider": "Delete {provider}",
      "config.delete.title": "Delete {provider}?",
      "config.delete.description": "Deleting {provider} removes its configuration. Any credential it uses is managed elsewhere and will be kept.",
      "config.delete.descriptionWithCredential": "Deleting {provider} removes its configuration and stored API key.",
      "config.delete.confirm": "Delete {provider}",
      "config.deleting": "Deleting {provider}…",
      "config.apply": "Apply",
      "config.applying": "Applying…",
      "config.cancel": "Cancel",
      "config.savedProvider": "Saved {provider}.",
      "config.customized": "Customized settings",
      "config.customTag": "Custom",
      "config.models.label": "Models",
      "config.models.inherited": "Using the adapter defaults",
      "config.models.count": "{count} models",
      "config.models.default": "Default",
      "config.models.customized": "Customized model catalog",
      "config.models.empty": "No models will be shown in the selector. Unlisted IDs can still be sent directly.",
      "config.models.reset": "Restore defaults",
      "config.catalog.collapse": "Collapse",
      "config.catalog.unsaved": "Unsaved model changes.",
      "config.catalog.keepEditing": "Keep editing",
      "config.catalog.discard": "Discard changes",
      "config.model.label": "Model",
      "config.model.advanced": "Model options",
      "config.model.inputTypes": "Input types",
      "config.model.inputText": "Text",
      "config.model.inputImage": "Image",
      "config.model.add": "Add model",
      "config.model.remove": "Delete model",
      "config.model.id": "Model ID",
      "config.model.name": "Display name",
      "config.model.namePlaceholder": "Uses the model ID when empty",
      "config.model.contextWindow": "Context window",
      "config.model.contextWindowPlaceholder": "Uses the provider default",
      "config.model.maxTokens": "Max output tokens",
      "config.model.maxTokensPlaceholder": "Uses the provider default",
      "config.model.contextShort": "Context",
      "config.model.outputShort": "Output",
      "config.model.capacityDefault": "Default capacity",
      "config.model.newLabel": "New model",
      "config.model.idRequired": "Model ID is required.",
      "config.model.idDuplicate": "Model ID must be unique.",
      "config.model.nameInvalid": "Display name cannot be empty.",
      "config.model.contextWindowInvalid": "Context window must be a positive count, like 131072, 256K, or 1M.",
      "config.model.maxTokensInvalid": "Max output tokens must be a positive count, like 8192, 64K, or 1M.",
      "config.model.capacityInvalid": "A capacity must be a number, optionally suffixed K or M.",
      "config.model.duplicate": "Each model ID may appear once.",
      "config.reasoning.label": "Reasoning levels",
      "config.reasoning.level": "Level",
      "config.reasoning.value": "API value",
      "config.reasoning.help": "About reasoning levels",
      "config.reasoning.helpText": "The API value is sent in the request's reasoning-effort field, such as OpenAI's reasoning_effort. It defaults to the level name; where the model provider's API documentation specifies a different value, follow it. Off turns reasoning off and needs no value; a value already written in the configuration is kept and sent.",
      "config.reasoning.needsLevel": "Add at least one level besides Off, or turn reasoning levels off.",
      "config.reasoning.valueRequired": "Every level besides Off needs an API value, and no value can be empty.",
      "config.reasoning.add": "Add level",
      "config.reasoning.remove": "Delete level",
      "config.reasoning.off": "Off",
      "config.reasoning.offPlaceholder": "Turns reasoning off",
      "config.fetch.action": "Fetch available models",
      "config.fetch.fetching": "Asking the provider…",
      "config.fetch.needsBaseUrl": "Enter the base URL first, then fetch.",
      "config.fetch.empty": "The provider listed no models. Add them by hand.",
      "config.fetch.title": "Choose models to add",
      "config.fetch.description": "These are the models this provider has available. Choose the ones to add.",
      "config.fetch.search": "Search models",
      "config.fetch.noMatches": "No matching models.",
      "config.fetch.selectAll": "Select all",
      "config.fetch.deselectAll": "Deselect all",
      "config.fetch.adopt": "Add selected",
      "config.fetch.count": "{count} candidates, {inCatalog} already in the catalog"
    };
    var dictionaries2 = { zh: zh2, en: en2 };
    var zhTable = zh2;
    var enTable = en2;
    function documentLanguage() {
      if (typeof document === "undefined") return null;
      const language = document.documentElement.lang;
      return language === "" ? null : language;
    }
    function t(key, params) {
      const language = documentLanguage();
      const table = language !== null && !language.toLowerCase().startsWith("zh") ? enTable : zhTable;
      const template = table[key] ?? zhTable[key] ?? key;
      return interpolate(template, params);
    }
    function configTranslate(face) {
      if (face === void 0) return t;
      return (key, params) => {
        const text = face(key, params);
        return text === key ? t(key, params) : text;
      };
    }
    
    // src/client/modelConfigModel.ts
    var ACCOUNT_ROUTE = "deepseek-account";
    var OFFICIAL_ROUTE = "deepseek-official";
    function isRecord(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function joinProviderDirectory(registered, directory) {
      const active = new Set(registered.map((provider) => provider.id));
      const declared = new Set(directory.map((entry) => entry.provider));
      const rows = directory.map((entry) => ({
        provider: entry.provider,
        displayName: entry.displayName,
        settingsNs: entry.settingsNs,
        settingsPath: [...entry.settingsPath],
        active: active.has(entry.provider),
        ...entry.declared === void 0 ? {} : { declared: entry.declared },
        ...entry.defaultBaseURL === void 0 ? {} : { defaultBaseURL: entry.defaultBaseURL },
        ...entry.baseURLEnv === void 0 ? {} : { baseURLEnv: entry.baseURLEnv },
        ...entry.error === void 0 ? {} : { error: entry.error }
      }));
      for (const provider of registered) {
        if (declared.has(provider.id)) continue;
        rows.push({
          provider: provider.id,
          displayName: provider.name,
          settingsNs: "",
          settingsPath: [],
          active: true
        });
      }
      const rank = (provider) => provider === ACCOUNT_ROUTE ? 0 : provider === OFFICIAL_ROUTE ? 1 : 2;
      return [...rows].sort((left, right) => rank(left.provider) - rank(right.provider));
    }
    function deriveKeyRef(provider) {
      return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
    }
    function apiKeyEnvOf(value, settingsPath) {
      const profile = readPath(value, settingsPath);
      if (!isRecord(profile)) return void 0;
      const ref = profile.apiKeyEnv;
      return typeof ref === "string" && ref.length > 0 ? ref : void 0;
    }
    function keyRefOf(row) {
      return row.apiKeyEnv ?? deriveKeyRef(row.entry.provider);
    }
    function providerUsable(row) {
      if (!row.entry.active) return false;
      if (row.entry.provider === ACCOUNT_ROUTE) return row.accountAvailable === true;
      if (row.apiKeyEnv === void 0) return true;
      return row.credential?.configured === true;
    }
    function keyConfigured(row) {
      return row.apiKeyEnv !== void 0 ? row.credential?.configured === true : row.derivedCredential?.configured === true;
    }
    function keyWritable(row) {
      const info = row.apiKeyEnv !== void 0 ? row.credential : row.derivedCredential;
      return info?.writable === true;
    }
    function isRemovable(namespace, settingsPath) {
      if (namespace === void 0) return false;
      if (settingsPath.length === 0) return false;
      const inUser = hasPath(namespace.user, settingsPath);
      const inBase = hasPath(namespace.base, settingsPath);
      return inUser && !inBase;
    }
    function isAdded(configured, settingsPath) {
      return configured || settingsPath.length === 0;
    }
    function readPath(value, path) {
      let current = value;
      for (const step of path) {
        if (Array.isArray(current)) {
          const index = Number.parseInt(step, 10);
          if (!Number.isInteger(index) || index < 0 || index >= current.length) return void 0;
          current = current[index];
          continue;
        }
        if (!isRecord(current)) return void 0;
        if (!(step in current)) return void 0;
        current = current[step];
      }
      return current;
    }
    function hasPath(value, path) {
      if (path.length === 0) return value !== void 0;
      const parent = readPath(value, path.slice(0, -1));
      const last = path[path.length - 1];
      if (last === void 0) return false;
      if (Array.isArray(parent)) {
        const index = Number.parseInt(last, 10);
        return Number.isInteger(index) && index >= 0 && index < parent.length;
      }
      if (!isRecord(parent)) return false;
      return last in parent;
    }
    function pathOps(base, before, after) {
      const previous = isRecord(before) ? before : {};
      const ops = [];
      for (const [key, value] of Object.entries(after)) {
        if (JSON.stringify(previous[key]) === JSON.stringify(value)) continue;
        ops.push({ op: "set", path: [...base, key], value });
      }
      for (const key of Object.keys(previous)) {
        if (!(key in after)) ops.push({ op: "unset", path: [...base, key] });
      }
      return ops;
    }
    function protocolChoices(namespace) {
      const refs = schemaRefsOf(namespace);
      if (refs === void 0) return [];
      const profile = profileNodeOf(refs, namespace);
      if (profile === void 0) return [];
      const api = stepDict(refs, profile, "api");
      return unionMembers(refs, api).map((member) => member.value).filter((value) => typeof value === "string");
    }
    function reasoningLevelChoices(namespace) {
      const refs = schemaRefsOf(namespace);
      if (refs === void 0) return [];
      const profile = profileNodeOf(refs, namespace);
      if (profile === void 0) return [];
      const models = stepDict(refs, profile, "models");
      if (models === void 0) return [];
      const modelShape = valueShapeOf(refs, models);
      if (modelShape === void 0) return [];
      const efforts = stepDict(refs, modelShape, "reasoningEfforts");
      const levels = unionMembers(refs, efforts).find((member) => member.type === "dict");
      if (levels === void 0) return [];
      const keyShape = deref(refs, levels.sKey);
      if (keyShape === void 0) return [];
      const list = keyShape.list;
      if (!Array.isArray(list)) return [];
      return list.flatMap((id) => {
        const member = deref(refs, id);
        return member === void 0 ? [] : [member.value];
      }).filter((value) => typeof value === "string");
    }
    function retryCapable(namespace, settingsPath) {
      const refs = schemaRefsOf(namespace);
      if (refs === void 0) return false;
      const profile = schemaNodeAt(refs, namespace, settingsPath);
      if (profile === void 0) return false;
      return stepDict(refs, profile, "retryPolicy") !== void 0;
    }
    function schemaNodeAt(refs, namespace, path) {
      const schema = namespace?.schema;
      if (!isRecord(schema)) return void 0;
      let node = deref(refs, schema.uid);
      for (const step of path) {
        if (node === void 0) return void 0;
        if (node.type === "dict" || node.type === "array") {
          node = valueShapeOf(refs, node);
          continue;
        }
        node = stepDict(refs, node, step);
      }
      return node;
    }
    function deref(refs, id) {
      if (!isRecord(refs) && !Array.isArray(refs)) return void 0;
      if (typeof id !== "number" && typeof id !== "string") return void 0;
      const node = refs[id];
      return isRecord(node) ? node : void 0;
    }
    function schemaRefsOf(namespace) {
      const schema = namespace?.schema;
      return isRecord(schema) ? schema.refs : void 0;
    }
    function profileNodeOf(refs, namespace) {
      const schema = namespace?.schema;
      if (!isRecord(schema)) return void 0;
      const root = deref(refs, schema.uid);
      if (root === void 0) return void 0;
      const providers = stepDict(refs, root, "providers");
      if (providers === void 0) return void 0;
      return valueShapeOf(refs, providers);
    }
    function stepDict(refs, node, key) {
      const dict = node.dict;
      if (!isRecord(dict)) return void 0;
      return deref(refs, dict[key]);
    }
    function valueShapeOf(refs, node) {
      return deref(refs, node.inner);
    }
    function unionMembers(refs, node) {
      if (node === void 0 || node.type !== "union") return [];
      const list = node.list;
      if (!Array.isArray(list)) return [];
      return list.flatMap((id) => {
        const member = deref(refs, id);
        return member === void 0 ? [] : [member];
      });
    }
    function modelsOf(value, settingsPath) {
      const profile = readPath(value, settingsPath);
      if (!isRecord(profile)) return [];
      const models = profile.models;
      if (!Array.isArray(models)) return [];
      const entries = [];
      for (const raw of models) {
        if (!isRecord(raw)) continue;
        const id = raw.id;
        if (typeof id !== "string" || id.length === 0) continue;
        entries.push({
          id,
          ...typeof raw.name === "string" ? { name: raw.name } : {},
          ...typeof raw.contextWindow === "number" ? { contextWindow: raw.contextWindow } : {},
          ...typeof raw.maxTokens === "number" ? { maxTokens: raw.maxTokens } : {},
          ...Array.isArray(raw.input) ? { input: raw.input.filter((item) => typeof item === "string") } : {}
        });
      }
      return entries;
    }
    function validateModels(models) {
      const seen = /* @__PURE__ */ new Set();
      for (const [index, model] of models.entries()) {
        const id = model.id.trim();
        if (id.length === 0) return { index, reason: "idEmpty" };
        if (seen.has(id)) return { index, reason: "idDuplicate" };
        seen.add(id);
      }
      return void 0;
    }
    function credentialRefFor(row) {
      if (row.apiKeyEnv !== void 0) return row.apiKeyEnv;
      if (row.entry.settingsNs === "" && row.entry.settingsPath.length === 0) return void 0;
      return deriveKeyRef(row.entry.provider);
    }
    
    // src/client/ModelCatalog.tsx
    var import_react = require("react");
    
    // src/client/params.ts
    var MIN_CONTEXT = 1024;
    var MAX_CONTEXT = 10485760;
    var CONTEXT_PLACEHOLDER = "128K";
    var PANEL_MODALITIES = ["text", "image"];
    var INPUT_FIELD_BY_NS = {
      "llm-pi-ai": "input",
      "llm-deepseek": "inputModalities"
    };
    var INPUT_FIELD_CANDIDATES = ["input", "inputModalities"];
    var INITIAL_SNAPSHOT2 = {
      status: "idle",
      error: null,
      writable: false,
      providers: [],
      namespaces: {}
    };
    function parseContext(raw) {
      const text = raw.trim().replace(/[\s_]/g, "").toUpperCase();
      const match = /^(\d+(?:\.\d+)?)([KM])?$/.exec(text);
      if (match === null) return null;
      const scale = match[2] === "M" ? 1e6 : match[2] === "K" ? 1e3 : 1;
      const tokens = Math.round(Number(match[1]) * scale);
      if (!Number.isFinite(tokens) || tokens < MIN_CONTEXT || tokens > MAX_CONTEXT) return null;
      return tokens;
    }
    function formatContext(tokens) {
      if (tokens >= 1e6 && tokens % 1e5 === 0) return `${tokens / 1e6}M`;
      if (tokens >= 1e3 && tokens % 1e3 === 0) return `${tokens / 1e3}K`;
      return String(tokens);
    }
    function isRecord2(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function getPath(value, path) {
      let node = value;
      for (const key of path) {
        if (Array.isArray(node)) {
          if (!/^\d+$/.test(key)) return void 0;
          node = node[Number(key)];
          continue;
        }
        if (!isRecord2(node)) return void 0;
        node = node[key];
      }
      return node;
    }
    function stringList(value) {
      return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
    }
    function numberOrUndefined(value) {
      return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : void 0;
    }
    function inputFieldOf(entry, ns) {
      for (const candidate of INPUT_FIELD_CANDIDATES) {
        if (entry[candidate] !== void 0) return candidate;
      }
      return INPUT_FIELD_BY_NS[ns] ?? INPUT_FIELD_CANDIDATES[0];
    }
    function entryPathOf(value, scope, model) {
      const models = getPath(value, [...scope, "models"]);
      if (Array.isArray(models)) {
        const index = models.findIndex((entry) => isRecord2(entry) && entry.id === model);
        if (index >= 0) return [...scope, "models", String(index)];
      }
      const overrides = getPath(value, [...scope, "modelOverrides"]);
      if (isRecord2(overrides) && isRecord2(overrides[model])) return [...scope, "modelOverrides", model];
      return null;
    }
    function resolveRoute(snapshot, route) {
      if (route === null) return null;
      const provider = snapshot.providers.find((candidate) => candidate.provider === route.provider);
      if (provider === void 0) return null;
      const view = snapshot.namespaces[provider.settingsNs];
      if (view === void 0) return null;
      const scope = [...provider.settingsPath];
      const entryPath = entryPathOf(view.value, scope, route.model);
      if (entryPath === null) return null;
      const entry = getPath(view.value, entryPath);
      if (!isRecord2(entry)) return null;
      const inputField = inputFieldOf(entry, provider.settingsNs);
      const input = stringList(entry[inputField]);
      const contextWindow = numberOrUndefined(entry.contextWindow);
      const maxTokens = numberOrUndefined(entry.maxTokens);
      const defaultContextWindow = numberOrUndefined(getPath(view.value, [...scope, "defaultContextWindow"]));
      const defaultInput = stringList(getPath(view.value, [...scope, "defaultInput"]));
      const userEntry = getPath(view.user, entryPath);
      const declared = isRecord2(userEntry) && (userEntry.contextWindow !== void 0 || userEntry[inputField] !== void 0);
      return {
        ns: provider.settingsNs,
        entryPath,
        inputField,
        revision: view.revision,
        input,
        defaultInput,
        declared,
        ...contextWindow === void 0 ? {} : { contextWindow },
        ...defaultContextWindow === void 0 ? {} : { defaultContextWindow },
        ...maxTokens === void 0 ? {} : { maxTokens }
      };
    }
    var ParamsStore = class {
      /**
       * @param face - RESOLVES the Host settings + provider directory faces, or
       *   returns null when this deployment mounts neither (the panel then stays
       *   read-only).
       *
       *   A RESOLVER rather than the faces themselves, for the reason DESIGN §2.2
       *   gives and `CapabilityStore` already follows: Remote namespaces are mounted
       *   by their owners when those owners activate, so `ctx.get('remote.settings')`
       *   answered at THIS plugin's activation can legitimately be "not yet". Captured
       *   once, that one unlucky ordering became permanent: the panel claimed
       *   "this deployment mounts no settings service" — a statement about the
       *   deployment made from a race — and every write refused with
       *   `settings are unavailable` for the rest of the page. Resolving per read
       *   makes the answer depend on what is mounted NOW, which is the only thing the
       *   claim was ever about.
       */
      constructor(face) {
        this.face = face;
      }
      listeners = /* @__PURE__ */ new Set();
      snapshot = INITIAL_SNAPSHOT2;
      inflight = null;
      /** Subscribe to snapshot changes. @param listener - called after any change. */
      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      }
      /**
       * The current snapshot, stable until something changes.
       * @returns the snapshot handed to React.
       */
      getSnapshot() {
        return this.snapshot;
      }
      /**
       * Read the Host once. Repeated calls while a read is in flight join it, and a
       * snapshot already in hand is never refetched by this method.
       */
      ensure() {
        if (this.snapshot.status === "idle") void this.read();
      }
      /**
       * Re-read the Host, keeping the last good values while the answer is in
       * flight so an open panel does not blank out on a refresh.
       * @returns a promise settling when the snapshot has been updated.
       */
      refresh() {
        return this.read();
      }
      /**
       * Apply one write and keep the snapshot in step with the Host's answer.
       *
       * A `settings/conflict` is retried once against a freshly read revision: the
       * panel's edit is a single field, so re-applying it over the newer document is
       * what the person asked for, while a second conflict is reported as-is.
       * @param ns - the settings namespace to write.
       * @param ops - the path-addressed edits.
       * @param expectedRevision - the revision the caller read.
       * @returns whether the Host accepted the write, and why not when it did not.
       */
      async write(ns, ops, expectedRevision) {
        const face = this.face();
        if (face === null) return { ok: false, conflict: false, message: "settings are unavailable" };
        let response;
        try {
          response = await face.settings.mutate(ns, ops, expectedRevision);
          if (!response.ok && response.error.code === "settings/conflict") {
            await this.read();
            response = await face.settings.mutate(ns, ops, this.snapshot.namespaces[ns]?.revision);
          }
        } catch (error) {
          return {
            ok: false,
            conflict: false,
            message: error instanceof Error ? error.message : String(error)
          };
        }
        if (!response.ok) {
          return { ok: false, conflict: response.error.code === "settings/conflict", message: response.error.message };
        }
        this.publish({
          ...this.snapshot,
          status: "ready",
          error: null,
          namespaces: { ...this.snapshot.namespaces, [response.value.ns]: response.value }
        });
        return { ok: true };
      }
      /** Read the provider directory and every namespace, then publish one snapshot. */
      read() {
        if (this.inflight !== null) return this.inflight;
        const face = this.face();
        if (face === null) {
          this.publish({ ...this.snapshot, status: "unavailable" });
          return Promise.resolve();
        }
        this.publish({ ...this.snapshot, status: this.snapshot.status === "ready" ? "ready" : "loading" });
        this.inflight = (async () => {
          const [providers, describe] = await Promise.all([
            face.llm.listConfigurableProviders(),
            face.settings.describe()
          ]);
          this.inflight = null;
          const failures = [];
          if (!providers.ok) failures.push(providers.error.message);
          if (!describe.ok) failures.push(describe.error.message);
          const namespaces = { ...this.snapshot.namespaces };
          if (describe.ok) {
            for (const view of describe.value.namespaces) namespaces[view.ns] = view;
          }
          this.publish({
            status: failures.length === 0 ? "ready" : "error",
            error: failures.length === 0 ? null : failures.join(" · "),
            writable: describe.ok ? describe.value.writable : this.snapshot.writable,
            providers: providers.ok ? providers.value : this.snapshot.providers,
            namespaces
          });
        })().catch((error) => {
          this.inflight = null;
          this.publish({
            ...this.snapshot,
            status: "error",
            error: error instanceof Error ? error.message : String(error)
          });
        });
        return this.inflight;
      }
      /**
       * Replace the snapshot and wake every subscriber — but only when the answer
       * actually differs from the one in hand.
       *
       * WHY THE GUARD. `useSyncExternalStore` re-renders when the snapshot stops
       * being `Object.is`-equal to the last one, and this store BUILDS that snapshot,
       * so comparing references can never help: every publish would hand React a new
       * object. Comparing the content is therefore the only way to skip the render,
       * and there is a lot to skip — the menu and the panel both call `refresh()` on
       * EVERY open, and a refresh that finds the same values (the ordinary case, an
       * unchanged settings document) used to re-render the panel twice: once for the
       * "reading" status it never actually left, and once for the identical answer.
       * Measured on a settled store: 3 opens produced 6 wakeups and exactly 1 content
       * change.
       *
       * A publish that differs is unaffected, including the "reading" one that really
       * does move `status` — that is a change a subscriber can see, so it still goes
       * out.
       */
      publish(snapshot) {
        if (sameSnapshot(this.snapshot, snapshot)) return;
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener();
      }
    };
    
    // src/client/catalogStyles.ts
    var STYLE_ELEMENT_ID = "dsh-rabbit-model-picker-catalog-styles";
    var CSS = `
    /* The region: a direct child of the .dmc-row five-track grid, so it starts at the
       name's spine (column 2) and never re-flows the scan line above it. It has no
       fill, edge, radius or lift of its own: the row's positional fill (hover /
       focus-within / data-catalog) is its surface, which is why it must live inside
       the row. The region owns no scroll box — the page scrolls. */
    .dmc-catalog-panel {
      grid-column: 2 / -1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
      padding: 2px 0 16px;
      color: var(--dsw-alias-label-primary);
      font-size: 13px;
      line-height: 20px;
    }
    
    /* The head: identity at the start (模型目录) and the region's one action at the
       end (收起) — the page's own two-ends grammar. The catalog's state travels
       beside the title in the quieter ink, so the header is one line rather than a
       stacked card title. */
    .dmc-catalog-head {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    
    .dmc-catalog-heading {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex: 1 1 auto;
      min-width: 0;
    }
    
    .dmc-catalog-title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      line-height: 20px;
      color: var(--dsw-alias-label-primary);
      white-space: nowrap;
    }
    
    /* --- controls -------------------------------------------------------------
       Every action is a WORD, not a box. At rest a control has no border, no fill,
       no radius and no shadow: it is told apart from static text by its cursor, its
       hover step and its focus ring, and from its neighbours by the row rhythm.
       Hover, focus and press are the three moments it is allowed to step up - and
       one press step is the whole of the motion a control owns.
    
       FULL INK WHILE IT CAN ACT, QUIET INK WHEN IT CANNOT. The lip of a control is
       stated in the primary ink, because a surface whose running words are soft grey
       reads as one that was never finished, and because in a read-only deployment
       (settings.writable === false) a row of quiet-grey actions looked clickable and
       then did nothing. The secondary ink is therefore spent on exactly one thing
       here: the control that is disabled, whose ink is the only signal left once the
       hover step is gone. Only two tokens may paint text in this sheet, so there is
       no third ink to reach for - and none is wanted. */
    
    .dmc-btn {
      height: 32px;
      padding: 0 8px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      /* Words, not capsules: a native button centres its label, which turned a
         full-width action ("添加档位") into a centred one. Every action in this sheet is
         a word starting at the panel's left spine. */
      text-align: left;
      cursor: pointer;
      transition: transform 80ms linear;
    }
    
    .dmc-btn:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-btn:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-btn:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* The commit words ("保存" / "添加所选"). At rest they carry the same primary ink
       as every other action, so they are told apart by WEIGHT alone, never by a
       fill: the measured pairing of white on the accent fill is 4.2349:1 in the
       light theme and 2.3278:1 in the dark one, under the 4.5:1 floor, so accent
       stays an edge and a focus ring on this page. */
    .dmc-btn-commit {
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-catalog-close {
      flex: none;
    }
    
    .dmc-catalog-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    
    .dmc-catalog-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    /* The collapse guard. It is a LINE in the region, not a dialog on top of it: the
       page removes a dirty draft only after this line has been answered. The 4px bar
       is the page's warning motif (a graphic, where the state colour clears 3:1); the
       sentence stays in the primary ink, and the two answers are words. */
    .dmc-catalog-guard {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 2px 0 2px 12px;
      border-left: 4px solid var(--dsw-alias-state-error-primary);
    }
    
    .dmc-catalog-guard-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    /* --- prose ---------------------------------------------------------------- */
    
    /* A section title, and - when the section has one - the sentence that states the
       section's own state at the far end of the same line, which is this page's
       grammar for every row: identity at the start, the answer at the end. */
    .dmc-catalog-section {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      line-height: 20px;
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-catalog-status {
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-catalog-notice {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* The Host's own diagnostic, printed verbatim. It is emphatic by weight, not by
       the error colour: that colour is a mark here, never an ink. */
    .dmc-catalog-error {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
      overflow-wrap: anywhere;
    }
    
    .dmc-catalog-note {
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
    }
    
    /* --- the catalog: a roster, one line per model ---------------------------- */
    
    /* THE ROSTER (§5.36). The region's own copy of the page's grammar: a model is a
       RECORD, so the list states records rather than opening a four-field form per
       model. Line one is the id and its one door; line two is the display name and the
       two capacity facts in the quiet ink; everything editable lives in the well that
       the door opens. Before this, seven models meant twenty-eight always-open inputs
       before the reader had asked for anything. */
    .dmc-model-list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    .dmc-model-row {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 12px;
      row-gap: 2px;
      align-items: center;
      min-height: 44px;
      padding: 10px 0;
      color: var(--dsw-alias-label-primary);
    }
    
    /* Positional and momentary, never a persistent fact: the row that is hovered, holds
       focus or has its well open is the only one that carries a fill. */
    .dmc-model-row:hover,
    .dmc-model-row:focus-within,
    .dmc-model-row[data-well='true'] {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    /* A row whose draft cannot be written carries the page's own mark: a 4px rail in
       the state colour. It is a graphic mark, so the 3:1 threshold applies, and the
       sentence beside it stays in the readable ink. */
    .dmc-model-row[data-invalid='true']::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 4px;
      background: var(--dsw-alias-state-error-primary);
    }
    
    /* The id is the record's identity: one line, cut with an ellipsis when the endpoint
       handed us a long id. The title attribute on the node keeps the whole string
       reachable, which is the only honest option inside the settings content column. */
    .dmc-model-ref {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
      overflow: hidden;
      font-size: 13px;
      line-height: 20px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* The facts line: display name and the capacity overrides, all in the quiet ink at
       the quiet end of the type ladder. */
    .dmc-model-sub {
      grid-column: 1;
      grid-row: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 12px;
      min-width: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmc-model-alias {
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmc-model-fact {
      color: var(--dsw-alias-label-secondary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    
    /* The row's one door, parked against the region's right edge with every other
       row's door. */
    .dmc-model-edit {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-model-edit:hover {
      background: var(--dsw-alias-interactive-bg-hover-solid);
    }
    
    .dmc-model-edit:active {
      transform: translateY(1px);
    }
    
    /* THE WELL. A two-column address form (id / display name, then the two capacities),
       the reasoning-level editor, and the remove entry last. No fill and no edge of its
       own: the row's fill is its surface, which is why the well is a child of the row. */
    .dmc-model-well {
      grid-column: 1 / -1;
      grid-row: 3;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      padding: 8px 0 4px;
    }
    
    .dmc-model-fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px 12px;
    }
    
    .dmc-model-id,
    .dmc-model-name,
    .dmc-model-window,
    .dmc-model-tokens {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    
    /* A form label, not an eyebrow: the four field names state what each field
       holds, in the quieter ink, at the quiet end of the type ladder. No caps, no
       letter-spacing, no monospace. */
    .dmc-model-label {
      font-size: 12px;
      line-height: 16px;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* Fields keep a real edge: a control is told apart from a label by its edge, and
       the design record exempts form fields from the no-hairline rule for exactly
       this reason - the retry sheet measured what happens without it. */
    .dmc-model-input,
    .dmc-reasoning-value,
    .dmc-reasoning-level,
    .dmc-discover-search {
      min-width: 0;
      height: 32px;
      padding: 0 8px;
      border: 1px solid var(--dsw-alias-border-l3);
      border-radius: 0;
      background: var(--dsw-specific-input-major);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
    }
    
    .dmc-model-input::placeholder,
    .dmc-reasoning-value::placeholder,
    .dmc-discover-search::placeholder {
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmc-model-input[data-invalid='true'] {
      border-color: var(--dsw-alias-state-error-primary);
    }
    
    .dmc-model-error {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
      overflow-wrap: anywhere;
    }
    
    /* The remove entry: the well's last line, away from the fields it must not be
       confused with. Its ink ladder is the sheet's (primary at rest, secondary when
       the deployment cannot write). */
    .dmc-model-danger {
      align-self: flex-start;
      min-height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-model-danger:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover-danger);
    }
    
    .dmc-model-danger:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-model-danger:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* The roster's add entry: one ledger line under the last model. */
    .dmc-model-add {
      align-self: stretch;
      height: 40px;
      padding: 0 6px;
      border-radius: 0;
      font-size: 13px;
      font-weight: 600;
      text-align: left;
    }
    
    .dmc-model-add:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    
    /* --- reasoning levels ----------------------------------------------------- */
    
    .dmc-reasoning {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .dmc-reasoning-head,
    .dmc-reasoning-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    
    .dmc-reasoning-head {
      align-items: center;
    }
    
    .dmc-reasoning-add,
    .dmc-reasoning-remove {
      flex: none;
    }
    
    .dmc-reasoning-add {
      align-self: flex-start;
    }
    
    .dmc-reasoning-help {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* --- discovery: the three-step flow --------------------------------------- */
    
    .dmc-discover-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    /* The fetch entry, the adopt entry and the checklist tools keep their own width;
       the status sentence beside them is the only flexible thing on the line. */
    .dmc-discover,
    .dmc-discover-adopt,
    .dmc-discover-tool {
      flex: none;
    }
    
    .dmc-discover-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    /* The checklist's own control row. The count leads it, because the count is what
       the reader is choosing from: the measured deployment lists 396 candidates,
       which is a set to filter and take from rather than a list to read top to
       bottom. It does NOT pin: the page is the one scrolling surface now, and a
       sticky strip inside a region that already lives in the page's scroll would
       travel over the ledger above it. The row simply leads the list. */
    .dmc-discover-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    /* The checklist is the one bounded scroll region in the region: 396 candidates
       would otherwise push the save footer a screen and a half down. It is a list
       scroll, not a panel scroll — the page keeps its own scroll. */
    .dmc-discover-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 360px;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    
    /* A group heading in the checklist. 396 rows of equal weight is not a hierarchy,
       so the checklist is grouped by the id's own first segment - the vendor, in the
       endpoint's own spelling - and each heading states how many rows it introduces.
       An existing class could not serve: "dmc-catalog-section" is the region's
       SECTION title (13px, 600, primary ink) and twenty of those inside one
       checklist would turn a quiet panel into a stack of headings, while
       "dmc-catalog-notice" is documented as a sentence of explanation. The heading is
       therefore quieter than the ids beneath it - 12px secondary ink, tabular
       figures - and draws no rule: the separation is rhythm, which is how this page
       separates every group of things. */
    .dmc-discover-group {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    
    .dmc-discover-candidate {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      color: var(--dsw-alias-label-primary);
    }
    
    /* A candidate whose id the catalog already declares cannot be adopted: the
       existing entry wins by contract, so the row falls back to the secondary ink as
       a whole - the id included, because the id states no colour of its own and
       inherits this one - and its box is inert. */
    .dmc-discover-candidate[data-present='true'] {
      color: var(--dsw-alias-label-secondary);
    }
    
    /* The box and the id are one label, so the id is the control's accessible name
       without an id built out of endpoint text. The label takes the free space, so a
       candidate reads as the page's own rows do: identity at the start, the row's
       other fact at the end. */
    .dmc-discover-label {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    
    .dmc-discover-check {
      flex: none;
      width: 16px;
      height: 16px;
      margin: 0;
    }
    
    /* No colour of its own: the id renders in whatever ink its row states, which is
       how one rule can quiet the whole row (the data-present hook) without a second
       selector reaching into it. */
    .dmc-discover-id {
      font-size: 13px;
      line-height: 20px;
      overflow-wrap: anywhere;
    }
    
    .dmc-discover-name {
      flex: 0 1 auto;
      min-width: 0;
      font-size: 12px;
      line-height: 18px;
      text-align: right;
      color: var(--dsw-alias-label-secondary);
      overflow-wrap: anywhere;
    }
    
    /* --- focus and motion ----------------------------------------------------- */
    
    /* Every focusable control, one ring. The host's own focus-ring token resolves to
       transparent in both themes, so the business colour is named directly instead
       of being reached through a fallback that would paint nothing. */
    .dmc-btn:focus-visible,
    .dmc-model-edit:focus-visible,
    .dmc-model-danger:focus-visible,
    .dmc-discover-check:focus-visible {
      outline: 2px solid var(--dsw-alias-state-business-primary);
      outline-offset: 2px;
    }
    
    .dmc-model-input:focus-visible,
    .dmc-reasoning-value:focus-visible,
    .dmc-reasoning-level:focus-visible,
    .dmc-discover-search:focus-visible {
      outline: 2px solid var(--dsw-alias-state-business-primary);
      outline-offset: -1px;
    }
    
    /* --- narrow and reduced motion -------------------------------------------- */
    
    /* The page is the query container, and this region lives inside it, so the narrow
       branch asks the same container the page's own rows do (the .dmc-page rule declares
       container-type: inline-size). At the phone column the host actually hands this
       section (about 106px) the field and level grids stack and every target grows to
       a thumb's size; the region keeps column 2 of the row's one surviving track. */
    @container (max-width: 360px) {
      .dmc-catalog-panel {
        grid-column: 2;
      }
    
      .dmc-catalog-head {
        flex-wrap: wrap;
      }
    
      .dmc-btn {
        height: 40px;
      }
    
      .dmc-model-fields,
      .dmc-reasoning-head,
      .dmc-reasoning-row {
        grid-template-columns: minmax(0, 1fr);
      }
    
      .dmc-discover-candidate {
        min-height: 40px;
      }
    }
    
    /* With motion reduced, a control does not settle: the transition and the
       transform it would have animated are both off, and nothing else about the
       surface changes. */
    @media (prefers-reduced-motion: reduce) {
      .dmc-btn {
        transition: none;
      }
    
      .dmc-btn:active:not(:disabled),
      .dmc-model-edit:active,
      .dmc-model-danger:active:not(:disabled) {
        transform: none;
      }
    }
    `;
    function injectCatalogStyles() {
      if (typeof document === "undefined") return () => {
      };
      document.getElementById(STYLE_ELEMENT_ID)?.remove();
      const element = document.createElement("style");
      element.id = STYLE_ELEMENT_ID;
      element.textContent = CSS;
      document.head.append(element);
      return () => {
        if (element.isConnected) element.remove();
      };
    }
    
    // src/client/ModelCatalog.tsx
    var import_jsx_runtime = require("react/jsx-runtime");
    var OFF_LEVEL = "off";
    var EDITED_FIELDS = ["id", "name", "contextWindow", "maxTokens", "reasoningEfforts"];
    var MODEL_ROW_SELECTOR = ".dmc-model-row";
    var addedKeySeed = 0;
    function nextAddedKey() {
      addedKeySeed += 1;
      return `a${addedKeySeed}`;
    }
    function isRecordValue(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function asRecord(value) {
      return isRecordValue(value) ? value : void 0;
    }
    function rawModelsOf(value, settingsPath) {
      const list = readPath(value, [...settingsPath, "models"]);
      return Array.isArray(list) ? list : [];
    }
    function reasoningRowsOf(value) {
      const record = asRecord(value);
      if (record === void 0) return [];
      return Object.entries(record).map(([level, raw]) => ({
        level,
        value: typeof raw === "string" ? raw : ""
      }));
    }
    function seedModel(raw, key) {
      const extra = {};
      for (const [field, value] of Object.entries(raw)) {
        if (EDITED_FIELDS.includes(field)) continue;
        extra[field] = value;
      }
      return {
        key,
        id: typeof raw.id === "string" ? raw.id : "",
        name: typeof raw.name === "string" ? raw.name : "",
        contextWindow: typeof raw.contextWindow === "number" ? formatContext(raw.contextWindow) : "",
        maxTokens: typeof raw.maxTokens === "number" ? formatContext(raw.maxTokens) : "",
        storedWindow: typeof raw.contextWindow === "number" ? raw.contextWindow : void 0,
        storedTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : void 0,
        reasoning: reasoningRowsOf(raw.reasoningEfforts),
        extra,
        open: false
      };
    }
    function seedModels(raw) {
      const models = [];
      raw.forEach((item, index) => {
        if (!isRecordValue(item)) return;
        models.push(seedModel(item, `m${index}`));
      });
      return models;
    }
    function seedCandidate(candidate) {
      return {
        key: nextAddedKey(),
        id: candidate.id,
        name: candidate.name ?? "",
        contextWindow: candidate.contextWindow === void 0 ? "" : formatContext(candidate.contextWindow),
        maxTokens: candidate.maxTokens === void 0 ? "" : formatContext(candidate.maxTokens),
        storedWindow: candidate.contextWindow,
        storedTokens: candidate.maxTokens,
        reasoning: [],
        extra: {},
        open: false
      };
    }
    function groupByPrefix(candidates) {
      const groups = [];
      const byLabel = /* @__PURE__ */ new Map();
      for (const candidate of candidates) {
        const cut = candidate.id.indexOf("/");
        const label = cut > 0 ? candidate.id.slice(0, cut) : "";
        let group = byLabel.get(label);
        if (group === void 0) {
          group = { label, items: [] };
          byLabel.set(label, group);
          groups.push(group);
        }
        group.items.push(candidate);
      }
      return groups;
    }
    function capacityOf(text, stored) {
      const trimmed = text.trim();
      if (trimmed === "") return void 0;
      const parsed = parseContext(trimmed);
      if (parsed !== null) return parsed;
      if (stored !== void 0 && trimmed === formatContext(stored)) return stored;
      return null;
    }
    function capacitiesOf(model) {
      const contextWindow = capacityOf(model.contextWindow, model.storedWindow);
      const maxTokens = capacityOf(model.maxTokens, model.storedTokens);
      return {
        contextWindow: contextWindow === null ? void 0 : contextWindow,
        maxTokens: maxTokens === null ? void 0 : maxTokens
      };
    }
    function reasoningValueOf(rows) {
      if (rows.length === 0) return void 0;
      const table = {};
      for (const row of rows) table[row.level] = row.value;
      return table;
    }
    function entryOf(model) {
      const { contextWindow, maxTokens } = capacitiesOf(model);
      const name = model.name.trim();
      return {
        id: model.id,
        ...name === "" ? {} : { name },
        ...contextWindow === void 0 ? {} : { contextWindow },
        ...maxTokens === void 0 ? {} : { maxTokens }
      };
    }
    function storedValueOf(model) {
      const { contextWindow, maxTokens } = capacitiesOf(model);
      const reasoning = reasoningValueOf(model.reasoning);
      const name = model.name.trim();
      return {
        ...model.extra,
        id: model.id,
        ...name === "" ? {} : { name },
        ...contextWindow === void 0 ? {} : { contextWindow },
        ...maxTokens === void 0 ? {} : { maxTokens },
        ...reasoning === void 0 ? {} : { reasoningEfforts: reasoning }
      };
    }
    function canonical(value) {
      if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
      if (isRecordValue(value)) {
        const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);
        return `{${entries.join(",")}}`;
      }
      return JSON.stringify(value) ?? "undefined";
    }
    function reasoningProblemOf(rows) {
      if (rows.length === 0) return void 0;
      const decisive = rows.filter((row) => row.level !== OFF_LEVEL);
      if (decisive.length === 0) return KEYS["config.reasoning.needsLevel"];
      if (decisive.some((row) => row.value.trim() === "")) return KEYS["config.reasoning.valueRequired"];
      return void 0;
    }
    function problemsOf(models, t2) {
      const messages = /* @__PURE__ */ new Map();
      const structural = validateModels(models.map(entryOf));
      if (structural !== void 0) {
        const offender = models[structural.index];
        if (offender !== void 0) messages.set(offender.key, t2(VALIDATION_KEYS[structural.reason]));
      }
      for (const model of models) {
        if (messages.has(model.key)) continue;
        const { contextWindow, maxTokens } = capacitiesOf(model);
        if (contextWindow === void 0 && model.contextWindow.trim() !== "") {
          messages.set(model.key, t2(KEYS["config.model.contextWindowInvalid"]));
          continue;
        }
        if (maxTokens === void 0 && model.maxTokens.trim() !== "") {
          messages.set(model.key, t2(KEYS["config.model.maxTokensInvalid"]));
          continue;
        }
        const reasoning = reasoningProblemOf(model.reasoning);
        if (reasoning !== void 0) messages.set(model.key, t2(reasoning));
      }
      return messages;
    }
    function ModelCatalog(props) {
      const { row, store, t: t2, onRequestClose } = props;
      const snapshot = (0, import_react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
      const settingsNs = row.entry.settingsNs;
      const settingsPath = row.entry.settingsPath;
      const modelsPath = (0, import_react.useMemo)(() => [...settingsPath, "models"], [settingsPath]);
      const namespace = snapshot.namespaces.get(settingsNs);
      const writable = snapshot.writable;
      (0, import_react.useEffect)(() => injectCatalogStyles(), []);
      const mounted = (0, import_react.useRef)(true);
      (0, import_react.useEffect)(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);
      const panelRef = (0, import_react.useRef)(null);
      const levelChoices = (0, import_react.useMemo)(
        () => reasoningLevelChoices(namespace),
        [namespace]
      );
      const raw = (0, import_react.useMemo)(() => rawModelsOf(namespace?.value, settingsPath), [namespace, settingsPath]);
      const seed = (0, import_react.useMemo)(() => seedModels(raw), [raw]);
      const storedModels = (0, import_react.useMemo)(() => modelsOf(namespace?.value, settingsPath), [namespace, settingsPath]);
      const [draft, setDraft] = (0, import_react.useState)(null);
      const models = draft ?? seed;
      const [busy, setBusy] = (0, import_react.useState)(false);
      const [note, setNote] = (0, import_react.useState)(null);
      const [discovery, setDiscovery] = (0, import_react.useState)({ kind: "idle" });
      const baseline = (0, import_react.useMemo)(() => canonical(raw.filter(isRecordValue)), [raw]);
      const dirty = canonical(models.map(storedValueOf)) !== baseline;
      const problems = (0, import_react.useMemo)(() => problemsOf(models, t2), [models, t2]);
      const invalid = problems.size > 0;
      (0, import_react.useEffect)(() => {
        props.onDirtyChange(dirty);
      }, [dirty, props.onDirtyChange]);
      (0, import_react.useEffect)(() => () => {
        props.onDirtyChange(false);
      }, [props.onDirtyChange]);
      const escapeRef = (0, import_react.useRef)(() => {
      });
      escapeRef.current = (event) => {
        if (event.key !== "Escape") return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest(".dmc-well") != null) return;
        event.stopPropagation();
        event.preventDefault();
        if (props.confirming) {
          props.onKeepEditing();
          return;
        }
        const modelRow2 = target?.closest(MODEL_ROW_SELECTOR) ?? null;
        if (modelRow2 !== null) {
          const key = modelRow2.getAttribute("data-key");
          const model = key === null ? void 0 : models.find((entry) => entry.key === key);
          if (key !== null && model?.open === true) {
            modelRow2.querySelector(".dmc-model-edit")?.focus();
            patch((rows) => rows.map((entry) => entry.key === key ? { ...entry, open: false } : entry));
            return;
          }
        }
        if (discovery.kind !== "idle") {
          panelRef.current?.querySelector(".dmc-discover")?.focus();
          setDiscovery({ kind: "idle" });
          return;
        }
        props.onRequestClose();
      };
      (0, import_react.useEffect)(() => {
        const listener = (event) => {
          escapeRef.current(event);
        };
        document.addEventListener("keydown", listener, true);
        return () => {
          document.removeEventListener("keydown", listener, true);
        };
      }, []);
      const patch = (change) => {
        setNote(null);
        setDraft((current) => change(current ?? seed));
      };
      const updateModel = (model, edit) => {
        const next = {
          key: model.key,
          id: edit.id ?? model.id,
          name: edit.name ?? model.name,
          contextWindow: edit.contextWindow ?? model.contextWindow,
          maxTokens: edit.maxTokens ?? model.maxTokens,
          storedWindow: model.storedWindow,
          storedTokens: model.storedTokens,
          reasoning: edit.reasoning ?? model.reasoning,
          extra: model.extra,
          open: edit.open ?? model.open
        };
        patch((rows) => rows.map((row2) => row2.key === next.key ? next : row2));
      };
      const addModel = () => {
        const blank = {
          key: nextAddedKey(),
          id: "",
          name: "",
          contextWindow: "",
          maxTokens: "",
          storedWindow: void 0,
          storedTokens: void 0,
          reasoning: [],
          extra: {},
          open: false
        };
        patch((rows) => [...rows, blank]);
      };
      const removeModel = (key) => {
        patch((rows) => rows.filter((row2) => row2.key !== key));
      };
      const addReasoning = (model) => {
        const used = new Set(model.reasoning.map((row2) => row2.level));
        const next = levelChoices.find((choice) => choice !== OFF_LEVEL && !used.has(choice)) ?? OFF_LEVEL;
        updateModel(model, { reasoning: [...model.reasoning, { level: next, value: "" }] });
      };
      const removeReasoning = (model, index) => {
        updateModel(model, { reasoning: model.reasoning.filter((_, position) => position !== index) });
      };
      const updateReasoning = (model, index, change) => {
        const reasoning = model.reasoning.map((row2, position) => position === index ? { level: change.level ?? row2.level, value: change.value ?? row2.value } : row2);
        updateModel(model, { reasoning });
      };
      const levelOptionsFor = (current, used) => {
        const options = [...levelChoices];
        if (current !== OFF_LEVEL && !options.includes(current)) options.push(current);
        if (!options.includes(OFF_LEVEL)) options.push(OFF_LEVEL);
        return options.filter((level) => level === current || !used.has(level));
      };
      const writeModels = async (next) => {
        if (namespace === void 0) return false;
        const profile2 = asRecord(readPath(namespace.value, settingsPath)) ?? {};
        const ops = pathOps(settingsPath, profile2, { ...profile2, models: next.map(storedValueOf) });
        setBusy(true);
        setNote(null);
        const outcome = await store.write(settingsNs, ops, namespace.revision);
        if (!mounted.current) return outcome.ok;
        setBusy(false);
        if (!outcome.ok) {
          setNote(outcome.conflict ? t2(KEYS["config.conflict"]) : outcome.message);
          return false;
        }
        setDraft(null);
        setNote(t2(KEYS["config.savedProvider"], { provider: row.entry.displayName }));
        return true;
      };
      const save = () => {
        if (!writable || busy || !dirty || invalid) return;
        void writeModels(models);
      };
      const reset = async () => {
        if (!writable || busy || namespace === void 0) return;
        setBusy(true);
        setNote(null);
        const outcome = await store.write(settingsNs, [{ op: "unset", path: modelsPath }], namespace.revision);
        if (!mounted.current) return;
        setBusy(false);
        if (!outcome.ok) {
          setNote(outcome.conflict ? t2(KEYS["config.conflict"]) : outcome.message);
          return;
        }
        setDraft(null);
        setNote(t2(KEYS["config.savedProvider"], { provider: row.entry.displayName }));
      };
      const profile = asRecord(readPath(namespace?.value, settingsPath));
      const baseURL = typeof profile?.baseURL === "string" && profile.baseURL !== "" ? profile.baseURL : void 0;
      const api = typeof profile?.api === "string" && profile.api !== "" ? profile.api : void 0;
      const fetchModels = async () => {
        if (namespace === void 0) return;
        if (row.entry.declared === true && baseURL === void 0) {
          setDiscovery({ kind: "needsBaseUrl" });
          return;
        }
        setDiscovery({ kind: "fetching" });
        const request = {
          provider: row.entry.provider,
          ...baseURL === void 0 ? {} : { baseURL },
          ...api === void 0 ? {} : { api }
        };
        const answer = await store.discover(settingsNs, request);
        if (!mounted.current) return;
        if (!answer.ok) {
          setDiscovery({ kind: "error", message: answer.message });
          return;
        }
        const seen = /* @__PURE__ */ new Set();
        const candidates = answer.models.filter((candidate) => {
          if (candidate.id === "" || seen.has(candidate.id)) return false;
          seen.add(candidate.id);
          return true;
        });
        if (candidates.length === 0) {
          setDiscovery({ kind: "empty" });
          return;
        }
        setDiscovery({ kind: "ready", candidates, selected: /* @__PURE__ */ new Set(), query: "", note: null });
      };
      const toggleCandidate = (id, checked) => {
        if (discovery.kind !== "ready") return;
        const selected = new Set(discovery.selected);
        if (checked) selected.add(id);
        else selected.delete(id);
        setDiscovery({ ...discovery, selected, note: null });
      };
      const adopt = async () => {
        if (discovery.kind !== "ready" || busy || !writable) return;
        const existing = new Set(models.map((model) => model.id));
        const additions = [];
        for (const candidate of discovery.candidates) {
          if (!discovery.selected.has(candidate.id)) continue;
          if (existing.has(candidate.id)) continue;
          existing.add(candidate.id);
          additions.push(seedCandidate(candidate));
        }
        if (additions.length === 0) return;
        const merged = [...models, ...additions];
        const firstProblem = [...problemsOf(merged, t2).values()][0];
        if (firstProblem !== void 0) {
          setDiscovery({ ...discovery, note: firstProblem });
          return;
        }
        const written = await writeModels(merged);
        if (written && mounted.current) setDiscovery({ kind: "idle" });
      };
      const catalogHead = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "dmc-catalog-title", children: t2(KEYS["config.models.label"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-catalog-status", children: storedModels.length > 0 ? t2(KEYS["config.models.customized"]) : t2(KEYS["config.models.inherited"]) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn dmc-catalog-close", onClick: onRequestClose, children: t2(KEYS["config.catalog.collapse"]) })
      ] });
      const guardLine = props.confirming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-guard", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.catalog.unsaved"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-guard-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn", onClick: props.onKeepEditing, children: t2(KEYS["config.catalog.keepEditing"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn dmc-btn-commit", onClick: props.onDiscard, children: t2(KEYS["config.catalog.discard"]) })
        ] })
      ] }) : null;
      const panel = (body2, foot2) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "dmc-catalog-panel",
          id: `dmc-catalog-${row.entry.provider}`,
          ref: panelRef,
          children: [
            catalogHead,
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-body", children: [
              guardLine,
              body2
            ] }),
            foot2
          ]
        }
      );
      if (namespace === void 0) {
        return panel(
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: snapshot.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.loadFailed"]) }),
            snapshot.error === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-error", children: snapshot.error })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-status", children: t2(KEYS["config.models.inherited"]) }) }),
          null
        );
      }
      const canReset = hasPath(namespace.user, modelsPath) || dirty;
      const presentIds = new Set(models.map((model) => model.id));
      const query = discovery.kind === "ready" ? discovery.query.trim().toLowerCase() : "";
      const visible = discovery.kind === "ready" ? discovery.candidates.filter((candidate) => query === "" || candidate.id.toLowerCase().includes(query) || (candidate.name ?? "").toLowerCase().includes(query)) : [];
      const addable = visible.filter((candidate) => !presentIds.has(candidate.id));
      const selectedAddable = discovery.kind === "ready" ? addable.filter((candidate) => discovery.selected.has(candidate.id)) : [];
      const allSelected = addable.length > 0 && selectedAddable.length === addable.length;
      const listedInCatalog = visible.length - addable.length;
      const listedGroups = groupByPrefix(visible);
      const grouped = listedGroups.length > 1;
      const selectAll = (checked) => {
        if (discovery.kind !== "ready") return;
        const selected = new Set(discovery.selected);
        for (const candidate of addable) {
          if (checked) selected.add(candidate.id);
          else selected.delete(candidate.id);
        }
        setDiscovery({ ...discovery, selected, note: null });
      };
      const modelRow = (model) => {
        const message = problems.get(model.key);
        const wellId = `dmc-model-well-${model.key}`;
        const used = new Set(model.reasoning.map((entry) => entry.level));
        const disabled = !writable || busy;
        const alias = model.name.trim();
        const context = model.contextWindow.trim();
        const output = model.maxTokens.trim();
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "li",
          {
            className: "dmc-model-row",
            "data-key": model.key,
            "data-invalid": message === void 0 ? void 0 : "true",
            "data-well": model.open ? "true" : void 0,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-ref", title: model.id === "" ? void 0 : model.id, children: model.id === "" ? t2(KEYS["config.model.newLabel"]) : model.id }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-model-edit",
                  "aria-expanded": model.open,
                  "aria-controls": wellId,
                  onClick: () => {
                    updateModel(model, { open: !model.open });
                  },
                  children: t2(KEYS["config.edit"])
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dmc-model-sub", children: [
                alias === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-alias", children: alias }),
                context === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dmc-model-fact", children: [
                  t2(KEYS["config.model.contextShort"]),
                  " ",
                  context
                ] }),
                output === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dmc-model-fact", children: [
                  t2(KEYS["config.model.outputShort"]),
                  " ",
                  output
                ] }),
                alias === "" && context === "" && output === "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-fact", children: t2(KEYS["config.model.capacityDefault"]) }) : null
              ] }),
              model.open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-model-well", id: wellId, children: [
                message === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-model-error", children: message }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-model-fields", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-model-id", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dmc-model-label", htmlFor: `dmc-model-id-${model.key}`, children: t2(KEYS["config.model.id"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        className: "dmc-model-input",
                        id: `dmc-model-id-${model.key}`,
                        type: "text",
                        autoComplete: "off",
                        spellCheck: false,
                        value: model.id,
                        disabled,
                        "data-invalid": message === void 0 ? void 0 : "true",
                        onChange: (event) => {
                          updateModel(model, { id: event.target.value });
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-model-name", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dmc-model-label", htmlFor: `dmc-model-name-${model.key}`, children: t2(KEYS["config.model.name"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        className: "dmc-model-input",
                        id: `dmc-model-name-${model.key}`,
                        type: "text",
                        autoComplete: "off",
                        spellCheck: false,
                        value: model.name,
                        placeholder: t2(KEYS["config.model.namePlaceholder"]),
                        disabled,
                        onChange: (event) => {
                          updateModel(model, { name: event.target.value });
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-model-window", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dmc-model-label", htmlFor: `dmc-model-window-${model.key}`, children: t2(KEYS["config.model.contextWindow"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        className: "dmc-model-input",
                        id: `dmc-model-window-${model.key}`,
                        type: "text",
                        inputMode: "decimal",
                        autoComplete: "off",
                        spellCheck: false,
                        value: model.contextWindow,
                        placeholder: t2(KEYS["config.model.contextWindowPlaceholder"]),
                        disabled,
                        onChange: (event) => {
                          updateModel(model, { contextWindow: event.target.value });
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-model-tokens", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dmc-model-label", htmlFor: `dmc-model-tokens-${model.key}`, children: t2(KEYS["config.model.maxTokens"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        className: "dmc-model-input",
                        id: `dmc-model-tokens-${model.key}`,
                        type: "text",
                        inputMode: "decimal",
                        autoComplete: "off",
                        spellCheck: false,
                        value: model.maxTokens,
                        placeholder: t2(KEYS["config.model.maxTokensPlaceholder"]),
                        disabled,
                        onChange: (event) => {
                          updateModel(model, { maxTokens: event.target.value });
                        }
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-reasoning", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-label", children: t2(KEYS["config.reasoning.label"]) }),
                  model.reasoning.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-reasoning-head", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-label", children: t2(KEYS["config.reasoning.level"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-label", children: t2(KEYS["config.reasoning.value"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
                  ] }),
                  model.reasoning.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-reasoning-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "select",
                      {
                        className: "dmc-reasoning-level",
                        "aria-label": t2(KEYS["config.reasoning.level"]),
                        value: entry.level,
                        disabled,
                        onChange: (event) => {
                          updateReasoning(model, index, { level: event.target.value });
                        },
                        children: levelOptionsFor(entry.level, used).map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: level, children: level === OFF_LEVEL ? t2(KEYS["config.reasoning.off"]) : level }, level))
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        className: "dmc-reasoning-value",
                        type: "text",
                        autoComplete: "off",
                        spellCheck: false,
                        "aria-label": t2(KEYS["config.reasoning.value"]),
                        value: entry.value,
                        disabled: disabled || entry.level === OFF_LEVEL,
                        placeholder: entry.level === OFF_LEVEL ? t2(KEYS["config.reasoning.offPlaceholder"]) : "",
                        onChange: (event) => {
                          updateReasoning(model, index, { value: event.target.value });
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "dmc-btn dmc-reasoning-remove",
                        disabled,
                        onClick: () => {
                          removeReasoning(model, index);
                        },
                        children: t2(KEYS["config.reasoning.remove"])
                      }
                    )
                  ] }, `${entry.level}-${index}`)),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dmc-btn dmc-reasoning-add",
                      disabled,
                      onClick: () => {
                        addReasoning(model);
                      },
                      children: t2(KEYS["config.reasoning.add"])
                    }
                  ),
                  model.reasoning.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-reasoning-help", children: t2(KEYS["config.reasoning.helpText"]) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-model-danger",
                    disabled,
                    onClick: () => {
                      removeModel(model.key);
                    },
                    children: t2(KEYS["config.model.remove"])
                  }
                )
              ] }) : null
            ]
          },
          model.key
        );
      };
      const body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        writable ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.readOnly"]) }),
        storedModels.length === 0 && models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.models.empty"]) }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dmc-model-list", children: models.map((model) => modelRow(model)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "dmc-btn dmc-model-add", disabled: !writable || busy, onClick: addModel, children: [
          "+ ",
          t2(KEYS["config.model.add"])
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-discover-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "dmc-btn dmc-discover",
              disabled: busy || discovery.kind === "fetching",
              onClick: () => {
                void fetchModels();
              },
              children: t2(KEYS["config.fetch.action"])
            }
          ),
          discovery.kind === "fetching" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-catalog-status", children: t2(KEYS["config.fetch.fetching"]) }) : null
        ] }),
        discovery.kind === "needsBaseUrl" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.needsBaseUrl"]) }) : null,
        discovery.kind === "empty" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.empty"]) }) : null,
        discovery.kind === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-error", children: discovery.message }) : null,
        discovery.kind === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-discover-panel", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dmc-catalog-section", children: t2(KEYS["config.fetch.title"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.description"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: "dmc-discover-search",
              type: "search",
              autoComplete: "off",
              spellCheck: false,
              "aria-label": t2(KEYS["config.fetch.search"]),
              placeholder: t2(KEYS["config.fetch.search"]),
              value: discovery.query,
              onChange: (event) => {
                setDiscovery({ ...discovery, query: event.target.value, note: null });
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-discover-tools", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-catalog-status", children: t2(KEYS["config.fetch.count"], {
              count: String(visible.length),
              inCatalog: String(listedInCatalog)
            }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "dmc-btn dmc-discover-tool",
                disabled: addable.length === 0 || allSelected,
                onClick: () => {
                  selectAll(true);
                },
                children: t2(KEYS["config.fetch.selectAll"])
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "dmc-btn dmc-discover-tool",
                disabled: selectedAddable.length === 0,
                onClick: () => {
                  selectAll(false);
                },
                children: t2(KEYS["config.fetch.deselectAll"])
              }
            )
          ] }),
          visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.noMatches"]) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dmc-discover-list", children: listedGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [
            grouped && group.label !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dmc-discover-group", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: group.label }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: group.items.length })
            ] }) : null,
            group.items.map((candidate) => {
              const present = presentIds.has(candidate.id);
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "li",
                {
                  className: "dmc-discover-candidate",
                  "data-present": present ? "true" : void 0,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-discover-label", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "input",
                        {
                          className: "dmc-discover-check",
                          type: "checkbox",
                          checked: !present && discovery.selected.has(candidate.id),
                          disabled: present || busy,
                          onChange: (event) => {
                            toggleCandidate(candidate.id, event.target.checked);
                          }
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-discover-id", children: candidate.id })
                    ] }),
                    candidate.name === void 0 || candidate.name === candidate.id ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-discover-name", children: candidate.name })
                  ]
                },
                candidate.id
              );
            })
          ] }, `group-${group.label}`)) }),
          discovery.note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-error", children: discovery.note }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmc-discover-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "dmc-btn dmc-btn-commit dmc-discover-adopt",
              disabled: !writable || busy || selectedAddable.length === 0,
              onClick: () => {
                void adopt();
              },
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.fetch.adopt"])
            }
          ) })
        ] }) : null
      ] });
      const foot = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-foot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "dmc-btn dmc-btn-commit",
            disabled: !writable || busy || !dirty || invalid,
            onClick: save,
            children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.apply"])
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "dmc-btn",
            disabled: !writable || busy || !canReset,
            onClick: () => {
              void reset();
            },
            children: t2(KEYS["config.models.reset"])
          }
        ),
        note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-catalog-note", children: note })
      ] });
      return panel(body, foot);
    }
    
    // src/client/RetryEditor.tsx
    var import_react2 = require("react");
    
    // src/client/retryPolicy.ts
    var MIN_RETRIES = 0;
    var MAX_RETRIES = 60;
    var MIN_MAX_DELAY_MS = 500;
    var MAX_MAX_DELAY_MS = 6e4;
    var DEFAULT_INITIAL_DELAY_MS = 500;
    var DEFAULT_MAX_DELAY_MS = 1e4;
    var DEFAULT_JITTER_RATIO = 0.1;
    var DEFAULT_MAX_RETRIES = 5;
    function isRecord3(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function nonNegativeInt(value) {
      return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : void 0;
    }
    function positiveNumber(value) {
      return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
    }
    function nodeAtPath(value, path) {
      let node = value;
      for (const key of path) {
        if (!isRecord3(node)) return void 0;
        node = node[key];
      }
      return isRecord3(node) ? node : void 0;
    }
    function resolveRetryPolicy(value, scope, user) {
      const atScope = nodeAtPath(value, scope);
      const policy = atScope === void 0 ? void 0 : atScope["retryPolicy"];
      const policyRecord = isRecord3(policy) ? policy : void 0;
      const backoffRaw = policyRecord === void 0 ? void 0 : policyRecord["backoff"];
      const backoff = isRecord3(backoffRaw) ? backoffRaw : void 0;
      const mode = policyRecord?.["mode"];
      const maxRetries = nonNegativeInt(policyRecord?.["maxRetries"]) ?? DEFAULT_MAX_RETRIES;
      const maxDelayMs = positiveNumber(backoff?.["maxDelayMs"]) ?? DEFAULT_MAX_DELAY_MS;
      const initialDelayMs = positiveNumber(backoff?.["initialDelayMs"]) ?? DEFAULT_INITIAL_DELAY_MS;
      const rawJitter = backoff?.["jitterRatio"];
      const jitterRatio = typeof rawJitter === "number" && Number.isFinite(rawJitter) ? Math.max(0, Math.min(rawJitter, 1)) : DEFAULT_JITTER_RATIO;
      const userScope = nodeAtPath(user, scope);
      const userPolicy = userScope === void 0 ? void 0 : userScope["retryPolicy"];
      const declared = isRecord3(userPolicy);
      return {
        // The executor treats a policy it cannot classify as normal mode; the card
        // shows the mode it will actually get.
        mode: mode === "always" ? "always" : "normal",
        declared,
        maxRetries,
        maxDelayMs,
        initialDelayMs,
        jitterRatio,
        ...policyRecord === void 0 ? {} : { policy: policyRecord }
      };
    }
    function retryWaitCurve(backoff, maxRetries) {
      const waits = [];
      const budget = Math.max(0, Math.min(Math.floor(maxRetries), MAX_RETRIES));
      for (let retry = 1; retry <= budget; retry += 1) {
        const exponent = Math.min(retry - 1, 1024);
        const exponential = Math.min(backoff.initialDelayMs * 2 ** exponent, backoff.maxDelayMs);
        waits.push(exponential);
      }
      return waits;
    }
    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return "0s";
      if (ms < 1e3) return `${Math.round(ms)}ms`;
      const totalSeconds = ms / 1e3;
      if (totalSeconds < 60) {
        return Number.isInteger(totalSeconds) ? `${totalSeconds}s` : `${totalSeconds.toFixed(1)}s`;
      }
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.round(totalSeconds - minutes * 60);
      if (seconds === 60) return `${minutes + 1}m`;
      return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`;
    }
    function waitRange(waits, jitterRatio) {
      const ratio = Number.isFinite(jitterRatio) ? Math.max(0, Math.min(jitterRatio, 1)) : 0;
      let low = 0;
      let high = 0;
      for (const wait of waits) {
        low += wait * (1 - ratio);
        high += wait * (1 + ratio);
      }
      return { low, high };
    }
    function parseRetries(raw) {
      const text = raw.trim();
      if (!/^\d+$/.test(text)) return null;
      const value = Number(text);
      if (!Number.isSafeInteger(value) || value < MIN_RETRIES || value > MAX_RETRIES) return null;
      return value;
    }
    function parseMaxDelaySeconds(raw) {
      const text = raw.trim();
      if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
      const seconds = Number(text);
      if (!Number.isFinite(seconds)) return null;
      const ms = Math.round(seconds * 1e3);
      if (ms < MIN_MAX_DELAY_MS || ms > MAX_MAX_DELAY_MS) return null;
      return ms;
    }
    function formatMaxDelaySeconds(ms) {
      const seconds = ms / 1e3;
      return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
    }
    function retryPolicyDocument(view, maxRetries, maxDelayMs) {
      const stored = view.policy?.["retryableCodes"];
      const retryableCodes = Array.isArray(stored) ? stored.filter((code) => typeof code === "string") : void 0;
      return {
        mode: view.mode,
        maxRetries,
        // Omitted rather than set to undefined: the schema would reject an explicit
        // null here, and an absent key is what `default(...)` fills.
        ...retryableCodes === void 0 || retryableCodes.length === 0 ? {} : { retryableCodes },
        backoff: {
          initialDelayMs: Math.min(view.initialDelayMs, maxDelayMs),
          maxDelayMs,
          jitterRatio: view.jitterRatio
        }
      };
    }
    
    // src/client/RetryEditor.tsx
    var import_jsx_runtime2 = require("react/jsx-runtime");
    function RetryField(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "dmc-retry-label", htmlFor: props.id, children: props.label }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              id: props.id,
              className: "dmc-retry-input",
              type: "text",
              inputMode: "decimal",
              autoComplete: "off",
              spellCheck: false,
              value: props.value,
              disabled: props.disabled,
              "aria-invalid": props.invalid || void 0,
              onChange: (event) => {
                props.onChange(event.target.value);
              },
              onFocus: (event) => {
                event.currentTarget.select();
              },
              onBlur: props.onCommit,
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.onCommit();
                }
                if (event.key === "Escape") {
                  event.stopPropagation();
                  props.onCancel();
                }
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-retry-unit", children: props.unit })
        ] })
      ] });
    }
    function RetryEditor(props) {
      const { row, namespace, store, t: t2, writable } = props;
      const provider = row.entry.provider;
      const ns = row.entry.settingsNs;
      const scope = row.entry.settingsPath;
      const [retriesDraft, setRetriesDraft] = (0, import_react2.useState)(null);
      const [capDraft, setCapDraft] = (0, import_react2.useState)(null);
      const [retriesInvalid, setRetriesInvalid] = (0, import_react2.useState)(false);
      const [capInvalid, setCapInvalid] = (0, import_react2.useState)(false);
      const [busy, setBusy] = (0, import_react2.useState)(false);
      const [note, setNote] = (0, import_react2.useState)(null);
      const mounted = (0, import_react2.useRef)(true);
      (0, import_react2.useEffect)(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);
      const view = resolveRetryPolicy(namespace.value, scope, namespace.user);
      const retriesText = retriesDraft ?? String(view.maxRetries);
      const capText = capDraft ?? formatMaxDelaySeconds(view.maxDelayMs);
      const parsedRetries = parseRetries(retriesText);
      const parsedCap = parseMaxDelaySeconds(capText);
      const preview = (0, import_react2.useMemo)(() => {
        const retries = parsedRetries ?? view.maxRetries;
        const capMs = parsedCap ?? view.maxDelayMs;
        const backoff = {
          initialDelayMs: Math.min(view.initialDelayMs, capMs),
          maxDelayMs: capMs,
          jitterRatio: view.jitterRatio
        };
        const waits = retryWaitCurve(backoff, retries);
        return { retries, first: backoff.initialDelayMs, longest: waitRange(waits, view.jitterRatio).high };
      }, [parsedCap, parsedRetries, view.initialDelayMs, view.jitterRatio, view.maxDelayMs, view.maxRetries]);
      const settle = (0, import_react2.useCallback)((message) => {
        setRetriesDraft(null);
        setCapDraft(null);
        setNote(message);
      }, []);
      const commit = (0, import_react2.useCallback)(async () => {
        const retries = parseRetries(retriesText);
        const capMs = parseMaxDelaySeconds(capText);
        setRetriesInvalid(retries === null);
        setCapInvalid(capMs === null);
        if (retries === null || capMs === null) return;
        if (retries === view.maxRetries && capMs === view.maxDelayMs) {
          settle(null);
          return;
        }
        setBusy(true);
        setNote(null);
        const ops = [{
          op: "set",
          path: [...scope, "retryPolicy"],
          value: retryPolicyDocument(view, retries, capMs)
        }];
        const outcome = await store.write(ns, ops, namespace.revision);
        if (!mounted.current) return;
        setBusy(false);
        if (!outcome.ok) {
          setNote(outcome.message);
          return;
        }
        settle(t2(KEYS["config.retryPolicy.saved"]));
      }, [capText, ns, namespace.revision, retriesText, scope, settle, store, t2, view]);
      const reset = (0, import_react2.useCallback)(async () => {
        setBusy(true);
        setNote(null);
        const outcome = await store.write(
          ns,
          [{ op: "unset", path: [...scope, "retryPolicy"] }],
          namespace.revision
        );
        if (!mounted.current) return;
        setBusy(false);
        if (!outcome.ok) {
          setNote(outcome.message);
          return;
        }
        settle(t2(KEYS["config.retryPolicy.saved"]));
      }, [ns, namespace.revision, scope, settle, store, t2]);
      const editable = writable && !busy;
      const always = view.mode === "always";
      const dirty = retriesText !== String(view.maxRetries) || capText !== formatMaxDelaySeconds(view.maxDelayMs);
      const summary = [
        `${preview.retries} ${t2(KEYS["config.retryPolicy.retriesUnit"])}`,
        t2(KEYS["config.retryPolicy.first"], { count: formatDuration(preview.first) }),
        t2(KEYS["config.retryPolicy.total"], { count: formatDuration(preview.longest) })
      ].join(" · ");
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry", id: `dmc-retry-${provider}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-retry-state", children: t2(view.declared ? KEYS["config.retryPolicy.declared"] : KEYS["config.retryPolicy.inherits"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry-fields", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            RetryField,
            {
              id: `retry-count-${provider}`,
              label: t2(KEYS["config.retryPolicy.retries"]),
              unit: t2(KEYS["config.retryPolicy.retriesUnit"]),
              value: retriesText,
              invalid: retriesInvalid,
              disabled: !editable,
              onChange: (next) => {
                setRetriesDraft(next);
                setRetriesInvalid(false);
                setNote(null);
              },
              onCommit: () => {
                void commit();
              },
              onCancel: () => {
                settle(null);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            RetryField,
            {
              id: `retry-cap-${provider}`,
              label: t2(KEYS["config.retryPolicy.cap"]),
              unit: t2(KEYS["config.retryPolicy.capUnit"]),
              value: capText,
              invalid: capInvalid,
              disabled: !editable,
              onChange: (next) => {
                setCapDraft(next);
                setCapInvalid(false);
                setNote(null);
              },
              onCommit: () => {
                void commit();
              },
              onCancel: () => {
                settle(null);
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.doubling"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.recovery"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-retry-summary", children: summary }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "dmc-key-action",
              disabled: !editable || !dirty,
              onClick: () => {
                void commit();
              },
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.apply"])
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "dmc-key-action",
              disabled: !editable || !view.declared,
              onClick: () => {
                void reset();
              },
              children: t2(KEYS["config.retryPolicy.reset"])
            }
          ),
          note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-notice", children: note })
        ] }),
        retriesInvalid ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.badRetries"], { count: String(MAX_RETRIES) }) }) : null,
        capInvalid ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.badCap"], { count: String(MAX_MAX_DELAY_MS / 1e3) }) }) : null,
        always ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.always"]) }) : null,
        writable ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.unavailable"]) })
      ] });
    }
    
    // src/client/modelConfigStyles.ts
    var STYLE_ELEMENT_ID2 = "dsh-rabbit-model-picker-model-config-styles";
    var CSS2 = `
    /* THE PAGE IS THE QUERY CONTAINER. This section is rendered inside the host
       settings panel, which hands it about 484-560px at any desktop viewport and only
       106px at a 390px viewport — so a viewport media query can never see the width the
       layout actually has. Every narrow branch below asks THIS element through
       @container. */
    .dmc-page {
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: 16px;
      /* One narrow column, left-aligned: this section lives in someone else's settings
         panel, so it aligns with that panel rather than centring itself. */
      max-width: 560px;
      color: var(--dsw-alias-label-primary);
      font-size: 13px;
      line-height: 20px;
    }
    
    /* THE BOX MODEL IS STATED, NOT ASSUMED: the host gives this plugin no global
       border-box, and a control's height and padding are written as one number. */
    .dmc-page,
    .dmc-row,
    .dmc-add,
    .dmc-picker-item,
    .dmc-key-action,
    .dmc-key-clear,
    .dmc-protocol,
    .dmc-catalog,
    .dmc-manage,
    .dmc-danger,
    .dmc-retry-action,
    .dmc-retry-input {
      box-sizing: border-box;
    }
    
    .dmc-head {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    /* THE LEDGER'S BALANCE LINE, and the page's only large thing.
       It counts the rows below it, so the sentence and the list can never disagree —
       both are computed from the same reading of the store (see readingOf in
       ModelConfigPage.tsx). It is INDENTED TO THE NAME COLUMN (16px = the 4px rail
       plus the 12px gap), so the balance shares a left edge with the entries it
       counts instead of hanging at the panel's edge.
       Two decided properties: tabular-nums, so a recount does not reflow the line; and
       a 160ms TRANSFORM-only landing, replayed by keying the node on its own sentence.
       Nothing here fades (a static gate forbids opacity in this sheet). */
    .dmc-readout {
      margin: 0 0 0 16px;
      font-size: 20px;
      line-height: 28px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
      animation: dmc-readout-landing 160ms ease-out;
    }
    
    /* The first-run hint is the page's only guidance when nothing can serve, so it
       carries the primary ink. It is a sentence: no banner, no capsule, no fill. */
    .dmc-empty {
      margin: 0;
      max-width: 62ch;
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-notice {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmc-notice-action {
      margin-left: 8px;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      text-decoration: underline;
      cursor: pointer;
    }
    
    /* The read-only alert borrows the page's own motif instead of inventing a second
       fill rung: a 4px bar in the state colour (a graphic, where the bar clears 3:1)
       beside a sentence in the primary ink. */
    .dmc-alert {
      margin: 0;
      padding: 2px 0 2px 12px;
      border-left: 4px solid var(--dsw-alias-state-error-primary);
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    
    /* The ledger's add entry, and the page's one accent.
       NOT a filled button: the theme has no "ink on accent" role, and the white a
       primary button pairs with the accent fill measures 4.2349:1 light / 2.3278:1
       dark — both under the 4.5:1 bar. The accent therefore carries the EDGE: a 4px
       left bar (a solid shape clears the 3:1 graphical bar at 4.2349:1 light /
       7.8343:1 dark) while the label keeps the primary ink at 17-19:1.
       The bar is the page's own bar language (the row rail is 4px too), and the two
       are deliberately different colours for different roles: red marks a state, blue
       marks the action. Padding-left 12 + the 4px bar puts the label at 16px, the same
       left edge every row's name sits on. */
    .dmc-add {
      height: 40px;
      padding: 0 10px 0 12px;
      border: none;
      border-left: 4px solid var(--dsw-alias-state-business-primary);
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-wrap: pretty;
      cursor: pointer;
      transition: transform 80ms linear, background-color 120ms ease-out;
    }
    
    .dmc-add:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmc-add:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-add:disabled {
      /* The bar is kept at 4px and only recoloured: dropping it outright would shift
         the action the moment it became unavailable. */
      border-left-color: transparent;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* The add picker: the catalog entries the page does NOT list, disclosed by the
       one add entry. It is an inline disclosure rather than a floating layer, because
       adding a provider is a step in this section's own task. */
    .dmc-picker {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .dmc-picker-list {
      display: flex;
      flex-direction: column;
      /* The measured deployment offers 38 entries; the list scrolls rather than
         pushing the section's own action row a screen and a half down. */
      max-height: 320px;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    
    /* A dormant entry draws NOTHING for its state: being addable is not an error, so
       the only marker is the live fill under the pointer. The data-state hook stays
       for accessibility and for the state gate, not for paint. */
    .dmc-picker-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background-color 120ms ease-out;
    }
    
    .dmc-picker-item:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmc-picker-item:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    .dmc-list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    /* THE LEDGER LINE. One row is one route, on one line:
         rail | name + route | model count | answer word | door
       The four tracks are shared by every row, and the answer word and door are
       right-aligned, so their right edges coincide across the whole list. A row that
       omits the model cell (it never does) would still park its neighbours here.
       NO FILL AT REST — not even for a state that needs the reader. At eleven rows the
       WORD is the primary channel and the rail is the redundant second one; a third
       channel only made the page shout. The only fills are positional (hover / focus /
       the row whose catalog is open). */
    .dmc-row {
      display: grid;
      grid-template-columns: 4px minmax(120px, 1fr) max-content max-content 44px;
      column-gap: 12px;
      align-items: center;
      min-height: 44px;
      padding: 10px 0;
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-row:hover,
    .dmc-row:focus-within,
    .dmc-row[data-catalog='true'],
    .dmc-row[data-well='true'] {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    /* The rail: 4px, spanning the row's own lines. It is the list's scanning column,
       so it is drawn only for the ONE fact it means — this provider cannot serve a
       request — and left EMPTY everywhere else, including on a row that merely has a
       diagnostic. One rung, one meaning. */
    .dmc-rail {
      grid-column: 1;
      grid-row: 1 / -1;
      align-self: stretch;
      width: 4px;
      background: transparent;
    }
    
    .dmc-rail[data-state='missing-key'],
    .dmc-rail[data-state='unreachable'] {
      background: var(--dsw-alias-state-error-primary);
    }
    
    /* Left end: identity. The route id rides inside the name's own track, so the two
       can never be separated by a grid gap, and both wrap rather than push a neighbour
       out. */
    .dmc-name {
      grid-column: 2;
      grid-row: 1;
      min-width: 0;
      font-size: 14px;
      line-height: 20px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
      overflow-wrap: anywhere;
    }
    
    .dmc-route {
      margin-left: 8px;
      font-size: 12px;
      line-height: 18px;
      font-weight: 400;
      color: var(--dsw-alias-label-secondary);
      overflow-wrap: anywhere;
    }
    
    /* The model cell: a FACT and the door to the catalog region that curates it. Right-aligned
       on its own track, so the counts form a column. Tabular figures keep a count
       change from reflowing the line; the noun is part of the value (a bare number in
       a settings list reads as a label waiting for its unit). */
    .dmc-catalog {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      height: 28px;
      padding: 0 4px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      cursor: pointer;
      transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-catalog:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-catalog:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-catalog:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* The row's answer, as ONE word, right-aligned. Its right edge is fixed by the
       grid, so the answers form a column down the list even though the words differ in
       width. The ink carries the loudness: a ready row states its word quietly, and
       the two states that need the reader state it in the primary ink. The rail is the
       redundant channel, never the first one. */
    .dmc-verdict {
      grid-column: 4;
      grid-row: 1;
      justify-self: end;
      /* The 12px left padding is what keeps the answer from reading as the tail of the
         model cell beside it (默认 已登录): the grid gap alone put two quiet words in
         one breath. Right-alignment is unaffected — padding widens the column leftward. */
      padding-left: 12px;
      font-size: 13px;
      line-height: 20px;
      font-variant-numeric: tabular-nums;
      color: var(--dsw-alias-label-secondary);
      text-wrap: pretty;
      transition: color 160ms ease-out;
      animation: dmc-verdict-landing 160ms ease-out;
    }
    
    .dmc-verdict[data-state='missing-key'],
    .dmc-verdict[data-state='unreachable'] {
      color: var(--dsw-alias-label-primary);
    }
    
    /* The row's one door. A word, not a chevron: the page's whole control vocabulary
       is words, and a glyph would need a legend. It is the only control on the scan
       line besides the model cell's own door, and it opens the well under the line. */
    .dmc-manage {
      grid-column: 5;
      grid-row: 1;
      justify-self: end;
      height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      white-space: nowrap;
      cursor: pointer;
      transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-manage:hover {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmc-manage:active {
      transform: translateY(1px);
    }
    
    .dmc-manage:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* The in-flight word. It takes a line of its own under the scan line rather than a
       control's cell: a write can be in flight ON a row whose well is also open (the
       well's controls are merely disabled), and stacking it under the line keeps both
       readable instead of overlaying one on the other. */
    .dmc-pending {
      grid-column: 2 / -1;
      grid-row: 2;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* THE SETTINGS WELL: the row's controls, as a FORM.
       Three labelled fields on one label column (凭据 / API 协议 / 自动重试) and the
       lifecycle entry last. It is a DIRECT CHILD of the row, under both segments of the
       scan line, so opening it never re-flows the line above. No fill, no edge and no
       radius of its own: the row's hover fill is its surface, which is why it must
       live inside .dmc-row.
       The label column is what makes this a form rather than a row of words: a value
       and its name can never drift apart, and the three values share one left edge. */
    .dmc-well {
      grid-column: 2 / -1;
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      column-gap: 12px;
      row-gap: 8px;
      align-items: center;
      padding: 2px 0 12px;
    }
    
    /* The diagnostic sentence. Primary ink, never the red one: measured on the light
       theme the state colour is under the 4.5:1 body bar, while this pairing is
       17.39:1. It sits at the top of the well, where the write that produced it
       happened. */
    .dmc-diagnostic {
      grid-column: 1 / -1;
      margin: 0;
      padding: 2px 0 4px;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-primary);
      overflow-wrap: anywhere;
    }
    
    .dmc-field-label {
      font-size: 12px;
      line-height: 20px;
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmc-field-value {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-width: 0;
      font-size: 13px;
      line-height: 20px;
      color: var(--dsw-alias-label-primary);
    }
    
    /* A value that is stated, not acted on (已配置 / 使用默认值 / 由账号提供). */
    .dmc-quiet {
      color: var(--dsw-alias-label-secondary);
    }
    
    /* THE ROW'S TASK ENTRIES, and the ink ladder every de-chromed action shares: the
       word is the PRIMARY ink at rest, the live fill is the pointer's, and only a
       DISABLED action drops to the secondary ink. A deployment that cannot write
       (settings.writable === false) must not draw actions that look clickable; the de
       -chroming must not remove the only cue that distinguishes them.
       Both the button that opens the field and the field itself share this class, so
       the de-chroming is stated once. The open field is the only flexing member: it
       takes the rest of the value column so a key can be typed without the row growing
       a second line. */
    .dmc-key-action {
      min-width: 0;
      height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
    }
    
    input.dmc-key-action {
      flex: 1 1 160px;
      width: 100%;
      padding: 0 8px;
      background: var(--dsw-specific-input-major);
    }
    
    .dmc-key-action::placeholder {
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmc-key-action:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-key-action:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-key-action:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    .dmc-key-clear {
      flex: none;
      min-height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: color 120ms ease-out, background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-key-clear:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-primary);
    }
    
    .dmc-key-clear:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-key-clear:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* A real form field keeps its edge: without it the choice reads as static text,
       and the retry sheet already recorded the regression that removing it caused.
       The native option list is painted by the platform, so the two colours it needs
       are stated rather than inherited. */
    .dmc-protocol {
      min-width: 176px;
      max-width: 100%;
      height: 28px;
      padding: 0 6px;
      border: 1px solid var(--dsw-alias-border-l3); /* taste-skill-ignore: a real form field is told apart from static text by its edge, which the house rules exempt (the retry sheet recorded the regression that removing it caused) */
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    
    .dmc-protocol:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    .dmc-protocol option {
      background: var(--dsw-alias-bg-base);
      color: var(--dsw-alias-label-primary);
    }
    
    /* The retry field's action. It states 修改 rather than 自动重试 because the field is
       already named 自动重试 — an action that repeats its field's name makes the form
       read as two labels. */
    .dmc-retry-action {
      min-height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-retry-action:hover {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmc-retry-action:active {
      transform: translateY(1px);
    }
    
    /* The lifecycle entry. It is destructive and it is not one of the provider's
       values, so it carries no field label and sits on the well's last line. The ink
       ladder is the page's (primary at rest, secondary when the deployment cannot
       write); the destructive intent is carried by the word itself. */
    .dmc-danger {
      min-height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-danger:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover-danger);
    }
    
    .dmc-danger:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-danger:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    /* THE INLINE AUTO-RETRY EDITOR: the deleted chart, restated as words.
    
       WHY THE BAR CHART IS GONE. The card this replaces drew every wait as a bar — a
       plot, one slot per retry, a cap mark, an axis. Measured against the reading it
       had to support ("how long will this provider make me wait, and how fast does the
       delay grow?"), those bars carried no exact value and their height meant nothing
       across rows: the chart was an illustration OF the two numbers beside it, not a
       second fact. The rhythm is now stated as words and figures:
         - the doubling rule as one sentence, which is the one thing the bar row showed
           only by eye;
         - the FIRST wait and the LONGEST TOTAL as tabular figures.
       The total is the HIGH bound of waitRange(waits, jitterRatio) and not the nominal
       sum: jitter moves every wait, so a line labelled 最长合计 must state the longest
       the schedule can run or the label is lying.
    
       THE FAMILY, top to bottom. The editor (.dmc-retry) is a stack of short lines, NOT
       a card: no fill, no edge, no radius. It is a direct child of .dmc-well and spans
       both of its columns, under the field line that opened it, so opening it never
       re-flows the controls above. Then: .dmc-retry-state says whether this provider
       has a policy of its own; .dmc-retry-fields holds one .dmc-retry-field per number
       (a .dmc-retry-label over a .dmc-retry-row of .dmc-retry-input + .dmc-retry-unit);
       .dmc-retry-summary is the one-line schedule; and .dmc-retry-actions reuses the
       page's own de-chromed action (.dmc-key-action) and notice line (.dmc-notice). No
       second button vocabulary is introduced. */
    .dmc-retry {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      padding: 2px 0 4px;
    }
    
    /* The one fact the fields cannot state for themselves: whether editing them will
       write a new value or create one. It takes the primary ink because it answers the
       question the reader opened the editor with. */
    .dmc-retry-state {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--dsw-alias-label-primary);
    }
    
    /* The two fields sit side by side and wrap only when the container is brutal. */
    .dmc-retry-fields {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 8px 16px;
      min-width: 0;
    }
    
    .dmc-retry-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    
    /* A form label, not an eyebrow: it names the value under it, in the quieter ink,
       at the same 12px every other name on this page uses. */
    .dmc-retry-label {
      font-size: 12px;
      line-height: 16px;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* The value line: the number and its unit word, kept together so "5" can never
       read as a bare number without its noun. */
    .dmc-retry-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    
    /* THE PAGE'S SECOND REAL FORM CONTROL — and the second, last 1px edge on it. It
       mirrors the catalog region's field: the same 1px --dsw-alias-border-l3 edge, the
       same --dsw-specific-input-major fill so the well reads as editable in both
       themes, the same 12px tabular figures. The width is fixed at about one three-
       digit number rather than elastic, because two fields of different sizes for the
       same kind of value would read as a layout accident. */
    .dmc-retry-input {
      width: 64px;
      min-width: 0;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--dsw-alias-border-l3); /* taste-skill-ignore: a real form field is told apart from static text by its edge, which the house rules exempt (the deleted retry card recorded the regression that removing it caused) */
      border-radius: 0;
      background: var(--dsw-specific-input-major);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    
    /* A rejected draft marks the FIELD, not only the sentence under it — the same
       graphic-only use of the state colour as the catalog region's invalid field. No text is
       painted in it, and the sentence still says what to type. */
    .dmc-retry-input[aria-invalid='true'] {
      border-color: var(--dsw-alias-state-error-primary);
    }
    
    .dmc-retry-input:disabled {
      color: var(--dsw-alias-label-secondary);
      cursor: default;
    }
    
    .dmc-retry-unit {
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* The schedule in one line, tabular so a digit change never reflows it. */
    .dmc-retry-summary {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--dsw-alias-label-secondary);
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-retry-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    
    /* The two landing voices: the row's answer word and the page's readout. Both are
       160ms and TRANSFORM-only — an opacity would be a fade, which this sheet's own
       static gate refuses — and both are replayed by remounting (React keys the node on
       the value it states), not by a scroll trigger. */
    @keyframes dmc-verdict-landing {
      from { transform: translateY(2px); }
    }
    
    @keyframes dmc-readout-landing {
      from { transform: translateY(2px); }
    }
    
    /* Every focusable control, one ring. The host's own focus-ring token resolves to
       transparent in both themes, so the business colour is named directly instead of
       being reached through a fallback that would paint nothing. */
    .dmc-add:focus-visible,
    .dmc-notice-action:focus-visible,
    .dmc-key-action:focus-visible,
    .dmc-key-clear:focus-visible,
    .dmc-protocol:focus-visible,
    .dmc-catalog:focus-visible,
    .dmc-manage:focus-visible,
    .dmc-danger:focus-visible,
    .dmc-retry-action:focus-visible,
    .dmc-retry-input:focus-visible,
    .dmc-picker-item:focus-visible {
      outline: 2px solid var(--dsw-alias-state-business-primary);
      outline-offset: 2px;
    }
    
    /* NARROW CONTAINER, asked of the CONTAINER and not of the window (see .dmc-page).
    
       The scan line keeps all four tracks and tightens only the gaps; the well narrows
       its column gap. NOTHING TALLER HAPPENS HERE: the panel's real narrow desktop width
       (484px at a 768px viewport) is still a mouse surface, and making every control
       40px tall there turned each row from 48px into 60px for no readability gain. The
       thumb-sized branch below is the one that is actually phone-shaped. */
    @container (max-width: 520px) {
      .dmc-row {
        column-gap: 8px;
      }
    
      .dmc-well {
        grid-template-columns: 64px minmax(0, 1fr);
        column-gap: 8px;
      }
    
      /* The select keeps its CONTENT width rather than stretching: a form field that
         spans the whole well reads as the page's main control, and this one is a
         rarely-touched setting. It may still shrink to the container. */
      .dmc-protocol {
        width: auto;
        max-width: 100%;
      }
    
      .dmc-picker-item {
        min-height: 44px;
      }
    }
    
    /* The phone column the host actually hands this section (measured: 106px at a
       390px viewport). Everything stacks into the one surviving track, so nothing can
       be pushed out of the container, and the rail still spans the row.
    
       DEGRADING IN ORDER, not by accident. This width is an external constraint — an
       800px settings panel at a 390px viewport leaves the content column about 94px —
       so the goal here is not a pretty layout but an ORDERED one: nothing overflows, no
       line is left holding a single character, and every clickable target stays at
       least 40px. The four facts of the scan line become four lines in a deliberate
       order (identity, answer, model cell, door), and the well becomes one column with
       its labels above their values. */
    @container (max-width: 360px) {
      .dmc-row {
        grid-template-columns: 4px minmax(0, 1fr);
        grid-template-rows: auto auto auto auto auto auto;
        row-gap: 2px;
      }
    
      .dmc-name {
        grid-column: 2;
        grid-row: 1;
        text-wrap: pretty;
      }
    
      .dmc-verdict {
        grid-column: 2;
        grid-row: 2;
        justify-self: start;
      }
    
      .dmc-catalog {
        grid-column: 2;
        grid-row: 3;
        justify-self: start;
      }
    
      .dmc-manage {
        grid-column: 2;
        grid-row: 4;
        justify-self: start;
      }
    
      .dmc-pending {
        grid-column: 2;
        grid-row: 5;
      }
    
      .dmc-well {
        grid-column: 2;
        grid-row: 6;
        grid-template-columns: minmax(0, 1fr);
        row-gap: 2px;
      }
    
      .dmc-diagnostic,
      .dmc-retry {
        grid-column: 1;
      }
    
      .dmc-protocol {
        width: 100%;
        min-width: 0;
      }
    
      /* THE THUMB BRANCH. This is the phone column (the host hands the section about
         106px), where the scan line has already stacked, so every control may grow to
         40px without costing any density: the page is being read on a phone. */
      .dmc-key-action,
      .dmc-key-clear,
      .dmc-catalog,
      .dmc-manage,
      .dmc-danger,
      .dmc-retry-action,
      .dmc-notice-action {
        min-height: 40px;
      }
    
      .dmc-protocol,
      .dmc-retry-input {
        height: 40px;
      }
    
      .dmc-readout {
        text-wrap: pretty;
      }
    
      .dmc-add {
        /* The add entry keeps its own width and wraps on natural break points, so it
           can never be squeezed into a column narrow enough to strand one glyph. */
        flex: none;
        max-width: 100%;
        text-wrap: pretty;
      }
    }
    
    /* The page's motion is control feedback and the two landing voices above, all of
       it transform or colour. With motion reduced every transition and animation is
       simply off: the content stays, it just stops moving. */
    @media (prefers-reduced-motion: reduce) {
      .dmc-add,
      .dmc-key-action,
      .dmc-key-clear,
      .dmc-catalog,
      .dmc-manage,
      .dmc-danger,
      .dmc-picker-item,
      .dmc-verdict,
      .dmc-readout,
      .dmc-retry-action {
        transition: none;
        animation: none;
      }
    
      .dmc-add:active:not(:disabled),
      .dmc-key-action:active:not(:disabled),
      .dmc-key-clear:active:not(:disabled),
      .dmc-catalog:active:not(:disabled),
      .dmc-manage:active,
      .dmc-danger:active:not(:disabled),
      .dmc-retry-action:active {
        transform: none;
      }
    }
    `;
    function injectModelConfigStyles() {
      if (typeof document === "undefined") return () => {
      };
      document.getElementById(STYLE_ELEMENT_ID2)?.remove();
      const element = document.createElement("style");
      element.id = STYLE_ELEMENT_ID2;
      element.textContent = CSS2;
      document.head.append(element);
      return () => {
        if (element.isConnected) element.remove();
      };
    }
    
    // src/client/ModelConfigPage.tsx
    var import_jsx_runtime3 = require("react/jsx-runtime");
    var PROTOCOL_LABELS = {
      "anthropic-messages": KEYS["config.api.anthropicMessages"],
      "openai-completions": KEYS["config.api.openaiCompletions"],
      "openai-responses": KEYS["config.api.openaiResponses"]
    };
    function readingOf(row, failure) {
      const diagnostic = failure ?? row.entry.error;
      const session = isSessionRoute(row);
      const credential = !session && credentialRefFor(row) !== void 0;
      const answer = credential && !keyConfigured(row) ? "missing-key" : providerUsable(row) ? "ready" : "unreachable";
      const word = session && answer === "ready" ? KEYS["config.account.signedIn"] : answer === "missing-key" ? KEYS["config.verdict.missingKey"] : answer === "unreachable" ? KEYS["config.verdict.unavailable"] : KEYS["config.verdict.ready"];
      return { answer, word, diagnostic };
    }
    function isRecord4(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function recordOf(value) {
      return isRecord4(value) ? { ...value } : {};
    }
    function without(record, key) {
      const next = { ...record };
      delete next[key];
      return next;
    }
    function isSessionRoute(row) {
      if (row.accountAvailable !== void 0) return true;
      return row.entry.active && row.apiKeyEnv === void 0 && !providerUsable(row);
    }
    function protocolLabel(t2, protocol) {
      const key = PROTOCOL_LABELS[protocol];
      return key === void 0 ? protocol : t2(key);
    }
    function ProviderRow(props) {
      const { row, store, t: t2 } = props;
      const provider = row.entry.provider;
      const displayName = isSessionRoute(row) ? t2(KEYS["config.account.name"]) : row.entry.displayName;
      const reading = readingOf(row, props.failure);
      const session = isSessionRoute(row);
      const busy = props.pending !== void 0;
      const editable = props.writable && !busy;
      const namespace = row.entry.settingsNs === "" ? void 0 : store.namespace(row.entry.settingsNs);
      const choices = namespace === void 0 ? [] : protocolChoices(namespace);
      const profile = readPath(namespace?.user, row.entry.settingsPath);
      const storedApi = isRecord4(profile) && typeof profile.api === "string" ? profile.api : void 0;
      const protocols = storedApi !== void 0 && !choices.includes(storedApi) ? [storedApi, ...choices] : choices;
      const keyRef = credentialRefFor(row);
      const keyPresent = keyConfigured(row);
      const models = namespace === void 0 ? 0 : modelsOf(namespace.value, row.entry.settingsPath).length;
      const removable = row.entry.settingsPath.length > 0 && namespace !== void 0 && isRemovable(namespace, row.entry.settingsPath);
      const retryable = retryCapable(namespace, row.entry.settingsPath);
      const clearsKey = keyPresent && keyWritable(row) && keyRefOf(row) === deriveKeyRef(provider);
      const [editing, setEditing] = (0, import_react3.useState)(false);
      const [draft, setDraft] = (0, import_react3.useState)("");
      const [retryOpen, setRetryOpen] = (0, import_react3.useState)(false);
      const [wellOpen, setWellOpen] = (0, import_react3.useState)(false);
      const shown = reading.diagnostic;
      (0, import_react3.useEffect)(() => {
        if (!props.catalogOpen) return;
        setEditing(false);
        setDraft("");
        setRetryOpen(false);
        setWellOpen(false);
      }, [props.catalogOpen]);
      const commit = (0, import_react3.useCallback)((explicit) => {
        const value = draft;
        setEditing(false);
        setDraft("");
        if (!explicit && value.length === 0) return;
        props.onSaveKey(value);
      }, [draft, props]);
      const lifecycleHint = row.configured ? t2(
        clearsKey ? KEYS["config.delete.descriptionWithCredential"] : KEYS["config.delete.description"],
        { provider: displayName }
      ) : t2(KEYS["config.add.catalogHint"]);
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "li",
        {
          className: "dmc-row",
          "data-state": reading.answer,
          "data-error": reading.diagnostic === void 0 ? void 0 : "true",
          "data-usable": reading.answer === "unreachable" ? "false" : "true",
          "data-catalog": props.catalogOpen ? "true" : void 0,
          "data-well": wellOpen ? "true" : void 0,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "span",
              {
                className: "dmc-rail",
                "data-state": reading.answer,
                "data-usable": reading.answer === "unreachable" ? "false" : "true",
                "aria-hidden": "true"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dmc-name", children: [
              displayName,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-route", children: provider })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "dmc-catalog",
                id: `dmc-catalog-btn-${provider}`,
                "aria-expanded": props.catalogOpen,
                "aria-controls": `dmc-catalog-${provider}`,
                title: models === 0 ? t2(KEYS["config.models.inherited"]) : void 0,
                onClick: props.onOpenCatalog,
                children: models > 0 ? t2(KEYS["config.models.count"], { count: String(models) }) : t2(KEYS["config.models.default"])
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-verdict", "data-state": reading.answer, children: t2(reading.word) }, reading.answer),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "dmc-manage",
                "aria-expanded": wellOpen,
                "aria-controls": `dmc-well-${provider}`,
                onClick: () => {
                  if (wellOpen) {
                    setEditing(false);
                    setDraft("");
                  }
                  setWellOpen(!wellOpen);
                },
                children: t2(KEYS["config.manage"])
              }
            ),
            busy ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-pending", children: props.pending }) : null,
            wellOpen ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-well", id: `dmc-well-${provider}`, children: [
              shown === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-diagnostic", children: shown }),
              session ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-label", children: t2(KEYS["config.credential.label"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-quiet", children: t2(KEYS["config.credential.session"]) }) })
              ] }) : keyRef === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-label", children: t2(KEYS["config.credential.label"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-value", children: editing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "input",
                  {
                    className: "dmc-key-action",
                    type: "password",
                    autoComplete: "off",
                    spellCheck: false,
                    autoFocus: true,
                    value: draft,
                    disabled: !editable,
                    "aria-label": t2(KEYS["config.key.input"]),
                    placeholder: keyPresent ? t2(KEYS["config.key.placeholderSaved"]) : t2(KEYS["config.key.placeholderFallback"], { hint: keyRef }),
                    onChange: (event) => {
                      setDraft(event.target.value);
                    },
                    onBlur: () => {
                      commit(false);
                    },
                    onKeyDown: (event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commit(true);
                      }
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setEditing(false);
                        setDraft("");
                      }
                    }
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-quiet", children: t2(keyPresent ? KEYS["config.credential.configuredShort"] : KEYS["config.credential.missingShort"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dmc-key-action",
                      disabled: !editable,
                      onClick: () => {
                        setEditing(true);
                        setDraft("");
                      },
                      children: t2(keyPresent ? KEYS["config.key.replaceShort"] : KEYS["config.key.add"])
                    }
                  ),
                  keyPresent ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dmc-key-clear",
                      disabled: !editable || !keyWritable(row),
                      "aria-label": t2(KEYS["config.removeProvider"], { provider: t2(KEYS["config.key.input"]) }),
                      onClick: props.onClearKey,
                      children: t2(KEYS["config.key.clearShort"])
                    }
                  ) : null
                ] }) })
              ] }),
              protocols.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-label", children: t2(KEYS["config.api.label"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                  "select",
                  {
                    className: "dmc-protocol",
                    value: storedApi ?? "",
                    disabled: !editable,
                    "aria-label": t2(KEYS["config.api.label"]),
                    onChange: (event) => {
                      props.onProtocol(event.target.value);
                    },
                    children: [
                      storedApi === void 0 || protocols.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: "", children: t2(KEYS["config.api.unset"]) }) : null,
                      protocols.map((protocol) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: protocol, children: protocolLabel(t2, protocol) }, protocol))
                    ]
                  }
                ) })
              ] }),
              retryable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-label", children: t2(KEYS["config.retryPolicy.trigger"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-retry-action",
                    "aria-expanded": retryOpen,
                    "aria-controls": `dmc-retry-${provider}`,
                    onClick: () => {
                      setRetryOpen((current) => !current);
                    },
                    children: t2(KEYS["config.retryPolicy.edit"])
                  }
                ) })
              ] }) : null,
              retryable && retryOpen && namespace !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                RetryEditor,
                {
                  row,
                  namespace,
                  store,
                  t: t2,
                  writable: props.writable
                }
              ) : null,
              row.entry.settingsPath.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-label", "aria-hidden": "true" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-danger",
                    disabled: !editable || row.configured && !removable,
                    "aria-label": row.configured ? t2(KEYS["config.removeProvider"], { provider: displayName }) : t2(KEYS["config.add"]),
                    title: lifecycleHint,
                    onClick: props.onLifecycle,
                    children: t2(row.configured ? KEYS["config.removeProvider"] : KEYS["config.add"])
                  }
                ) })
              ] })
            ] }) : null,
            props.catalogOpen ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ModelCatalog,
              {
                row,
                store,
                t: t2,
                onDirtyChange: props.onCatalogDirty,
                onRequestClose: props.onRequestCloseCatalog,
                confirming: props.catalogConfirming,
                onKeepEditing: props.onKeepEditingCatalog,
                onDiscard: props.onDiscardCatalog
              }
            ) : null
          ]
        }
      );
    }
    function ModelConfigPage(props) {
      const { close, store, t: t2 } = props;
      const snapshot = (0, import_react3.useSyncExternalStore)(store.subscribe, store.getSnapshot);
      const mounted = (0, import_react3.useRef)(true);
      const [pending, setPending] = (0, import_react3.useState)({});
      const [failures, setFailures] = (0, import_react3.useState)({});
      const [catalog, setCatalog] = (0, import_react3.useState)(null);
      const [catalogDirty, setCatalogDirty] = (0, import_react3.useState)(false);
      const [catalogGuard, setCatalogGuard] = (0, import_react3.useState)(null);
      const [picker, setPicker] = (0, import_react3.useState)(false);
      (0, import_react3.useEffect)(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);
      (0, import_react3.useEffect)(() => injectModelConfigStyles(), []);
      (0, import_react3.useEffect)(() => {
        void store.load();
      }, [store]);
      const focusCatalogTrigger = (0, import_react3.useCallback)((provider) => {
        if (typeof document === "undefined") return;
        document.getElementById(`dmc-catalog-btn-${provider}`)?.focus();
      }, []);
      const collapseCatalog = (0, import_react3.useCallback)(() => {
        const provider = catalog;
        setCatalog(null);
        setCatalogDirty(false);
        setCatalogGuard(null);
        if (provider !== null) focusCatalogTrigger(provider);
      }, [catalog, focusCatalogTrigger]);
      const requestCloseCatalog = (0, import_react3.useCallback)(() => {
        if (catalog === null) return;
        if (catalogDirty) {
          setCatalogGuard({ kind: "close" });
          return;
        }
        collapseCatalog();
      }, [catalog, catalogDirty, collapseCatalog]);
      const openCatalog = (0, import_react3.useCallback)((provider) => {
        if (catalog === provider) {
          requestCloseCatalog();
          return;
        }
        if (catalog !== null && catalogDirty) {
          setCatalogGuard({ kind: "switch", provider });
          return;
        }
        setCatalog(provider);
        setCatalogDirty(false);
        setCatalogGuard(null);
      }, [catalog, catalogDirty, requestCloseCatalog]);
      const discardCatalogDraft = (0, import_react3.useCallback)(() => {
        const pendingAction = catalogGuard;
        setCatalogDirty(false);
        setCatalogGuard(null);
        if (pendingAction === null) return;
        if (pendingAction.kind === "switch") {
          focusCatalogTrigger(pendingAction.provider);
          setCatalog(pendingAction.provider);
          return;
        }
        collapseCatalog();
      }, [catalogGuard, collapseCatalog, focusCatalogTrigger]);
      const keepEditingCatalog = (0, import_react3.useCallback)(() => {
        setCatalogGuard(null);
      }, []);
      (0, import_react3.useEffect)(() => {
        if (catalog === null) return;
        if (snapshot.rows.some((row) => row.added && row.entry.provider === catalog)) return;
        setCatalog(null);
        setCatalogDirty(false);
        setCatalogGuard(null);
      }, [catalog, snapshot.rows]);
      const run = (0, import_react3.useCallback)(async (provider, word, action) => {
        setPending((current) => ({ ...current, [provider]: word }));
        setFailures((current) => without(current, provider));
        const failure = await action();
        if (!mounted.current) return;
        setPending((current) => without(current, provider));
        if (failure !== void 0) setFailures((current) => ({ ...current, [provider]: failure }));
      }, []);
      const saveKey = (0, import_react3.useCallback)((row, value) => {
        const ref = credentialRefFor(row);
        if (ref === void 0) return;
        if (value.length === 0) {
          const provider = row.entry.provider;
          const blank = t2(keyConfigured(row) ? KEYS["config.key.blank"] : KEYS["config.key.blankNew"]);
          setFailures((current) => ({ ...current, [provider]: blank }));
          return;
        }
        void run(row.entry.provider, t2(KEYS["config.applying"]), () => store.storeCredential(ref, value));
      }, [run, store, t2]);
      const clearKey = (0, import_react3.useCallback)((row) => {
        const ref = credentialRefFor(row);
        if (ref === void 0) return;
        void run(row.entry.provider, t2(KEYS["config.applying"]), () => store.removeCredential(ref));
      }, [run, store, t2]);
      const setProtocol = (0, import_react3.useCallback)((row, protocol) => {
        const ns = row.entry.settingsNs;
        const view = store.namespace(ns);
        if (view === void 0) {
          setFailures((current) => ({ ...current, [row.entry.provider]: t2(KEYS["config.loadFailed"]) }));
          return;
        }
        const before = readPath(view.user, row.entry.settingsPath);
        const ops = pathOps(row.entry.settingsPath, before, { ...recordOf(before), api: protocol });
        void run(row.entry.provider, t2(KEYS["config.applying"]), async () => {
          const outcome = await store.write(ns, ops, view.revision);
          return outcome.ok ? void 0 : outcome.message;
        });
      }, [run, store, t2]);
      const lifecycle = (0, import_react3.useCallback)((row) => {
        const ns = row.entry.settingsNs;
        const provider = row.entry.provider;
        const view = store.namespace(ns);
        if (view === void 0) {
          setFailures((current) => ({ ...current, [provider]: t2(KEYS["config.loadFailed"]) }));
          return;
        }
        if (!row.configured) {
          const first = protocolsOf(store, ns)[0];
          const next = { apiKeyEnv: keyRefOf(row) };
          if (first !== void 0) next.api = first;
          const ops = pathOps(row.entry.settingsPath, readPath(view.user, row.entry.settingsPath), next);
          void run(provider, t2(KEYS["config.applying"]), async () => {
            const outcome = await store.write(ns, ops, view.revision);
            return outcome.ok ? void 0 : outcome.message;
          });
          return;
        }
        const ref = keyRefOf(row);
        const clearsKey = keyConfigured(row) && keyWritable(row) && ref === deriveKeyRef(provider);
        void run(provider, t2(KEYS["config.deleting"], { provider: row.entry.displayName }), async () => {
          if (clearsKey) {
            const failure = await store.removeCredential(ref);
            if (failure !== void 0) return failure;
          }
          const outcome = await store.write(
            ns,
            [{ op: "unset", path: [...row.entry.settingsPath] }],
            void 0
          );
          return outcome.ok ? void 0 : outcome.message;
        });
      }, [run, store, t2]);
      const listed = snapshot.rows.filter((row) => row.added);
      const candidates = snapshot.rows.filter((row) => !row.added);
      const pickerFailures = candidates.flatMap((row) => {
        const message = failures[row.entry.provider];
        return message === void 0 ? [] : [{ row, message }];
      });
      const readOnly = !snapshot.writable;
      const readings = listed.map((row) => readingOf(row, failures[row.entry.provider]));
      const readyCount = readings.filter((reading) => reading.answer === "ready").length;
      const issues = listed.length - readyCount;
      const readout = listed.length === 0 ? t2(KEYS["config.summary.none"]) : issues === 0 ? t2(KEYS["config.summary.ready"], { count: String(readyCount) }) : t2(KEYS["config.summary.attention"], { count: String(readyCount), issues: String(issues) });
      const empty = snapshot.status === "ready" && (listed.length === 0 || listed.every((row) => !providerUsable(row)));
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "section",
        {
          className: "dmc-page",
          "aria-label": t2(KEYS["config.title"]),
          onKeyDown: (event) => {
            if (event.key !== "Escape") return;
            if (catalogGuard !== null) {
              setCatalogGuard(null);
              return;
            }
            if (catalog !== null) {
              requestCloseCatalog();
              return;
            }
            if (picker) {
              setPicker(false);
              return;
            }
            close();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmc-head", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-readout", children: readout }, readout) }),
            snapshot.error === null ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dmc-notice", children: [
              t2(KEYS["config.loadFailed"]),
              "：",
              snapshot.error,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-notice-action",
                  onClick: () => {
                    void store.load();
                  },
                  children: t2(KEYS["config.retry"])
                }
              )
            ] }),
            snapshot.credentialError === null ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-notice", children: snapshot.credentialError }),
            readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-alert", children: t2(KEYS["config.readOnly"]) }) : null,
            empty ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dmc-empty", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: t2(KEYS["config.empty.title"]) }),
              " ",
              t2(KEYS["config.empty.description"])
            ] }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dmc-list", children: listed.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ProviderRow,
              {
                row,
                store,
                t: t2,
                writable: snapshot.writable,
                pending: pending[row.entry.provider],
                failure: failures[row.entry.provider],
                catalogOpen: catalog === row.entry.provider,
                catalogConfirming: catalogGuard !== null && catalog === row.entry.provider,
                onOpenCatalog: () => {
                  openCatalog(row.entry.provider);
                },
                onRequestCloseCatalog: requestCloseCatalog,
                onKeepEditingCatalog: keepEditingCatalog,
                onDiscardCatalog: discardCatalogDraft,
                onCatalogDirty: setCatalogDirty,
                onSaveKey: (value) => {
                  saveKey(row, value);
                },
                onClearKey: () => {
                  clearKey(row);
                },
                onProtocol: (protocol) => {
                  setProtocol(row, protocol);
                },
                onLifecycle: () => {
                  lifecycle(row);
                }
              },
              row.entry.provider
            )) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-add",
                  "aria-expanded": picker && candidates.length > 0,
                  disabled: readOnly || candidates.length === 0,
                  onClick: () => {
                    setPicker((current) => !current);
                  },
                  children: t2(KEYS["config.add"])
                }
              ),
              candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-notice", children: t2(KEYS["config.add.catalogExhausted"]) }) : null
            ] }),
            picker && candidates.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-picker", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.add.catalogHint"]) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dmc-picker-list", children: candidates.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dmc-picker-item",
                  "data-state": "dormant",
                  disabled: readOnly || pending[row.entry.provider] !== void 0,
                  onClick: () => {
                    lifecycle(row);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dmc-name", children: [
                      row.entry.displayName,
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-route", children: row.entry.provider })
                    ] }),
                    pending[row.entry.provider] === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-pending", children: pending[row.entry.provider] })
                  ]
                }
              ) }, row.entry.provider)) }),
              pickerFailures.map(({ row, message }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dmc-notice", children: [
                row.entry.displayName,
                "：",
                message
              ] }, row.entry.provider))
            ] }) : null
          ]
        }
      );
    }
    function protocolsOf(store, ns) {
      const view = store.namespace(ns);
      if (view === void 0) return [];
      return protocolChoices(view);
    }
    
    // src/client/modelConfigStore.ts
    var INVALIDATING_EVENTS = [
      "settings/document-updated",
      "credentials/record-updated",
      "credentials/reference-updated",
      "llm/adapters-updated",
      "connection/reset"
    ];
    var EMPTY = {
      status: "idle",
      error: null,
      credentialError: null,
      writable: false,
      rows: [],
      namespaces: /* @__PURE__ */ new Map()
    };
    var CREDENTIAL_BATCH = 64;
    var ModelConfigStore = class {
      /**
       * @param faces - the Host faces, resolved per call: the Remote namespaces mount
       * asynchronously, so a capture at construction can legitimately be "not yet".
       */
      constructor(faces) {
        this.faces = faces;
      }
      snapshot = EMPTY;
      listeners = /* @__PURE__ */ new Set();
      /**
       * Latest read wins. A superseded read publishes nothing, which is what keeps a
       * slow first load from overwriting a fast second one — without this, opening
       * settings twice in quick succession can leave the page showing the older
       * directory.
       */
      generation = 0;
      pending = Promise.resolve();
      /** Subscribe to snapshot changes; the return value unsubscribes. */
      subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      };
      /**
       * Subscribe to the Host events that invalidate this page's facts.
       *
       * THE SUBSCRIPTION *IS* THE "未打开的页面不后台拉取" RULE. It exists only while
       * the page is mounted, so a closed settings panel holds no listener and cannot
       * be woken into a fetch — the property the official page has to get from an
       * explicit `refreshIfLoaded` flag, because its store outlives its component
       * while this one does not.
       *
       * A burst of events issues one read each; that is intentional and cheap, since
       * the generation counter means only the newest read publishes. Coalescing them
       * would delay the page's response to the user's own write, which is the case
       * that has to feel immediate.
       * @returns the disposer that unsubscribes every event.
       */
      start() {
        const on = this.faces()?.on;
        if (on === void 0) return () => {
        };
        const disposers = INVALIDATING_EVENTS.map((event) => on(event, () => {
          void this.load();
        }));
        return () => {
          for (const dispose of disposers) dispose();
        };
      }
      /** The current snapshot. Stable between publishes, so it is safe for `useSyncExternalStore`. */
      getSnapshot = () => this.snapshot;
      /** Publish one snapshot to every listener. */
      publish(next) {
        this.snapshot = next;
        for (const listener of this.listeners) listener();
      }
      /**
       * Read the whole page: directory and settings in parallel, then one batched
       * credential describe over every reference the rows actually use.
       *
       * The credential read is batched because the alternative — one call per row —
       * makes a deployment with a dozen providers issue a dozen round trips on every
       * refresh, including each one triggered by a push event.
       * @returns resolution after this read's snapshot is published.
       */
      async load() {
        const generation = ++this.generation;
        const faces = this.faces();
        if (faces === null) {
          this.publish({ ...EMPTY, status: "ready" });
          return;
        }
        this.publish({ ...this.snapshot, status: this.snapshot.status === "idle" ? "loading" : this.snapshot.status });
        this.pending = this.read(faces, generation);
        await this.pending;
      }
      /**
       * One read, publishing only while it still owns the newest generation.
       * @param faces - the resolved Host faces.
       * @param generation - the generation this read was issued under.
       */
      async read(faces, generation) {
        let described;
        let registered;
        let directory;
        try {
          const [settingsAnswer, registeredAnswer, directoryAnswer] = await Promise.all([
            faces.settings.describe(),
            faces.llm.listProviders?.() ?? Promise.resolve({ ok: true, value: [] }),
            faces.llm.listConfigurableProviders()
          ]);
          if (generation !== this.generation) return;
          if (!settingsAnswer.ok) {
            this.publish({ ...this.snapshot, status: "error", error: settingsAnswer.error.message });
            return;
          }
          described = settingsAnswer.value;
          registered = registeredAnswer.ok ? registeredAnswer.value : [];
          directory = directoryAnswer.ok ? directoryAnswer.value : [];
        } catch (error) {
          if (generation !== this.generation) return;
          this.publish({
            ...this.snapshot,
            status: "error",
            error: error instanceof Error ? error.message : String(error)
          });
          return;
        }
        const namespaces = /* @__PURE__ */ new Map();
        for (const view of described.namespaces) namespaces.set(view.ns, view);
        const entries = joinProviderDirectory(registered, directory);
        let accountAvailable;
        if (entries.some((entry) => entry.provider === ACCOUNT_ROUTE) && faces.session !== void 0) {
          try {
            const catalog = await faces.session.modelCatalog();
            if (generation !== this.generation) return;
            if (catalog.ok) {
              accountAvailable = catalog.value.groups.some(
                (group) => group.id === ACCOUNT_ROUTE && group.models.length > 0
              );
            }
          } catch {
          }
        }
        const draft = entries.map((entry) => this.rowFor(entry, namespaces.get(entry.settingsNs), accountAvailable));
        const refs = [...new Set(draft.map(credentialRefFor).filter((ref) => ref !== void 0))];
        let credentials = {};
        let credentialError = null;
        if (faces.credentials !== void 0 && refs.length > 0) {
          try {
            for (let index = 0; index < refs.length; index += CREDENTIAL_BATCH) {
              const answer = await faces.credentials.describe(refs.slice(index, index + CREDENTIAL_BATCH));
              if (generation !== this.generation) return;
              if (answer.ok) credentials = { ...credentials, ...answer.value };
              else credentialError = answer.error.message;
            }
          } catch (error) {
            if (generation !== this.generation) return;
            credentialError = error instanceof Error ? error.message : String(error);
          }
        }
        if (generation !== this.generation) return;
        const rows = entries.map((entry) => this.withCredential(entry, namespaces.get(entry.settingsNs), credentials, accountAvailable)).filter((row) => row.entry.provider !== ACCOUNT_ROUTE || row.accountAvailable === true);
        this.publish({
          status: "ready",
          error: null,
          credentialError,
          writable: described.writable,
          rows,
          namespaces
        });
      }
      /**
       * One row before its credential state is known.
       * @param entry - the joined directory entry.
       * @param namespace - its settings namespace view, when one exists.
       * @param accountAvailable - the account route's session-derived usability, when it could be read.
       * @returns the row.
       */
      rowFor(entry, namespace, accountAvailable) {
        const value = namespace?.value;
        const configured = namespace !== void 0 && hasProfile(namespace, entry.settingsPath);
        return {
          entry,
          configured,
          // "Added" is the page's LISTING question, and it is not the same as
          // `configured`. A route the adapter registers with no settings address owes
          // no profile and is already the user's (the account route, and any live
          // route the configurable directory does not declare); a catalog entry that
          // HAS an address and no profile is one the user has not added yet, and the
          // page hides those behind a single add entry rather than listing dozens of
          // things that are not configured. The rule itself lives in the pure module
          // so the unit gate can pin it.
          added: isAdded(configured, entry.settingsPath),
          removable: isRemovable(namespace, entry.settingsPath),
          // The account route NEVER reads a credential: it has no `apiKeyEnv` to name,
          // so deriving one would describe `<ROUTE>_API_KEY` — a reference no adapter
          // consults — and report a key state that cannot affect anything.
          apiKeyEnv: entry.provider === ACCOUNT_ROUTE ? void 0 : apiKeyEnvOf(value, entry.settingsPath),
          credential: void 0,
          // ONLY the account route carries this fact. `accountAvailable` answers
          // "can the SESSION serve that one route", so writing it onto every row
          // tells the page that every provider IS the account route — which is
          // precisely what it did: all 48 rows rendered as 「DeepSeek 账号」, the
          // replace-key entry vanished from every one of them, and 43 protocol
          // selects came up disabled. The contract says this field is undefined for
          // every other route, and this is the line that enforces it.
          ...entry.provider === ACCOUNT_ROUTE && accountAvailable !== void 0 ? { accountAvailable } : {}
        };
      }
      /**
       * Attach the described credential to one row.
       *
       * A row whose profile names a reference stores it under `credential`; a row
       * that names none stores it under `derivedCredential`, because the two are read
       * by different questions ("is the key the profile reads present?" versus
       * "would the key the user is about to type be found?") and collapsing them
       * would let a row report a key its provider never looks at.
       * @param entry - the joined directory entry.
       * @param namespace - its settings namespace view, when one exists.
       * @param credentials - the described credential states, by reference.
       * @param accountAvailable - the account route's session-derived usability, when it could be read.
       * @returns the row.
       */
      withCredential(entry, namespace, credentials, accountAvailable) {
        const base = this.rowFor(entry, namespace, accountAvailable);
        const ref = credentialRefFor(base);
        const info = ref === void 0 ? void 0 : credentials[ref];
        return base.apiKeyEnv !== void 0 ? { ...base, credential: info } : {
          ...base,
          credential: void 0,
          ...info === void 0 ? {} : { derivedCredential: info }
        };
      }
      /**
       * Write path operations to one namespace, retrying once against a fresh
       * revision when the fence rejects them.
       *
       * The retry is not optimism: this page writes at most a handful of fields, so
       * re-applying them over a document that moved underneath is what the user
       * asked for, and reporting a conflict instead would make the page unusable
       * whenever the official Models tab happens to be open. A SECOND conflict is
       * reported as-is, because by then the other writer is actively racing and the
       * user should decide.
       * @param ns - the settings namespace.
       * @param ops - the path operations.
       * @param expectedRevision - the revision the draft was read at.
       * @returns whether the write landed, and its failure text when it did not.
       */
      async write(ns, ops, expectedRevision) {
        const faces = this.faces();
        if (faces === null) return { ok: false, conflict: false, message: "设置服务不可用。" };
        if (ops.length === 0) return { ok: true };
        try {
          let answer = await faces.settings.mutate(ns, ops, expectedRevision);
          if (!answer.ok && answer.error.code === "settings/conflict") {
            const described = await faces.settings.describe();
            const fresh = described.ok ? described.value.namespaces.find((candidate) => candidate.ns === ns) : void 0;
            if (fresh !== void 0) answer = await faces.settings.mutate(ns, ops, fresh.revision);
          }
          if (!answer.ok) {
            return {
              ok: false,
              conflict: answer.error.code === "settings/conflict",
              message: answer.error.message
            };
          }
          await this.load();
          return { ok: true };
        } catch (error) {
          return { ok: false, conflict: false, message: error instanceof Error ? error.message : String(error) };
        }
      }
      /**
       * Store one credential literal.
       * @param ref - the reference to write.
       * @param value - the literal.
       * @returns the failure text, or undefined once stored.
       */
      async storeCredential(ref, value) {
        const faces = this.faces();
        if (faces?.credentials === void 0) return "此部署未挂载凭据服务。";
        try {
          const answer = await faces.credentials.set(ref, value);
          if (!answer.ok) return answer.error.message;
          await this.load();
          return void 0;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
      /**
       * Remove one credential reference (idempotent).
       * @param ref - the reference to clear.
       * @returns the failure text, or undefined once removed.
       */
      async removeCredential(ref) {
        const faces = this.faces();
        if (faces?.credentials === void 0) return "此部署未挂载凭据服务。";
        try {
          const answer = await faces.credentials.unset(ref);
          if (!answer.ok) return answer.error.message;
          await this.load();
          return void 0;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
      /**
       * Ask a provider endpoint what models it serves.
       *
       * A PURE READ, and that is the load-bearing fact for the catalog's three-step
       * flow: the Host's own contract says discovery "reads or writes nothing" — it
       * describes a DRAFT, not a stored route — so the candidates this returns are
       * metadata the user may adopt, never a write. Merging them into the profile is
       * a separate `write` the user has to confirm, which is why nothing here touches
       * the store's snapshot.
       * @param settingsNs - the namespace whose adapter family answers.
       * @param request - the endpoint facts the form currently shows.
       * @returns the candidates, or the Host's own refusal diagnostic.
       */
      async discover(settingsNs, request) {
        const faces = this.faces();
        if (faces === null) return { ok: false, message: "设置服务不可用。" };
        if (typeof faces.llm.discoverModels !== "function") {
          return { ok: false, message: "此部署未挂载模型发现。" };
        }
        try {
          const answer = await faces.llm.discoverModels(settingsNs, request);
          if (!answer.ok) return { ok: false, message: answer.error.message };
          return { ok: true, models: answer.value };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      }
      /**
       * Read this namespace's view as the page currently holds it.
       * @param ns - the namespace id.
       * @returns the view, or undefined.
       */
      namespace(ns) {
        return this.snapshot.namespaces.get(ns);
      }
    };
    function hasProfile(namespace, settingsPath) {
      if (settingsPath.length === 0) {
        return namespace.value !== void 0 && namespace.value !== null;
      }
      let current = namespace.value;
      for (const step of settingsPath) {
        if (typeof current !== "object" || current === null || Array.isArray(current)) return false;
        if (!(step in current)) return false;
        current = current[step];
      }
      return current !== void 0;
    }
    
    // src/client/Picker.tsx
    var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react5 = require("react");
    var import_react_dom2 = require("react-dom");
    
    // src/client/BadgeIcons.tsx
    var import_jsx_runtime4 = require("react/jsx-runtime");
    var BADGE_STROKE = 1.6;
    var BRAIN_STROKE = 2.4;
    var BRAIN = [
      "M3.87326 10.9728C3.65146 10.5059 3.52734 9.98359 3.52734 9.43228C3.52734 7.71144 4.73657 6.27302 6.35167 5.92041",
      "M20.1268 10.9728C20.3487 10.5059 20.4728 9.98359 20.4728 9.43228C20.4728 7.71144 19.2635 6.27302 17.6484 5.92041",
      "M5.58108 10.9731C3.87945 10.9731 2.5 12.3526 2.5 14.0542C2.5 15.7559 3.87945 17.1353 5.58108 17.1353C6.03924 17.1353 6.47405 17.0353 6.86486 16.8559L7.37838 16.6218",
      "M18.4184 10.9731C20.12 10.9731 21.4995 12.3526 21.4995 14.0542C21.4995 15.7559 20.12 17.1353 18.4184 17.1353C17.9602 17.1353 17.5254 17.0353 17.1346 16.8559L16.6211 16.6218",
      "M12.0013 5.22866C12.0013 3.73973 10.7943 2.53271 9.30532 2.53271C7.81639 2.53271 6.60938 3.73973 6.60938 5.22866C6.60938 6.11056 7.03282 6.89355 7.68749 7.38542",
      "M12 5.19595C12 3.70702 13.207 2.5 14.6959 2.5C16.1849 2.5 17.3919 3.70702 17.3919 5.19595C17.3919 6.07784 16.9684 6.86084 16.3138 7.3527",
      "M12 5.06738V17.6485",
      "M11.9996 17.6488C11.9996 19.7758 10.2753 21.5001 8.14823 21.5001C6.02118 21.5001 4.29688 19.7758 4.29688 17.6488V17.1353",
      "M12 17.6488C12 19.7758 13.7243 21.5001 15.8514 21.5001C17.9784 21.5001 19.7027 19.7758 19.7027 17.6488V17.1353"
    ];
    function artworkOf(fact) {
      switch (fact) {
        case "text":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.4 2.5 H8.5 L12 6 V12.1 A1.4 1.4 0 0 1 10.6 13.5 H5.4 A1.4 1.4 0 0 1 4 12.1 V3.9 A1.4 1.4 0 0 1 5.4 2.5 Z" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8.5 2.5 V6 H12" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M6.5 9 H9.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M6.5 11 H9.5" })
          ] });
        case "image":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M2.75 8 C4.6 4.8 6.5 3.5 8 3.5 C9.5 3.5 11.4 4.8 13.25 8 C11.4 11.2 9.5 12.5 8 12.5 C6.5 12.5 4.6 11.2 2.75 8 Z" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "8", cy: "8", r: "1.6" })
          ] });
        case "effort":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: BRAIN.map((path) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: path }, path)) });
        case "context":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "2.75", y: "3.75", width: "10.5", height: "8.5", rx: "1.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M2.75 6.5 H13.25" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.1 8.9 H10.9" })
          ] });
      }
    }
    function BadgeIcon({ fact, size = 14, className }) {
      const brain = fact === "effort";
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "svg",
        {
          className,
          width: size,
          height: size,
          viewBox: brain ? "0 0 24 24" : "0 0 16 16",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: brain ? BRAIN_STROKE : BADGE_STROKE,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
          xmlns: "http://www.w3.org/2000/svg",
          children: artworkOf(fact)
        }
      );
    }
    
    // src/client/anchorLoss.ts
    var CONFIRM_LOOKS = 2;
    var CONFIRM_DELAY_MS = 16;
    function occupiesPage(element) {
      return element.isConnected && element.getClientRects().length > 0;
    }
    function seatLeftThePage(element) {
      return element === null || occupiesPage(element) === false;
    }
    function observeSeatLoss(root, onLost) {
      let frames = 0;
      let reported = false;
      let stopped = false;
      let timer = null;
      const confirm = () => {
        if (stopped || reported) return;
        if (seatLeftThePage(root()) === false) {
          frames = 0;
          return;
        }
        frames += 1;
        if (frames < CONFIRM_LOOKS) {
          timer = window.setTimeout(confirm, CONFIRM_DELAY_MS);
          return;
        }
        reported = true;
        onLost();
      };
      const observer = new ResizeObserver(confirm);
      const element = root();
      if (element !== null) observer.observe(element);
      return () => {
        stopped = true;
        observer.disconnect();
        if (timer !== null) window.clearTimeout(timer);
      };
    }
    
    // src/client/format.ts
    function formatWindow(tokens) {
      if (!Number.isFinite(tokens) || tokens <= 0) return "";
      if (tokens < 1e3) return String(Math.round(tokens));
      if (tokens < 1e6) {
        const thousands = Math.round(tokens / 1e3);
        return thousands >= 1e3 ? "1M" : `${thousands}K`;
      }
      return `${Math.round(tokens / 1e6)}M`;
    }
    
    // src/client/badges.ts
    var BADGE_FACTS = ["text", "image", "effort", "context"];
    function modalitiesOf(address, capability) {
      if (address !== null && address.input.length > 0) return address.input;
      if (capability?.inputModalities !== void 0 && capability.inputModalities.length > 0) {
        return capability.inputModalities;
      }
      if (address !== null && address.defaultInput.length > 0) return address.defaultInput;
      return void 0;
    }
    function capacityOf2(address, capability) {
      return address?.contextWindow ?? capability?.contextWindow ?? address?.defaultContextWindow;
    }
    function badgeSpecsOf({ address, capability, reasoning, t: t2 }) {
      const specs = [];
      const modalities = modalitiesOf(address, capability);
      const text = modalities === void 0 || modalities.includes("text");
      specs.push({
        fact: "text",
        off: !text,
        value: "",
        sentence: t2(text ? "badge.text.on" : "badge.text.off")
      });
      const image = modalities !== void 0 && modalities.includes("image");
      specs.push({
        fact: "image",
        off: !image,
        value: "",
        sentence: t2(image ? "badge.image.on" : "badge.image.off")
      });
      if (reasoning === void 0) {
        specs.push({ fact: "effort", off: true, value: "", sentence: t2("badge.effort.off") });
      } else {
        specs.push({ fact: "effort", off: false, value: "", sentence: t2("badge.effort.on") });
      }
      const capacity = capacityOf2(address, capability);
      if (capacity !== void 0) {
        const value = formatWindow(capacity);
        if (value !== "") {
          specs.push({ fact: "context", off: false, value, sentence: t2("badge.context", { value }) });
        }
      }
      return specs;
    }
    
    // src/client/effort.ts
    function effortLabelOf(reasoning, effort, t2) {
      if (effort === void 0) return t2("effort.providerDefault");
      return reasoning.efforts.find((level) => level.id === effort)?.name ?? effort;
    }
    function effortChoicesOf(reasoning, t2) {
      return [
        ...reasoning.defaultEffort === void 0 ? [{ key: "provider-default", effort: void 0, label: t2("effort.providerDefault") }] : [],
        ...reasoning.efforts.map((level) => ({ key: `effort:${level.id}`, effort: level.id, label: level.name }))
      ];
    }
    
    // src/client/focusChain.ts
    var CHAIN_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";
    function isDisabled(element) {
      return element.disabled === true;
    }
    function isChainMember(element) {
      if (isDisabled(element)) return false;
      if (element.getAttribute("role") === "option") return element.tabIndex === 0;
      return true;
    }
    function cardChainOf(root) {
      return Array.from(root.querySelectorAll(CHAIN_SELECTOR)).filter(isChainMember);
    }
    function stepChain(chain, active, delta) {
      if (chain.length === 0) return { kind: "none" };
      const index = active === null ? -1 : chain.indexOf(active);
      const next = index === -1 ? delta > 0 ? 0 : chain.length - 1 : index + delta;
      if (next < 0) return { kind: "close" };
      const element = chain[next % chain.length];
      return element === void 0 ? { kind: "none" } : { kind: "focus", element };
    }
    
    // src/client/ProviderRail.tsx
    var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_jsx_runtime5 = require("react/jsx-runtime");
    function ProviderRail({
      options,
      current,
      stopIndex,
      busy,
      t: t2,
      refs,
      onPick,
      onEnterList
    }) {
      const usableOf = () => options.map((option, index) => ({ option, index })).filter(({ option }) => !option.failed);
      const move = (delta) => {
        if (busy) return;
        const usable = usableOf();
        if (usable.length === 0) return;
        const active = usable.findIndex(({ index }) => refs.current[index] === document.activeElement);
        const next = active === -1 ? delta > 0 ? 0 : usable.length - 1 : (active + delta + usable.length) % usable.length;
        const target = usable[next];
        if (target !== void 0) refs.current[target.index]?.focus();
      };
      const jump = (first) => {
        if (busy) return;
        const usable = usableOf();
        const target = usable[first ? 0 : usable.length - 1];
        if (target !== void 0) refs.current[target.index]?.focus();
      };
      const onKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        switch (event.key) {
          case "ArrowDown":
          case "ArrowUp":
            event.preventDefault();
            event.stopPropagation();
            move(event.key === "ArrowDown" ? 1 : -1);
            return;
          case "Home":
          case "End":
            event.preventDefault();
            event.stopPropagation();
            jump(event.key === "Home");
            return;
          case "ArrowRight":
            event.preventDefault();
            event.stopPropagation();
            onEnterList();
            return;
          case "Enter":
          case " ": {
            const index = refs.current.findIndex((element) => element === document.activeElement);
            const option = index === -1 ? void 0 : options[index];
            if (option === void 0 || option.failed || busy) return;
            event.preventDefault();
            event.stopPropagation();
            onPick(option.id);
            return;
          }
          default:
        }
      };
      refs.current = [];
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          className: "dmp-rail",
          role: "listbox",
          "aria-label": t2("provider.group"),
          onKeyDown,
          children: options.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              ref: (element) => {
                refs.current[index] = element;
              },
              type: "button",
              role: "option",
              "aria-selected": option.id === current,
              "aria-current": option.session ? "true" : void 0,
              className: "dmp-rail-row",
              tabIndex: index === stopIndex ? 0 : -1,
              disabled: busy || option.failed,
              title: option.label,
              onClick: () => {
                onPick(option.id);
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-rail-copy", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-rail-name", children: option.label }) }),
                option.failed ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dmp-provider-failed", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-provider-failed-dot", "aria-hidden": "true" }),
                  t2("provider.failed")
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-provider-count", children: option.count }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-check", children: option.id === current ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : null })
              ]
            },
            option.id ?? "all"
          ))
        }
      );
    }
    
    // src/client/SettingsMenu.tsx
    var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react4 = require("react");
    var import_react_dom = require("react-dom");
    
    // src/client/panelCopy.ts
    function modalityLabel(modalities, t2) {
      return modalities.map((modality) => modality === "text" ? t2("settings.input.text") : modality === "image" ? t2("settings.input.image") : modality === "audio" ? t2("settings.input.audio") : modality === "video" ? t2("settings.input.video") : modality === "pdf" ? t2("settings.input.pdf") : modality).join(t2("settings.listJoin"));
    }
    function publishedInputOf(capability) {
      const published = capability?.inputModalities;
      return published === void 0 || published.length === 0 ? void 0 : published;
    }
    function noticeOf(state) {
      const line = noticeKeyOf(state);
      if (line === null) return null;
      return line.key === "settings.loadFailed" ? { key: line.key, params: { message: state.snapshot.error ?? "" } } : line;
    }
    function noticeKeyOf(state) {
      if (state.busy) return { key: "settings.busy" };
      if (state.snapshot.status === "loading" || state.snapshot.status === "idle") {
        return { key: "settings.loading" };
      }
      if (state.snapshot.status === "unavailable") return { key: "settings.unavailable" };
      if (state.snapshot.status === "error") return { key: "settings.loadFailed" };
      if (state.address === null) return { key: "settings.unaddressable" };
      if (!state.snapshot.writable) return { key: "settings.readonly" };
      return null;
    }
    function inputHintOf(state, t2) {
      const address = state.address;
      const published = publishedInputOf(state.capability);
      if (address !== null && address.input.length > 0) {
        return noticeOf(state) === null ? { key: "settings.input.declared", params: { list: modalityLabel(address.input, t2) } } : null;
      }
      if (published !== void 0) {
        return { key: "settings.input.capability", params: { list: modalityLabel(published, t2) } };
      }
      if (noticeOf(state) !== null) return null;
      if (address === null) return null;
      if (address.defaultInput.length > 0) {
        return { key: "settings.input.default", params: { list: modalityLabel(address.defaultInput, t2) } };
      }
      return { key: "settings.input.defaultUnknown" };
    }
    function contextHintOf(state) {
      if (state.capacityError) return { key: "settings.context.invalid" };
      const address = state.address;
      const published = state.capability?.contextWindow;
      if (address !== null && address.contextWindow !== void 0) {
        return noticeOf(state) === null ? { key: "settings.context.declared" } : null;
      }
      if (published !== void 0) {
        return { key: "settings.context.capability", params: { value: formatContext(published) } };
      }
      if (noticeOf(state) !== null) return null;
      if (address === null) return null;
      if (address.defaultContextWindow !== void 0) {
        return { key: "settings.context.default", params: { value: formatContext(address.defaultContextWindow) } };
      }
      return { key: "settings.context.unset" };
    }
    function contextFieldOf(address, capability = null) {
      const declared = address?.contextWindow;
      const fallback = capability?.contextWindow ?? address?.defaultContextWindow;
      return {
        value: declared === void 0 ? "" : formatContext(declared),
        placeholder: declared === void 0 ? fallback === void 0 ? CONTEXT_PLACEHOLDER : formatContext(fallback) : formatContext(declared)
      };
    }
    function shownInputOf(address, capability = null) {
      if (address !== null && address.input.length > 0) return address.input;
      const published = publishedInputOf(capability);
      if (published !== void 0) return published;
      if (address !== null && address.defaultInput.length > 0) return address.defaultInput;
      return address === null ? [] : PANEL_MODALITIES;
    }
    function showsInputSection(address, capability = null) {
      return address !== null || publishedInputOf(capability) !== void 0;
    }
    function restoreIsEmpty(state) {
      const address = state.address;
      if (address === null) return false;
      if (noticeKeyOf(state) !== null) return false;
      return address.input.length === 0 && address.contextWindow === void 0;
    }
    function showsContextField(address, capability = null) {
      return address !== null || capability?.contextWindow !== void 0;
    }
    function capacityAction(draft, committed, declaredTokens, parse) {
      if (draft === null || draft === committed) return { kind: "skip" };
      const text = draft.trim();
      if (text === "") {
        return declaredTokens === void 0 ? { kind: "skip" } : { kind: "unset" };
      }
      const tokens = parse(text);
      if (tokens === null) return { kind: "reject" };
      if (tokens === declaredTokens) return { kind: "normalize", text: formatContext(tokens) };
      return { kind: "set", value: tokens };
    }
    
    // src/client/SettingsMenu.tsx
    var import_jsx_runtime6 = require("react/jsx-runtime");
    var MEASURE_STYLE = { visibility: "hidden", left: 0, top: 0 };
    function modelOf(store, route) {
      const group = store.getSnapshot().groups.find((candidate) => candidate.id === route.provider);
      return group?.models.find((candidate) => candidate.id === route.model) ?? null;
    }
    function SettingsMenu({
      anchorRef,
      panelRef,
      idPrefix,
      side,
      directory,
      params,
      capabilities,
      busy,
      maxHeight,
      t: t2,
      onSelect,
      onClose
    }) {
      const [capacityDraft, setCapacityDraft] = (0, import_react4.useState)(null);
      const [capacityError, setCapacityError] = (0, import_react4.useState)(false);
      const [writing, setWriting] = (0, import_react4.useState)(false);
      const [writeError, setWriteError] = (0, import_react4.useState)(null);
      const current = (0, import_react4.useSyncExternalStore)(
        (subscribe) => directory.subscribe(subscribe),
        () => directory.getSnapshot().current
      );
      const snapshot = (0, import_react4.useSyncExternalStore)(
        (subscribe) => params.subscribe(subscribe),
        () => params.getSnapshot()
      );
      const catalog = (0, import_react4.useSyncExternalStore)(
        (subscribe) => capabilities.subscribe(subscribe),
        () => capabilities.getSnapshot()
      );
      const position = (0, import_dsh_client_ui_primitives2.useAnchoredPosition)({ open: true, anchorRef, panelRef, side, align: "end", gap: 8, margin: 12 });
      (0, import_react4.useEffect)(() => {
        void params.refresh();
      }, [params]);
      const route = current === null ? null : { provider: current.provider, model: current.model };
      const address = (0, import_react4.useMemo)(
        () => resolveRoute(snapshot, route),
        [snapshot, route?.provider, route?.model]
      );
      const capability = route === null ? null : catalog.routes[rowKey(route.provider, route.model)] ?? null;
      (0, import_react4.useEffect)(() => {
        if (route !== null) capabilities.ensure([route.provider]);
      }, [capabilities, route?.provider]);
      const model = route === null ? null : modelOf(directory, route);
      const reasoning = model?.reasoning;
      const choices = (0, import_react4.useMemo)(
        () => reasoning === void 0 ? [] : effortChoicesOf(reasoning, t2),
        [reasoning, t2]
      );
      const activeEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
      const modelLabel = model?.name ?? (route === null ? "" : `${route.provider}/${route.model}`);
      const copyState = { address, capability, snapshot, busy, capacityError };
      const noticeLine = noticeOf(copyState);
      const sectionNotice = noticeLine === null ? null : t2(noticeLine.key, noticeLine.params);
      const inputHintLine = inputHintOf(copyState, t2);
      const inputHint = inputHintLine === null ? null : [
        t2(inputHintLine.key, inputHintLine.params),
        restoreIsEmpty(copyState) ? t2("settings.resetNothing") : null
      ].filter((part) => part !== null).join(" ");
      const contextHintLine = contextHintOf(copyState);
      const contextHint = contextHintLine === null ? null : t2(contextHintLine.key, contextHintLine.params);
      const shownInput = shownInputOf(address, capability);
      const contextField = contextFieldOf(address, capability);
      const editable = address !== null && snapshot.writable && !busy && !writing;
      const capacity = capacityDraft ?? contextField.value;
      const chain = () => {
        const panel = panelRef.current;
        if (panel === null) return [];
        return [
          ...panel.querySelectorAll('[role="switch"]'),
          panel.querySelector(".dmp-settings-input input"),
          ...panel.querySelectorAll(".dmp-effort-item"),
          panel.querySelector(".dmp-settings-reset")
        ].filter((item) => item !== null && !item.hasAttribute("disabled"));
      };
      const tookFocus = (0, import_react4.useRef)(false);
      (0, import_react4.useLayoutEffect)(() => {
        if (position === null || tookFocus.current) return;
        tookFocus.current = true;
        panelRef.current?.focus();
      }, [position]);
      const addressId = address === null ? "" : `${address.ns}#${address.entryPath.join(".")}`;
      (0, import_react4.useEffect)(() => {
        setCapacityDraft(null);
        setCapacityError(false);
        setWriteError(null);
      }, [addressId, contextField.value]);
      const move = (delta) => {
        const items = chain();
        if (items.length === 0) return;
        const active = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1;
        const next = active === -1 ? delta > 0 ? 0 : items.length - 1 : (active + delta + items.length) % items.length;
        items[next]?.focus();
      };
      const onKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        switch (event.key) {
          case "Escape":
          case "ArrowLeft":
            event.preventDefault();
            event.stopPropagation();
            onClose(true);
            return;
          case "Tab":
            event.preventDefault();
            event.stopPropagation();
            move(event.shiftKey ? -1 : 1);
            return;
          default:
        }
      };
      const write = (ops, done, failed) => {
        if (address === null) return;
        setWriting(true);
        setWriteError(null);
        void params.write(address.ns, ops, address.revision).then((outcome) => {
          setWriting(false);
          if (!outcome.ok) {
            failed?.();
            setWriteError(outcome.message);
            return;
          }
          done?.();
        });
      };
      const commitCapacity = () => {
        if (address === null || !editable) return;
        const action = capacityAction(capacityDraft, contextField.value, address.contextWindow, parseContext);
        switch (action.kind) {
          case "skip":
            return;
          case "reject":
            setCapacityError(true);
            return;
          case "normalize":
            setCapacityError(false);
            setCapacityDraft(action.text);
            return;
          case "unset":
            setCapacityError(false);
            write(
              [{ op: "unset", path: [...address.entryPath, "contextWindow"] }],
              () => {
                setCapacityDraft(null);
              },
              () => {
                setCapacityDraft(null);
              }
            );
            return;
          case "set":
            setCapacityError(false);
            write(
              [{ op: "set", path: [...address.entryPath, "contextWindow"], value: action.value }],
              () => {
                setCapacityDraft(formatContext(action.value));
              },
              // On a refusal the field goes back to what the Host actually holds.
              // Otherwise the rejected draft stays in the box, and the NEXT dismissal
              // re-issues the same refused mutation — a write per blur, forever, with
              // only "retype the declared value" as a way out. The refusal message is
              // what stays on screen; the draft does not.
              () => {
                setCapacityDraft(null);
              }
            );
        }
      };
      const toggleModality = (modality, on) => {
        if (address === null || !editable) return;
        const next = new Set(shownInput);
        if (on) next.add(modality);
        else next.delete(modality);
        const known = PANEL_MODALITIES.filter((candidate) => next.has(candidate));
        const extras = shownInput.filter((candidate) => !PANEL_MODALITIES.includes(candidate));
        const list = [...known, ...extras.filter((candidate) => candidate !== modality)];
        if (list.length === 0) {
          setWriteError(t2("settings.input.needOne"));
          return;
        }
        write([{ op: "set", path: [...address.entryPath, address.inputField], value: list }]);
      };
      const restoreDefaults = () => {
        if (address === null || !editable) return;
        const ops = [];
        if (address.contextWindow !== void 0) {
          ops.push({ op: "unset", path: [...address.entryPath, "contextWindow"] });
        }
        if (address.input.length > 0) {
          ops.push({ op: "unset", path: [...address.entryPath, address.inputField] });
        }
        if (ops.length === 0) return;
        write(ops);
      };
      const pickEffort = (effort) => {
        if (route === null || reasoning === void 0) return;
        if ((activeEffort ?? void 0) === effort) return;
        onSelect({
          provider: route.provider,
          model: route.model,
          ...effort === void 0 ? {} : { reasoningEffort: effort }
        });
      };
      if (route === null) return null;
      const notice = writeError !== null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-alert", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, { className: "dmp-settings-alert-icon" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.writeFailed", { message: writeError }) })
      ] }) : sectionNotice === null ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-notice", children: sectionNotice });
      return (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          import_dsh_client_ui_primitives2.MenuSurface,
          {
            ref: panelRef,
            id: `${idPrefix}-settings`,
            className: position === null ? "dmp-menu dmp-settings" : `dmp-menu dmp-settings dmp-menu-in ${side === "top" ? "dmp-from-top" : "dmp-from-bottom"}`,
            style: position === null ? MEASURE_STYLE : { ...position, maxHeight },
            role: "group",
            "aria-label": t2("settings.aria", { model: modelLabel }),
            "aria-busy": writing || busy,
            tabIndex: -1,
            onKeyDown,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-settings-title", children: modelLabel }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmp-settings-reset",
                    "aria-label": t2("settings.resetAria", { model: modelLabel }),
                    disabled: !editable || address === null || !address.declared,
                    onClick: restoreDefaults,
                    children: t2("settings.reset")
                  }
                )
              ] }),
              notice,
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-body", children: [
                showsInputSection(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-label", children: t2("settings.input.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-settings-name", children: t2("settings.input.text") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      import_dsh_client_ui_primitives2.Switch,
                      {
                        className: "dmp-settings-switch",
                        checked: shownInput.includes("text"),
                        label: t2("settings.input.text"),
                        disabled: !editable,
                        onChange: (next) => {
                          toggleModality("text", next);
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-settings-name", children: t2("settings.input.image") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      import_dsh_client_ui_primitives2.Switch,
                      {
                        className: "dmp-settings-switch",
                        checked: shownInput.includes("image"),
                        label: t2("settings.input.image"),
                        disabled: !editable,
                        onChange: (next) => {
                          toggleModality("image", next);
                        }
                      }
                    )
                  ] }),
                  inputHint !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-hint", children: inputHint })
                ] }),
                showsContextField(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-label", children: t2("settings.context.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-row", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                    import_dsh_client_ui_primitives2.Input,
                    {
                      className: capacityError ? "dmp-settings-input dmp-settings-input-bad" : "dmp-settings-input",
                      type: "text",
                      inputMode: "numeric",
                      disabled: !editable,
                      "aria-label": t2("settings.context.title"),
                      "aria-invalid": capacityError || void 0,
                      placeholder: contextField.placeholder,
                      value: capacity,
                      onChange: (event) => {
                        setCapacityDraft(event.target.value);
                        setCapacityError(false);
                      },
                      onKeyDown: (event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        event.stopPropagation();
                        commitCapacity();
                      },
                      onBlur: () => {
                        commitCapacity();
                      }
                    }
                  ) }),
                  contextHint !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-hint", children: contextHint })
                ] }),
                reasoning !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-label", children: t2("settings.effort.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-effort-list", role: "radiogroup", "aria-label": t2("settings.effort.title"), children: choices.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                    "button",
                    {
                      type: "button",
                      role: "radio",
                      "aria-checked": choice.effort === activeEffort,
                      className: "dmp-effort-item",
                      disabled: busy,
                      onClick: () => {
                        pickEffort(choice.effort);
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-effort-name", children: choice.label }),
                        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-effort-check", children: choice.effort === activeEffort ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives2.IconCheckOutlineRegular, {}) : null })
                      ]
                    },
                    choice.key
                  )) })
                ] }),
                address !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-target", title: `${address.ns} · ${address.entryPath.join(".")}`, children: t2("settings.target", { ns: address.ns, path: address.entryPath.join(".") }) }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-note", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives2.IconInfoOutlineRegular, { className: "dmp-settings-note-icon" }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.note") })
                ] })
              ] })
            ]
          }
        ),
        document.body
      );
    }
    
    // src/client/Picker.tsx
    var import_jsx_runtime7 = require("react/jsx-runtime");
    var MEASURE_STYLE2 = { visibility: "hidden", left: 0, top: 0 };
    function orderProviders(groups) {
      return groups.slice().sort((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
    }
    function Picker(props) {
      const { locked, available, directory, load, select, params, capabilities, translate, sessionId } = props;
      const t2 = props.t ?? translate;
      const state = (0, import_react5.useSyncExternalStore)(
        (subscribe) => directory.subscribe(subscribe),
        () => directory.getSnapshot()
      );
      const [open, setOpen] = (0, import_react5.useState)(false);
      const [query, setQuery] = (0, import_react5.useState)("");
      const [highlight, setHighlight] = (0, import_react5.useState)(null);
      const [providerFilter, setProviderFilter] = (0, import_react5.useState)(null);
      const [settingsAt, setSettingsAt] = (0, import_react5.useState)(false);
      const [settingsSide, setSettingsSide] = (0, import_react5.useState)("bottom");
      const [settingsBudget, setSettingsBudget] = (0, import_react5.useState)(void 0);
      const [selectionFocus, setSelectionFocus] = (0, import_react5.useState)(false);
      const [toast, setToast] = (0, import_react5.useState)(null);
      const toastSeq = (0, import_react5.useRef)(0);
      const rootRef = (0, import_react5.useRef)(null);
      const triggerRef = (0, import_react5.useRef)(null);
      const settingsButtonRef = (0, import_react5.useRef)(null);
      const settingsMenuRef = (0, import_react5.useRef)(null);
      const searchRef = (0, import_react5.useRef)(null);
      const menuRef = (0, import_react5.useRef)(null);
      const groupsRef = (0, import_react5.useRef)(null);
      const rowRefs = (0, import_react5.useRef)([]);
      const railRefs = (0, import_react5.useRef)([]);
      const lastActionRef = (0, import_react5.useRef)("load");
      const id = (0, import_react5.useId)();
      const [settingsSession, setSettingsSession] = (0, import_react5.useState)(sessionId);
      if (settingsAt && settingsSession !== sessionId) {
        setSettingsAt(false);
        setSettingsSession(sessionId);
      }
      const [scopeSession, setScopeSession] = (0, import_react5.useState)(sessionId);
      if (scopeSession !== sessionId) {
        setScopeSession(sessionId);
        setProviderFilter(state.current?.provider ?? null);
      }
      const menuPos = (0, import_dsh_client_ui_primitives3.useAnchoredPosition)({
        open,
        anchorRef: triggerRef,
        panelRef: menuRef,
        side: "top",
        align: "end",
        gap: 8,
        margin: 12
      });
      const orderedGroups = (0, import_react5.useMemo)(() => orderProviders(state.groups), [state.groups]);
      const catalogRows = (0, import_react5.useMemo)(() => orderedGroups.flatMap((group) => group.models.map((model) => ({ key: `${group.id}:${model.id}`, provider: group.id, model }))), [orderedGroups]);
      const selectedKey = state.current === null ? null : rowKey(state.current.provider, state.current.model);
      const currentRow = catalogRows.find((row) => rowKey(row.provider, row.model.id) === selectedKey) ?? null;
      const currentReasoning = currentRow?.model.reasoning;
      const effectiveEffort = state.current?.reasoningEffort ?? currentReasoning?.defaultEffort;
      const effortLabel = currentReasoning === void 0 ? state.retainedEffort : effortLabelOf(currentReasoning, effectiveEffort, t2);
      const paramsSnapshot = (0, import_react5.useSyncExternalStore)(
        (subscribe) => params.subscribe(subscribe),
        () => params.getSnapshot()
      );
      const catalog = (0, import_react5.useSyncExternalStore)(
        (subscribe) => capabilities.subscribe(subscribe),
        () => capabilities.getSnapshot()
      );
      const declaredCurrent = resolveRoute(paramsSnapshot, state.current)?.declared === true;
      const specsByRow = (0, import_react5.useMemo)(() => {
        const map = /* @__PURE__ */ new Map();
        for (const row of catalogRows) {
          map.set(rowKey(row.provider, row.model.id), badgeSpecsOf({
            address: resolveRoute(paramsSnapshot, { provider: row.provider, model: row.model.id }),
            capability: catalog.routes[rowKey(row.provider, row.model.id)],
            // The row states only whether the model CAN reason (reasoning metadata
            // present or not); the effort in force is the trigger's and the panel's
            // subject, so it is not passed here.
            reasoning: row.model.reasoning,
            t: t2
          }));
        }
        return map;
      }, [catalog, catalogRows, paramsSnapshot, t2]);
      const trimmedQuery = query.trim();
      const providerLabel = (0, import_react5.useCallback)(
        (providerId, fallback) => providerId === "deepseek-account" ? t2("provider.account") : fallback,
        [t2]
      );
      const groups = (0, import_react5.useMemo)(() => {
        const ranked = (0, import_dsh_client_ui_primitives3.rankByName)(catalogRows.map((row) => row.model), trimmedQuery);
        const rankOf = new Map(ranked.map((model, index) => [model, index]));
        const bestRank = (candidate) => candidate.rows.reduce(
          (best, row) => Math.min(best, rankOf.get(row.model) ?? Number.MAX_SAFE_INTEGER),
          Number.MAX_SAFE_INTEGER
        );
        const scoped = providerFilter === null ? orderedGroups : orderedGroups.filter((group) => group.id === providerFilter);
        return scoped.map((group) => ({
          id: group.id,
          label: providerLabel(group.id, group.name),
          rows: (0, import_dsh_client_ui_primitives3.rankByName)(group.models, trimmedQuery).map((model) => ({
            key: `${group.id}:${model.id}`,
            provider: group.id,
            model
          }))
        })).filter((group) => group.rows.length > 0).sort((left, right) => bestRank(left) - bestRank(right));
      }, [catalogRows, orderedGroups, providerFilter, providerLabel, trimmedQuery]);
      const modelCounts = (0, import_react5.useMemo)(() => new Map(
        orderedGroups.map((group) => [group.id, group.models.length])
      ), [orderedGroups]);
      const providerOptions = (0, import_react5.useMemo)(() => [
        {
          id: null,
          label: t2("provider.all"),
          count: catalogRows.length,
          failed: false,
          session: false
        },
        ...orderedGroups.map((group) => ({
          id: group.id,
          label: providerLabel(group.id, group.name),
          count: modelCounts.get(group.id) ?? group.models.length,
          failed: false,
          session: group.id === state.current?.provider
        })),
        ...state.failures.map((failure) => ({
          id: failure.id,
          label: providerLabel(failure.id, failure.name),
          count: 0,
          failed: true,
          session: failure.id === state.current?.provider
        }))
      ], [catalogRows.length, modelCounts, orderedGroups, providerLabel, state.current, state.failures, t2]);
      const providerNameOf = (0, import_react5.useCallback)(
        (providerId) => providerOptions.find((option) => option.id === providerId)?.label ?? providerLabel(providerId, providerId),
        [providerLabel, providerOptions]
      );
      const railStop = (0, import_react5.useMemo)(() => {
        const selected = providerOptions.findIndex((option) => option.id === providerFilter && !option.failed);
        if (selected >= 0) return selected;
        return providerOptions.findIndex((option) => !option.failed);
      }, [providerOptions, providerFilter]);
      const currentProviderId = state.current?.provider ?? null;
      const currentProviderLabel = currentProviderId === null ? null : providerNameOf(currentProviderId);
      const knownProviders = (0, import_react5.useMemo)(() => new Set(providerOptions.map((option) => option.id)), [providerOptions]);
      (0, import_react5.useEffect)(() => {
        if (providerFilter === null || state.status !== "ready") return;
        if (knownProviders.has(providerFilter)) return;
        setProviderFilter(currentProviderId);
      }, [currentProviderId, knownProviders, providerFilter, state.status]);
      const rows = (0, import_react5.useMemo)(() => groups.flatMap((group) => group.rows), [groups]);
      const indexOfRow = (0, import_react5.useMemo)(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
      const currentVisibleIndex = rows.findIndex((row) => row.provider === state.current?.provider && row.model.id === state.current.model);
      const activeIndex = rows.length === 0 ? -1 : Math.min(highlight ?? Math.max(0, currentVisibleIndex), rows.length - 1);
      const pending = state.pending;
      const busy = pending !== null;
      const elsewhereCount = (0, import_react5.useMemo)(() => {
        if (providerFilter === null || trimmedQuery === "") return 0;
        const matches = (0, import_dsh_client_ui_primitives3.rankByName)(catalogRows.map((row) => row.model), trimmedQuery).length;
        return Math.max(0, matches - rows.length);
      }, [catalogRows, providerFilter, rows.length, trimmedQuery]);
      const reload = () => {
        lastActionRef.current = "load";
        load();
      };
      (0, import_react5.useEffect)(() => {
        params.ensure();
      }, [params]);
      (0, import_react5.useEffect)(() => {
        if (!open) return;
        void params.refresh();
      }, [open, params]);
      (0, import_react5.useEffect)(() => {
        if (!open) return;
        capabilities.ensure(catalogRows.map((row) => row.provider));
      }, [capabilities, catalogRows, open]);
      (0, import_react5.useEffect)(() => {
        if (!open && !settingsAt) return;
        const closeOutside = (event) => {
          const target = event.target;
          if (rootRef.current?.contains(target) === true) return;
          if (menuRef.current?.contains(target) === true) return;
          if (settingsMenuRef.current?.contains(target) === true) return;
          setOpen(false);
          setSettingsAt(false);
        };
        document.addEventListener("mousedown", closeOutside);
        return () => {
          document.removeEventListener("mousedown", closeOutside);
        };
      }, [open, settingsAt]);
      (0, import_react5.useEffect)(() => {
        if (!open && !settingsAt) return;
        return observeSeatLoss(
          () => rootRef.current,
          () => {
            setOpen(false);
            setSettingsAt(false);
            setSelectionFocus(false);
          }
        );
      }, [open, settingsAt]);
      (0, import_react5.useEffect)(() => {
        const viewport = groupsRef.current;
        if (viewport === null) return;
        return (0, import_dsh_client_ui_primitives3.observeStickyMenuGroups)(viewport);
      }, [available, open, groups]);
      (0, import_react5.useLayoutEffect)(() => {
        if (!open || menuPos === null) return;
        const active = document.activeElement;
        if (active instanceof Node && menuRef.current?.contains(active) === true) return;
        searchRef.current?.focus();
      }, [open, menuPos]);
      (0, import_react5.useLayoutEffect)(() => {
        if (open && activeIndex >= 0) {
          rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
        }
      }, [open, activeIndex, rows]);
      if (!available) return null;
      const show = () => {
        setSelectionFocus(false);
        triggerRef.current?.focus();
        setQuery("");
        setHighlight(null);
        setProviderFilter(currentProviderId);
        setSettingsAt(false);
        setOpen(true);
        reload();
      };
      const close = (restoreFocus = false) => {
        setOpen(false);
        setSettingsAt(false);
        if (restoreFocus) queueMicrotask(() => {
          triggerRef.current?.focus();
        });
      };
      const pickProvider = (providerId) => {
        setProviderFilter(providerId);
        setHighlight(0);
        searchRef.current?.focus();
      };
      const toggleSettings = () => {
        if (settingsAt) {
          setSettingsAt(false);
          return;
        }
        const rect = settingsButtonRef.current?.getBoundingClientRect();
        if (rect !== void 0) {
          const estimated = 330;
          const below = window.innerHeight - rect.bottom;
          const top = below < estimated && rect.top > below ? "top" : "bottom";
          setSettingsSide(top);
          const room = top === "top" ? rect.top - 28 : below - 28;
          setSettingsBudget(Math.max(240, Math.min(460, room)));
        }
        setOpen(false);
        setSettingsAt(true);
      };
      const closeSettings = (restoreToGear) => {
        setSettingsAt(false);
        if (restoreToGear) queueMicrotask(() => {
          settingsButtonRef.current?.focus();
        });
      };
      const closeAfterSelection = () => {
        setSelectionFocus(true);
        close(true);
      };
      const showFailure = (text) => {
        toastSeq.current += 1;
        setToast({ seq: toastSeq.current, text });
      };
      const settleSelection = (result) => {
        if (result === void 0) return;
        if (result.ok) {
          if (rootRef.current !== null) closeAfterSelection();
          return;
        }
        const { error } = result;
        showFailure(error.code === "session/writer-held" ? t2("error.sessionInUse") : t2("error.action", { message: `${error.code}: ${error.message}` }));
      };
      const submit = (selection) => {
        lastActionRef.current = "select";
        setSelectionFocus(true);
        triggerRef.current?.focus();
        void select(selection).then(settleSelection).catch((error) => {
          showFailure(t2("error.action", { message: error instanceof Error ? error.message : String(error) }));
        });
      };
      const choose = (row) => {
        if (state.current?.provider === row.provider && state.current.model === row.model.id) {
          closeAfterSelection();
          return;
        }
        submit({ provider: row.provider, model: row.model.id });
      };
      const focusedIndexOf = () => {
        const active = document.activeElement;
        if (active === null) return null;
        const rowIndex = rowRefs.current.findIndex((element) => element === active);
        return rowIndex === -1 ? null : rowIndex;
      };
      const moveTab = (delta) => {
        const panel = menuRef.current;
        if (panel === null) return;
        const step = stepChain(cardChainOf(panel), document.activeElement, delta);
        if (step.kind === "close") {
          close(true);
          return;
        }
        if (step.kind === "focus") step.element.focus();
      };
      const onKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        if (settingsAt) return;
        if (event.key === "Escape" && open) {
          event.preventDefault();
          if (query !== "") {
            setQuery("");
            setHighlight(null);
            searchRef.current?.focus();
            return;
          }
          close(true);
          return;
        }
        if (!open) return;
        const onSearch = document.activeElement === searchRef.current;
        if (event.key === "ArrowLeft" && (onSearch ? query === "" : focusedIndexOf() !== null)) {
          const stop = railRefs.current[railStop] ?? null;
          if (stop !== null) {
            event.preventDefault();
            stop.focus();
          }
          return;
        }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && rows.length > 0) {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const base = highlight ?? activeIndex;
          const next = (base + delta + rows.length) % rows.length;
          if (onSearch) {
            setHighlight(next);
            rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          } else {
            setHighlight(next);
            rowRefs.current[next]?.focus();
          }
          return;
        }
        if (event.key === "Home" || event.key === "End") {
          if (rows.length === 0) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : rows.length - 1;
          setHighlight(next);
          if (onSearch) {
            rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          } else {
            rowRefs.current[next]?.focus();
          }
          return;
        }
        if (event.key === "Enter") {
          const index = focusedIndexOf();
          if (index !== null) {
            event.preventDefault();
            const row = rows[index];
            if (row === void 0 || busy) return;
            choose(row);
            return;
          }
          if (onSearch && activeIndex >= 0) {
            const row = rows[activeIndex];
            if (row !== void 0 && !busy) {
              event.preventDefault();
              choose(row);
            }
          }
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          moveTab(event.shiftKey ? -1 : 1);
        }
      };
      const onBlur = (event) => {
        const target = event.relatedTarget;
        if (target instanceof Node && (rootRef.current?.contains(target) === true || menuRef.current?.contains(target) === true || settingsMenuRef.current?.contains(target) === true)) return;
        if (event.currentTarget.contains(document.activeElement) || document.activeElement === document.body) return;
        close();
      };
      const legend = [
        { fact: "text", label: t2("badge.key.text") },
        { fact: "image", label: t2("badge.key.image") },
        { fact: "effort", label: t2("badge.key.effort") },
        { fact: "context", label: t2("badge.key.context") }
      ];
      const waiting = state.current === null && state.status === "loading";
      const modelName = waiting ? t2("trigger.loading") : currentRow?.model.name ?? (state.current === null ? t2("trigger.fallback") : state.current.model);
      const triggerLabel = currentProviderLabel === null ? modelName : `${currentProviderLabel}/${modelName}`;
      const triggerAria = waiting ? t2("trigger.loading") : state.current === null || currentProviderLabel === null ? t2("trigger.selectAria") : effortLabel === void 0 ? t2("trigger.aria", { provider: currentProviderLabel, model: modelName }) : t2("trigger.ariaEffort", { provider: currentProviderLabel, model: modelName, effort: effortLabel });
      const settingsTitle = state.current === null ? t2("settings.openNoModel") : declaredCurrent ? `${t2("settings.open")} · ${t2("settings.openDeclared")}` : t2("settings.open");
      rowRefs.current = [];
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          ref: rootRef,
          className: "dmp-root",
          onKeyDown,
          onBlur,
          onMouseDown: (event) => {
            if (event.target instanceof Element && event.target.closest('button,[role="menuitemradio"]') !== null) {
              event.preventDefault();
            }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: triggerLabel, side: "top", align: "end", portal: true, disabled: open, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
              "button",
              {
                ref: triggerRef,
                type: "button",
                className: open ? "dmp-trigger dmp-trigger-open" : "dmp-trigger",
                "aria-label": triggerAria,
                "aria-haspopup": "menu",
                "aria-expanded": open,
                "aria-controls": open ? `${id}-menu` : void 0,
                "aria-busy": busy,
                "data-selection-focus": selectionFocus ? "" : void 0,
                onBlur: () => {
                  setSelectionFocus(false);
                },
                disabled: locked,
                onClick: () => {
                  if (open) close(true);
                  else show();
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconDataOutlineRegular, { className: "dmp-trigger-icon", size: 16 }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-trigger-label", children: triggerLabel }),
                  !waiting && effortLabel !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-trigger-effort", children: effortLabel }),
                  busy ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconChevronDownOutlineRegular, { className: open ? "dmp-chevron dmp-chevron-open" : "dmp-chevron" })
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: settingsTitle, side: "top", align: "end", portal: true, disabled: settingsAt, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "button",
              {
                ref: settingsButtonRef,
                type: "button",
                className: settingsAt ? "dmp-settings-button dmp-settings-open" : "dmp-settings-button",
                "aria-label": state.current === null ? t2("settings.openNoModel") : t2("settings.openAria", { model: modelName }),
                "aria-haspopup": "menu",
                "aria-expanded": settingsAt,
                "aria-controls": settingsAt ? `${id}-settings` : void 0,
                "data-edited": declaredCurrent ? "" : void 0,
                "data-selection-focus": settingsAt ? "" : void 0,
                disabled: locked || state.current === null,
                onClick: toggleSettings,
                children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconSettingsOutlineRegular, { className: "dmp-settings-icon", size: 16 })
              }
            ) }),
            open && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                import_dsh_client_ui_primitives3.MenuSurface,
                {
                  ref: menuRef,
                  id: `${id}-menu`,
                  className: menuPos === null ? "dmp-menu dmp-card" : "dmp-menu dmp-card dmp-menu-in dmp-from-top",
                  style: menuPos ?? MEASURE_STYLE2,
                  role: "group",
                  "aria-label": t2("menu.aria"),
                  "aria-busy": state.status === "loading" || busy,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                      ProviderRail,
                      {
                        options: providerOptions,
                        current: providerFilter,
                        stopIndex: railStop,
                        busy,
                        t: t2,
                        refs: railRefs,
                        onPick: pickProvider,
                        onEnterList: () => {
                          searchRef.current?.focus();
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-models", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-search-row", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                          import_dsh_client_ui_primitives3.Input,
                          {
                            ref: searchRef,
                            className: query === "" ? "dmp-search" : "dmp-search dmp-search-with-query",
                            type: "text",
                            role: "searchbox",
                            "aria-label": t2("search.placeholder"),
                            "aria-controls": `${id}-models`,
                            "aria-activedescendant": activeIndex < 0 ? void 0 : `${id}-row-${activeIndex}`,
                            placeholder: t2("search.placeholder"),
                            value: query,
                            onChange: (event) => {
                              setQuery(event.target.value);
                              setHighlight(0);
                            }
                          }
                        ),
                        query !== "" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                          "button",
                          {
                            type: "button",
                            className: "dmp-search-clear",
                            "aria-label": t2("search.clear"),
                            disabled: busy,
                            onClick: () => {
                              setQuery("");
                              setHighlight(null);
                              searchRef.current?.focus();
                            },
                            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconCloseFillRegular, {})
                          }
                        )
                      ] }),
                      rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-legend", role: "note", "aria-label": t2("badge.keyAria"), children: legend.map((item) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dmp-legend-item", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-legend-icon", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BadgeIcon, { fact: item.fact, className: "dmp-badge-icon" }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-legend-word", children: item.label })
                      ] }, item.fact)) }),
                      state.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-status", role: "status", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("status.loading") })
                      ] }),
                      elsewhereCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-filter-hint", role: "status", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("provider.elsewhere", { count: String(elsewhereCount) }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                          "button",
                          {
                            type: "button",
                            className: "dmp-filter-clear",
                            disabled: busy,
                            onClick: () => {
                              pickProvider(null);
                            },
                            children: t2("provider.showAll")
                          }
                        )
                      ] }),
                      state.error !== null && lastActionRef.current === "load" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-error", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("error.action", { message: state.error }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t2("action.reload") })
                      ] }),
                      state.failures.map((failure) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-warning", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("warning.groupLoad", {
                          name: providerLabel(failure.id, failure.name),
                          message: failure.message
                        }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t2("action.reload") })
                      ] }, failure.id)),
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                        "div",
                        {
                          ref: groupsRef,
                          id: `${id}-models`,
                          className: "dmp-groups scrollable",
                          role: "menu",
                          "aria-label": t2("menu.model"),
                          hidden: rows.length === 0,
                          children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.MenuGroup, { label: group.label, children: group.rows.map((row) => {
                            const index = indexOfRow.get(row.key) ?? -1;
                            const selected = row.provider === state.current?.provider && row.model.id === state.current.model;
                            const specs = specsByRow.get(rowKey(row.provider, row.model.id)) ?? [];
                            const facts = specs.map((spec) => spec.sentence).join(t2("settings.listJoin"));
                            const shown = specs.filter((spec) => !spec.off);
                            const shownByFact = new Map(shown.map((spec) => [spec.fact, spec]));
                            const rowPending = pending !== null && pending.provider === row.provider && pending.model === row.model.id;
                            return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                              "div",
                              {
                                ref: (element) => {
                                  rowRefs.current[index] = element;
                                },
                                id: `${id}-row-${index}`,
                                role: "menuitemradio",
                                "aria-checked": selected,
                                "aria-label": facts === "" ? row.model.name : t2("badge.rowAria", { model: row.model.name, facts }),
                                "aria-disabled": busy || void 0,
                                "data-active": index === activeIndex ? "" : void 0,
                                className: "dmp-row",
                                tabIndex: -1,
                                onMouseDown: () => {
                                  rowRefs.current[index]?.focus();
                                },
                                onMouseMove: busy || index === activeIndex ? void 0 : () => {
                                  setHighlight(index);
                                },
                                onClick: () => {
                                  if (!busy) choose(row);
                                },
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dmp-row-copy", children: [
                                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-row-name", title: row.model.name, children: row.model.name }),
                                    shown.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-badges", title: facts, "aria-hidden": "true", children: BADGE_FACTS.map((fact) => {
                                      const spec = shownByFact.get(fact);
                                      if (spec === void 0) {
                                        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-badge-slot" }, fact);
                                      }
                                      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                                        import_dsh_client_ui_primitives3.Tag,
                                        {
                                          tone: "neutral",
                                          className: "dmp-badge",
                                          children: [
                                            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-badge-fact", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BadgeIcon, { fact: spec.fact, className: "dmp-badge-icon" }) }),
                                            spec.value !== "" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-badge-value", children: spec.value })
                                          ]
                                        },
                                        spec.fact
                                      );
                                    }) })
                                  ] }),
                                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-check", children: rowPending ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : selected ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconCheckOutlineRegular, {}) : null })
                                ]
                              },
                              row.key
                            );
                          }) }, group.id))
                        }
                      ),
                      state.status === "ready" && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-empty", role: "status", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconDataOutlineRegular, { className: "dmp-empty-icon", size: 20, "aria-hidden": "true" }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: providerFilter !== null ? trimmedQuery === "" ? t2("empty.provider") : t2("empty.providerSearch") : catalogRows.length === 0 ? t2("empty.models") : t2("search.empty") })
                      ] })
                    ] })
                  ]
                }
              ),
              document.body
            ),
            settingsAt && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                SettingsMenu,
                {
                  anchorRef: settingsButtonRef,
                  panelRef: settingsMenuRef,
                  idPrefix: id,
                  side: settingsSide,
                  directory,
                  params,
                  capabilities,
                  busy,
                  maxHeight: settingsBudget,
                  t: t2,
                  onSelect: (selection) => {
                    submit(selection);
                  },
                  onClose: closeSettings
                }
              ),
              document.body
            ),
            toast !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              import_dsh_client_ui_primitives3.Toast,
              {
                text: toast.text,
                icon: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, {}),
                anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
                onDone: () => {
                  setToast(null);
                }
              },
              toast.seq
            )
          ]
        }
      );
    }
    
    // src/client/retiredScope.ts
    var RETIRED_SCOPE_PREFIX = "dsh-model-picker.provider.";
    function retireStoredScope() {
      let store;
      try {
        store = window.localStorage;
      } catch {
        return;
      }
      try {
        const doomed = [];
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index);
          if (key !== null && key.startsWith(RETIRED_SCOPE_PREFIX)) doomed.push(key);
        }
        for (const key of doomed) store.removeItem(key);
      } catch {
      }
    }
    
    // src/client/styles.ts
    var STYLE_ELEMENT_ID3 = "dsh-rabbit-model-picker-styles";
    var CSS3 = `
    .dmp-root {
      position: relative;
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
      /* One motion voice for the whole seat: a decelerating curve that starts fast
         and settles, shared by every hover, press and entrance below. The portaled
         cards are NOT descendants of this element, so .dmp-menu states it too. */
      --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
    }
    
    /* The seat's only control. §5.26 folded the provider INTO this label
       (provider/model), so the chip that used to sit beside it is gone: the provider
       is a fact about the model in use, and the trigger is what names the model. The
       settings gear shares the hover/focus/disabled contract by its own rules below,
       but not this block: it is icon-only at every width, so it has no text to
       collapse. */
    .dmp-trigger {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      max-width: 220px;
      max-width: min(360px, 45cqw);
      height: 28px;
      padding: 0 4px 0 8px;
      border: none;
      border-radius: var(--dsw-radius-sm);
      outline: none;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font-size: 13px;
      line-height: 20px;
      font-weight: 400;
      cursor: pointer;
      transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease), transform 90ms var(--dmp-ease);
    }
    
    .dmp-trigger:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    /* Press: the control yields by one notch and returns on release. A transform,
       so the composer's layout never reflows under the pointer. */
    .dmp-trigger:active:not(:disabled) {
      transform: scale(0.97);
    }
    
    .dmp-trigger:focus-visible:not([data-selection-focus]) {
      box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); /* taste-skill-ignore: focus indicator on the keyboard path, not elevation */
    }
    
    .dmp-trigger:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    /* The composer measures expanded row demand and owns this display variable;
       this seat only consumes it. Outside a composer the trigger keeps its text,
       and the icon stays hidden.
       The trigger labels the model as provider/model (§5.26 — the provider is a
       prefix of the model's identity, not a separate control beside it) and the
       effort in force after it (the stock picker's "name · level"). The identity is
       the primary half and the effort is the secondary half, so the width fight is
       settled by role: the identity keeps its shrink and ellipsizes first, the effort
       holds one short word. */
    .dmp-trigger-label {
      display: var(--dsh-composer-model-text-display, block);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* The effort in force, shown beside the name. It is TEXT, not an icon, so it
       carries the same readable ink as the name rather than the chevron's caption
       grey (the contrast gate holds every painted word to AA). The separator is a
       CSS ::before so it adds no DOM node and no accessible-name text: the trigger's
       aria-label already spells the effort out through trigger.ariaEffort, and a
       screen reader must not hear the middot as content. Under the composer's
       narrow-row switch the whole text half collapses together, so the effort
       answers the same display variable the name does.
    
       It is set one step down from the name (11px against the name's 13px, with
       tabular figures) so the chip states a MODEL at a level rather than one long
       string: at 13px/400 in the same ink as the name, "DeepSeek V4.1 Flash · Max"
       read as a single label and the level competed with the thing being named. */
    .dmp-trigger-effort {
      display: var(--dsh-composer-model-text-display, inline);
      flex: 0 0 auto;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-trigger-effort::before {
      content: '·';
      margin: 0 4px;
    }
    
    .dmp-trigger-icon {
      display: var(--dsh-composer-model-icon-display, none);
      flex: 0 0 auto;
    }
    
    .dmp-chevron {
      flex: 0 0 auto;
      color: var(--dsw-alias-label-caption);
      transition: transform 140ms var(--dmp-ease);
    }
    
    .dmp-chevron-open {
      transform: rotate(180deg);
    }
    
    /* While the model card is up, the control that owns it reads as held down, the
       same way the gear does. Without it the chevron rotated but the chrome stayed
       cold, and the seat's shared contract had a hole in it. */
    .dmp-trigger-open {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    /* The parameter gear: the trigger's right-hand companion. Icon-only by
       design (it carries no model text), so the composer's narrow-row variables do
       not apply to it and a 28px square is all the width it ever asks for. */
    .dmp-settings-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: var(--dsw-radius-sm);
      outline: none;
      background: transparent;
      color: var(--dsw-alias-label-caption);
      cursor: pointer;
      transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease), transform 90ms var(--dmp-ease);
    }
    
    .dmp-settings-button:active:not(:disabled) {
      transform: scale(0.97);
    }
    
    .dmp-settings-button:hover:not(:disabled) {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmp-settings-button:focus-visible:not([data-selection-focus]) {
      box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); /* taste-skill-ignore: focus indicator on the keyboard path, not elevation */
    }
    
    .dmp-settings-button:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    /* A route with a record tones the gear up; the open state is spelled by its own
       class so the two do not have to be told apart by specificity. */
    .dmp-settings-button[data-edited] {
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmp-settings-open {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-primary);
    }
    
    /* Portaled to body and placed from the trigger rect, so the sidebar and the
       columns' overflow clips cannot crop the card. border-box keeps the OUTER
       width inside the design budget (padding included).
    
       This is the shared MATERIAL, and the three cards' shared metrics: the model
       card, the parameter panel and the settings surfaces all wear this class. So it
       stays a COLUMN — the two-pane layout belongs to the model card alone and lives
       on .dmp-card, because the parameter panel wears both classes and a row here
       would lay its head and its body out side by side. */
    .dmp-menu {
      position: fixed;
      z-index: 1100;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: min(320px, calc(100vw - 32px));
      max-height: min(420px, calc(100vh - 96px));
      overflow: hidden;
      padding: 4px;
      border: 0;
      --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
      box-shadow: var(--dsw-elevation-prominent); /* taste-skill-ignore: the card IS the overlay this rule allows */
      color: var(--dsw-alias-label-primary);
      /* Elevated surface: the scrollbar thumb takes the l2 elevation tokens. */
      --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
      --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
      --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
      /* THE FACT GRID. The row's four facts are four fixed tracks, in BADGE_FACTS
         order, on every row whether or not the fact exists: one source for the
         widths, so the columns of a 520px card full of 60 models line up and a
         missing fact shows as an empty track instead of shifting its neighbours.
         The window track is the only one with a value (the window in force, right
         aligned so its unit letter lands in one column); a boolean fact is just its
         14px glyph. Everything that draws the grid — the row strip and the key under
         the search field — reads these three, so they cannot drift apart:
           strip = icon + gap + icon + gap + icon + gap + window
                 = 14 + 8 + 14 + 8 + 14 + 8 + 47 = 113px
         Against the shipped strip (~107px for the common three-fact row, ~129px for
         a four-fact one) the worst case NARROWS and the common case costs nothing on
         the four-fact rows it was worst on, while the name column becomes the same
         ~187px on every row rather than a different width per row (§5.25 moved the
         card off the single-column 320px that budgeted ~160px here). */
      --dmp-col-icon: 14px;
      --dmp-col-window: 47px;
      --dmp-col-gap: 8px;
      --dmp-row-pad-x: 7px;
    }
    
    /* Entry. The card settles from 97% into place over 150ms with its origin at the
       anchored corner, so it grows OUT of the control that opened it — the same
       gesture every native menu of this class makes, and one the host's own
       surfaces do not make (they snap). Transform only: an opacity fade would dim
       the card's text mid-flight, which the contrast contract does not permit any
       more permanently than it does transiently, and a settle reads cleaner than a
       fade at this speed anyway. The animation is gated on the class that arrives
       with the measured position, so it plays from the placed rect, never from the
       off-screen measuring origin. */
    @keyframes dmp-card-in {
      from { transform: scale(0.97); }
      to { transform: none; }
    }
    
    .dmp-menu-in {
      animation: dmp-card-in 150ms var(--dmp-ease);
    }
    
    /* The anchored corner, per the side the card opened on: everything here is
       align-end, so the horizontal origin is always the right edge. */
    .dmp-from-top {
      transform-origin: 100% 100%;
    }
    
    .dmp-from-bottom {
      transform-origin: 100% 0;
    }
    
    /* THE TWO PANES (§5.25), and only on the MODEL card: the provider rail on the
       left, the model list on the right. 520px is the smallest width at which both
       panes can do their jobs — the model column must stay at least the 320px the
       four-track fact grid was budgeted against (a narrower column would either drop
       badges, losing the row-to-row column alignment §5.24 exists for, or wrap them,
       making the row height jump), and the rail's box needs 181px (176 of flex basis
       plus its own padding and hairline) to hold a real provider name beside a
       two-digit model count and the selection check. Measured on the live GUI at that
       width: the model pane is 331px and the name column is 175px on every row,
       against ~160px in the single-column card. */
    .dmp-card {
      flex-direction: row;
      align-items: stretch;
      width: min(520px, calc(100vw - 32px));
    }
    
    /* The rail is the left pane: every scope this catalog offers, the unfiltered one
       first. It scrolls on its own (a deployment with fifteen providers must not push
       the model list off the card) and it is separated from the list by the host's l1
       hairline rather than by a fill, so the two panes still read as one surface.
       The name column it must not truncate is the longest provider label a real
       catalog carries (measured: "Magpie · Anthropic", 132px of room, no ellipsis). */
    .dmp-rail {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 0 0 176px;
      min-height: 0;
      overflow-y: auto;
      padding: 2px 4px 2px 0;
      border-right: 1px solid var(--dsw-alias-border-l1);
    }
    
    /* One scope. It is a button because it is picked (click and keyboard), but a
       listbox OPTION in role: the selection it reports is a scope, not an action.
       The check beside it is the same mark the model rows use for their own
       selection, so "what is picked" reads the same way in both panes. */
    .dmp-rail-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-height: 30px;
      padding: 0 6px;
      border: none;
      border-radius: var(--dsw-radius-sm);
      outline: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color 90ms var(--dmp-ease);
    }
    
    .dmp-rail-row:hover:not(:disabled),
    .dmp-rail-row:focus-visible,
    .dmp-rail-row[aria-selected='true'] {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmp-rail-row:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    /* The provider this conversation actually runs on. The rail has no room for the
       words 「当前会话」 beside a name, a count and the check — and the fact is already
       spelled out beside the card by the seat's chip — so the marker is one weight
       up, with aria-current as its machine-readable half. It is deliberately NOT the
       selected row's fill: the scope and the session are two different claims, and
       this pane is where confusing them would be invisible. */
    .dmp-rail-row[aria-current='true'] .dmp-rail-name {
      font-weight: 500;
    }
    
    .dmp-rail-copy {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 1 1 auto;
      min-width: 0;
    }
    
    .dmp-rail-name {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      line-height: 18px;
      font-weight: 400;
    }
    
    /* The model pane: search, key, state lines and the list, stacked in the column
       beside the rail. min-width: 0 keeps a long model name from widening the card
       instead of ellipsizing inside its own column. */
    .dmp-models {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      padding-left: 4px;
    }
    
    /* Status and empty copy are sentences a user is meant to read ("正在刷新模型列表…",
       "没有匹配的模型。"), not chrome: the tertiary ink measured 3.61:1 on this card
       in the light theme, under AA for 12px text. Same ink as every other
       explanatory line. */
    .dmp-status,
    .dmp-empty {
      padding: 8px;
      color: var(--dsw-alias-label-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    /* The loading line carries the host's live dot in front of the sentence, so a
       slow catalog reads as "working" rather than as a dead label. */
    .dmp-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    /* An empty result is a state, not a rendering accident, so it is composed the
       way one should be: a quiet glyph over one sentence, centered, with air —
       the same sentence either way, but a state that holds its shape reads as
       deliberate. The model card's three empty reasons all take it. */
    .dmp-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 20px 8px;
      text-align: center;
    }
    
    .dmp-empty-icon {
      color: var(--dsw-alias-label-tertiary);
    }
    
    /* A load failure and a partial failure. The failure signal is the host's danger
       fill plus the icon, NOT the ink: the host's error token measures 4.38:1 light
       and 3.61:1 dark on this card, which is under AA for any of these sizes, and
       the only size at which that red becomes compliant is 24px — absurd for a
       one-line callout. So the sentence takes ordinary readable ink and the state is
       carried by the fill, the icon and the words themselves (the message says the
       load failed). An error that is red but unreadable is worse than one that is
       neutral but legible. */
    .dmp-error,
    .dmp-warning {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 3px;
      padding: 6px 7px;
      border-radius: var(--dsw-radius-md);
      background: var(--dsw-alias-interactive-bg-hover-danger);
      color: var(--dsw-alias-label-secondary);
      font-size: 13px;
      line-height: 18px;
    }
    
    .dmp-error-icon {
      flex: 0 0 14px;
      margin-top: 1px;
      color: var(--dsw-alias-state-error-primary);
    }
    
    .dmp-warning {
      background: var(--dsw-alias-bg-module-platform);
    }
    
    .dmp-retry {
      flex: 0 0 auto;
      padding: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: color 90ms var(--dmp-ease);
    }
    
    .dmp-search-row {
      position: relative;
      flex-shrink: 0;
      margin: 2px 0 3px;
    }
    
    .dmp-search-row .dmp-search {
      display: flex;
      height: 30px;
      padding: 0 8px;
      /* The host's OWN field material, kept rather than flattened away: this is a
         real Input (the same primitive the settings pages use), and a control that
         renders as bare placeholder text is a label, not a field — the first thing
         on the card has to look like the thing you type into. Its border is the
         host's 0.5px l4 hairline, which is a form field's own line, not a rule. */
      border: 0.5px solid var(--dsw-alias-border-l4);
      border-radius: var(--dsw-radius-md);
      background: var(--dsw-alias-bg-layer-1);
    }
    
    .dmp-search-row .dmp-search-with-query {
      padding-right: 34px;
    }
    
    /* 13px, the row name's own size: the field used to be set a step SMALLER than
       the list it filters, which made the card's first line its quietest. */
    .dmp-search-row .dmp-search input {
      padding: 0;
      font-size: 13px;
      line-height: 18px;
    }
    
    /* The search field's placeholder is the ONLY instruction the list gives
       ("搜索模型…"), so it is held to the same ink as body copy: the caption token
       measures 2.08:1 on the card in the light theme, which is not readable, and a
       placeholder a user cannot read is not a hint. */
    .dmp-search-row .dmp-search input::placeholder {
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmp-search-clear {
      position: absolute;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 50%;
      corner-shape: round;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      cursor: pointer;
      /* The clear button only exists while there is a query to clear, so its
         arrival is an event: it pops in on the shared curve. It animates the
         standalone scale property, not transform, because the rule's own
         translateY centering must survive the animation untouched. */
      animation: dmp-clear-in 120ms var(--dmp-ease);
      transition: background-color 90ms var(--dmp-ease);
    }
    
    @keyframes dmp-clear-in {
      from { scale: 0.6; }
      to { scale: 1; }
    }
    
    .dmp-search-clear:hover,
    .dmp-search-clear:focus-visible {
      outline: none;
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    /* THE KEY TO THE STRIP. Four glyphs per row state four facts; the glyphs are
       the seat's whole invention and they mean nothing to a user who has not hovered
       a row, so the card says which column is which exactly once, above the table:
       the four marks with their words, in the order the columns are drawn, at the
       same 14px cell and the same readable ink the badges use. It is copy, not
       chrome — the a11y gate forbids hiding copy behind aria-hidden — and it is set
       in the secondary ink for the same reason every other explanatory line is: the
       caption token is 2.08:1 on this card in the light theme. */
    .dmp-legend {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      flex-wrap: wrap;
      gap: 12px;
      padding: 2px 8px 6px;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    
    .dmp-legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    /* The glyph's own box, the way .dmp-badge-fact holds it in a row, so the key's
       marks and the row's marks are the same thing at the same size. */
    .dmp-legend-icon {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      width: 14px;
      height: 14px;
    }
    
    .dmp-legend-word {
      flex: 0 0 auto;
    }
    
    .dmp-groups {
      min-height: 0;
      overflow-y: auto;
      /* The pinned group heading is 24px tall and the viewport knows nothing about
         it: scrollIntoView({ block: 'nearest' }) parked the newly highlighted first
         hit UNDER the band (measured in the query state — the top result of "deep
         seek" sat half behind its own heading). scroll-padding insets the scrollport
         for scroll-into-view and keyboard scrolling, so the browser keeps the row it
         is revealing clear of the band. */
      scroll-padding-top: 26px;
    }
    
    /* Groups are separated by air, not by the heading band alone: with 8px between
       sections the list stops reading as one continuous stripe of bands and rows. */
    .dmp-groups > [data-menu-group] + [data-menu-group] {
      margin-top: 8px;
    }
    
    /* The pinned group heading: the list's ONLY landmark — it names the provider
       whose models follow — and it shipped as the least legible text on the card,
       because MenuGroup's own rule paints the label-tertiary token at 11px.
       That token is 2.08:1 on this card in the light theme (measured by this repo's
       own contrast gate, which is the reason every other explanatory line here was
       moved off it), so the landmark takes the readable ink and 12px — one step over
       the badge values, one step under the row names. The fill stays: see §5.8 —
       without it, rows slide under the label and both texts draw through each other
       in any tab whose rendering pipeline is parked. */
    .dmp-groups [data-menu-group-heading] {
      background: var(--dsw-alias-menu-group-header-fill);
      color: var(--dsw-alias-label-secondary);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
      padding: 6px var(--dmp-row-pad-x) 2px;
    }
    
    /* The model row states facts instead of offering controls, and it keeps them on
       ONE line: the name shrinks with an ellipsis while the badge strip keeps its
       own width, so a long catalog name never pushes the facts out of the row. It is
       a div rather than a button so a row can hold block content while aria-disabled
       keeps it focusable during a selection (a disabled button would drop the
       keyboard back to the trigger).
    
       The row is 38px tall: a 22px badge capsule plus 8px of air above and below is
       what makes the strip read as a fact line rather than as text that happens to
       have a background. The strip is kept on ONE line (flex-wrap: nowrap): a badge
       broken across two lines was the row at 46px, and a row that changes height
       because its facts wrapped is a list that jumps as the eye scans it. */
    .dmp-row {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 6px;
      width: auto;
      min-width: 100%;
      min-height: 38px;
      padding: 5px var(--dmp-row-pad-x);
      border: none;
      border-radius: var(--dsw-radius-md);
      outline: none;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      /* Menu rows are actions, not copy: rapid clicking must never drag a
         selection halo across the list. */
      user-select: none;
      transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease);
    }
    
    /* The rows carry aria-disabled (the provider rows in the other card are real
       buttons and carry disabled); both spellings mean the same thing here. */
    .dmp-row:hover:not([aria-disabled='true']):not(:disabled),
    .dmp-row:focus-visible,
    .dmp-row[data-active]:not([aria-disabled='true']) {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmp-row[aria-disabled='true'],
    .dmp-row:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    /* Trailing model count on a rail row. The count is the reason to pick one
       provider over another, so it reads in the same ink as the row rather than in
       the caption token (2.08:1 on this card in the light theme). */
    .dmp-provider-count {
      flex: 0 0 auto;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    
    /* The "加载失败" mark on a rail row — the only thing on that row explaining
       why its models cannot be listed. The host's warn amber measures 2.72:1 here in
       the light theme (4.26:1 in dark) and no amber token in this palette clears AA
       on this card, so the words take readable ink and the state is carried by a
       trailing red dot, which is decoration and owes no text ratio. */
    .dmp-provider-failed {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      color: var(--dsw-alias-label-secondary);
      font-size: 12px;
      font-weight: 600;
      line-height: 16px;
    }
    
    .dmp-provider-failed-dot {
      flex: 0 0 6px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      corner-shape: round;
      background: var(--dsw-alias-state-error-primary);
    }
    
    /* "N more matches in other providers" strip at the top of the model list. The
       rail states the scope itself, so this is not a scope label: it appears only
       when a query has hits the scope is hiding, and it carries the one-click way
       back to every provider. */
    .dmp-filter-hint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 8px 4px;
      /* This strip explains why the list is short and carries the way back to all
         providers, so it is copy rather than chrome: the tertiary ink measures
         3.61:1 on this card in the light theme, below AA for 12px text. */
      color: var(--dsw-alias-label-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-filter-clear {
      flex: 0 0 auto;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: color 90ms var(--dmp-ease);
    }
    
    .dmp-filter-clear:hover:not(:disabled) {
      color: var(--dsw-alias-label-primary);
    }
    
    /* Name first, facts behind it, both on the row's single line: the name is the
       flexible half, the strip is the fixed half. */
    .dmp-row-copy {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }
    
    .dmp-row-name {
      flex: 1 1 auto;
      /* The name is the row's elastic half: it takes whatever the four capsules do
         not need, and it is what ellipsizes when the composer is narrow. The 48px
         floor is not a width budget — it is the point below which a name stops
         identifying a model at all. */
      min-width: 48px;
      overflow: hidden;
      color: inherit;
      font-size: 13px;
      line-height: 18px;
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* The fact strip: one badge per fact. Nothing in here is a control — that is the
       point of the strip, so it takes no hover, no focus ring and no cursor.
    
       The badges carry NO frame. The host's "neutral" tone paints the capsule's
       background, and that fill was the badge's whole outline: at 22px with 4px of
       side padding it read as a row of small bordered pills, which is a lot of
       chrome for four facts that are really just "T", a value and a window. Dropping
       the fill leaves the glyph and the value as the badge, so the strip reads as a
       fact LINE instead of a row of chips — and the two axes it frees are the two
       that were scarce (below). The paint is cleared here, on the badge itself,
       rather than by picking another tone: "quiet" also drops the icon's ink one
       step, and the facts are not second-class copy.
    
       WIDTH IS THE SCARCE RESOURCE, so the strip is built tight (see
       .dmp-badges .dmp-badge): the four common badges measure ~138px together, down
       from the ~152px the framed capsule cost, where the first version of this strip
       measured ~212px and left the model name 53px — barely two characters — in a
       320px card. The strip is the row's fixed half (it keeps its own width) and the
       name absorbs the deficit and ellipsizes, so those 14px went to the name. */
    .dmp-badges {
      display: grid;
      grid-template-columns:
        var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
      flex: 0 0 auto;
      align-items: center;
      /* The gap is the only thing separating neighbouring glyphs now that the
         capsule's own 4px of side padding is gone: between two glyphs the framed row
         had 4 + 2 + 4 = 10px of optical distance, and 8px keeps that rhythm. */
      gap: var(--dmp-col-gap);
    }
    
    /* An empty track. A fact this model does not state — no image input, no declared
       reasoning, no readable window — leaves its own column empty rather than
       pulling its neighbours left, so the three facts a model HAS are always in
       their own columns and the four columns agree from row to row. Nothing is drawn
       in the gap on purpose: a slashed glyph was the quietest possible way to say
       "no", and a fixed position says it without a mark at all (see §5.24). */
    .dmp-badge-slot {
      min-width: 0;
    }
    
    /* The badge is two cells on one baseline: the icon cell and the value.
       The primitive's own capsule is 1px 8px at 11px/17px, which both wastes 16px
       of width on a two-cell badge and leaves the icon floating in padding; these
       overrides make it a bare 22px-tall pair whose horizontal padding is gone
       entirely — with no fill and no border there is no capsule edge left to
       respect, so every pixel of padding here is width the model name needs. The
       min-height stays so the two-cell badges still agree on one baseline. The
       fill and border are cleared explicitly (not left to the tone): whatever
       stylesheet the shell injects first, the badge has no frame.
       Specificity beats the primitive's own .tag padding regardless of which
       stylesheet the shell injects first. */
    .dmp-badges .dmp-badge {
      gap: 3px;
      min-height: 22px;
      padding: 0;
      border: 0;
      background: transparent;
      font-weight: 400;
    }
    
    /* The icon cell: it states WHICH fact, so it is never the value's leftover, and
       it is the same size in every badge of the row whether the badge behind it
       carries text or not. It is exactly the glyph's box — the artwork carries its
       own inset inside the viewBox — so the cell adds no width the icon does not
       use. */
    .dmp-badge-fact {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      width: 14px;
      height: 14px;
    }
    
    /* With the capsule fill gone, the glyph and this value ARE the badge, so the
       glyph is the one thing left that states WHICH fact this is. There is no
       second (dimmed) state to paint: a fact the model lacks is not drawn at all —
       the row keeps only the facts it HAS (see badges.ts on the off field, whose
       sentence still reaches the row's aria-label). */
    .dmp-badge-icon {
      display: block;
      flex: 0 0 auto;
      color: var(--dsw-alias-label-secondary);
    }
    
    /* A capacity or a level name is a value, so it reads in tabular figures and one
       step brighter than the badge's own ink. It sits 3px behind its own glyph — the
       badge stays ONE mark, exactly as it was — because the icon cell is what the
       four tracks align on; a value right-aligned inside the window track instead
       left "1M" stranded 16px from its glyph while "262K" touched it, and the badge
       stopped reading as a single fact. The cap keeps an adapter's unusually long
       level name (the effort name is free adapter text) from growing the strip until
       the context-window badge — the last one — is pushed off the card and clipped by
       .dmp-menu's overflow. Beyond it the value ellipsizes like the name does. */
    .dmp-badge-value {
      max-width: 64px;
      overflow: hidden;
      color: var(--dsw-alias-label-secondary);
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
    }
    
    .dmp-check {
      display: grid;
      place-items: center;
      flex: 0 0 14px;
      color: var(--dsw-alias-label-primary);
    }
    
    /* The check arrives only when a row becomes the checked one, so its entrance is
       the selection's own event: a small overshoot pop on the shared curve. It is
       an icon, not copy, so the pop never touches the contrast contract. */
    @keyframes dmp-check-in {
      0% { transform: scale(0.5); }
      60% { transform: scale(1.12); }
      100% { transform: none; }
    }
    
    .dmp-check svg {
      width: 14px;
      height: 14px;
      animation: dmp-check-in 180ms var(--dmp-ease);
    }
    
    /* The parameter panel: same material as the model card, narrower than it (it
       carries labelled controls, not a list).
       The surface itself must NOT scroll. MenuSurface paints the card's fill as an
       absolutely positioned child (.material, inset: 0) anchored to this element's
       padding box, so a surface that scrolls drags that layer up with the content
       and the bottom of the card loses its fill — the page shows through the panel's
       own footer, and the layer's rounded bottom corners appear in the middle of the
       card. Measured on the real GUI: exactly that. The scroll role belongs to the
       inner body below; the model card already splits it the same way (.dmp-groups). */
    .dmp-settings {
      width: min(280px, calc(100vw - 32px));
      max-height: min(460px, calc(100vh - 96px));
      overflow: hidden;
    }
    
    /* The card holds initial focus when it opens (§5.10), so it needs a ring of its
       own: without one the focus is invisible until the first Tab, and with the UA's
       default outline it reads as a selection border around a floating card. Same
       token the capacity field paints on focus-within, so the two never disagree
       about which thing is focused. Mouse users never see it — focus-visible only
       matches the keyboard path that opened the panel. */
    .dmp-settings:focus-visible {
      outline: 1px solid var(--dsw-alias-state-business-primary);
      outline-offset: 1px;
    }
    
    /* The panel's scroll viewport: the head and the state line stay put, everything
       below them scrolls inside the card. min-height: 0 is what lets the flex item
       shrink below its content and actually become scrollable.
       The sections are separated by AIR (12px), not by a rule: the sheet used to draw
       border-top 1px on all five blocks of this panel, which is the one thing a
       floating card should never do — five hairlines turn a small panel into a form
       from 2014 and draw more lines than the card has groups. Space plus a change of
       type size carries the grouping instead. */
    .dmp-settings-body {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      gap: 12px;
      min-height: 0;
      padding: 2px 0 6px;
      overflow-y: auto;
    }
    
    .dmp-settings-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 8px 8px 6px;
    }
    
    .dmp-settings-title {
      min-width: 0;
      overflow: hidden;
      color: var(--dsw-alias-label-primary);
      font-size: 13px;
      line-height: 18px;
      /* The panel's one landmark: it names the model every control below belongs to,
         so it takes the card's primary ink and the heavier of the two weights this
         seat allows (the other 600 is the restore action beside it, set two steps
         smaller). */
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-settings-reset {
      flex: 0 0 auto;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-size: 11px;
      line-height: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: color 90ms var(--dmp-ease);
    }
    
    .dmp-settings-reset:hover:not(:disabled) {
      color: var(--dsw-alias-label-primary);
    }
    
    .dmp-settings-reset:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-settings-section {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 0 8px;
    }
    
    /* The parameter panel's labels and every explanatory line below them. These are
       real copy, not decoration, so they take the secondary ink: the caption token
       measures 2.08:1 on this card in the light theme (3.82:1 in dark), which fails
       WCAG AA for text this size in both themes — "已声明：文字、图片" is information
       the user needs in order to decide what the switches do. Hierarchy is carried
       by size (12px section label against the 13px control text, 11px hints) instead
       of by an unreadable ink, and by the 12px of air the body puts between
       sections, which is now the only thing dividing them. */
    .dmp-settings-label {
      color: var(--dsw-alias-label-secondary);
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
    }
    
    .dmp-settings-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 30px;
    }
    
    .dmp-settings-name {
      min-width: 0;
      color: var(--dsw-alias-label-secondary);
      font-size: 13px;
      line-height: 18px;
    }
    
    .dmp-settings-hint {
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    
    /* The panel's state line: why the controls above it are inert (no declaration,
       read-only profile, unavailable settings service). It is rendered above the
       controls it qualifies, so the reason is read before the control — which is
       exactly why it must be legible: it is the ONLY explanation of a disabled
       panel. Same ink as the hints. */
    .dmp-settings-notice {
      padding: 6px 8px 0;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    
    /* What the settings service refused, in its own words — the one line a user MUST
       read, and the only statement that their edit did not happen.
       It would be natural to paint this in the host's error red, and that is what
       this rule did at first. It cannot: the red measures 4.38:1 on this card in the
       light theme and 3.61:1 on the composer card in dark, both under AA for any
       body size, and the only size where that red becomes compliant is 24px — which
       turns one short refusal into a banner that dwarfs the 11-13px panel it lives
       in and pushes the controls down. So the failure is carried by things that do
       not have to be legible to be read: the host's danger fill, a warning icon in
       the error ink, and a sentence that says "被拒绝" in words. The copy becomes
       MORE legible than the red version (5.64:1 light / 7.86:1 dark), not less. */
    .dmp-settings-alert {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 6px 8px 0;
      padding: 6px 7px;
      border-radius: var(--dsw-radius-md);
      background: var(--dsw-alias-interactive-bg-hover-danger);
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    
    .dmp-settings-alert-icon {
      flex: 0 0 12px;
      margin-top: 2px;
      color: var(--dsw-alias-state-error-primary);
    }
    
    /* The declaration this panel writes, so a reviewer can check the edit landed;
       the full namespace + path stays available in the title attribute. It is the
       quietest line of the panel but it is still information ("which declaration
       does this edit?"), so it uses the same secondary ink as every other line
       rather than the dimmed token — dimmed measures 1.23:1 on this card in the
       light theme, which is invisible rather than quiet. */
    .dmp-settings-target {
      overflow: hidden;
      padding: 0 8px;
      color: var(--dsw-alias-label-secondary);
      /* 10px was the smallest text in the whole seat, on the one line a reviewer has
         to read to check the edit landed. It takes the panel's hint size. */
      font-size: 11px;
      line-height: 16px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* The primitive owns the switch's own chrome; only its place in the row is ours.
       align-self keeps it centered instead of stretching to the row's 30px. */
    .dmp-settings-switch {
      flex: 0 0 auto;
      align-self: center;
    }
    
    /* The gear's own mark: it must never shrink in a cramped composer row. */
    .dmp-settings-icon {
      flex: 0 0 auto;
    }
    
    /* The effort choices of the parameter panel: the panel is the one surface that
       lets effort be changed, so these are the only effort controls left in the
       seat. This wrapper stacks them and keeps the group tight against its label. */
    .dmp-effort-list {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    
    /* The capacity field takes the row's remaining width; the primitive's wrapper
       and its native input are both stretched so the whole row is the target. */
    .dmp-settings-input {
      flex: 1;
      min-width: 0;
      height: 28px;
      padding: 0 6px;
      /* The host's own Input material, the same field the settings pages draw: a
         form field may carry its own line, and this one should look like every other
         field in the product rather than like the last outlined box on the card. */
      border: 0.5px solid var(--dsw-alias-border-l4);
      border-radius: var(--dsw-radius-md);
      background: var(--dsw-alias-bg-layer-1);
    }
    
    .dmp-settings-input:focus-within {
      border-color: var(--dsw-alias-state-business-primary);
    }
    
    .dmp-settings-input input {
      width: 100%;
      padding: 0;
      color: var(--dsw-alias-label-primary);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-settings-input input::placeholder {
      color: var(--dsw-alias-label-secondary);
    }
    
    .dmp-settings-input-bad {
      border-color: var(--dsw-alias-state-error-primary);
    }
    
    /* What the panel writes and where the edits land. This is the one paragraph in
       the card with no control of its own, and it is the only place the panel says
       its edits are real rather than a local override — so it is held at the same
       secondary ink as every other explanatory line instead of the caption token
       (2.08:1 on this card in the light theme). */
    .dmp-settings-note {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      padding: 0 8px;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    
    .dmp-settings-note-icon {
      flex: 0 0 12px;
      margin-top: 2px;
    }
    
    .dmp-effort-item {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-height: 30px;
      padding: 4px 8px;
      border: none;
      border-radius: var(--dsw-radius-md);
      outline: none;
      background: transparent;
      color: inherit;
      font-size: 13px;
      line-height: 18px;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color 90ms var(--dmp-ease), color 90ms var(--dmp-ease);
    }
    
    .dmp-effort-item:hover:not(:disabled),
    .dmp-effort-item:focus-visible {
      background: var(--dsw-alias-interactive-bg-hover);
    }
    
    .dmp-effort-item:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-effort-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-effort-check {
      display: grid;
      place-items: center;
      flex: 0 0 14px;
      color: var(--dsw-alias-label-primary);
    }
    
    .dmp-effort-check svg {
      width: 14px;
      height: 14px;
      animation: dmp-check-in 180ms var(--dmp-ease);
    }
    
    /* The two-pane card collapses into ONE column when the viewport can no longer
       hold both panes at their floors: the rail's 176px plus the 320px the model
       column needs, plus the card's own 4px of padding either side, means the panes
       stop fitting below a 505px card — and the card is 100vw - 32px below a 552px
       viewport, so 536px is where that happens.
       The rail becomes a horizontal strip ABOVE the list rather than disappearing:
       the scope stays visible and changeable at every width, which is the whole point
       of having put it in the card. Same DOM, same roles, same keys — only the
       flex direction changes, so nothing has to be tested twice. */
    @media (max-width: 536px) {
      .dmp-card {
        flex-direction: column;
      }
    
      .dmp-rail {
        flex: 0 0 auto;
        flex-direction: row;
        gap: 2px;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0 0 4px;
        border-right: none;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
    
      /* A row becomes a chip: it sizes to its own content instead of filling the
         pane, and the name stops being the elastic half. */
      .dmp-rail-row {
        width: auto;
        flex: 0 0 auto;
        padding: 0 8px;
      }
    
      .dmp-rail-copy {
        flex: 0 0 auto;
      }
    
      .dmp-rail-name {
        flex: 0 0 auto;
        max-width: 132px;
      }
    
      .dmp-models {
        padding-left: 0;
      }
    }
    
    @media (max-width: 480px) {
      .dmp-menu {
        width: calc(100vw - 24px);
      }
    
      .dmp-settings {
        width: calc(100vw - 24px);
      }
    }
    
    /* Keyboard cycling scrolls the highlight into view; smooth only when the user
       has not asked the system to calm down. The media gate keeps the two motion
       preferences from disagreeing with each other. */
    @media (prefers-reduced-motion: no-preference) {
      .dmp-groups {
        scroll-behavior: smooth;
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .dmp-trigger,
      .dmp-settings-button,
      .dmp-row,
      .dmp-rail-row,
      .dmp-effort-item,
      .dmp-search-clear,
      .dmp-retry,
      .dmp-filter-clear,
      .dmp-settings-reset {
        transition: none;
      }
    
      .dmp-trigger:active:not(:disabled),
      .dmp-settings-button:active:not(:disabled) {
        transform: none;
      }
    
      .dmp-chevron {
        transition: none;
      }
    
      .dmp-menu-in {
        animation: none;
      }
    
      .dmp-check svg,
      .dmp-effort-check svg,
      .dmp-search-clear {
        animation: none;
      }
    }
    `;
    function injectStyles() {
      if (typeof document === "undefined") return () => {
      };
      document.getElementById(STYLE_ELEMENT_ID3)?.remove();
      const element = document.createElement("style");
      element.id = STYLE_ELEMENT_ID3;
      element.textContent = CSS3;
      document.head.append(element);
      return () => {
        if (element.isConnected) element.remove();
      };
    }
    
    // src/client/index.ts
    var inject = ["slots", "sessions", "modelDirectories", "remote", "remote.session"];
    function settingsFaceOf(scope) {
      return () => {
        const settings = scope.get("remote.settings");
        const llm = scope.get("remote.llm");
        if (typeof settings?.describe !== "function" || typeof settings.mutate !== "function") return null;
        if (typeof llm?.listConfigurableProviders !== "function") return null;
        return { settings, llm };
      };
    }
    function registerAdapterCatalogs(ctx, capabilities) {
      for (const catalog of ADAPTER_CATALOGS) {
        capabilities.addSource({
          providers: catalog.providers,
          // The namespace is resolved per READ, not captured here: the Remote
          // namespaces mount asynchronously, so a capture at activation would make
          // the facts depend on plugin activation order.
          read: () => readCatalog(ctx, catalog.namespace)
        });
      }
    }
    var MODEL_CONFIG_SECTION_ID = "rabbit-model-config";
    function modelConfigFacesOf(ctx) {
      const settings = ctx.get("remote.settings");
      const llm = ctx.get("remote.llm");
      if (typeof settings?.describe !== "function" || typeof settings.mutate !== "function") return null;
      if (typeof llm?.listConfigurableProviders !== "function") return null;
      const credentials = ctx.get("remote.credentials");
      const session = ctx.get("remote.session");
      const remote = ctx.get("remote");
      return {
        settings,
        llm,
        ...credentials === void 0 ? {} : { credentials },
        ...session === void 0 ? {} : { session },
        ...typeof remote?.$on !== "function" ? {} : { on: (event, listener) => remote.$on(event, listener) }
      };
    }
    function apply(ctx) {
      const locale = ctx.get("locale");
      const translate = locale === void 0 ? localTranslate() : locale.bind(NS);
      const allDictionaries = {
        zh: { ...dictionaries.zh, ...dictionaries2.zh },
        en: { ...dictionaries.en, ...dictionaries2.en }
      };
      if (locale !== void 0) {
        ctx.effect(() => locale.register(NS, allDictionaries), "dsh-rabbit-model-picker: dictionaries");
      }
      ctx.effect(() => injectStyles(), "dsh-rabbit-model-picker: styles");
      ctx.effect(() => retireStoredScope(), "dsh-rabbit-model-picker: retired scope record");
      const capabilities = new CapabilityStore(
        () => ctx.get("remote.llm") ?? null
      );
      registerAdapterCatalogs(ctx, capabilities);
      ctx.inject(["slots", "sessions", "modelDirectories", "remote", "remote.session"], (scope) => {
        const models = scope.modelDirectories;
        const sessions = scope.sessions;
        const params = new ParamsStore(settingsFaceOf(scope));
        scope.slots.inject("conversation.input.model", () => scope.slots.register({
          name: "conversation.input.model",
          // Ascending rank, lowest renders: -10 shadows the shipped seat at 0.
          priority: -10,
          // Declaring the namespace puts the framework `t` seat on the component;
          // without a locale face the inject face carries the local translator.
          ...locale === void 0 ? {} : { locale: NS },
          inject: (sessionId) => {
            const directory = models.directoryFor(sessionId);
            const available = sessions.subagentAddress(sessionId) === void 0;
            return {
              available,
              sessionId,
              directory: directory.store,
              params,
              capabilities,
              translate,
              load: () => {
                if (available) directory.load().catch(() => {
                });
              },
              select: (selection) => available ? directory.select(selection) : Promise.resolve(void 0)
            };
          }
        }, Picker));
      });
      const modelConfig = new ModelConfigStore(() => modelConfigFacesOf(ctx));
      const configT = configTranslate(locale === void 0 ? void 0 : translate);
      ctx.effect(() => modelConfig.start(), "dsh-rabbit-model-picker: model config invalidation");
      ctx.inject(["slots"], (scope) => {
        scope.slots.inject("settings.section", () => scope.slots.register({
          name: "settings.section",
          id: MODEL_CONFIG_SECTION_ID,
          // Immediately after the shipped 模型 page, which registers at order 10.
          order: 11,
          // A thunk, not a string: the shell re-reads it on every locale revision, so
          // the nav row follows a language change without re-registering.
          label: () => configT(KEYS["config.nav"]),
          inject: () => ({ store: modelConfig, t: configT })
        }, ModelConfigPage));
      });
    }
    
    return module.exports;
  },
});
