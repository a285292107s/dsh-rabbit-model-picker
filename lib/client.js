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
      "badge.effort.on": "支持思考",
      "badge.effort.off": "不支持思考",
      "badge.context": "上下文窗口 {value}",
      "badge.rowAria": "{model}，{facts}",
      // The key to the strip's four columns, read once per card (see §5.24). One
      // short noun per fact, in the same order the columns are drawn: the words name
      // the columns so the row's glyphs do not have to be learned by hovering.
      "badge.key.text": "文字",
      "badge.key.image": "图片",
      "badge.key.effort": "思考",
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
      "settings.unavailable": "这个部署没有挂载设置服务，参数面板只能查看（思考强度仍可用）。",
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
      "settings.effort.title": "思考强度",
      "settings.note": "输入类型与上下文窗口会直接写进适配器对这个模型的声明，立即生效，与「设置 → 模型」页改的是同一处；思考强度是会话级设置，不写进声明。"
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
    function isRecord(value) {
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
        if (!isRecord(node)) return void 0;
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
        const index = models.findIndex((entry) => isRecord(entry) && entry.id === model);
        if (index >= 0) return [...scope, "models", String(index)];
      }
      const overrides = getPath(value, [...scope, "modelOverrides"]);
      if (isRecord(overrides) && isRecord(overrides[model])) return [...scope, "modelOverrides", model];
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
      if (!isRecord(entry)) return null;
      const inputField = inputFieldOf(entry, provider.settingsNs);
      const input = stringList(entry[inputField]);
      const contextWindow = numberOrUndefined(entry.contextWindow);
      const maxTokens = numberOrUndefined(entry.maxTokens);
      const defaultContextWindow = numberOrUndefined(getPath(view.value, [...scope, "defaultContextWindow"]));
      const defaultInput = stringList(getPath(view.value, [...scope, "defaultInput"]));
      const userEntry = getPath(view.user, entryPath);
      const declared = isRecord(userEntry) && (userEntry.contextWindow !== void 0 || userEntry[inputField] !== void 0);
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
    
    // src/client/Picker.tsx
    var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react2 = require("react");
    var import_react_dom2 = require("react-dom");
    
    // src/client/BadgeIcons.tsx
    var import_jsx_runtime = require("react/jsx-runtime");
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
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.4 2.5 H8.5 L12 6 V12.1 A1.4 1.4 0 0 1 10.6 13.5 H5.4 A1.4 1.4 0 0 1 4 12.1 V3.9 A1.4 1.4 0 0 1 5.4 2.5 Z" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 2.5 V6 H12" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 9 H9.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 11 H9.5" })
          ] });
        case "image":
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.75 8 C4.6 4.8 6.5 3.5 8 3.5 C9.5 3.5 11.4 4.8 13.25 8 C11.4 11.2 9.5 12.5 8 12.5 C6.5 12.5 4.6 11.2 2.75 8 Z" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "1.6" })
          ] });
        case "effort":
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: BRAIN.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: path }, path)) });
        case "context":
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.75", y: "3.75", width: "10.5", height: "8.5", rx: "1.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.75 6.5 H13.25" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.1 8.9 H10.9" })
          ] });
      }
    }
    function BadgeIcon({ fact, size = 14, className }) {
      const brain = fact === "effort";
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
    function capacityOf(address, capability) {
      return address?.contextWindow ?? capability?.contextWindow ?? address?.defaultContextWindow;
    }
    function badgeSpecsOf({ address, capability, reasoning, t }) {
      const specs = [];
      const modalities = modalitiesOf(address, capability);
      const text = modalities === void 0 || modalities.includes("text");
      specs.push({
        fact: "text",
        off: !text,
        value: "",
        sentence: t(text ? "badge.text.on" : "badge.text.off")
      });
      const image = modalities !== void 0 && modalities.includes("image");
      specs.push({
        fact: "image",
        off: !image,
        value: "",
        sentence: t(image ? "badge.image.on" : "badge.image.off")
      });
      if (reasoning === void 0) {
        specs.push({ fact: "effort", off: true, value: "", sentence: t("badge.effort.off") });
      } else {
        specs.push({ fact: "effort", off: false, value: "", sentence: t("badge.effort.on") });
      }
      const capacity = capacityOf(address, capability);
      if (capacity !== void 0) {
        const value = formatWindow(capacity);
        if (value !== "") {
          specs.push({ fact: "context", off: false, value, sentence: t("badge.context", { value }) });
        }
      }
      return specs;
    }
    
    // src/client/effort.ts
    function effortLabelOf(reasoning, effort, t) {
      if (effort === void 0) return t("effort.providerDefault");
      return reasoning.efforts.find((level) => level.id === effort)?.name ?? effort;
    }
    function effortChoicesOf(reasoning, t) {
      return [
        ...reasoning.defaultEffort === void 0 ? [{ key: "provider-default", effort: void 0, label: t("effort.providerDefault") }] : [],
        ...reasoning.efforts.map((level) => ({ key: `effort:${level.id}`, effort: level.id, label: level.name }))
      ];
    }
    
    // src/client/ProviderRail.tsx
    var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_jsx_runtime2 = require("react/jsx-runtime");
    function ProviderRail({
      options,
      current,
      stopIndex,
      busy,
      t,
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
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          className: "dmp-rail",
          role: "listbox",
          "aria-label": t("provider.group"),
          onKeyDown,
          children: options.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmp-rail-copy", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmp-rail-name", children: option.label }) }),
                option.failed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmp-provider-failed", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmp-provider-failed-dot", "aria-hidden": "true" }),
                  t("provider.failed")
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmp-provider-count", children: option.count }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmp-check", children: option.id === current ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : null })
              ]
            },
            option.id ?? "all"
          ))
        }
      );
    }
    
    // src/client/SettingsMenu.tsx
    var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react = require("react");
    var import_react_dom = require("react-dom");
    
    // src/client/panelCopy.ts
    function modalityLabel(modalities, t) {
      return modalities.map((modality) => modality === "text" ? t("settings.input.text") : modality === "image" ? t("settings.input.image") : modality === "audio" ? t("settings.input.audio") : modality === "video" ? t("settings.input.video") : modality === "pdf" ? t("settings.input.pdf") : modality).join(t("settings.listJoin"));
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
    function inputHintOf(state, t) {
      const address = state.address;
      const published = publishedInputOf(state.capability);
      if (address !== null && address.input.length > 0) {
        return noticeOf(state) === null ? { key: "settings.input.declared", params: { list: modalityLabel(address.input, t) } } : null;
      }
      if (published !== void 0) {
        return { key: "settings.input.capability", params: { list: modalityLabel(published, t) } };
      }
      if (noticeOf(state) !== null) return null;
      if (address === null) return null;
      if (address.defaultInput.length > 0) {
        return { key: "settings.input.default", params: { list: modalityLabel(address.defaultInput, t) } };
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
    var import_jsx_runtime3 = require("react/jsx-runtime");
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
      t,
      onSelect,
      onClose
    }) {
      const [capacityDraft, setCapacityDraft] = (0, import_react.useState)(null);
      const [capacityError, setCapacityError] = (0, import_react.useState)(false);
      const [writing, setWriting] = (0, import_react.useState)(false);
      const [writeError, setWriteError] = (0, import_react.useState)(null);
      const current = (0, import_react.useSyncExternalStore)(
        (subscribe) => directory.subscribe(subscribe),
        () => directory.getSnapshot().current
      );
      const snapshot = (0, import_react.useSyncExternalStore)(
        (subscribe) => params.subscribe(subscribe),
        () => params.getSnapshot()
      );
      const catalog = (0, import_react.useSyncExternalStore)(
        (subscribe) => capabilities.subscribe(subscribe),
        () => capabilities.getSnapshot()
      );
      const position = (0, import_dsh_client_ui_primitives2.useAnchoredPosition)({ open: true, anchorRef, panelRef, side, align: "end", gap: 8, margin: 12 });
      (0, import_react.useEffect)(() => {
        void params.refresh();
      }, [params]);
      const route = current === null ? null : { provider: current.provider, model: current.model };
      const address = (0, import_react.useMemo)(
        () => resolveRoute(snapshot, route),
        [snapshot, route?.provider, route?.model]
      );
      const capability = route === null ? null : catalog.routes[rowKey(route.provider, route.model)] ?? null;
      (0, import_react.useEffect)(() => {
        if (route !== null) capabilities.ensure([route.provider]);
      }, [capabilities, route?.provider]);
      const model = route === null ? null : modelOf(directory, route);
      const reasoning = model?.reasoning;
      const choices = (0, import_react.useMemo)(
        () => reasoning === void 0 ? [] : effortChoicesOf(reasoning, t),
        [reasoning, t]
      );
      const activeEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
      const modelLabel = model?.name ?? (route === null ? "" : `${route.provider}/${route.model}`);
      const copyState = { address, capability, snapshot, busy, capacityError };
      const noticeLine = noticeOf(copyState);
      const sectionNotice = noticeLine === null ? null : t(noticeLine.key, noticeLine.params);
      const inputHintLine = inputHintOf(copyState, t);
      const inputHint = inputHintLine === null ? null : [
        t(inputHintLine.key, inputHintLine.params),
        restoreIsEmpty(copyState) ? t("settings.resetNothing") : null
      ].filter((part) => part !== null).join(" ");
      const contextHintLine = contextHintOf(copyState);
      const contextHint = contextHintLine === null ? null : t(contextHintLine.key, contextHintLine.params);
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
      const tookFocus = (0, import_react.useRef)(false);
      (0, import_react.useLayoutEffect)(() => {
        if (position === null || tookFocus.current) return;
        tookFocus.current = true;
        panelRef.current?.focus();
      }, [position]);
      const addressId = address === null ? "" : `${address.ns}#${address.entryPath.join(".")}`;
      (0, import_react.useEffect)(() => {
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
          setWriteError(t("settings.input.needOne"));
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
      const notice = writeError !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-alert", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, { className: "dmp-settings-alert-icon" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("settings.writeFailed", { message: writeError }) })
      ] }) : sectionNotice === null ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-notice", children: sectionNotice });
      return (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          import_dsh_client_ui_primitives2.MenuSurface,
          {
            ref: panelRef,
            id: `${idPrefix}-settings`,
            className: position === null ? "dmp-menu dmp-settings" : `dmp-menu dmp-settings dmp-menu-in ${side === "top" ? "dmp-from-top" : "dmp-from-bottom"}`,
            style: position === null ? MEASURE_STYLE : { ...position, maxHeight },
            role: "group",
            "aria-label": t("settings.aria", { model: modelLabel }),
            "aria-busy": writing || busy,
            tabIndex: -1,
            onKeyDown,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmp-settings-title", children: modelLabel }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmp-settings-reset",
                    "aria-label": t("settings.resetAria", { model: modelLabel }),
                    disabled: !editable || address === null || !address.declared,
                    onClick: restoreDefaults,
                    children: t("settings.reset")
                  }
                )
              ] }),
              notice,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-body", children: [
                showsInputSection(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-label", children: t("settings.input.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmp-settings-name", children: t("settings.input.text") }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      import_dsh_client_ui_primitives2.Switch,
                      {
                        className: "dmp-settings-switch",
                        checked: shownInput.includes("text"),
                        label: t("settings.input.text"),
                        disabled: !editable,
                        onChange: (next) => {
                          toggleModality("text", next);
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmp-settings-name", children: t("settings.input.image") }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      import_dsh_client_ui_primitives2.Switch,
                      {
                        className: "dmp-settings-switch",
                        checked: shownInput.includes("image"),
                        label: t("settings.input.image"),
                        disabled: !editable,
                        onChange: (next) => {
                          toggleModality("image", next);
                        }
                      }
                    )
                  ] }),
                  inputHint !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-hint", children: inputHint })
                ] }),
                showsContextField(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-label", children: t("settings.context.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-row", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_dsh_client_ui_primitives2.Input,
                    {
                      className: capacityError ? "dmp-settings-input dmp-settings-input-bad" : "dmp-settings-input",
                      type: "text",
                      inputMode: "numeric",
                      disabled: !editable,
                      "aria-label": t("settings.context.title"),
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
                  contextHint !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-hint", children: contextHint })
                ] }),
                reasoning !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-label", children: t("settings.effort.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-effort-list", role: "radiogroup", "aria-label": t("settings.effort.title"), children: choices.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmp-effort-name", children: choice.label }),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmp-effort-check", children: choice.effort === activeEffort ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.IconCheckOutlineRegular, {}) : null })
                      ]
                    },
                    choice.key
                  )) })
                ] }),
                address !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmp-settings-target", title: `${address.ns} · ${address.entryPath.join(".")}`, children: t("settings.target", { ns: address.ns, path: address.entryPath.join(".") }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmp-settings-note", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.IconInfoOutlineRegular, { className: "dmp-settings-note-icon" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("settings.note") })
                ] })
              ] })
            ]
          }
        ),
        document.body
      );
    }
    
    // src/client/Picker.tsx
    var import_jsx_runtime4 = require("react/jsx-runtime");
    var MEASURE_STYLE2 = { visibility: "hidden", left: 0, top: 0 };
    function orderProviders(groups) {
      return groups.slice().sort((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
    }
    function Picker(props) {
      const { locked, available, directory, load, select, params, capabilities, translate, sessionId } = props;
      const t = props.t ?? translate;
      const state = (0, import_react2.useSyncExternalStore)(
        (subscribe) => directory.subscribe(subscribe),
        () => directory.getSnapshot()
      );
      const [open, setOpen] = (0, import_react2.useState)(false);
      const [query, setQuery] = (0, import_react2.useState)("");
      const [highlight, setHighlight] = (0, import_react2.useState)(null);
      const [providerFilter, setProviderFilter] = (0, import_react2.useState)(null);
      const [settingsAt, setSettingsAt] = (0, import_react2.useState)(false);
      const [settingsSide, setSettingsSide] = (0, import_react2.useState)("bottom");
      const [settingsBudget, setSettingsBudget] = (0, import_react2.useState)(void 0);
      const [selectionFocus, setSelectionFocus] = (0, import_react2.useState)(false);
      const [toast, setToast] = (0, import_react2.useState)(null);
      const toastSeq = (0, import_react2.useRef)(0);
      const rootRef = (0, import_react2.useRef)(null);
      const triggerRef = (0, import_react2.useRef)(null);
      const settingsButtonRef = (0, import_react2.useRef)(null);
      const settingsMenuRef = (0, import_react2.useRef)(null);
      const searchRef = (0, import_react2.useRef)(null);
      const menuRef = (0, import_react2.useRef)(null);
      const groupsRef = (0, import_react2.useRef)(null);
      const rowRefs = (0, import_react2.useRef)([]);
      const railRefs = (0, import_react2.useRef)([]);
      const lastActionRef = (0, import_react2.useRef)("load");
      const id = (0, import_react2.useId)();
      const [settingsSession, setSettingsSession] = (0, import_react2.useState)(sessionId);
      if (settingsAt && settingsSession !== sessionId) {
        setSettingsAt(false);
        setSettingsSession(sessionId);
      }
      const [scopeSession, setScopeSession] = (0, import_react2.useState)(sessionId);
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
      const orderedGroups = (0, import_react2.useMemo)(() => orderProviders(state.groups), [state.groups]);
      const catalogRows = (0, import_react2.useMemo)(() => orderedGroups.flatMap((group) => group.models.map((model) => ({ key: `${group.id}:${model.id}`, provider: group.id, model }))), [orderedGroups]);
      const selectedKey = state.current === null ? null : rowKey(state.current.provider, state.current.model);
      const currentRow = catalogRows.find((row) => rowKey(row.provider, row.model.id) === selectedKey) ?? null;
      const currentReasoning = currentRow?.model.reasoning;
      const effectiveEffort = state.current?.reasoningEffort ?? currentReasoning?.defaultEffort;
      const effortLabel = currentReasoning === void 0 ? state.retainedEffort : effortLabelOf(currentReasoning, effectiveEffort, t);
      const paramsSnapshot = (0, import_react2.useSyncExternalStore)(
        (subscribe) => params.subscribe(subscribe),
        () => params.getSnapshot()
      );
      const catalog = (0, import_react2.useSyncExternalStore)(
        (subscribe) => capabilities.subscribe(subscribe),
        () => capabilities.getSnapshot()
      );
      const declaredCurrent = resolveRoute(paramsSnapshot, state.current)?.declared === true;
      const specsByRow = (0, import_react2.useMemo)(() => {
        const map = /* @__PURE__ */ new Map();
        for (const row of catalogRows) {
          map.set(rowKey(row.provider, row.model.id), badgeSpecsOf({
            address: resolveRoute(paramsSnapshot, { provider: row.provider, model: row.model.id }),
            capability: catalog.routes[rowKey(row.provider, row.model.id)],
            // The row states only whether the model CAN reason (reasoning metadata
            // present or not); the effort in force is the trigger's and the panel's
            // subject, so it is not passed here.
            reasoning: row.model.reasoning,
            t
          }));
        }
        return map;
      }, [catalog, catalogRows, paramsSnapshot, t]);
      const trimmedQuery = query.trim();
      const providerLabel = (0, import_react2.useCallback)(
        (providerId, fallback) => providerId === "deepseek-account" ? t("provider.account") : fallback,
        [t]
      );
      const groups = (0, import_react2.useMemo)(() => {
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
      const modelCounts = (0, import_react2.useMemo)(() => new Map(
        orderedGroups.map((group) => [group.id, group.models.length])
      ), [orderedGroups]);
      const providerOptions = (0, import_react2.useMemo)(() => [
        {
          id: null,
          label: t("provider.all"),
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
      ], [catalogRows.length, modelCounts, orderedGroups, providerLabel, state.current, state.failures, t]);
      const providerNameOf = (0, import_react2.useCallback)(
        (providerId) => providerOptions.find((option) => option.id === providerId)?.label ?? providerLabel(providerId, providerId),
        [providerLabel, providerOptions]
      );
      const railStop = (0, import_react2.useMemo)(() => {
        const selected = providerOptions.findIndex((option) => option.id === providerFilter && !option.failed);
        if (selected >= 0) return selected;
        return providerOptions.findIndex((option) => !option.failed);
      }, [providerOptions, providerFilter]);
      const currentProviderId = state.current?.provider ?? null;
      const currentProviderLabel = currentProviderId === null ? null : providerNameOf(currentProviderId);
      const knownProviders = (0, import_react2.useMemo)(() => new Set(providerOptions.map((option) => option.id)), [providerOptions]);
      (0, import_react2.useEffect)(() => {
        if (providerFilter === null || state.status !== "ready") return;
        if (knownProviders.has(providerFilter)) return;
        setProviderFilter(currentProviderId);
      }, [currentProviderId, knownProviders, providerFilter, state.status]);
      const rows = (0, import_react2.useMemo)(() => groups.flatMap((group) => group.rows), [groups]);
      const indexOfRow = (0, import_react2.useMemo)(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
      const currentVisibleIndex = rows.findIndex((row) => row.provider === state.current?.provider && row.model.id === state.current.model);
      const activeIndex = rows.length === 0 ? -1 : Math.min(highlight ?? Math.max(0, currentVisibleIndex), rows.length - 1);
      const pending = state.pending;
      const busy = pending !== null;
      const elsewhereCount = (0, import_react2.useMemo)(() => {
        if (providerFilter === null || trimmedQuery === "") return 0;
        const matches = (0, import_dsh_client_ui_primitives3.rankByName)(catalogRows.map((row) => row.model), trimmedQuery).length;
        return Math.max(0, matches - rows.length);
      }, [catalogRows, providerFilter, rows.length, trimmedQuery]);
      const reload = () => {
        lastActionRef.current = "load";
        load();
      };
      (0, import_react2.useEffect)(() => {
        params.ensure();
      }, [params]);
      (0, import_react2.useEffect)(() => {
        if (!open) return;
        void params.refresh();
      }, [open, params]);
      (0, import_react2.useEffect)(() => {
        if (!open) return;
        capabilities.ensure(catalogRows.map((row) => row.provider));
      }, [capabilities, catalogRows, open]);
      (0, import_react2.useEffect)(() => {
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
      (0, import_react2.useEffect)(() => {
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
      (0, import_react2.useEffect)(() => {
        const viewport = groupsRef.current;
        if (viewport === null) return;
        return (0, import_dsh_client_ui_primitives3.observeStickyMenuGroups)(viewport);
      }, [available, open, groups]);
      (0, import_react2.useLayoutEffect)(() => {
        if (!open || menuPos === null) return;
        const active = document.activeElement;
        if (active instanceof Node && menuRef.current?.contains(active) === true) return;
        searchRef.current?.focus();
      }, [open, menuPos]);
      (0, import_react2.useLayoutEffect)(() => {
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
        showFailure(error.code === "session/writer-held" ? t("error.sessionInUse") : t("error.action", { message: `${error.code}: ${error.message}` }));
      };
      const submit = (selection) => {
        lastActionRef.current = "select";
        setSelectionFocus(true);
        triggerRef.current?.focus();
        void select(selection).then(settleSelection).catch((error) => {
          showFailure(t("error.action", { message: error instanceof Error ? error.message : String(error) }));
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
        const chain = [railRefs.current[railStop] ?? null, searchRef.current];
        rows.forEach((_row, index) => {
          chain.push(rowRefs.current[index] ?? null);
        });
        const elements = chain.filter(
          (element) => element !== null && !(element instanceof HTMLButtonElement && element.disabled)
        );
        if (elements.length === 0) return;
        const active = document.activeElement instanceof HTMLElement ? elements.indexOf(document.activeElement) : -1;
        const next = active === -1 ? delta > 0 ? 0 : elements.length - 1 : active + delta;
        if (next < 0) {
          close(true);
          return;
        }
        elements[next % elements.length]?.focus();
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
        { fact: "text", label: t("badge.key.text") },
        { fact: "image", label: t("badge.key.image") },
        { fact: "effort", label: t("badge.key.effort") },
        { fact: "context", label: t("badge.key.context") }
      ];
      const waiting = state.current === null && state.status === "loading";
      const modelName = waiting ? t("trigger.loading") : currentRow?.model.name ?? (state.current === null ? t("trigger.fallback") : state.current.model);
      const triggerLabel = currentProviderLabel === null ? modelName : `${currentProviderLabel}/${modelName}`;
      const triggerAria = waiting ? t("trigger.loading") : state.current === null || currentProviderLabel === null ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { provider: currentProviderLabel, model: modelName }) : t("trigger.ariaEffort", { provider: currentProviderLabel, model: modelName, effort: effortLabel });
      const settingsTitle = state.current === null ? t("settings.openNoModel") : declaredCurrent ? `${t("settings.open")} · ${t("settings.openDeclared")}` : t("settings.open");
      rowRefs.current = [];
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: triggerLabel, side: "top", align: "end", portal: true, disabled: open, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconDataOutlineRegular, { className: "dmp-trigger-icon", size: 16 }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-trigger-label", children: triggerLabel }),
                  !waiting && effortLabel !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-trigger-effort", children: effortLabel }),
                  busy ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconChevronDownOutlineRegular, { className: open ? "dmp-chevron dmp-chevron-open" : "dmp-chevron" })
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: settingsTitle, side: "top", align: "end", portal: true, disabled: settingsAt, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                ref: settingsButtonRef,
                type: "button",
                className: settingsAt ? "dmp-settings-button dmp-settings-open" : "dmp-settings-button",
                "aria-label": state.current === null ? t("settings.openNoModel") : t("settings.openAria", { model: modelName }),
                "aria-haspopup": "menu",
                "aria-expanded": settingsAt,
                "aria-controls": settingsAt ? `${id}-settings` : void 0,
                "data-edited": declaredCurrent ? "" : void 0,
                "data-selection-focus": settingsAt ? "" : void 0,
                disabled: locked || state.current === null,
                onClick: toggleSettings,
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconSettingsOutlineRegular, { className: "dmp-settings-icon", size: 16 })
              }
            ) }),
            open && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                import_dsh_client_ui_primitives3.MenuSurface,
                {
                  ref: menuRef,
                  id: `${id}-menu`,
                  className: menuPos === null ? "dmp-menu dmp-card" : "dmp-menu dmp-card dmp-menu-in dmp-from-top",
                  style: menuPos ?? MEASURE_STYLE2,
                  role: "group",
                  "aria-label": t("menu.aria"),
                  "aria-busy": state.status === "loading" || busy,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                      ProviderRail,
                      {
                        options: providerOptions,
                        current: providerFilter,
                        stopIndex: railStop,
                        busy,
                        t,
                        refs: railRefs,
                        onPick: pickProvider,
                        onEnterList: () => {
                          searchRef.current?.focus();
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-models", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-search-row", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          import_dsh_client_ui_primitives3.Input,
                          {
                            ref: searchRef,
                            className: query === "" ? "dmp-search" : "dmp-search dmp-search-with-query",
                            type: "text",
                            role: "searchbox",
                            "aria-label": t("search.placeholder"),
                            "aria-controls": `${id}-models`,
                            "aria-activedescendant": activeIndex < 0 ? void 0 : `${id}-row-${activeIndex}`,
                            placeholder: t("search.placeholder"),
                            value: query,
                            onChange: (event) => {
                              setQuery(event.target.value);
                              setHighlight(0);
                            }
                          }
                        ),
                        query !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "button",
                          {
                            type: "button",
                            className: "dmp-search-clear",
                            "aria-label": t("search.clear"),
                            disabled: busy,
                            onClick: () => {
                              setQuery("");
                              setHighlight(null);
                              searchRef.current?.focus();
                            },
                            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconCloseFillRegular, {})
                          }
                        )
                      ] }),
                      rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dmp-legend", role: "note", "aria-label": t("badge.keyAria"), children: legend.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dmp-legend-item", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-legend-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BadgeIcon, { fact: item.fact, className: "dmp-badge-icon" }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-legend-word", children: item.label })
                      ] }, item.fact)) }),
                      state.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-status", role: "status", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("status.loading") })
                      ] }),
                      elsewhereCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-filter-hint", role: "status", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("provider.elsewhere", { count: String(elsewhereCount) }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "button",
                          {
                            type: "button",
                            className: "dmp-filter-clear",
                            disabled: busy,
                            onClick: () => {
                              pickProvider(null);
                            },
                            children: t("provider.showAll")
                          }
                        )
                      ] }),
                      state.error !== null && lastActionRef.current === "load" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-error", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("error.action", { message: state.error }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t("action.reload") })
                      ] }),
                      state.failures.map((failure) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-warning", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("warning.groupLoad", {
                          name: providerLabel(failure.id, failure.name),
                          message: failure.message
                        }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t("action.reload") })
                      ] }, failure.id)),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                        "div",
                        {
                          ref: groupsRef,
                          id: `${id}-models`,
                          className: "dmp-groups scrollable",
                          role: "menu",
                          "aria-label": t("menu.model"),
                          hidden: rows.length === 0,
                          children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.MenuGroup, { label: group.label, children: group.rows.map((row) => {
                            const index = indexOfRow.get(row.key) ?? -1;
                            const selected = row.provider === state.current?.provider && row.model.id === state.current.model;
                            const specs = specsByRow.get(rowKey(row.provider, row.model.id)) ?? [];
                            const facts = specs.map((spec) => spec.sentence).join(t("settings.listJoin"));
                            const shown = specs.filter((spec) => !spec.off);
                            const shownByFact = new Map(shown.map((spec) => [spec.fact, spec]));
                            const rowPending = pending !== null && pending.provider === row.provider && pending.model === row.model.id;
                            return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                              "div",
                              {
                                ref: (element) => {
                                  rowRefs.current[index] = element;
                                },
                                id: `${id}-row-${index}`,
                                role: "menuitemradio",
                                "aria-checked": selected,
                                "aria-label": facts === "" ? row.model.name : t("badge.rowAria", { model: row.model.name, facts }),
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
                                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dmp-row-copy", children: [
                                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-row-name", title: row.model.name, children: row.model.name }),
                                    shown.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-badges", title: facts, "aria-hidden": "true", children: BADGE_FACTS.map((fact) => {
                                      const spec = shownByFact.get(fact);
                                      if (spec === void 0) {
                                        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-badge-slot" }, fact);
                                      }
                                      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                                        import_dsh_client_ui_primitives3.Tag,
                                        {
                                          tone: "neutral",
                                          className: "dmp-badge",
                                          children: [
                                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-badge-fact", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BadgeIcon, { fact: spec.fact, className: "dmp-badge-icon" }) }),
                                            spec.value !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-badge-value", children: spec.value })
                                          ]
                                        },
                                        spec.fact
                                      );
                                    }) })
                                  ] }),
                                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmp-check", children: rowPending ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : selected ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconCheckOutlineRegular, {}) : null })
                                ]
                              },
                              row.key
                            );
                          }) }, group.id))
                        }
                      ),
                      state.status === "ready" && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmp-empty", role: "status", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconDataOutlineRegular, { className: "dmp-empty-icon", size: 20, "aria-hidden": "true" }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: providerFilter !== null ? trimmedQuery === "" ? t("empty.provider") : t("empty.providerSearch") : catalogRows.length === 0 ? t("empty.models") : t("search.empty") })
                      ] })
                    ] })
                  ]
                }
              ),
              document.body
            ),
            settingsAt && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
                  t,
                  onSelect: (selection) => {
                    submit(selection);
                  },
                  onClose: closeSettings
                }
              ),
              document.body
            ),
            toast !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              import_dsh_client_ui_primitives3.Toast,
              {
                text: toast.text,
                icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, {}),
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
    var STYLE_ELEMENT_ID = "dsh-rabbit-model-picker-styles";
    var CSS = `
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
      document.getElementById(STYLE_ELEMENT_ID)?.remove();
      const element = document.createElement("style");
      element.id = STYLE_ELEMENT_ID;
      element.textContent = CSS;
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
    function apply(ctx) {
      const locale = ctx.get("locale");
      const translate = locale === void 0 ? localTranslate() : locale.bind(NS);
      if (locale !== void 0) {
        ctx.effect(() => locale.register(NS, dictionaries), "dsh-rabbit-model-picker: dictionaries");
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
    }
    
    return module.exports;
  },
});
