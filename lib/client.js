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
    
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);
    
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
    
    function rowKey(provider, model) {
      return `${provider}/${model}`;
    }
    
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
      constructor(llm) {
        this.llm = llm;
      }
      listeners = /* @__PURE__ */ new Set();
      sources = [];
      asked = /* @__PURE__ */ new Set();
      inflight = /* @__PURE__ */ new Set();
      unanswered = /* @__PURE__ */ new Set();
      requeue = /* @__PURE__ */ new Set();
      routes = {};
      snapshot = INITIAL_SNAPSHOT;
      directory = null;
      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      }
      getSnapshot() {
        return this.snapshot;
      }
      ensure(providers) {
        for (const provider of providers) {
          if (provider.length === 0) continue;
          if (this.asked.has(provider) && !this.unanswered.has(provider)) continue;
          this.asked.add(provider);
          this.unanswered.delete(provider);
          void this.read(provider);
        }
      }
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
      requeueRacingReader(provider) {
        if (!this.requeue.delete(provider)) return;
        this.asked.delete(provider);
        this.unanswered.delete(provider);
        this.ensure([provider]);
      }
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
      async providers(llm) {
        if (this.directory !== null) return this.directory;
        const result = await llm.listConfigurableProviders();
        if (!result.ok) throw new Error(result.error.message);
        this.directory = result.value;
        return result.value;
      }
      publish() {
        const next = { routes: { ...this.routes } };
        if (sameSnapshot(this.snapshot, next)) return;
        this.snapshot = next;
        for (const listener of this.listeners) listener();
      }
    };
    
    var NS = "dsh-rabbit-model-picker";
    var zh = {
      "provider.account": "DeepSeek 账号",
      "provider.all": "全部",
      "provider.group": "模型提供商",
      "provider.elsewhere": "其他提供商还有 {count} 个匹配",
      "provider.showAll": "显示全部",
      "provider.failed": "加载失败",
      "empty.provider": "该提供商没有可用模型。",
      "empty.providerSearch": "这个提供商里没有匹配的模型。",
      "trigger.fallback": "请选择模型",
      "trigger.loading": "正在加载模型…",
      "trigger.selectAria": "请选择模型",
      "trigger.aria": "选择模型，当前 {provider}/{model}",
      "trigger.ariaEffort": "选择模型，当前 {provider}/{model}，推理等级 {effort}",
      "menu.aria": "模型与推理等级",
      "menu.model": "模型",
      "card.subAll": "按提供商分组",
      "card.subScoped": "这个提供商的全部模型",
      "card.count": "{count} 个",
      "card.footTotal": "共 {count} 个模型",
      "card.footPart": "显示 {shown} / {total} 个模型",
      "card.footProviders": "{count} 个提供商",
      "card.railKeys": "数字键跳提供商",
      "search.placeholder": "搜索模型…",
      "search.clear": "清除搜索",
      "effort.providerDefault": "Default",
      "badge.text.on": "文字输入",
      "badge.text.off": "不支持文字输入",
      "badge.image.on": "图片输入",
      "badge.image.off": "不支持图片输入",
      "badge.effort.on": "支持推理",
      "badge.effort.off": "不支持推理",
      "badge.context": "上下文窗口 {value}",
      "badge.rowAria": "{model}，{facts}",
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
      "settings.scope": "只改这一个模型的参数",
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
      "settings.targetLabel": "写入位置",
      "settings.target": "{ns} · {path}",
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
      "card.subAll": "grouped by provider",
      "card.subScoped": "every model this provider offers",
      "card.count": "{count}",
      "card.footTotal": "{count} models in total",
      "card.footPart": "showing {shown} of {total} models",
      "card.footProviders": "{count} providers",
      "card.railKeys": "number keys jump providers",
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
      "settings.scope": "This model only",
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
      "settings.targetLabel": "Written to",
      "settings.target": "{ns} · {path}",
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
    
    var import_react3 = require("react");
    
    var KEYS = {
      "config.nav": "config.nav",
      "config.title": "config.title",
      "config.summary.ready": "config.summary.ready",
      "config.summary.attention": "config.summary.attention",
      "config.summary.none": "config.summary.none",
      "config.listheadState": "config.listheadState",
      "config.listheadAction": "config.listheadAction",
      "config.footCount": "config.footCount",
      "config.empty.title": "config.empty.title",
      "config.empty.description": "config.empty.description",
      "config.empty.hint": "config.empty.hint",
      "config.loadFailed": "config.loadFailed",
      "config.retry": "config.retry",
      "config.readOnly": "config.readOnly",
      "config.conflict": "config.conflict",
      "config.retryPolicy.trigger": "config.retryPolicy.trigger",
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
      "config.provider.label": "config.provider.label",
      "config.account.name": "config.account.name",
      "config.account.signedIn": "config.account.signedIn",
      "config.account.signedOut": "config.account.signedOut",
      "config.verdict.ready": "config.verdict.ready",
      "config.verdict.missingKey": "config.verdict.missingKey",
      "config.verdict.dormant": "config.verdict.dormant",
      "config.verdict.unavailable": "config.verdict.unavailable",
      "config.credential.configured": "config.credential.configured",
      "config.credential.missing": "config.credential.missing",
      "config.credential.configuredShort": "config.credential.configuredShort",
      "config.credential.missingShort": "config.credential.missingShort",
      "config.credential.label": "config.credential.label",
      "config.credential.session": "config.credential.session",
      "config.key.input": "config.key.input",
      "config.key.replace": "config.key.replace",
      "config.key.clear": "config.key.clear",
      "config.key.replaceShort": "config.key.replaceShort",
      "config.key.clearShort": "config.key.clearShort",
      "config.key.add": "config.key.add",
      "config.key.reveal": "config.key.reveal",
      "config.key.hide": "config.key.hide",
      "config.key.placeholder": "config.key.placeholder",
      "config.key.placeholderFallback": "config.key.placeholderFallback",
      "config.key.placeholderSaved": "config.key.placeholderSaved",
      "config.key.fallbackDetected": "config.key.fallbackDetected",
      "config.key.fallbackDetectedHidden": "config.key.fallbackDetectedHidden",
      "config.key.fallbackMissing": "config.key.fallbackMissing",
      "config.key.fallbackUnchecked": "config.key.fallbackUnchecked",
      "config.key.help": "config.key.help",
      "config.key.blank": "config.key.blank",
      "config.key.blankNew": "config.key.blankNew",
      "config.key.illegal": "config.key.illegal",
      "config.authHelp": "config.authHelp",
      "config.baseUrl.label": "config.baseUrl.label",
      "config.baseUrl.default": "config.baseUrl.default",
      "config.baseUrl.environment": "config.baseUrl.environment",
      "config.baseUrl.configured": "config.baseUrl.configured",
      "config.baseUrl.placeholder": "config.baseUrl.placeholder",
      "config.baseUrl.invalid": "config.baseUrl.invalid",
      "config.baseUrl.required": "config.baseUrl.required",
      "config.baseUrl.placeholderGateway": "config.baseUrl.placeholderGateway",
      "config.baseUrl.placeholderAnthropic": "config.baseUrl.placeholderAnthropic",
      "config.api.label": "config.api.label",
      "config.api.unset": "config.api.unset",
      "config.api.openaiCompletions": "config.api.openaiCompletions",
      "config.api.openaiResponses": "config.api.openaiResponses",
      "config.api.anthropicMessages": "config.api.anthropicMessages",
      "config.route.label": "config.route.label",
      "config.route.hint": "config.route.hint",
      "config.route.invalid": "config.route.invalid",
      "config.route.taken": "config.route.taken",
      "config.route.displayName": "config.route.displayName",
      "config.route.needsModels": "config.route.needsModels",
      "config.route.create": "config.route.create",
      "config.route.creating": "config.route.creating",
      "config.add": "config.add",
      "config.add.mode": "config.add.mode",
      "config.add.catalog": "config.add.catalog",
      "config.add.custom": "config.add.custom",
      "config.add.catalogHint": "config.add.catalogHint",
      "config.add.customHint": "config.add.customHint",
      "config.add.catalogExhausted": "config.add.catalogExhausted",
      "config.add.customUnavailable": "config.add.customUnavailable",
      "config.edit": "config.edit",
      "config.manage": "config.manage",
      "config.well.title": "config.well.title",
      "config.editProvider": "config.editProvider",
      "config.remove": "config.remove",
      "config.removeProvider": "config.removeProvider",
      "config.delete.title": "config.delete.title",
      "config.delete.description": "config.delete.description",
      "config.delete.descriptionWithCredential": "config.delete.descriptionWithCredential",
      "config.delete.confirm": "config.delete.confirm",
      "config.deleting": "config.deleting",
      "config.apply": "config.apply",
      "config.applying": "config.applying",
      "config.cancel": "config.cancel",
      "config.savedProvider": "config.savedProvider",
      "config.customized": "config.customized",
      "config.customTag": "config.customTag",
      "config.models.label": "config.models.label",
      "config.models.inherited": "config.models.inherited",
      "config.models.count": "config.models.count",
      "config.models.default": "config.models.default",
      "config.models.customized": "config.models.customized",
      "config.models.empty": "config.models.empty",
      "config.models.reset": "config.models.reset",
      "config.catalog.collapse": "config.catalog.collapse",
      "config.catalog.unsaved": "config.catalog.unsaved",
      "config.catalog.keepEditing": "config.catalog.keepEditing",
      "config.catalog.discard": "config.catalog.discard",
      "config.model.label": "config.model.label",
      "config.model.advanced": "config.model.advanced",
      "config.model.inputTypes": "config.model.inputTypes",
      "config.model.inputText": "config.model.inputText",
      "config.model.inputImage": "config.model.inputImage",
      "config.model.add": "config.model.add",
      "config.model.remove": "config.model.remove",
      "config.model.id": "config.model.id",
      "config.model.name": "config.model.name",
      "config.model.namePlaceholder": "config.model.namePlaceholder",
      "config.model.contextWindow": "config.model.contextWindow",
      "config.model.contextWindowPlaceholder": "config.model.contextWindowPlaceholder",
      "config.model.maxTokens": "config.model.maxTokens",
      "config.model.maxTokensPlaceholder": "config.model.maxTokensPlaceholder",
      "config.model.contextShort": "config.model.contextShort",
      "config.model.outputShort": "config.model.outputShort",
      "config.model.capacityDefault": "config.model.capacityDefault",
      "config.model.newLabel": "config.model.newLabel",
      "config.model.idRequired": "config.model.idRequired",
      "config.model.idDuplicate": "config.model.idDuplicate",
      "config.model.nameInvalid": "config.model.nameInvalid",
      "config.model.contextWindowInvalid": "config.model.contextWindowInvalid",
      "config.model.maxTokensInvalid": "config.model.maxTokensInvalid",
      "config.model.capacityInvalid": "config.model.capacityInvalid",
      "config.model.duplicate": "config.model.duplicate",
      "config.reasoning.label": "config.reasoning.label",
      "config.reasoning.level": "config.reasoning.level",
      "config.reasoning.value": "config.reasoning.value",
      "config.reasoning.help": "config.reasoning.help",
      "config.reasoning.helpText": "config.reasoning.helpText",
      "config.reasoning.needsLevel": "config.reasoning.needsLevel",
      "config.reasoning.valueRequired": "config.reasoning.valueRequired",
      "config.reasoning.add": "config.reasoning.add",
      "config.reasoning.remove": "config.reasoning.remove",
      "config.reasoning.off": "config.reasoning.off",
      "config.reasoning.offPlaceholder": "config.reasoning.offPlaceholder",
      "config.fetch.action": "config.fetch.action",
      "config.fetch.fetching": "config.fetch.fetching",
      "config.fetch.needsBaseUrl": "config.fetch.needsBaseUrl",
      "config.fetch.empty": "config.fetch.empty",
      "config.fetch.title": "config.fetch.title",
      "config.fetch.description": "config.fetch.description",
      "config.fetch.search": "config.fetch.search",
      "config.fetch.noMatches": "config.fetch.noMatches",
      "config.fetch.selectAll": "config.fetch.selectAll",
      "config.fetch.deselectAll": "config.fetch.deselectAll",
      "config.fetch.adopt": "config.fetch.adopt",
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
      "config.summary.attention": "{count} 个可用 · {issues} 个需要处理",
      "config.summary.none": "尚未添加任何提供商",
      "config.listheadState": "状态",
      "config.listheadAction": "操作",
      "config.footCount": "共 {count} 个提供商",
      "config.empty.title": "还没有提供商",
      "config.empty.description": "添加一个 API Key 即可开始使用；DeepSeek 官方模型只需一次登录。",
      "config.empty.hint": "密钥只保存在本机设置里",
      "config.loadFailed": "加载提供商目录失败",
      "config.retry": "重试",
      "config.readOnly": "当前部署的设置文档为只读。",
      "config.conflict": "这张卡片打开期间，这些设置已被其他地方改动。请关闭后重新打开，在当前值上编辑。",
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
      "config.well.title": "设置",
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
      "config.listheadState": "State",
      "config.listheadAction": "Action",
      "config.footCount": "{count} providers in total",
      "config.empty.title": "No providers yet",
      "config.empty.description": "Add one API key to begin; the official DeepSeek route only needs a sign-in.",
      "config.empty.hint": "Keys stay in the local settings",
      "config.loadFailed": "Loading the provider directory failed",
      "config.retry": "Retry",
      "config.readOnly": "The settings document is read-only in this deployment.",
      "config.conflict": "Someone else changed these settings while this card was open. Close it and reopen to edit the current values.",
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
      "config.well.title": "Settings",
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
    
    var import_react = require("react");
    
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
      constructor(face) {
        this.face = face;
      }
      listeners = /* @__PURE__ */ new Set();
      snapshot = INITIAL_SNAPSHOT2;
      inflight = null;
      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      }
      getSnapshot() {
        return this.snapshot;
      }
      ensure() {
        if (this.snapshot.status === "idle") void this.read();
      }
      refresh() {
        return this.read();
      }
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
      publish(snapshot) {
        if (sameSnapshot(this.snapshot, snapshot)) return;
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener();
      }
    };
    
    function formatWindow(tokens) {
      if (!Number.isFinite(tokens) || tokens <= 0) return "";
      if (tokens < 1e3) return String(Math.round(tokens));
      if (tokens < 1e6) {
        const thousands = Math.round(tokens / 1e3);
        return thousands >= 1e3 ? "1M" : `${thousands}K`;
      }
      return `${Math.round(tokens / 1e6)}M`;
    }
    function formatWindowStatement(raw, stored) {
      const text = raw.trim();
      if (text === "") return "";
      const digits = text.replace(/[\s_]/g, "").toUpperCase();
      const match = /^(\d+(?:\.\d+)?)([KM])?$/.exec(digits);
      if (match === null) return text;
      const scale = match[2] === "M" ? 1e6 : match[2] === "K" ? 1e3 : 1;
      const tokens = Math.round(Number(match[1]) * scale);
      return formatWindow(tokens) || formatWindow(stored ?? 0) || text;
    }
    
    var STYLE_ELEMENT_ID = "dsh-rabbit-model-picker-catalog-styles";
    var CSS = `
    .dmc-catalog-panel,
    .dmc-catalog-head,
    .dmc-catalog-foot,
    .dmc-model-row,
    .dmc-model-well,
    .dmc-btn,
    .dmc-model-input,
    .dmc-reasoning-value,
    .dmc-reasoning-level,
    .dmc-discover-search,
    .dmc-discover-check,
    .dmc-model-add {
      box-sizing: border-box;
    }
    
    .dmc-catalog-panel {
      grid-column: 2 / -1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
      margin: 0 0 14px;
      padding: 12px 16px 12px 14px;
      border-left: 1px solid var(--zmd-line-strong);
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmc-catalog-panel > * {
      position: relative;
      z-index: 1;
    }
    
    .dmc-catalog-head {
      min-width: 0;
    }
    
    .dmc-catalog-title {
      margin: 0;
      flex: 0 0 auto;
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
      color: var(--zmd-ink);
    }
    
    .dmc-catalog-status {
      flex: 0 0 auto;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-roster-count {
      flex: none;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    
    .dmc-btn {
      height: 26px;
      padding: 0 6px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      text-align: left;
      cursor: pointer;
      transition: background-color 120ms ease-out, color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-btn:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmc-btn:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-btn:disabled {
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .dmc-catalog-close {
      flex: none;
    }
    
    .dmc-catalog-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    
    .dmc-catalog-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 12px;
      padding-top: 10px;
    }
    
    .dmc-catalog-foot-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    
    .dmc-catalog-guard {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 2px 0 2px 10px;
      border-left: 2px solid var(--zmd-danger);
    }
    
    .dmc-catalog-guard-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .dmc-catalog-section {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-catalog-notice {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-catalog-error {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--zmd-ink);
      overflow-wrap: anywhere;
    }
    
    .dmc-catalog-note {
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--zmd-ink);
    }
    
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
      grid-template-columns: 26px minmax(0, 1fr) auto;
      column-gap: 10px;
      row-gap: 1px;
      align-items: center;
      min-height: 44px;
      padding: 8px 0;
      color: var(--zmd-ink);
      transition: background-color 120ms ease-out;
    }
    
    .dmc-model-row:hover,
    .dmc-model-row:focus-within {
      background: var(--zmd-hover);
    }
    
    .dmc-model-row[data-well='true'] {
      background: transparent;
    }
    
    .dmc-model-row[data-invalid='true']::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 2px;
      background: var(--zmd-danger);
    }
    
    .dmc-model-index {
      grid-column: 1;
      grid-row: 1;
      align-self: center;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-model-ref {
      grid-column: 2;
      grid-row: 1;
      min-width: 0;
      overflow: hidden;
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 20px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--zmd-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmc-model-sub {
      grid-column: 2 / -1;
      grid-row: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 2px 12px;
      min-width: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-model-alias {
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-model-facts {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 2px 12px;
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-model-fact {
      color: var(--zmd-ink-mute);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    
    .dmc-model-edit {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      height: 26px;
      padding: 0 8px;
    }
    
    .dmc-model-well {
      grid-column: 1 / -1;
      grid-row: 3;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      margin: 6px 0 2px;
      padding: 12px 12px 12px 10px;
      border-left: 1px solid var(--zmd-line-strong);
      background: transparent;
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
      gap: 2px;
      min-width: 0;
    }
    
    .dmc-model-label {
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-model-input,
    .dmc-reasoning-value,
    .dmc-reasoning-level,
    .dmc-discover-search {
      min-width: 0;
      height: 32px;
      padding: 0 2px;
      border: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmc-model-input:focus,
    .dmc-model-input:focus-visible,
    .dmc-reasoning-value:focus,
    .dmc-reasoning-value:focus-visible,
    .dmc-reasoning-level:focus,
    .dmc-reasoning-level:focus-visible,
    .dmc-discover-search:focus,
    .dmc-discover-search:focus-visible {
      border-bottom-color: var(--zmd-accent);
      outline: 0;
    }
    
    .dmc-reasoning-level {
      padding-right: 22px;
    }
    
    .dmc-model-input::placeholder,
    .dmc-reasoning-value::placeholder,
    .dmc-discover-search::placeholder {
      color: var(--zmd-ink-mute);
    }
    
    .dmc-model-input[data-invalid='true'] {
      border-bottom-color: var(--zmd-danger);
    }
    
    .dmc-model-error {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--zmd-ink);
      overflow-wrap: anywhere;
    }
    
    .dmc-model-danger {
      align-self: flex-start;
      height: 26px;
      padding: 0 6px;
      font-size: 12px;
    }
    
    .dmc-model-add {
      align-self: flex-start;
      height: 32px;
      padding: 0 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      text-align: left;
      text-decoration: underline;
      text-decoration-color: transparent;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
      cursor: pointer;
      transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out;
    }
    
    .dmc-model-add:hover:not(:disabled) {
      text-decoration-color: var(--zmd-accent);
    }
    
    .dmc-reasoning {
      display: flex;
      flex-direction: column;
      gap: 6px;
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
    
    .dmc-reasoning-remove {
      align-self: center;
      justify-self: end;
      height: 26px;
      font-size: 12px;
      font-weight: 500;
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
      max-width: 62ch;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-discover-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    .dmc-discover,
    .dmc-discover-adopt,
    .dmc-discover-tool {
      flex: none;
    }
    
    .dmc-discover-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--zmd-line);
    }
    
    .dmc-discover-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    .dmc-discover-list {
      display: flex;
      flex-direction: column;
      max-height: 360px;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    
    .dmc-discover-group {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    
    .dmc-discover-candidate {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      padding: 0;
      color: var(--zmd-ink);
    }
    
    .dmc-discover-candidate[data-present='true'] {
      color: var(--zmd-ink-mute);
    }
    
    .dmc-discover-label {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    
    .dmc-discover-check {
      flex: none;
      display: inline-grid;
      place-content: center;
      width: 14px;
      height: 14px;
      margin: 0;
      padding: 0;
      border: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    
    .dmc-discover-check::after {
      content: '';
      display: none;
      width: 4px;
      height: 7px;
      transform: translateY(-1px) rotate(45deg);
    }
    
    .dmc-discover-check:checked {
      border-color: var(--zmd-ink);
      background: var(--zmd-ink);
    }
    
    .dmc-discover-check:checked::after {
      display: block;
      border-right: 2px solid var(--zmd-on-ink);
      border-bottom: 2px solid var(--zmd-on-ink);
      animation: dmc-check-in 160ms var(--zmd-ease) both;
    }
    
    .dmc-discover-check:disabled {
      border-color: var(--zmd-line);
      background: transparent;
      cursor: default;
    }
    
    .dmc-discover-check:disabled::after {
      display: none;
    }
    
    .dmc-discover-id {
      font-size: 14px;
      line-height: 22px;
      overflow-wrap: anywhere;
    }
    
    .dmc-discover-name {
      flex: 0 1 auto;
      min-width: 0;
      font-size: 12px;
      line-height: 18px;
      text-align: right;
      color: var(--zmd-ink-mute);
      overflow-wrap: anywhere;
    }
    
    .dmc-btn:focus-visible,
    .dmc-model-edit:focus-visible,
    .dmc-model-danger:focus-visible,
    .dmc-model-add:focus-visible,
    .dmc-discover-check:focus-visible {
      outline: 2px solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @container (max-width: 484px) {
      .dmc-catalog-head {
        flex-wrap: wrap;
      }
    }
    
    @container (max-width: 360px) {
      .dmc-catalog-panel {
        grid-column: 1 / -1;
        gap: 12px;
        padding: 10px 12px;
      }
    
      .dmc-catalog-head {
        flex-wrap: wrap;
      }
    
      .dmc-roster-count {
        display: none;
      }
    
      .dmc-btn,
      .dmc-model-add,
      .dmc-model-edit {
        height: 40px;
        min-height: 40px;
      }
    
      .zmd-btn-primary,
      .dmc-model-input,
      .dmc-reasoning-value,
      .dmc-reasoning-level,
      .dmc-discover-search {
        height: 40px;
      }
    
      .dmc-model-row {
        grid-template-columns: minmax(0, 1fr) auto;
      }
    
      .dmc-model-index {
        display: none;
      }
    
      .dmc-model-ref {
        grid-column: 1;
        grid-row: 1;
      }
    
      .dmc-model-edit {
        grid-column: 2;
        grid-row: 1;
      }
    
      .dmc-model-sub {
        grid-column: 1 / -1;
        grid-row: 2;
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
    
    @media (prefers-reduced-motion: reduce) {
      .zmd-btn-primary,
      .dmc-btn,
      .dmc-model-add {
        transition: none;
      }
    
      .zmd-btn-primary:active:not(:disabled),
      .dmc-btn:active:not(:disabled),
      .dmc-model-edit:active,
      .dmc-model-danger:active:not(:disabled) {
        transform: none;
      }
    
      .dmc-discover-check:checked::after {
        animation: none;
      }
    }
    
    @keyframes dmc-check-in {
      from { transform: translateY(-1px) rotate(45deg) scale(0.6); }
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
      const catalogHead = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-head zmd-runhead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "dmc-catalog-title", children: t2(KEYS["config.models.label"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-catalog-status", children: storedModels.length > 0 ? t2(KEYS["config.models.customized"]) : t2(KEYS["config.models.inherited"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-rule", "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-roster-count zmd-num", children: t2(KEYS["config.models.count"], { count: String(models.length) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn dmc-catalog-close", onClick: onRequestClose, children: t2(KEYS["config.catalog.collapse"]) })
      ] });
      const guardLine = props.confirming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-guard", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.catalog.unsaved"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-guard-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn", onClick: props.onKeepEditing, children: t2(KEYS["config.catalog.keepEditing"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn", onClick: props.onDiscard, children: t2(KEYS["config.catalog.discard"]) })
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
      const modelRow = (model, position) => {
        const message = problems.get(model.key);
        const wellId = `dmc-model-well-${model.key}`;
        const used = new Set(model.reasoning.map((entry) => entry.level));
        const disabled = !writable || busy;
        const alias = model.name.trim();
        const context = formatWindowStatement(model.contextWindow, model.storedWindow);
        const output = formatWindowStatement(model.maxTokens, model.storedTokens);
        const manifestIndex = String(position).padStart(2, "0");
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "li",
          {
            className: "dmc-model-row",
            "data-key": model.key,
            "data-invalid": message === void 0 ? void 0 : "true",
            "data-well": model.open ? "true" : void 0,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-index zmd-ordinal", "aria-hidden": "true", children: manifestIndex }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-ref", title: model.id === "" ? void 0 : model.id, children: model.id === "" ? t2(KEYS["config.model.newLabel"]) : model.id }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-model-edit zmd-btn-quiet",
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
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dmc-model-facts", children: [
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
                  context === "" && output === "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-model-fact", children: t2(KEYS["config.model.capacityDefault"]) }) : null
                ] })
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
                        className: "zmd-btn-danger dmc-reasoning-remove",
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
                      className: "dmc-btn dmc-reasoning-add zmd-btn-quiet",
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
                    className: "dmc-model-danger zmd-btn-danger",
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dmc-model-list", children: models.map((model, index) => modelRow(model, index + 1)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmc-btn dmc-model-add", disabled: !writable || busy, onClick: addModel, children: t2(KEYS["config.model.add"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-discover-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-door dmc-discover",
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
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "dmc-catalog-section zmd-runhead", children: [
            t2(KEYS["config.fetch.title"]),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-rule", "aria-hidden": "true" })
          ] }),
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
                className: "dmc-btn dmc-discover-tool zmd-btn-quiet",
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
                className: "dmc-btn dmc-discover-tool zmd-btn-quiet",
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
              className: "dmc-btn dmc-discover-adopt zmd-btn-door",
              disabled: !writable || busy || selectedAddable.length === 0,
              onClick: () => {
                void adopt();
              },
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.fetch.adopt"])
            }
          ) })
        ] }) : null
      ] });
      const foot = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-catalog-foot zmd-footing", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-footing-note", children: t2(KEYS["config.models.count"], { count: String(models.length) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dmc-catalog-foot-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "dmc-btn zmd-btn-quiet",
              disabled: !writable || busy || !canReset,
              onClick: () => {
                void reset();
              },
              children: t2(KEYS["config.models.reset"])
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-primary",
              disabled: !writable || busy || !dirty || invalid,
              onClick: save,
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.apply"])
            }
          )
        ] }),
        note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-catalog-note", children: note })
      ] });
      return panel(body, foot);
    }
    
    var import_react2 = require("react");
    
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
        ...retryableCodes === void 0 || retryableCodes.length === 0 ? {} : { retryableCodes },
        backoff: {
          initialDelayMs: Math.min(view.initialDelayMs, maxDelayMs),
          maxDelayMs,
          jitterRatio: view.jitterRatio
        }
      };
    }
    
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
        return { retries, first: backoff.initialDelayMs, longest: waitRange(waits, view.jitterRatio).high, waits };
      }, [parsedCap, parsedRetries, view.initialDelayMs, view.jitterRatio, view.maxDelayMs, view.maxRetries]);
      const backoffTicks = (0, import_react2.useMemo)(() => {
        const shown = preview.waits.slice(0, 5);
        if (shown.length === 0) return [];
        const peak = Math.max(...shown, 1);
        return shown.map((wait) => Math.min(4, Math.max(1, Math.ceil(wait / peak * 4))));
      }, [preview.waits]);
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
      const firstWait = t2(KEYS["config.retryPolicy.first"], { count: formatDuration(preview.first) });
      const longestTotal = t2(KEYS["config.retryPolicy.total"], { count: formatDuration(preview.longest) });
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry", id: `dmc-retry-${provider}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "dmc-retry-state zmd-runhead", children: [
          t2(view.declared ? KEYS["config.retryPolicy.declared"] : KEYS["config.retryPolicy.inherits"]),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "zmd-rule", "aria-hidden": "true" })
        ] }),
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "dmc-retry-summary", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-retry-tally", children: preview.retries }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-retry-tally-unit", children: t2(KEYS["config.retryPolicy.retriesUnit"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-retry-detail", children: [
            firstWait,
            " · ",
            longestTotal
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-backoff", "aria-hidden": "true", children: Array.from({ length: 5 }, (_, index) => {
          const level = backoffTicks[index];
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "span",
            {
              className: "dmc-backoff-cell",
              "data-level": level === void 0 ? "0" : String(level)
            },
            String(index)
          );
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-retry-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-door zmd-btn-commit",
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
              className: "zmd-btn-quiet",
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
    
    var STYLE_ELEMENT_ID2 = "dsh-rabbit-model-picker-model-config-styles";
    var CSS2 = `
    .dmc-page {
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: 0;
      max-width: 560px;
      padding-bottom: 8px;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmc-page > * {
      position: relative;
      z-index: 1;
    }
    
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
    .dmc-retry-input,
    .dmc-well,
    .dmc-backoff-cell {
      box-sizing: border-box;
    }
    
    .dmc-head {
      padding: 20px 16px 14px;
      border-bottom: 1px solid var(--zmd-line);
    }
    
    .dmc-readout {
      margin: 0;
    }
    
    .dmc-meta {
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-empty {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      max-width: 52ch;
      padding: 16px;
    }
    
    .dmc-empty-lead {
      margin: 0;
      color: var(--zmd-ink);
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
    }
    
    .dmc-empty-copy {
      margin: 0;
      color: var(--zmd-ink-secondary);
      font-size: 14px;
      line-height: 22px;
      text-wrap: pretty;
    }
    
    .dmc-notice {
      margin: 0;
      padding: 0 16px 8px;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-notice-action {
      margin-left: 8px;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      text-decoration: underline;
      text-decoration-color: transparent;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
      cursor: pointer;
      transition: color 120ms ease-out, background-color 120ms ease-out, text-decoration-color 120ms ease-out;
    }
    
    .dmc-notice-action:hover {
      background: var(--zmd-hover);
      text-decoration-color: var(--zmd-accent);
    }
    
    .dmc-alert {
      margin: 0 16px 8px;
      padding: 2px 0 2px 10px;
      border-left: 2px solid var(--zmd-danger);
      color: var(--zmd-ink);
    }
    
    .dmc-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 14px;
      padding: 10px 16px 0;
    }
    
    .dmc-actions .dmc-add {
      height: 32px;
      padding: 0 14px;
      border: 1px solid var(--zmd-line-control);
      color: var(--zmd-ink);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
    }
    
    .dmc-actions .dmc-add:hover:not(:disabled) {
      border-color: var(--zmd-ink-mute);
      background: var(--zmd-hover);
      text-decoration: none;
    }
    
    .dmc-actions .dmc-add:disabled {
      border-color: var(--zmd-line);
      color: var(--zmd-ink-mute);
    }
    
    .dmc-add[data-emphasis='primary'] {
      height: 32px;
      padding: 0 16px;
      border: 0;
      background: var(--zmd-ink);
      color: var(--zmd-on-ink);
    }
    
    .dmc-add[data-emphasis='primary']:hover:not(:disabled) {
      background: var(--zmd-ink-secondary);
      text-decoration: none;
    }
    
    .dmc-add[data-emphasis='primary']:disabled {
      background: var(--zmd-hover);
      color: var(--zmd-ink-mute);
    }
    
    .dmc-add {
      display: inline-flex;
      align-items: center;
      height: 40px;
      padding: 0 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      text-align: left;
      text-wrap: pretty;
      text-decoration: underline;
      text-decoration-color: transparent;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
      cursor: pointer;
      transition: background-color 120ms ease-out, text-decoration-color 120ms ease-out, transform 80ms linear;
    }
    
    .dmc-add:hover:not(:disabled) {
      text-decoration-color: var(--zmd-accent);
    }
    
    .dmc-add:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmc-add:disabled {
      color: var(--zmd-ink-mute);
      text-decoration-color: transparent;
      cursor: default;
    }
    
    .dmc-picker {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 16px 0;
    }
    
    .dmc-picker-list {
      display: flex;
      flex-direction: column;
      max-height: 320px;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    
    .dmc-picker-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-height: 40px;
      padding: 0 8px 0 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 14px;
      font-weight: 400;
      line-height: 20px;
      text-align: left;
      cursor: pointer;
      transition: background-color 120ms ease-out;
    }
    
    .dmc-picker-item:hover:not(:disabled) {
      background: var(--zmd-hover);
    }
    
    .dmc-picker-item:disabled {
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .dmc-listhead {
      display: grid;
      grid-template-columns: 26px minmax(120px, 1fr) max-content 92px 56px;
      column-gap: 12px;
      align-items: center;
      min-height: 26px;
      padding: 0 16px;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    
    .dmc-listhead-name {
      grid-column: 1 / span 2;
    }
    
    .dmc-listhead-col {
      justify-self: end;
      white-space: nowrap;
    }
    
    .dmc-listhead-col:nth-of-type(2) {
      grid-column: 3;
    }
    
    .dmc-listhead-col:nth-of-type(3) {
      grid-column: 4;
    }
    
    .dmc-listhead-col:nth-of-type(4) {
      grid-column: 5;
    }
    
    .dmc-list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    .dmc-list:empty {
      display: none;
      border: 0;
    }
    
    .dmc-row {
      display: grid;
      grid-template-columns: 26px minmax(120px, 1fr) max-content 92px 56px;
      column-gap: 12px;
      align-items: center;
      min-height: 48px;
      padding: 0 16px;
      border-bottom: 1px solid var(--zmd-line);
      color: var(--zmd-ink);
      transition: background-color 120ms ease-out;
    }
    
    .dmc-row:hover,
    .dmc-row:focus-within {
      background: var(--zmd-hover);
    }
    
    .dmc-row[data-catalog='true'],
    .dmc-row[data-well='true'] {
      background: transparent;
    }
    
    .dmc-name {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      column-gap: 8px;
      min-width: 0;
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
      color: var(--zmd-ink);
      overflow-wrap: anywhere;
    }
    
    .dmc-route {
      font-size: 12px;
      line-height: 18px;
      font-weight: 400;
      color: var(--zmd-ink-mute);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    
    .dmc-catalog {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      padding: 0 4px;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      height: 26px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-catalog:hover:not(:disabled) {
      color: var(--zmd-ink);
    }
    
    .dmc-catalog:disabled {
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .dmc-state {
      grid-column: 4;
      grid-row: 1;
      justify-self: end;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-secondary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    
    .dmc-mark {
      flex: 0 0 6px;
      width: 6px;
      height: 6px;
      background: var(--zmd-ink-mute);
    }
    
    .dmc-mark[data-state='missing-key'],
    .dmc-mark[data-state='unreachable'] {
      background: var(--zmd-danger);
    }
    
    .dmc-state[data-state='missing-key'],
    .dmc-state[data-state='unreachable'] {
      color: var(--zmd-ink);
    }
    
    .dmc-manage {
      grid-column: 5;
      grid-row: 1;
      justify-self: end;
      padding: 0 8px;
      height: 26px;
    }
    
    .dmc-pending {
      grid-column: 2 / -1;
      grid-row: 2;
      padding-bottom: 4px;
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-well {
      grid-column: 2 / -1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0 0 14px;
      padding: 12px 16px 12px 14px;
      border-left: 1px solid var(--zmd-line-strong);
      background: transparent;
    }
    
    .dmc-well-head {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px 10px;
      min-width: 0;
    }
    
    .dmc-well-name {
      margin: 0;
      min-width: 0;
      color: var(--zmd-ink);
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    
    .dmc-well-route {
      flex: 1 1 auto;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    
    .dmc-danger {
      flex: 0 0 auto;
      margin-left: auto;
      min-width: 0;
      max-width: 100%;
      padding: 0 6px;
      white-space: normal;
      text-align: right;
    }
    
    .dmc-well-foot {
      display: flex;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid var(--zmd-line);
    }
    
    .dmc-well-foot > .dmc-danger {
      margin-left: 0;
      padding-left: 0;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-diagnostic {
      margin: 0;
      padding: 2px 0 2px 10px;
      border-left: 2px solid var(--zmd-danger);
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink);
      overflow-wrap: anywhere;
    }
    
    .dmc-fields {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      column-gap: 12px;
      row-gap: 6px;
      align-items: center;
      margin: 0;
    }
    
    .dmc-field-label {
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
      margin: 0;
    }
    
    .dmc-field-value {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-width: 0;
      margin: 0;
      font-size: 14px;
      line-height: 22px;
      color: var(--zmd-ink);
    }
    
    .dmc-quiet {
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-key-action {
      min-width: 0;
      padding: 0 6px;
    }
    
    input.dmc-key-action {
      flex: 1 1 100%;
      width: 100%;
      height: 32px;
      padding: 0 2px;
      border: 0;
      border-radius: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      font-weight: 400;
      line-height: 22px;
    }
    
    input.dmc-key-action::placeholder {
      color: var(--zmd-ink-mute);
    }
    
    input.dmc-key-action:focus,
    input.dmc-key-action:focus-visible {
      border-bottom-color: var(--zmd-accent);
      outline: 0;
    }
    
    .dmc-key-clear {
      padding: 0 6px;
    }
    
    .dmc-protocol {
      min-width: 0;
      max-width: 100%;
      height: 32px;
      padding: 0 22px 0 2px;
      border: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 14px;
      line-height: 22px;
      cursor: pointer;
    }
    
    .dmc-protocol:disabled {
      color: var(--zmd-ink-secondary);
      cursor: default;
    }
    
    .dmc-protocol option {
      background: var(--zmd-panel);
      color: var(--zmd-ink);
    }
    
    .dmc-retry-action {
      padding: 0 6px;
    }
    
    .dmc-retry {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      margin-top: 2px;
      padding-top: 12px;
      border-top: 1px solid var(--zmd-line);
    }
    
    .dmc-retry-state {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-retry .dmc-notice {
      padding: 0;
    }
    
    .dmc-retry-fields {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 8px 20px;
      min-width: 0;
    }
    
    .dmc-retry-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    
    .dmc-retry-label {
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-retry-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    
    .dmc-retry-input {
      width: 64px;
      min-width: 0;
      height: 32px;
      padding: 0 2px;
      border: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-retry-input[aria-invalid='true'] {
      border-bottom-color: var(--zmd-danger);
    }
    
    .dmc-retry-input:disabled {
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .dmc-retry-unit {
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-retry-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 8px;
      margin: 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-retry-tally {
      font-size: 16px;
      line-height: 20px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--zmd-ink);
    }
    
    .dmc-retry-tally-unit {
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-retry-detail {
      font-size: 12px;
      line-height: 18px;
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-backoff {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 20px;
    }
    
    .dmc-backoff-cell {
      width: 6px;
      background: var(--zmd-ink-mute);
      transform-origin: 50% 100%;
      animation: dmc-backoff-rise 160ms var(--zmd-ease) both;
    }
    
    .dmc-backoff-cell[data-level='0'] {
      height: 2px;
      background: var(--zmd-line-strong);
      animation: none;
    }
    
    .dmc-backoff-cell[data-level='1'] {
      height: 6px;
    }
    
    .dmc-backoff-cell[data-level='2'] {
      height: 10px;
    }
    
    .dmc-backoff-cell[data-level='3'] {
      height: 14px;
    }
    
    .dmc-backoff-cell[data-level='4'] {
      height: 18px;
    }
    
    .dmc-retry-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    
    @keyframes dmc-backoff-rise {
      from { transform: scaleY(0.35); }
    }
    
    .dmc-page .zmd-btn-door:focus-visible,
    .dmc-page .zmd-btn-quiet:focus-visible,
    .dmc-page .zmd-btn-danger:focus-visible,
    .dmc-page .zmd-btn-primary:focus-visible,
    .dmc-page .dmc-add:focus-visible,
    .dmc-page .dmc-notice-action:focus-visible,
    .dmc-page .dmc-protocol:focus-visible,
    .dmc-page .dmc-retry-input:focus-visible,
    .dmc-page .dmc-picker-item:focus-visible {
      outline: 2px solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @container (max-width: 484px) {
      .dmc-row {
        grid-template-columns: 26px minmax(0, 1fr) max-content 76px 52px;
        column-gap: 10px;
      }
    
      .dmc-listhead {
        grid-template-columns: 26px minmax(0, 1fr) max-content 76px 52px;
        column-gap: 10px;
      }
    
      .dmc-fields {
        grid-template-columns: 64px minmax(0, 1fr);
        column-gap: 10px;
      }
    }
    
    @container (max-width: 360px) {
      .dmc-listhead {
        display: none;
      }
    
      .dmc-row {
        grid-template-columns: 22px minmax(0, 1fr) auto;
        grid-template-rows: auto auto auto auto;
        row-gap: 2px;
        padding: 6px 12px 6px 0;
      }
    
      .dmc-head {
        padding: 12px 12px 10px;
      }
    
      .dmc-name {
        grid-column: 2;
        grid-row: 1;
        font-size: 14px;
        line-height: 20px;
        text-wrap: pretty;
      }
    
      .dmc-ordinal {
        width: 22px;
      }
    
      .dmc-catalog {
        grid-column: 1 / span 2;
        grid-row: 2;
        justify-self: start;
      }
    
      .dmc-state {
        grid-column: 3;
        grid-row: 1;
        justify-self: end;
      }
    
      .dmc-manage {
        grid-column: 3;
        grid-row: 2;
        justify-self: end;
      }
    
      .dmc-pending {
        grid-column: 2 / -1;
        grid-row: 3;
      }
    
      .dmc-well {
        grid-column: 1 / -1;
        grid-row: 4;
        margin: 4px 0 10px;
        padding: 10px 12px;
      }
    
      .dmc-well-head {
        gap: 2px 8px;
      }
    
      .dmc-danger {
        margin-left: 0;
        text-align: left;
      }
    
      .dmc-fields {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 2px;
      }
    
      .dmc-field-label {
        margin-top: 6px;
      }
    
      .dmc-protocol {
        width: 100%;
        min-width: 0;
        padding: 0 18px 0 0;
        text-overflow: ellipsis;
      }
    
      .dmc-retry-field {
        flex: 1 1 100%;
      }
    
      .dmc-retry-input {
        width: 100%;
      }
    
      .dmc-page .zmd-btn-door,
      .dmc-page .zmd-btn-quiet,
      .dmc-page .zmd-btn-danger,
      .dmc-page .dmc-add,
      .dmc-page .dmc-catalog,
      .dmc-page .dmc-manage,
      .dmc-page .dmc-notice-action {
        min-height: 40px;
      }
    
      .dmc-protocol,
      .dmc-retry-input {
        height: 40px;
      }
    }
    
    @container (max-width: 240px) {
      .dmc-row {
        grid-template-columns: 16px minmax(0, 1fr);
        grid-template-rows: auto;
        row-gap: 3px;
        column-gap: 6px;
        padding: 8px 4px 8px 0;
      }
    
      .dmc-head {
        padding: 10px 4px;
      }
    
      .dmc-readout {
        line-height: 28px;
        letter-spacing: -0.04em;
        word-break: keep-all;
      }
    
      .dmc-meta {
        flex-direction: column;
        gap: 1px;
      }
    
      .dmc-meta > [aria-hidden='true'] {
        display: none;
      }
    
      .dmc-ordinal {
        grid-column: 1;
        grid-row: 1;
        width: 16px;
        padding-top: 5px;
      }
    
      .dmc-catalog {
        grid-column: 2;
        grid-row: 3;
        justify-self: start;
        padding-left: 0;
        height: auto;
        min-height: 26px;
        white-space: normal;
        text-align: left;
      }
    
      .dmc-name {
        grid-column: 2;
        grid-row: 1;
        font-size: 14px;
        line-height: 20px;
        overflow-wrap: anywhere;
      }
    
      .dmc-state {
        grid-column: 2;
        grid-row: 2;
        justify-self: start;
      }
    
      .dmc-catalog {
        grid-column: 2;
        grid-row: 3;
        justify-self: start;
        padding-left: 0;
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
        grid-column: 1 / -1;
        grid-row: 6;
        padding: 10px;
      }
    
      .dmc-well-head {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
    
      .dmc-well-route {
        display: none;
      }
    
      .dmc-danger {
        margin-left: 0;
        padding-left: 0;
        text-align: left;
        white-space: normal;
      }
    
      .dmc-well-head > .dmc-danger {
        flex: 1 1 100%;
        white-space: normal;
      }
    
      .dmc-well-foot {
        justify-content: flex-start;
      }
    
      .dmc-fields {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 2px;
      }
    
      .dmc-field-label {
        margin-top: 6px;
      }
    
      .dmc-protocol {
        width: 100%;
        min-width: 0;
        padding: 0 18px 0 0;
        text-overflow: ellipsis;
      }
    
      .dmc-protocol option {
        max-width: 100%;
      }
    
      .dmc-actions,
      .dmc-empty,
      .dmc-notice {
        padding-left: 8px;
        padding-right: 8px;
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .zmd-btn-primary,
      .dmc-add,
      .dmc-key-action,
      .dmc-key-clear,
      .dmc-catalog,
      .dmc-manage,
      .dmc-danger,
      .dmc-picker-item,
      .dmc-retry-action,
      .dmc-backoff-cell {
        transition: none;
        animation: none;
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
      const manifestIndex = String(props.index).padStart(2, "0");
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
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-ordinal zmd-ordinal", "aria-hidden": "true", children: manifestIndex }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dmc-name", children: [
              displayName,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-route", children: provider })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "dmc-catalog zmd-btn-quiet",
                id: `dmc-catalog-btn-${provider}`,
                "aria-expanded": props.catalogOpen,
                "aria-controls": `dmc-catalog-${provider}`,
                title: models === 0 ? t2(KEYS["config.models.inherited"]) : void 0,
                onClick: props.onOpenCatalog,
                children: models > 0 ? t2(KEYS["config.models.count"], { count: String(models) }) : t2(KEYS["config.models.default"])
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dmc-state", "data-state": reading.answer, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-mark", "data-state": reading.answer, "aria-hidden": "true" }),
              t2(reading.word)
            ] }, reading.answer),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "dmc-manage zmd-btn-door",
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
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-well-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { className: "dmc-well-name", children: t2(KEYS["config.well.title"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-well-route", children: provider })
              ] }),
              shown === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-diagnostic", children: shown }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dl", { className: "dmc-fields", children: [
                session ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { className: "dmc-field-label", children: t2(KEYS["config.credential.label"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-quiet", children: t2(KEYS["config.credential.session"]) }) })
                ] }) : keyRef === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { className: "dmc-field-label", children: t2(KEYS["config.credential.label"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { className: "dmc-field-value", children: editing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
                        className: "dmc-key-action zmd-btn-quiet",
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
                        className: "dmc-key-clear zmd-btn-quiet",
                        disabled: !editable || !keyWritable(row),
                        "aria-label": t2(KEYS["config.removeProvider"], { provider: t2(KEYS["config.key.input"]) }),
                        onClick: props.onClearKey,
                        children: t2(KEYS["config.key.clearShort"])
                      }
                    ) : null
                  ] }) })
                ] }),
                protocols.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { className: "dmc-field-label", children: t2(KEYS["config.api.label"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { className: "dmc-field-label", children: t2(KEYS["config.retryPolicy.trigger"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dmc-retry-action zmd-btn-quiet",
                      "aria-expanded": retryOpen,
                      "aria-controls": `dmc-retry-${provider}`,
                      onClick: () => {
                        setRetryOpen((current) => !current);
                      },
                      children: t2(KEYS["config.retryPolicy.edit"])
                    }
                  ) })
                ] }) : null
              ] }),
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
              row.entry.settingsPath.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmc-well-foot", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-danger zmd-btn-danger",
                  disabled: !editable || row.configured && !removable,
                  "aria-label": row.configured ? t2(KEYS["config.removeProvider"], { provider: displayName }) : t2(KEYS["config.add"]),
                  title: lifecycleHint,
                  onClick: props.onLifecycle,
                  children: t2(row.configured ? KEYS["config.removeProvider"] : KEYS["config.add"])
                }
              ) })
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
      const summary = listed.length === 0 ? t2(KEYS["config.summary.none"]) : issues === 0 ? t2(KEYS["config.summary.ready"], { count: String(readyCount) }) : t2(KEYS["config.summary.attention"], { count: String(readyCount), issues: String(issues) });
      const empty = snapshot.status === "ready" && (listed.length === 0 || listed.every((row) => !providerUsable(row)));
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "section",
        {
          className: "dmc-page zmd-plate zmd-grain",
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
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("header", { className: "dmc-head", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-masthead zmd-masthead", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { className: "dmc-readout zmd-masthead-name", children: t2(KEYS["config.title"]) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmc-meta zmd-masthead-meta", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: summary }) })
            ] }) }),
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
            empty ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dmc-empty", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-empty-copy", children: t2(KEYS["config.empty.description"]) }) }) : null,
            listed.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-listhead", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-listhead-name", children: t2(KEYS["config.provider.label"]) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-listhead-col", children: t2(KEYS["config.models.label"]) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-listhead-col", children: t2(KEYS["config.listheadState"]) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-listhead-col", children: t2(KEYS["config.listheadAction"]) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dmc-list", children: listed.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ProviderRow,
              {
                row,
                index: index + 1,
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
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-actions zmd-footing", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "zmd-footing-note", children: listed.length === 0 ? t2(KEYS["config.footCount"], { count: "0" }) : candidates.length === 0 ? t2(KEYS["config.add.catalogExhausted"]) : t2(KEYS["config.footCount"], { count: String(listed.length) }) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-add",
                  "data-emphasis": empty ? "primary" : void 0,
                  "aria-expanded": picker && candidates.length > 0,
                  disabled: readOnly || candidates.length === 0,
                  onClick: () => {
                    setPicker((current) => !current);
                  },
                  children: t2(KEYS["config.add"])
                }
              )
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
      constructor(faces) {
        this.faces = faces;
      }
      snapshot = EMPTY;
      listeners = /* @__PURE__ */ new Set();
      generation = 0;
      pending = Promise.resolve();
      subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      };
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
      getSnapshot = () => this.snapshot;
      publish(next) {
        this.snapshot = next;
        for (const listener of this.listeners) listener();
      }
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
      rowFor(entry, namespace, accountAvailable) {
        const value = namespace?.value;
        const configured = namespace !== void 0 && hasProfile(namespace, entry.settingsPath);
        return {
          entry,
          configured,
          added: isAdded(configured, entry.settingsPath),
          removable: isRemovable(namespace, entry.settingsPath),
          apiKeyEnv: entry.provider === ACCOUNT_ROUTE ? void 0 : apiKeyEnvOf(value, entry.settingsPath),
          credential: void 0,
          ...entry.provider === ACCOUNT_ROUTE && accountAvailable !== void 0 ? { accountAvailable } : {}
        };
      }
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
    
    var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react5 = require("react");
    var import_react_dom2 = require("react-dom");
    
    var import_jsx_runtime4 = require("react/jsx-runtime");
    var BADGE_STROKE = 1.6;
    var FRAME = "M3 2.5 H13 V13.5 H3 Z";
    function artworkOf(fact) {
      switch (fact) {
        case "text":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.4 6.6 H10.6" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.4 9.8 H10.6" })
          ] });
        case "image":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4.8 11.2 L6.9 8.4 L8.4 10.2 L10.2 8.1 L11.2 11.2" })
          ] });
        case "effort":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.6 10.6 V9.4" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 10.6 V7.6" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M10.4 10.6 V5.8" })
          ] });
        case "context":
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M6.4 5.8 H5.4 V10.6 H6.4" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M9.6 5.8 H10.6 V10.6 H9.6" })
          ] });
      }
    }
    function BadgeIcon({ fact, size = 14, className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "svg",
        {
          className,
          width: size,
          height: size,
          viewBox: "0 0 16 16",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: BADGE_STROKE,
          strokeLinecap: "square",
          strokeLinejoin: "miter",
          "aria-hidden": "true",
          focusable: "false",
          xmlns: "http://www.w3.org/2000/svg",
          children: artworkOf(fact)
        }
      );
    }
    
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
    
    var import_jsx_runtime5 = require("react/jsx-runtime");
    var ordinalOf = (index) => `${index + 1}`.padStart(2, "0");
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
        if (/^[1-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const target = options[Number(event.key) - 1];
          if (target === void 0 || target.failed) return;
          event.preventDefault();
          event.stopPropagation();
          refs.current[Number(event.key) - 1]?.focus();
          return;
        }
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
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-rail-index", "aria-hidden": "true", children: ordinalOf(index) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-rail-copy", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-rail-name", children: option.label }) }),
                option.failed ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dmp-provider-failed", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-provider-failed-dot", "aria-hidden": "true" }),
                  t2("provider.failed")
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dmp-provider-count zmd-num", children: option.count })
              ]
            },
            option.id ?? "all"
          ))
        }
      );
    }
    
    var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react4 = require("react");
    var import_react_dom = require("react-dom");
    
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
      const position = (0, import_dsh_client_ui_primitives.useAnchoredPosition)({ open: true, anchorRef, panelRef, side, align: "end", gap: 8, margin: 12 });
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
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives.IconWarningOutlineRegular, { className: "dmp-settings-alert-icon" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.writeFailed", { message: writeError }) })
      ] }) : sectionNotice === null ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-notice", children: sectionNotice });
      return (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          import_dsh_client_ui_primitives.MenuSurface,
          {
            ref: panelRef,
            id: `${idPrefix}-settings`,
            className: "dmp-menu dmp-settings zmd-plate zmd-grain",
            style: position === null ? MEASURE_STYLE : { ...position, maxHeight },
            role: "group",
            "aria-label": t2("settings.aria", { model: modelLabel }),
            "aria-busy": writing || busy,
            tabIndex: -1,
            onKeyDown,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-head", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "dmp-settings-title", children: modelLabel }) }),
              notice,
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-body", children: [
                showsInputSection(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-label zmd-runhead", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.input.title") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "zmd-rule", "aria-hidden": "true" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-settings-name", children: t2("settings.input.text") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      import_dsh_client_ui_primitives.Switch,
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
                      import_dsh_client_ui_primitives.Switch,
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
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-label zmd-runhead", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.context.title") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "zmd-rule", "aria-hidden": "true" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dmp-settings-row", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                    import_dsh_client_ui_primitives.Input,
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
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-label zmd-runhead", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.effort.title") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "zmd-rule", "aria-hidden": "true" })
                  ] }),
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
                        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                          "span",
                          {
                            className: "dmp-effort-check",
                            "data-on": choice.effort === activeEffort ? "" : void 0,
                            children: choice.effort === activeEffort ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : null
                          }
                        )
                      ]
                    },
                    choice.key
                  )) })
                ] }),
                address !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-target", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-settings-target-label", children: t2("settings.targetLabel") }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-settings-target-value", children: t2("settings.target", { ns: address.ns, path: address.entryPath.join(".") }) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-note", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives.IconInfoOutlineRegular, { className: "dmp-settings-note-icon" }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t2("settings.note") })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dmp-settings-foot zmd-footing", children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "zmd-footing-note", children: t2("settings.scope") }),
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
              ] })
            ]
          }
        ),
        document.body
      );
    }
    
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
      const menuPos = (0, import_dsh_client_ui_primitives2.useAnchoredPosition)({
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
        const ranked = (0, import_dsh_client_ui_primitives2.rankByName)(catalogRows.map((row) => row.model), trimmedQuery);
        const rankOf = new Map(ranked.map((model, index) => [model, index]));
        const bestRank = (candidate) => candidate.rows.reduce(
          (best, row) => Math.min(best, rankOf.get(row.model) ?? Number.MAX_SAFE_INTEGER),
          Number.MAX_SAFE_INTEGER
        );
        const scoped = providerFilter === null ? orderedGroups : orderedGroups.filter((group) => group.id === providerFilter);
        return scoped.map((group) => ({
          id: group.id,
          label: providerLabel(group.id, group.name),
          rows: (0, import_dsh_client_ui_primitives2.rankByName)(group.models, trimmedQuery).map((model) => ({
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
        const matches = (0, import_dsh_client_ui_primitives2.rankByName)(catalogRows.map((row) => row.model), trimmedQuery).length;
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
        return (0, import_dsh_client_ui_primitives2.observeStickyMenuGroups)(viewport);
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
      const scopeName = providerFilter === null ? t2("provider.all") : providerNameOf(providerFilter);
      const scopeSub = providerFilter === null ? t2("card.subAll") : t2("card.subScoped");
      const scopeCount = t2("card.count", { count: String(rows.length) });
      const hiddenRows = Math.max(0, catalogRows.length - rows.length);
      const footNote = hiddenRows === 0 ? t2("card.footTotal", { count: String(rows.length) }) : t2("card.footPart", { shown: String(rows.length), total: String(catalogRows.length) });
      const footKeys = groups.length > 1 ? t2("card.footProviders", { count: String(groups.length) }) : "";
      const railKeys = providerOptions.filter((option) => !option.failed).length > 1 ? t2("card.railKeys") : "";
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
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.Tooltip, { label: triggerLabel, side: "top", align: "end", portal: true, disabled: open, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconDataOutlineRegular, { className: "dmp-trigger-icon", size: 16 }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-trigger-label", children: triggerLabel }),
                  !waiting && effortLabel !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-trigger-effort", children: effortLabel }),
                  busy ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconChevronDownOutlineRegular, { className: open ? "dmp-chevron dmp-chevron-open" : "dmp-chevron" })
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.Tooltip, { label: settingsTitle, side: "top", align: "end", portal: true, disabled: settingsAt, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "button",
              {
                ref: settingsButtonRef,
                type: "button",
                className: settingsAt ? "dmp-settings-button dmp-settings-open" : "dmp-settings-button",
                "aria-label": state.current === null ? t2("settings.openNoModel") : t2("settings.openAria", { model: modelName }),
                "aria-haspopup": "menu",
                "aria-expanded": settingsAt,
                "aria-controls": settingsAt ? `${id}-settings` : void 0,
                "data-selection-focus": settingsAt ? "" : void 0,
                disabled: locked || state.current === null,
                onClick: toggleSettings,
                children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconSettingsOutlineRegular, { className: "dmp-settings-icon", size: 16 })
              }
            ) }),
            open && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                import_dsh_client_ui_primitives2.MenuSurface,
                {
                  ref: menuRef,
                  id: `${id}-menu`,
                  className: "dmp-menu dmp-card zmd-plate zmd-grain",
                  "data-scope": providerFilter === null ? "all" : "one",
                  style: menuPos ?? MEASURE_STYLE2,
                  role: "group",
                  "aria-label": t2("menu.aria"),
                  "aria-busy": state.status === "loading" || busy,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-card-head", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-card-identity", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "dmp-card-name", children: scopeName }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-card-sub", children: scopeSub })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-card-count zmd-num", children: scopeCount })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-card-body", children: [
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
                            import_dsh_client_ui_primitives2.Input,
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
                              children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { "aria-hidden": "true", children: "×" })
                            }
                          )
                        ] }),
                        state.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-status", role: "status", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "ongoing" }),
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("status.loading") })
                        ] }),
                        "            ",
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
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("error.action", { message: state.error }) }),
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t2("action.reload") })
                        ] }),
                        state.failures.map((failure) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-warning", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
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
                            children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.MenuGroup, { label: group.label, children: group.rows.map((row) => {
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
                                          import_dsh_client_ui_primitives2.Tag,
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
                                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-check", "data-on": selected ? "" : void 0, children: rowPending ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "ongoing" }) : selected ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconCheckOutlineRegular, {}) : null })
                                  ]
                                },
                                row.key
                              );
                            }) }, group.id))
                          }
                        ),
                        state.status === "ready" && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-empty", role: "status", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconDataOutlineRegular, { className: "dmp-empty-icon", size: 20, "aria-hidden": "true" }),
                          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: providerFilter !== null ? trimmedQuery === "" ? t2("empty.provider") : t2("empty.providerSearch") : catalogRows.length === 0 ? t2("empty.models") : t2("search.empty") })
                        ] })
                      ] })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-card-foot", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-card-foot-note zmd-num", children: footNote }),
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-card-foot-providers zmd-num", children: footKeys }),
                      railKeys === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-card-foot-keys", children: railKeys }),
                      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-card-key", role: "note", "aria-label": t2("badge.keyAria"), children: legend.map((item) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dmp-card-key-item", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BadgeIcon, { fact: item.fact, className: "dmp-card-key-icon" }),
                        item.label
                      ] }, item.fact)) })
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
              import_dsh_client_ui_primitives2.Toast,
              {
                text: toast.text,
                icon: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, {}),
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
    
    var FONT_FAMILY = "ZMD Archivo";
    var FONT_WOFF2_BASE64 = "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";
    
    var STYLE_ELEMENT_ID3 = "dsh-rabbit-model-picker-design";
    var FONT_FACE = `@font-face {
      font-family: ${JSON.stringify(FONT_FAMILY)};
      src: url(data:font/woff2;base64,${FONT_WOFF2_BASE64}) format('woff2');
      font-weight: 100 900;
      font-stretch: 62% 125%;
      font-style: normal;
      font-display: swap;
    }`;
    var GRAIN_LIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.42 0 0 0 0 0.44 0 0 0 0.11 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)'/%3E%3C/svg%3E")`;
    var GRAIN_DARK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.62 0 0 0 0 0.62 0 0 0 0 0.66 0 0 0 0.075 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)'/%3E%3C/svg%3E")`;
    var TOKENS = `:root {
      --zmd-font-latin: ${JSON.stringify(FONT_FAMILY)}, var(--dsh-font-family-text, var(--dsh-font-family-text-default, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif));
    
      --zmd-panel: #f8f8f7;
      --zmd-raised: #ffffff;
      --zmd-panel-deep: #efefee;
      --zmd-hover: #ececea;
      --zmd-line: #8d8d8a;
      --zmd-line-strong: #7e7e7b;
      --zmd-line-control: #787874;
      --zmd-ink: #0f0f10;
      --zmd-ink-secondary: #4c4c50;
      --zmd-ink-mute: #65656a;
    
      --zmd-wash-top: #fdfdfc;
      --zmd-wash-bottom: #f1f1ef;
      --zmd-grain-tile: ${GRAIN_LIGHT};
    
      --zmd-online: #2f7d4f;
    
      --zmd-ease: cubic-bezier(0.2, 0, 0, 1);
    }
    
    body[data-ds-dark-theme] {
      --zmd-panel: #161618;
      --zmd-raised: #1d1d20;
      --zmd-panel-deep: #101011;
      --zmd-hover: #202024;
      --zmd-line: #666670;
      --zmd-line-strong: #7b7b86;
      --zmd-line-control: #83838f;
      --zmd-ink: #f3f3f5;
      --zmd-ink-secondary: #b5b5bc;
      --zmd-ink-mute: #8e8e96;
    
      --zmd-wash-top: #1e1e21;
      --zmd-wash-bottom: #111113;
      --zmd-grain-tile: ${GRAIN_DARK};
    
      --zmd-online: #6bbf8a;
    }
    
    body {
      --zmd-accent: var(--dsw-alias-state-business-primary);
      --zmd-on-accent: var(--zmd-panel);
      --zmd-focus: var(--dsw-alias-state-business-primary);
      --zmd-danger: var(--dsw-alias-state-error-primary);
      --zmd-on-ink: var(--zmd-panel);
    }`;
    var PRIMITIVES = `
    .zmd-num {
      font-variant-numeric: tabular-nums;
    }
    
    .zmd-plate {
      position: relative;
      isolation: isolate;
      background-color: var(--zmd-panel);
      background-image:
        radial-gradient(135% 105% at 2% -18%, var(--zmd-wash-top) 0%, var(--zmd-panel) 52%, var(--zmd-wash-bottom) 100%);
    }
    
    .zmd-grain::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      opacity: 1;
      background-image: var(--zmd-grain-tile);
      background-size: 120px 120px;
      background-repeat: repeat;
    }
    
    .zmd-runhead {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
    }
    
    .zmd-runhead > .zmd-rule {
      flex: 1 1 auto;
      min-width: 8px;
    }
    
    .zmd-rule {
      height: 1px;
      border: 0;
      background: var(--zmd-line);
    }
    
    .zmd-masthead {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    
    .zmd-masthead-name {
      margin: 0;
      overflow: hidden;
      color: var(--zmd-ink);
      font-size: 24px;
      line-height: 32px;
      font-weight: 500;
      letter-spacing: -0.02em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .zmd-masthead-meta {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px 10px;
      min-width: 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .zmd-footing {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      padding-top: 8px;
      border-top: 1px solid var(--zmd-line);
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .zmd-footing-note {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .zmd-footing-keys {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    
    .zmd-ordinal {
      flex: 0 0 auto;
      width: 26px;
      color: var(--zmd-ink-mute);
      font-size: 10px;
      line-height: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    
    .zmd-btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      padding: 0 14px;
      border: 0;
      border-radius: 0;
      background: var(--zmd-ink);
      color: var(--zmd-on-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      cursor: pointer;
      transition: background-color 120ms var(--zmd-ease), transform 80ms var(--zmd-ease);
    }
    
    .zmd-btn-primary:hover:not(:disabled) {
      background: var(--zmd-ink-secondary);
    }
    
    .zmd-btn-primary:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .zmd-btn-primary:disabled {
      background: var(--zmd-hover);
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .zmd-btn-door {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 26px;
      padding: 0 10px;
      border: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 120ms var(--zmd-ease), border-color 120ms var(--zmd-ease), transform 80ms var(--zmd-ease);
    }
    
    .zmd-btn-door.zmd-btn-commit {
      height: 32px;
      padding: 0 16px;
      border-color: var(--zmd-ink);
      font-size: 14px;
      line-height: 20px;
    }
    
    .zmd-btn-door:hover:not(:disabled) {
      border-color: var(--zmd-ink-mute);
      background: var(--zmd-hover);
    }
    
    .zmd-btn-door:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .zmd-btn-door[aria-expanded='true'] {
      border-color: var(--zmd-ink);
      background: transparent;
    }
    
    .zmd-btn-door:disabled {
      border-color: var(--zmd-line);
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .zmd-btn-quiet {
      display: inline-flex;
      align-items: center;
      height: 26px;
      padding: 0 6px;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 120ms var(--zmd-ease), color 120ms var(--zmd-ease), transform 80ms var(--zmd-ease);
    }
    
    .zmd-btn-quiet:hover:not(:disabled) {
      background: var(--zmd-hover);
    }
    
    .zmd-btn-quiet:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .zmd-btn-quiet:disabled {
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .zmd-btn-danger {
      display: inline-flex;
      align-items: center;
      height: 26px;
      padding: 0 6px;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-danger);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 120ms var(--zmd-ease), color 120ms var(--zmd-ease);
    }
    
    .zmd-btn-danger:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-danger);
    }
    
    .zmd-btn-danger:disabled {
      color: var(--zmd-ink-mute);
      cursor: default;
    }
    
    .zmd-field {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      height: 32px;
      padding: 0 2px;
      border: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
      font-variant-numeric: tabular-nums;
      transition: border-color 120ms var(--zmd-ease);
    }
    
    .zmd-field:focus,
    .zmd-field:focus-visible {
      border-bottom-color: var(--zmd-accent);
      outline: 0;
    }
    
    .zmd-field::placeholder {
      color: var(--zmd-ink-mute);
    }
    
    .zmd-btn-primary:focus-visible,
    .zmd-btn-door:focus-visible,
    .zmd-btn-quiet:focus-visible,
    .zmd-btn-danger:focus-visible {
      outline: 2px solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .zmd-btn-primary,
      .zmd-btn-door,
      .zmd-btn-quiet,
      .zmd-btn-danger,
      .zmd-field {
        transition: none;
      }
    
      .zmd-btn-primary:active:not(:disabled),
      .zmd-btn-door:active:not(:disabled),
      .zmd-btn-quiet:active:not(:disabled) {
        transform: none;
      }
    }
    `;
    var CSS3 = `${FONT_FACE}
    
    ${TOKENS}
    
    ${PRIMITIVES}`;
    function injectDesignSystem() {
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
    
    var STYLE_ELEMENT_ID4 = "dsh-rabbit-model-picker-styles";
    var CSS4 = `
    .dmp-root {
      position: relative;
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
      --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
      --dmp-margin: 26px;
      --dmp-col-icon: 14px;
      --dmp-col-window: 47px;
      --dmp-col-gap: 8px;
      --dmp-row-pad-x: 6px;
      --dmp-badge-budget: 113px;
      --dmp-name-budget: 175px;
    }
    
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
      border-radius: 0;
      outline: none;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      cursor: pointer;
      transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease), transform 80ms var(--dmp-ease);
    }
    
    .dmp-trigger:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-trigger:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmp-trigger:focus-visible:not([data-selection-focus]) {
      outline: 2px solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    .dmp-trigger:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-trigger-label {
      display: var(--dsh-composer-model-text-display, block);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-trigger-effort {
      display: var(--dsh-composer-model-text-display, inline);
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
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
      color: var(--zmd-ink-mute);
      transition: transform 140ms var(--dmp-ease);
    }
    
    .dmp-chevron-open {
      transform: rotate(180deg);
    }
    
    .dmp-trigger-open {
      background: var(--zmd-panel-deep);
      color: var(--zmd-ink);
    }
    
    .dmp-settings-button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 0;
      outline: none;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font-latin);
      cursor: pointer;
      transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease), transform 80ms var(--dmp-ease);
    }
    
    .dmp-settings-button:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    .dmp-settings-button:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-settings-button:focus-visible:not([data-selection-focus]) {
      outline: 2px solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    .dmp-settings-button:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-settings-open {
      background: var(--zmd-panel-deep);
      color: var(--zmd-ink);
    }
    
    .dmp-settings-icon {
      flex: 0 0 auto;
    }
    
    .dmp-menu {
      position: fixed;
      z-index: 1100;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: min(320px, calc(100vw - 32px));
      max-height: min(420px, calc(100vh - 96px));
      overflow: hidden;
      padding: 0;
      border: 0;
      border-radius: 0;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
      --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
      --dmp-ease: cubic-bezier(0.2, 0, 0, 1);
      --dmp-col-icon: 14px;
      --dmp-col-window: 47px;
      --dmp-col-gap: 8px;
      --dmp-row-pad-x: 6px;
    }
    
    .dmp-menu [class*='material'] {
      background: transparent;
      border-radius: 0;
      backdrop-filter: none;
    }
    
    .dmp-menu > :not([class*='material']) {
      position: relative;
      z-index: 1;
    }
    
    .dmp-menu::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 4;
      border: 1px solid var(--zmd-line-strong);
      pointer-events: none;
    }
    
    .dmp-card {
      width: min(520px, calc(100vw - 32px));
      height: min(420px, calc(100vh - 96px));
      max-height: min(420px, calc(100vh - 96px));
    }
    
    .dmp-card-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      flex: 0 0 auto;
      min-width: 0;
      padding: 14px 14px 11px;
      border-bottom: 1px solid var(--zmd-line);
    }
    
    .dmp-card-identity {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    
    .dmp-card-name {
      margin: 0;
      overflow: hidden;
      color: var(--zmd-ink);
      font-size: 24px;
      line-height: 32px;
      font-weight: 500;
      letter-spacing: -0.02em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-card-sub {
      overflow: hidden;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-card-count {
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    
    .dmp-card-body {
      position: relative;
      display: flex;
      flex: 1 1 auto;
      align-items: stretch;
      min-height: 0;
    }
    
    .dmp-rail {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 1px;
      width: 176px;
      min-height: 0;
      overflow-y: auto;
      padding: 6px 0;
      scroll-snap-type: y proximity;
      scroll-padding-block: 6px;
      border-right: 1px solid var(--zmd-line);
      mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 18px), transparent 100%);
    }
    
    .dmp-rail-row {
      position: relative;
      scroll-snap-align: start;
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      min-height: 30px;
      padding: 0 10px 0 14px;
      border: none;
      border-radius: 0;
      outline: none;
      background: transparent;
      color: inherit;
      font: inherit;
      font-family: var(--zmd-font-latin);
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color 120ms var(--dmp-ease);
    }
    
    .dmp-rail-index {
      flex: 0 0 var(--dmp-margin);
      color: var(--zmd-ink-mute);
      font-size: 10px;
      line-height: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    
    .dmp-rail-row:hover:not(:disabled),
    .dmp-rail-row:focus-visible {
      background: var(--zmd-hover);
    }
    
    .dmp-rail-row[aria-selected='true'],
    .dmp-rail-row[aria-selected='true']:hover:not(:disabled) {
      background: var(--zmd-panel-deep);
    }
    
    .dmp-rail-row[aria-current='true']::before {
      content: '';
      position: absolute;
      left: 0;
      top: 3px;
      bottom: 3px;
      width: 0;
      border-left: 2px solid var(--zmd-accent);
    }
    
    .dmp-rail-row[aria-selected='true']:not([aria-current='true']) {
      box-shadow: inset 0 0 0 1px var(--zmd-line-strong);
    }
    
    .dmp-rail-row[aria-selected='true'] .dmp-rail-index {
      color: var(--zmd-ink-secondary);
    }
    
    .dmp-rail-row:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-rail-row[aria-current='true'] .dmp-rail-name,
    .dmp-rail-row[aria-selected='true'] .dmp-rail-name {
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
      font-size: 14px;
      line-height: 22px;
      font-weight: 400;
    }
    
    .dmp-provider-count {
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-provider-failed {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      font-weight: 500;
      line-height: 18px;
    }
    
    .dmp-provider-failed-dot {
      flex: 0 0 6px;
      width: 6px;
      height: 6px;
      background: var(--zmd-danger);
    }
    
    .dmp-models {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      margin-left: 176px;
      padding: 8px 12px 0;
    }
    
    .dmp-status,
    .dmp-empty {
      padding: 8px 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .dmp-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 20px 0;
      text-align: left;
    }
    
    .dmp-empty-icon {
      color: var(--zmd-ink-mute);
    }
    
    .dmp-error,
    .dmp-warning {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin: 6px 0 2px;
      padding: 6px 0 6px 10px;
      border-left: 2px solid var(--zmd-danger);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-error-icon {
      flex: 0 0 14px;
      margin-top: 2px;
      color: var(--zmd-danger);
    }
    
    .dmp-retry {
      flex: 0 0 auto;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: color 120ms var(--dmp-ease);
    }
    
    .dmp-retry:hover {
      text-decoration: underline;
      text-decoration-color: var(--zmd-accent);
      text-underline-offset: 4px;
    }
    
    .dmp-search-row {
      position: relative;
      flex-shrink: 0;
      margin: 0 0 8px;
    }
    
    .dmp-search-row .dmp-search {
      display: flex;
      height: 32px;
      padding: 0 30px 0 0;
      border: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      transition: border-color 120ms var(--dmp-ease);
    }
    
    .dmp-search-row .dmp-search:focus-within {
      border-bottom-color: var(--zmd-accent);
      outline: 0;
    }
    
    .dmp-search-row .dmp-search-with-query {
      padding-right: 30px;
    }
    
    .dmp-search-row .dmp-search input {
      padding: 0;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 20px;
    }
    
    .dmp-search-row .dmp-search input::placeholder {
      color: var(--zmd-ink-mute);
    }
    
    .dmp-search-clear {
      position: absolute;
      top: 50%;
      right: -6px;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      transition: background-color 120ms var(--dmp-ease);
    }
    
    .dmp-search-clear:hover,
    .dmp-search-clear:focus-visible {
      outline: none;
      background: var(--zmd-hover);
    }
    
    .dmp-card-key {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px 12px;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-card-key-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    
    .dmp-card-key-icon {
      display: block;
      flex: 0 0 auto;
      width: 12px;
      height: 12px;
      color: var(--zmd-ink-mute);
    }
    
    .dmp-groups {
      min-height: 0;
      overflow-y: auto;
      scroll-padding-top: 26px;
    }
    
    .dmp-groups > [data-menu-group] + [data-menu-group] {
      margin-top: 6px;
    }
    
    .dmp-groups [data-menu-group-heading] {
      display: flex;
      align-items: center;
      gap: 10px;
      background: transparent;
      border: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 14px 0 4px;
    }
    
    .dmp-groups [data-menu-group-heading]::after {
      content: '';
      flex: 1 1 auto;
      min-width: 8px;
      height: 1px;
      background: var(--zmd-line);
    }
    
    .dmp-row {
      position: relative;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 6px;
      width: auto;
      min-width: 100%;
      min-height: 38px;
      padding: 5px var(--dmp-row-pad-x) 5px calc(var(--dmp-row-pad-x) + 2px);
      border: none;
      border-radius: 0;
      outline: none;
      background: transparent;
      color: inherit;
      font-family: var(--zmd-font-latin);
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease);
    }
    
    .dmp-row:hover:not([aria-disabled='true']):not(:disabled),
    .dmp-row:focus-visible,
    .dmp-row[data-active]:not([aria-disabled='true']) {
      background: var(--zmd-hover);
    }
    
    .dmp-row[aria-checked='true'] {
      background: var(--zmd-panel-deep);
    }
    
    .dmp-row[aria-checked='true']::before {
      content: '';
      position: absolute;
      left: 0;
      top: 4px;
      bottom: 4px;
      width: 0;
      border-left: 2px solid var(--zmd-accent);
    }
    
    .dmp-row[aria-disabled='true'],
    .dmp-row:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-row-copy {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }
    
    .dmp-row-name {
      flex: 1 1 auto;
      min-width: 48px;
      overflow: hidden;
      color: inherit;
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-row[aria-checked='true'] .dmp-row-name {
      font-weight: 500;
    }
    
    .dmp-badges {
      display: grid;
      grid-template-columns:
        var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
      flex: 0 0 auto;
      align-items: center;
      gap: var(--dmp-col-gap);
    }
    
    .dmp-badge-slot {
      min-width: 0;
    }
    
    .dmp-badges .dmp-badge {
      gap: 3px;
      min-height: 22px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      font-size: 12px;
      line-height: 18px;
      font-weight: 400;
    }
    
    .dmp-badge-fact {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      width: 14px;
      height: 14px;
    }
    
    .dmp-badge-icon {
      display: block;
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
    }
    
    .dmp-badge-value {
      max-width: 64px;
      overflow: hidden;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font-latin);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
    }
    
    .dmp-check {
      position: relative;
      display: grid;
      place-items: center;
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      color: var(--zmd-ink);
    }
    
    @keyframes dmp-check-in {
      from { transform: scale(0.6); }
      to { transform: none; }
    }
    
    .dmp-check svg {
      position: relative;
      z-index: 1;
      width: 14px;
      height: 14px;
      animation: dmp-check-in 160ms var(--dmp-ease);
    }
    
    .dmp-check[data-on],
    .dmp-effort-check[data-on] {
      background: var(--zmd-ink);
      color: var(--zmd-on-ink);
    }
    
    .dmp-check[data-on] svg,
    .dmp-effort-check[data-on] svg {
      width: 9px;
      height: 9px;
    }
    
    .dmp-filter-hint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0 2px;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-filter-clear {
      flex: 0 0 auto;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
      cursor: pointer;
      transition: color 120ms var(--dmp-ease);
    }
    
    .dmp-filter-clear:hover:not(:disabled) {
      text-decoration: underline;
      text-decoration-color: var(--zmd-accent);
      text-underline-offset: 4px;
    }
    
    .dmp-card-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 4px 12px;
      flex: 0 0 auto;
      min-width: 0;
      padding: 8px 14px;
      border-top: 1px solid var(--zmd-line);
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-card-foot-note {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-card-foot-providers {
      flex: 0 0 auto;
      padding-left: 10px;
      border-left: 1px solid var(--zmd-line);
      white-space: nowrap;
    }
    
    .dmp-card-foot-providers:empty {
      display: none;
    }
    
    .dmp-card-foot-keys {
      flex: 0 0 auto;
      padding-left: 10px;
      border-left: 1px solid var(--zmd-line);
      color: var(--zmd-ink-mute);
      white-space: nowrap;
    }
    
    .dmp-settings {
      width: min(280px, calc(100vw - 32px));
      max-height: min(460px, calc(100vh - 96px));
      overflow: hidden;
    }
    
    .dmp-settings:focus-visible {
      outline: none;
    }
    
    .dmp-settings-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      flex: 0 0 auto;
      padding: 14px 12px 10px;
      border-bottom: 1px solid var(--zmd-line);
    }
    
    .dmp-settings-title {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      color: var(--zmd-ink);
      font-size: 24px;
      line-height: 30px;
      font-weight: 500;
      letter-spacing: -0.02em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-settings-reset {
      flex: 0 0 auto;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
      cursor: pointer;
      transition: color 120ms var(--dmp-ease);
    }
    
    .dmp-settings-reset:hover:not(:disabled) {
      text-decoration: underline;
      text-decoration-color: var(--zmd-accent);
      text-underline-offset: 4px;
    }
    
    .dmp-settings-reset:disabled {
      color: var(--dsw-alias-label-dimmed);
      cursor: default;
    }
    
    .dmp-settings-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex: 0 0 auto;
      padding: 8px 12px;
      border-top: 1px solid var(--zmd-line);
    }
    
    .dmp-settings-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1 1 auto;
      min-height: 0;
      padding: 14px 12px 12px;
      overflow-y: auto;
    }
    
    .dmp-settings-section {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .dmp-settings-label {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    
    .dmp-settings-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 32px;
    }
    
    .dmp-settings-name {
      min-width: 0;
      color: var(--zmd-ink);
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmp-settings-hint {
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-settings-notice {
      padding: 0 12px;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-settings-alert {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 10px 12px 0;
      padding: 6px 0 6px 10px;
      border-left: 2px solid var(--zmd-danger);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-settings-alert-icon {
      flex: 0 0 12px;
      margin-top: 2px;
      color: var(--zmd-danger);
    }
    
    .dmp-settings-target {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 2px;
      border-top: 1px solid var(--zmd-line);
    }
    
    .dmp-settings-target-label {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-settings-target-value {
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
    
    .dmp-settings .dmp-settings-switch {
      box-sizing: border-box;
      flex: 0 0 auto;
      align-self: center;
      width: 34px;
      height: 20px;
      padding: 3px;
      border: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      color: var(--zmd-ink-mute);
    }
    
    .dmp-settings .dmp-settings-switch[aria-checked='true'] {
      border-color: var(--zmd-ink);
      background: transparent;
      color: var(--zmd-ink);
    }
    
    .dmp-settings .dmp-settings-switch > span {
      display: block;
      width: 12px;
      height: 12px;
      border-radius: 0;
      background: currentColor;
      transition: transform 120ms var(--dmp-ease), background-color 120ms var(--dmp-ease), margin-left 120ms var(--dmp-ease);
    }
    
    .dmp-settings .dmp-settings-switch[aria-checked='true'] > span {
      margin-left: 14px;
    }
    
    .dmp-settings-input {
      flex: 1;
      min-width: 0;
      height: 32px;
      padding: 0;
      border: 0;
      border-bottom: 1px solid var(--zmd-line-control);
      border-radius: 0;
      background: transparent;
      transition: border-color 120ms var(--dmp-ease);
    }
    
    .dmp-settings-input:focus-within {
      border-bottom-color: var(--zmd-accent);
      outline: 0;
    }
    
    .dmp-settings-input input {
      width: 100%;
      padding: 0;
      color: var(--zmd-ink);
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 20px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-settings-input input::placeholder {
      color: var(--zmd-ink-mute);
    }
    
    .dmp-settings-input-bad {
      border-bottom-color: var(--zmd-danger);
    }
    
    .dmp-settings-note {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--zmd-line);
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-settings-note-icon {
      flex: 0 0 12px;
      margin-top: 3px;
      color: var(--zmd-ink-mute);
    }
    
    .dmp-effort-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    
    .dmp-effort-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-height: 32px;
      padding: 4px 4px 4px 8px;
      border: none;
      border-radius: 0;
      outline: none;
      background: transparent;
      color: inherit;
      font-family: var(--zmd-font-latin);
      font-size: 14px;
      line-height: 20px;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color 120ms var(--dmp-ease), color 120ms var(--dmp-ease);
    }
    
    .dmp-effort-item:hover:not(:disabled),
    .dmp-effort-item:focus-visible {
      background: var(--zmd-hover);
    }
    
    .dmp-effort-item[aria-checked='true'] {
      background: var(--zmd-panel-deep);
    }
    
    .dmp-effort-item[aria-checked='true']::before {
      content: '';
      position: absolute;
      left: 0;
      top: 4px;
      bottom: 4px;
      width: 0;
      border-left: 2px solid var(--zmd-accent);
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
      position: relative;
      display: grid;
      place-items: center;
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      color: var(--zmd-ink);
    }
    
    .dmp-effort-check svg {
      position: relative;
      z-index: 1;
      width: 14px;
      height: 14px;
      animation: dmp-check-in 160ms var(--dmp-ease);
    }
    
    @media (max-width: 536px) {
      .dmp-card {
        height: auto;
        max-height: min(560px, calc(100vh - 96px));
      }
    
      .dmp-card-body {
        flex-direction: column;
        min-height: 0;
      }
    
      .dmp-rail {
        position: static;
        flex: 0 0 auto;
        flex-direction: row;
        width: auto;
        gap: 2px;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 6px 0;
        border-right: none;
        border-bottom: 1px solid var(--zmd-line);
      }
    
      .dmp-models {
        margin-left: 0;
      }
    
      .dmp-rail-row {
        width: auto;
        flex: 0 0 auto;
        padding: 0 10px 0 8px;
      }
    
      .dmp-rail-index {
        flex: 0 0 auto;
        width: auto;
      }
    
      .dmp-rail-copy {
        flex: 0 0 auto;
      }
    
      .dmp-rail-name {
        flex: 0 0 auto;
        max-width: 132px;
      }
    
      .dmp-models {
        padding: 10px 12px 0;
      }
    
      .dmp-card-foot-keys {
        display: none;
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
      .dmp-settings-reset,
      .dmp-search-row .dmp-search,
      .dmp-settings-input,
      .dmp-settings .dmp-settings-switch > span {
        transition: none;
      }
    
      .dmp-trigger:active:not(:disabled),
      .dmp-settings-button:active:not(:disabled) {
        transform: none;
      }
    
      .dmp-chevron {
        transition: none;
      }
    
      .dmp-check svg,
      .dmp-effort-check svg {
        animation: none;
      }
    }
    `;
    function injectStyles() {
      if (typeof document === "undefined") return () => {
      };
      document.getElementById(STYLE_ELEMENT_ID4)?.remove();
      const element = document.createElement("style");
      element.id = STYLE_ELEMENT_ID4;
      element.textContent = CSS4;
      document.head.append(element);
      return () => {
        if (element.isConnected) element.remove();
      };
    }
    
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
      ctx.effect(() => injectDesignSystem(), "dsh-rabbit-model-picker: design system");
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
          priority: -10,
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
          order: 11,
          label: () => configT(KEYS["config.nav"]),
          inject: () => ({ store: modelConfig, t: configT })
        }, ModelConfigPage));
      });
    }
    
    return module.exports;
  },
});
