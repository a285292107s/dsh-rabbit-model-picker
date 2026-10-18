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
      "badge.head.text": "文",
      "badge.head.image": "图",
      "badge.head.effort": "推",
      "badge.head.context": "窗口",
      "badge.headAria": "每一行右侧四列的含义：文字、图片、推理、窗口",
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
      "badge.head.text": "Txt",
      "badge.head.image": "Img",
      "badge.head.effort": "Rea",
      "badge.head.context": "Window",
      "badge.headAria": "What the four columns on the right of each row mean: text, images, reasoning, window",
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
    
    var import_react4 = require("react");
    
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
      "config.retryPolicy.retries": "config.retryPolicy.retries",
      "config.retryPolicy.retriesUnit": "config.retryPolicy.retriesUnit",
      "config.retryPolicy.cap": "config.retryPolicy.cap",
      "config.retryPolicy.capUnit": "config.retryPolicy.capUnit",
      "config.retryPolicy.preview": "config.retryPolicy.preview",
      "config.retryPolicy.zero": "config.retryPolicy.zero",
      "config.retryPolicy.rateLimit": "config.retryPolicy.rateLimit",
      "config.retryPolicy.declared": "config.retryPolicy.declared",
      "config.retryPolicy.inherits": "config.retryPolicy.inherits",
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
      "config.credential.label": "config.credential.label",
      "config.credential.session": "config.credential.session",
      "config.key.input": "config.key.input",
      "config.key.replace": "config.key.replace",
      "config.key.clear": "config.key.clear",
      "config.key.stateSaved": "config.key.stateSaved",
      "config.key.stateFallback": "config.key.stateFallback",
      "config.key.reveal": "config.key.reveal",
      "config.key.hide": "config.key.hide",
      "config.key.placeholder": "config.key.placeholder",
      "config.key.placeholderFallback": "config.key.placeholderFallback",
      "config.key.placeholderSaved": "config.key.placeholderSaved",
      "config.key.blank": "config.key.blank",
      "config.key.blankNew": "config.key.blankNew",
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
      "config.api.followingDefault": "config.api.followingDefault",
      "config.api.inheritedNote": "config.api.inheritedNote",
      "config.api.lockedAria": "config.api.lockedAria",
      "config.api.override": "config.api.override",
      "config.api.inheritReset": "config.api.inheritReset",
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
      "config.add.close": "config.add.close",
      "config.add.fromCatalog": "config.add.fromCatalog",
      "config.custom.routeRequired": "config.custom.routeRequired",
      "config.custom.routePlaceholder": "config.custom.routePlaceholder",
      "config.custom.displayNamePlaceholder": "config.custom.displayNamePlaceholder",
      "config.custom.keyPlaceholder": "config.custom.keyPlaceholder",
      "config.custom.modelsPlaceholder": "config.custom.modelsPlaceholder",
      "config.custom.modelsCount": "config.custom.modelsCount",
      "config.custom.cancel": "config.custom.cancel",
      "config.add.catalog": "config.add.catalog",
      "config.add.custom": "config.add.custom",
      "config.add.catalogHint": "config.add.catalogHint",
      "config.add.customHint": "config.add.customHint",
      "config.add.catalogExhausted": "config.add.catalogExhausted",
      "config.add.customUnavailable": "config.add.customUnavailable",
      "config.edit": "config.edit",
      "config.manage": "config.manage",
      "config.manageAria": "config.manageAria",
      "config.models.openAria": "config.models.openAria",
      "config.manageSettings": "config.manageSettings",
      "config.listheadModels": "config.listheadModels",
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
      "config.model.removeAria": "config.model.removeAria",
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
      "config.reasoning.add": "config.reasoning.add",
      "config.reasoning.remove": "config.reasoning.remove",
      "config.reasoning.offPlaceholder": "config.reasoning.offPlaceholder",
      "config.reasoning.helpText": "config.reasoning.helpText",
      "config.reasoning.needsLevel": "config.reasoning.needsLevel",
      "config.reasoning.valueRequired": "config.reasoning.valueRequired",
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
      "config.retryPolicy.retries": "重试次数",
      "config.retryPolicy.retriesUnit": "次",
      "config.retryPolicy.cap": "间隔上限",
      "config.retryPolicy.capUnit": "秒",
      "config.retryPolicy.preview": "首次等待 {first}，最长合计 {total}",
      "config.retryPolicy.zero": "0 次表示不重试。",
      "config.retryPolicy.rateLimit": "「请求过于频繁」这类限流文案也按这里重试。",
      "config.retryPolicy.declared": "此提供商单独设置",
      "config.retryPolicy.inherits": "跟随默认",
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
      "config.credential.label": "API 密钥",
      "config.credential.session": "由账号提供",
      "config.key.input": "API 密钥",
      "config.key.replace": "替换 API 密钥",
      "config.key.clear": "清除密钥",
      "config.key.stateSaved": "已保存。留空则沿用这份密钥。",
      "config.key.stateFallback": "未保存。留空则用环境变量 {hint}。",
      "config.key.reveal": "显示密钥",
      "config.key.hide": "隐藏密钥",
      "config.key.placeholder": "输入 API 密钥",
      "config.key.placeholderFallback": "输入 API 密钥",
      "config.key.placeholderSaved": "输入新密钥以替换旧的",
      "config.key.blank": "请输入 API 密钥；留空则保持已存储的密钥。",
      "config.key.blankNew": "请输入 API 密钥；若该提供商以其他方式鉴权，可以留空。",
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
      "config.api.followingDefault": "跟随适配器默认",
      "config.api.inheritedNote": "由适配器决定，无需填写。",
      "config.api.lockedAria": "API 协议由适配器决定，不可直接编辑",
      "config.api.override": "手动指定",
      "config.api.inheritReset": "恢复跟随默认",
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
      "config.add.close": "关闭",
      "config.add.fromCatalog": "从内置目录添加",
      "config.custom.routeRequired": "请填写 Provider ID。",
      "config.custom.routePlaceholder": "例如 my-gateway",
      "config.custom.displayNamePlaceholder": "例如 我的网关",
      "config.custom.keyPlaceholder": "留空则用环境变量",
      "config.custom.modelsPlaceholder": "每行一个模型 id，例如 gpt-4o",
      "config.custom.modelsCount": "{count} 个模型",
      "config.custom.cancel": "取消",
      "config.add.catalog": "第三方模型提供商",
      "config.add.custom": "自定义模型 API",
      "config.add.catalogHint": "从内置目录中选择 OpenAI、Anthropic、Kimi 等提供商，填入其 API 密钥即可使用。",
      "config.add.customHint": "连接中转站、自部署服务或其他兼容 OpenAI / Anthropic 协议的接口，需填写 API 地址、协议和模型。",
      "config.add.catalogExhausted": "目录中的提供商都已添加。",
      "config.add.customUnavailable": "没有可用的 API 协议。",
      "config.edit": "编辑",
      "config.manage": "提供商设置",
      "config.manageAria": "打开 {provider} 的提供商设置：API 密钥、协议、自动重试",
      "config.models.openAria": "查看并编辑 {provider} 的模型目录，当前 {count}",
      "config.manageSettings": "提供商设置",
      "config.listheadModels": "模型目录（点开可改）",
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
      "config.model.remove": "删除",
      "config.model.removeAria": "删除模型 {model}",
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
      "config.reasoning.add": "添加档位",
      "config.reasoning.remove": "删除档位",
      "config.reasoning.offPlaceholder": "关闭思考",
      "config.reasoning.helpText": "API 参数值会写入请求的推理强度字段（如 OpenAI 的 reasoning_effort），默认与档位名相同；如有不同，以模型提供商的 API 文档为准。Off 表示关闭思考，不需要填写参数值；配置中已写入的值会保留并发送。",
      "config.reasoning.needsLevel": "至少添加一个 Off 以外的档位；不需要思考请关闭推理等级。",
      "config.reasoning.valueRequired": "Off 以外的档位都需要填写 API 参数值，且参数值不能为空字符串。",
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
      "config.retryPolicy.retries": "Retries",
      "config.retryPolicy.retriesUnit": "times",
      "config.retryPolicy.cap": "Wait cap",
      "config.retryPolicy.capUnit": "s",
      "config.retryPolicy.preview": "First wait {first}, up to {total} in total",
      "config.retryPolicy.zero": "0 means no retry.",
      "config.retryPolicy.rateLimit": "Wording like “请求过于频繁” is retried on these settings too.",
      "config.retryPolicy.declared": "Set for this provider",
      "config.retryPolicy.inherits": "Following the default",
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
      "config.credential.label": "API key",
      "config.credential.session": "Provided by your account",
      "config.key.input": "API key",
      "config.key.replace": "Replace API key",
      "config.key.clear": "Clear key",
      "config.key.stateSaved": "Saved. Leave empty to keep it.",
      "config.key.stateFallback": "Not saved. Leave empty to read {hint} from the environment.",
      "config.key.reveal": "Show secret",
      "config.key.hide": "Hide secret",
      "config.key.placeholder": "Enter your API key",
      "config.key.placeholderFallback": "Enter the API key",
      "config.key.placeholderSaved": "Enter a new key",
      "config.key.blank": "Enter the API key, or leave the field empty to keep the stored one.",
      "config.key.blankNew": "Enter the API key, or leave the field empty if this provider authenticates another way.",
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
      "config.api.followingDefault": "Following the adapter default",
      "config.api.inheritedNote": "Decided by the adapter; not editable here.",
      "config.api.lockedAria": "The API protocol is decided by the adapter and cannot be edited directly",
      "config.api.override": "Set manually",
      "config.api.inheritReset": "Follow adapter default",
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
      "config.add.close": "Close",
      "config.add.fromCatalog": "Add from catalog",
      "config.custom.routeRequired": "Enter a Provider ID.",
      "config.custom.routePlaceholder": "e.g. my-gateway",
      "config.custom.displayNamePlaceholder": "e.g. My gateway",
      "config.custom.keyPlaceholder": "Leave blank to use the environment",
      "config.custom.modelsPlaceholder": "One model id per line, e.g. gpt-4o",
      "config.custom.modelsCount": "{count} models",
      "config.custom.cancel": "Cancel",
      "config.add.catalog": "Third-party model provider",
      "config.add.custom": "Custom model API",
      "config.add.catalogHint": "Pick OpenAI, Anthropic, Kimi, or another provider from the built-in catalog and enter its API key.",
      "config.add.customHint": "Connect a relay, a self-hosted server, or any other OpenAI- or Anthropic-compatible endpoint by its base URL, protocol, and models.",
      "config.add.catalogExhausted": "Every catalog provider is already configured.",
      "config.add.customUnavailable": "No API protocol is available to declare.",
      "config.edit": "Edit",
      "config.manage": "Settings",
      "config.manageAria": "Open provider settings for {provider}: API key, protocol, auto-retry",
      "config.models.openAria": "Open and edit the model catalog for {provider}, currently {count}",
      "config.manageSettings": "Provider settings",
      "config.listheadModels": "Model catalog (click to edit)",
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
      "config.model.remove": "Delete",
      "config.model.removeAria": "Delete the model {model}",
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
      "config.reasoning.add": "Add level",
      "config.reasoning.remove": "Delete level",
      "config.reasoning.offPlaceholder": "Turns reasoning off",
      "config.reasoning.helpText": "The API value is sent in the request’s reasoning-effort field, such as OpenAI’s reasoning_effort. It defaults to the level name; where the model provider’s API documentation specifies a different value, follow it. Off turns reasoning off and needs no value; a value already written in the configuration is kept and sent.",
      "config.reasoning.needsLevel": "Add at least one level besides Off, or turn reasoning levels off.",
      "config.reasoning.valueRequired": "Every level besides Off needs an API value, and no value can be empty.",
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
      const levelMap = unionMembers(refs, efforts).find((member) => member.type === "dict");
      if (levelMap === void 0) return [];
      return unionMembers(refs, deref(refs, levelMap.sKey)).map((member) => member.value).filter((value) => typeof value === "string");
    }
    function customProviderHost(namespaces) {
      for (const [ns, view] of namespaces) {
        const protocols = protocolChoices(view);
        if (protocols.length > 0) return { ns, protocols };
      }
      return void 0;
    }
    function customProviderOps(route, draft) {
      const id = route.trim();
      const name = draft.displayName.trim();
      const base = draft.baseURL.trim();
      const profile = {
        ...name === "" ? {} : { displayName: name },
        ...draft.keyRef === void 0 ? {} : { apiKeyEnv: draft.keyRef },
        api: draft.api,
        ...base === "" ? {} : { baseURL: base },
        models: draft.models.map((model) => ({ id: model }))
      };
      return [{ op: "set", path: ["providers", id], value: profile }];
    }
    function routeProblemOf(route, taken) {
      const id = route.trim();
      if (id === "") return "empty";
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) return "invalid";
      return taken.includes(id) ? "taken" : void 0;
    }
    function baseUrlProblemOf(baseURL) {
      const value = baseURL.trim();
      if (value === "") return "empty";
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:" ? void 0 : "invalid";
      } catch {
        return "invalid";
      }
    }
    function modelIdsOf(text) {
      const seen = /* @__PURE__ */ new Set();
      const ids = [];
      for (const line of text.split("\n")) {
        const id = line.trim();
        if (id === "" || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      return ids;
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
    var import_jsx_runtime = require("react/jsx-runtime");
    function AddProviderCard(props) {
      const { store, t: t2, host } = props;
      const [route, setRoute] = (0, import_react.useState)("");
      const [displayName, setDisplayName] = (0, import_react.useState)("");
      const [baseURL, setBaseURL] = (0, import_react.useState)("");
      const [api, setApi] = (0, import_react.useState)(host.protocols[0] ?? "");
      const [key, setKey] = (0, import_react.useState)("");
      const [modelsText, setModelsText] = (0, import_react.useState)("");
      const [busy, setBusy] = (0, import_react.useState)(false);
      const [failure, setFailure] = (0, import_react.useState)(null);
      const mounted = (0, import_react.useRef)(true);
      const taken = (0, import_react.useMemo)(
        () => props.rows.map((row) => row.entry.provider),
        [props.rows]
      );
      const problem = routeProblemOf(route, taken);
      const urlProblem = baseUrlProblemOf(baseURL);
      const models = modelIdsOf(modelsText);
      const editable = props.writable && !busy;
      const ready = problem === void 0 && urlProblem === void 0 && models.length > 0 && api !== "";
      const submit = (0, import_react.useCallback)(async () => {
        if (!ready) return;
        const revision = props.namespaces.get(host.ns)?.revision;
        const keyRef = key.trim() === "" ? void 0 : deriveKeyRef(route.trim());
        setBusy(true);
        setFailure(null);
        const outcome = await store.write(
          host.ns,
          customProviderOps(route.trim(), {
            displayName,
            baseURL,
            api,
            keyRef,
            models
          }),
          revision
        );
        if (!mounted.current) return;
        if (!outcome.ok) {
          setBusy(false);
          setFailure(outcome.message);
          return;
        }
        if (keyRef !== void 0) {
          const keyFailure = await store.storeCredential(keyRef, key.trim());
          if (!mounted.current) return;
          if (keyFailure !== void 0) {
            setBusy(false);
            setFailure(keyFailure);
            return;
          }
        }
        setBusy(false);
        props.onDone();
      }, [api, baseURL, displayName, host.ns, key, models, props, ready, route, store]);
      const hint = problem === "empty" ? t2(KEYS["config.custom.routeRequired"]) : problem === "invalid" ? t2(KEYS["config.route.invalid"]) : problem === "taken" ? t2(KEYS["config.route.taken"]) : urlProblem === "empty" ? t2(KEYS["config.baseUrl.required"]) : urlProblem === "invalid" ? t2(KEYS["config.baseUrl.invalid"]) : models.length === 0 ? t2(KEYS["config.route.needsModels"]) : null;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-custom zmd-card", id: "dmc-custom-provider", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-custom-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "zmd-title", children: t2(KEYS["config.add.custom"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "zmd-lede", children: t2(KEYS["config.add.customHint"]) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-custom-fields", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.route.label"]) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "zmd-input",
                type: "text",
                autoComplete: "off",
                spellCheck: false,
                value: route,
                disabled: !editable,
                placeholder: t2(KEYS["config.custom.routePlaceholder"]),
                "aria-invalid": problem === void 0 ? void 0 : true,
                onChange: (event) => {
                  setRoute(event.target.value);
                  setFailure(null);
                }
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.route.displayName"]) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "zmd-input",
                type: "text",
                autoComplete: "off",
                spellCheck: false,
                value: displayName,
                disabled: !editable,
                placeholder: t2(KEYS["config.custom.displayNamePlaceholder"]),
                onChange: (event) => {
                  setDisplayName(event.target.value);
                }
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-field dmc-field-span", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.baseUrl.label"]) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "zmd-input",
                type: "text",
                autoComplete: "off",
                spellCheck: false,
                value: baseURL,
                disabled: !editable,
                placeholder: t2(KEYS["config.baseUrl.placeholderGateway"]),
                "aria-invalid": urlProblem === "invalid" ? true : void 0,
                onChange: (event) => {
                  setBaseURL(event.target.value);
                }
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.api.label"]) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "select",
              {
                className: "zmd-select",
                value: api,
                disabled: !editable,
                onChange: (event) => {
                  setApi(event.target.value);
                },
                children: host.protocols.map((protocol) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: protocol, children: protocol }, protocol))
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.key.input"]) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "zmd-input",
                type: "password",
                autoComplete: "off",
                spellCheck: false,
                value: key,
                disabled: !editable,
                placeholder: t2(KEYS["config.custom.keyPlaceholder"]),
                onChange: (event) => {
                  setKey(event.target.value);
                }
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmc-field dmc-field-span", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.models.label"]) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "textarea",
              {
                className: "zmd-input dmc-custom-models",
                rows: 4,
                autoComplete: "off",
                spellCheck: false,
                value: modelsText,
                disabled: !editable,
                placeholder: t2(KEYS["config.custom.modelsPlaceholder"]),
                onChange: (event) => {
                  setModelsText(event.target.value);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-custom-count", children: t2(KEYS["config.custom.modelsCount"], { count: String(models.length) }) })
          ] })
        ] }),
        failure === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmc-custom-error", children: failure }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmc-custom-foot", children: [
          hint === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmc-custom-hint", children: hint }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-ghost",
              disabled: busy,
              onClick: props.onDone,
              children: t2(KEYS["config.custom.cancel"])
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-primary",
              disabled: !editable || !ready,
              onClick: () => {
                void submit();
              },
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.route.create"])
            }
          )
        ] })
      ] });
    }
    
    var import_react2 = require("react");
    var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    
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
    .dmc-model-input,
    .dmc-discover-search,
    .dmc-discover-check {
      box-sizing: border-box;
    }
    
    .dmc-catalog-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      margin: 0 0 14px;
      padding: 14px 16px;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmc-catalog-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    
    .dmc-catalog-title {
      margin: 0;
      color: var(--zmd-ink);
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
    }
    
    .dmc-catalog-status {
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-catalog-count {
      flex: 0 0 auto;
      margin-left: auto;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    
    .dmc-catalog-close {
      flex: none;
    }
    
    .dmc-catalog-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }
    
    .dmc-catalog-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding-top: 12px;
      border-top: 0.5px solid var(--zmd-line-strong);
    }
    
    .dmc-catalog-foot-note {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
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
      gap: 8px;
      padding: 12px;
      border: 0.5px solid var(--zmd-line-control);
      border-radius: var(--zmd-radius-well);
    }
    
    .dmc-catalog-guard-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .dmc-catalog-section {
      margin: 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
    }
    
    .dmc-catalog-notice {
      margin: 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      text-wrap: pretty;
    }
    
    .dmc-catalog-error {
      margin: 0;
      color: var(--zmd-danger);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
    
    .dmc-catalog-note {
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-model-list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    .dmc-model-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 10px;
      row-gap: 2px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 0.5px solid var(--zmd-line);
      color: var(--zmd-ink);
    }
    
    .dmc-model-row:last-child {
      border-bottom: 0;
    }
    
    .dmc-model-row[data-well='true'] {
      border-bottom-color: transparent;
    }
    
    .dmc-model-ref {
      min-width: 0;
      overflow: hidden;
      color: var(--zmd-ink);
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmc-model-actions {
      display: flex;
      align-items: center;
      justify-self: end;
      gap: 2px;
      min-width: 0;
    }
    
    .dmc-model-edit,
    .dmc-model-delete {
      flex: 0 0 auto;
    }
    
    .dmc-model-sub {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 2px 12px;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-model-alias {
      min-width: 0;
      color: var(--zmd-ink-secondary);
      overflow-wrap: anywhere;
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
    
    .dmc-model-well {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      margin: 8px 0 2px;
      padding: 12px;
      border: 0.5px solid var(--zmd-line-control);
      border-radius: var(--zmd-radius-well);
    }
    
    
    
    .dmc-model-fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }
    
    .dmc-model-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    
    .dmc-model-input,
    .dmc-discover-search {
      min-width: 0;
    }
    
    .dmc-model-input::placeholder,
    .dmc-discover-search::placeholder {
      color: var(--zmd-ink-dim);
    }
    
    .dmc-model-input[data-invalid='true'] {
      border-color: var(--zmd-danger);
    }
    
    .dmc-model-error {
      margin: 0;
      color: var(--zmd-danger);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
    
    .dmc-reasoning {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      padding-top: 12px;
      border-top: 0.5px solid var(--zmd-line-strong);
    }
    
    .dmc-reasoning-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      min-width: 0;
    }
    
    .dmc-reasoning .dmc-reasoning-switch {
      box-sizing: border-box;
      flex: 0 0 auto;
      align-self: center;
      width: 36px;
      height: 20px;
      margin-left: auto;
      padding: 2px;
      border: 0;
      border-radius: 999px;
      background: var(--zmd-line-strong);
      color: var(--zmd-ink-caption);
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-reasoning .dmc-reasoning-switch[aria-checked='true'] {
      background: var(--zmd-fill-primary);
      color: var(--zmd-on-primary);
    }
    
    .dmc-reasoning .dmc-reasoning-switch > span {
      display: block;
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: var(--dsw-alias-switch-thumb);
      transition: transform var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-reasoning .dmc-reasoning-switch[aria-checked='true'] > span {
      transform: translateX(16px);
    }
    
    .dmc-reasoning .dmc-reasoning-switch:disabled {
      opacity: 0.5;
      cursor: default;
    }
    
    .dmc-reasoning .dmc-reasoning-switch:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    .dmc-reasoning-columns,
    .dmc-reasoning-row {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    
    .dmc-reasoning-columns {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-reasoning-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    
    .dmc-reasoning-select,
    .dmc-reasoning-value {
      min-width: 0;
    }
    
    .dmc-reasoning-value::placeholder {
      color: var(--zmd-ink-dim);
    }
    
    .dmc-reasoning-remove {
      justify-self: end;
    }
    
    .dmc-reasoning-add {
      align-self: flex-start;
    }
    
    .dmc-reasoning-help {
      margin: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      text-wrap: pretty;
    }
    
    .dmc-model-add {
      flex: 0 0 auto;
    }
    
    .dmc-catalog-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    
    
    
    
    
    
    .dmc-discover {
      flex: none;
    }
    
    
    
    .dmc-discover-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 0.5px solid var(--zmd-line-strong);
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
      max-height: 300px;
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
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
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
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--zmd-fill-primary);
      cursor: pointer;
    }
    
    .dmc-discover-check:disabled {
      cursor: default;
    }
    
    .dmc-discover-id {
      min-width: 0;
      font-size: 14px;
      line-height: 22px;
      overflow-wrap: anywhere;
    }
    
    .dmc-discover-name {
      flex: 0 1 auto;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      text-align: right;
      overflow-wrap: anywhere;
    }
    
    .dmc-catalog-panel .zmd-btn-ghost:focus-visible,
    .dmc-catalog-panel .zmd-btn-secondary:focus-visible,
    .dmc-catalog-panel .zmd-btn-primary:focus-visible,
    .dmc-catalog-panel .zmd-btn-danger:focus-visible,
    .dmc-catalog-panel .dmc-model-input:focus-visible,
    .dmc-catalog-panel .dmc-reasoning-select:focus-visible,
    .dmc-catalog-panel .dmc-reasoning-value:focus-visible,
    .dmc-catalog-panel .dmc-discover-search:focus-visible,
    .dmc-catalog-panel .dmc-discover-check:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @container (max-width: 484px) {
      .dmc-catalog-head {
        flex-wrap: wrap;
      }
    
      .dmc-model-fields {
        gap: 10px;
      }
    
      .dmc-reasoning-columns,
      .dmc-reasoning-row {
        grid-template-columns: 96px minmax(0, 1fr) auto;
      }
    }
    
    @container (max-width: 400px) {
      .dmc-catalog-panel {
        padding: 12px;
      }
    
      .dmc-model-fields,
    
    
      .dmc-catalog-foot-actions {
        margin-left: 0;
      }
    }
    
    @container (max-width: 300px) {
      .dmc-catalog-panel {
        padding: 10px;
        gap: 10px;
      }
    
      .dmc-catalog-count {
        display: none;
      }
    
      .dmc-reasoning-columns {
        display: none;
      }
    
      .dmc-reasoning-row {
        grid-template-columns: minmax(0, 1fr) auto;
        row-gap: 6px;
      }
    
      .dmc-reasoning-select {
        grid-column: 1;
        grid-row: 1;
      }
    
      .dmc-reasoning-remove {
        grid-column: 2;
        grid-row: 1;
      }
    
      .dmc-reasoning-value {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    
      .dmc-discover-candidate {
        min-height: 36px;
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .dmc-model-row {
        transition: none;
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
    
    var import_jsx_runtime2 = require("react/jsx-runtime");
    var OFF_LEVEL = "off";
    var INITIAL_LEVELS = [OFF_LEVEL, "low", "medium", "high"];
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
      if (value === null) return [];
      if (!isRecordValue(value)) return void 0;
      return Object.entries(value).map(([level, wire]) => ({
        level,
        value: typeof wire === "string" ? wire : "",
        bad: typeof wire === "string" ? wire.length === 0 : !(wire === null && level === OFF_LEVEL),
        raw: wire
      }));
    }
    function withoutReasoningField(extra) {
      if (!("reasoningEfforts" in extra)) return extra;
      const next = { ...extra };
      delete next.reasoningEfforts;
      return next;
    }
    function seedModel(raw, key) {
      const extra = {};
      for (const [field, value] of Object.entries(raw)) {
        if (EDITED_FIELDS.includes(field)) continue;
        extra[field] = value;
      }
      const rawReasoning = raw.reasoningEfforts;
      const reasoning = reasoningRowsOf(rawReasoning);
      if (reasoning === void 0 && rawReasoning !== void 0) {
        extra.reasoningEfforts = rawReasoning;
      }
      return {
        key,
        id: typeof raw.id === "string" ? raw.id : "",
        name: typeof raw.name === "string" ? raw.name : "",
        contextWindow: typeof raw.contextWindow === "number" ? formatContext(raw.contextWindow) : "",
        maxTokens: typeof raw.maxTokens === "number" ? formatContext(raw.maxTokens) : "",
        storedWindow: typeof raw.contextWindow === "number" ? raw.contextWindow : void 0,
        storedTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : void 0,
        reasoning,
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
        reasoning: void 0,
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
    function reasoningEntriesOf(rows) {
      if (rows === void 0) return void 0;
      const entries = {};
      for (const row of rows) {
        if (row.raw !== void 0) {
          entries[row.level] = row.raw;
          continue;
        }
        entries[row.level] = row.level === OFF_LEVEL ? row.value === "" ? null : row.value : row.value === "" ? row.level : row.value;
      }
      return entries;
    }
    function storedValueOf(model) {
      const { contextWindow, maxTokens } = capacitiesOf(model);
      const reasoning = reasoningEntriesOf(model.reasoning);
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
      if (rows === void 0) return void 0;
      if (rows.some((row) => row.bad)) return KEYS["config.reasoning.valueRequired"];
      if (!rows.some((row) => row.level !== OFF_LEVEL)) return KEYS["config.reasoning.needsLevel"];
      return void 0;
    }
    function problemsOf(models, t2, editsReasoning) {
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
        if (!editsReasoning) continue;
        const reasoning = reasoningProblemOf(model.reasoning);
        if (reasoning !== void 0) messages.set(model.key, t2(reasoning));
      }
      return messages;
    }
    function ModelCatalog(props) {
      const { row, store, t: t2, onRequestClose } = props;
      const snapshot = (0, import_react2.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
      const settingsNs = row.entry.settingsNs;
      const settingsPath = row.entry.settingsPath;
      const modelsPath = (0, import_react2.useMemo)(() => [...settingsPath, "models"], [settingsPath]);
      const namespace = snapshot.namespaces.get(settingsNs);
      const writable = snapshot.writable;
      (0, import_react2.useEffect)(() => injectCatalogStyles(), []);
      const mounted = (0, import_react2.useRef)(true);
      (0, import_react2.useEffect)(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);
      const panelRef = (0, import_react2.useRef)(null);
      const levelChoices = (0, import_react2.useMemo)(
        () => row.entry.declared === true ? reasoningLevelChoices(namespace) : [],
        [namespace, row.entry.declared]
      );
      const raw = (0, import_react2.useMemo)(() => rawModelsOf(namespace?.value, settingsPath), [namespace, settingsPath]);
      const seed = (0, import_react2.useMemo)(() => seedModels(raw), [raw]);
      const storedModels = (0, import_react2.useMemo)(() => modelsOf(namespace?.value, settingsPath), [namespace, settingsPath]);
      const [draft, setDraft] = (0, import_react2.useState)(null);
      const models = draft ?? seed;
      const [busy, setBusy] = (0, import_react2.useState)(false);
      const [note, setNote] = (0, import_react2.useState)(null);
      const [discovery, setDiscovery] = (0, import_react2.useState)({ kind: "idle" });
      const baseline = (0, import_react2.useMemo)(() => canonical(raw.filter(isRecordValue)), [raw]);
      const dirty = canonical(models.map(storedValueOf)) !== baseline;
      const problems = (0, import_react2.useMemo)(
        () => problemsOf(models, t2, levelChoices.length > 0),
        [models, t2, levelChoices]
      );
      const invalid = problems.size > 0;
      (0, import_react2.useEffect)(() => {
        props.onDirtyChange(dirty);
      }, [dirty, props.onDirtyChange]);
      (0, import_react2.useEffect)(() => () => {
        props.onDirtyChange(false);
      }, [props.onDirtyChange]);
      const escapeRef = (0, import_react2.useRef)(() => {
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
      (0, import_react2.useEffect)(() => {
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
        const extra = edit.reasoning === null ? withoutReasoningField(model.extra) : model.extra;
        const next = {
          key: model.key,
          id: edit.id ?? model.id,
          name: edit.name ?? model.name,
          contextWindow: edit.contextWindow ?? model.contextWindow,
          maxTokens: edit.maxTokens ?? model.maxTokens,
          storedWindow: model.storedWindow,
          storedTokens: model.storedTokens,
          reasoning: edit.reasoning === void 0 ? model.reasoning : edit.reasoning === null ? void 0 : edit.reasoning,
          extra,
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
          reasoning: void 0,
          extra: {},
          open: false
        };
        patch((rows) => [...rows, blank]);
      };
      const removeModel = (key) => {
        patch((rows) => rows.filter((row2) => row2.key !== key));
      };
      const initialReasoning = () => {
        const levels = INITIAL_LEVELS.filter((level) => levelChoices.includes(level));
        if (!levels.some((level) => level !== OFF_LEVEL)) {
          const first = levelChoices.find((level) => level !== OFF_LEVEL);
          if (first !== void 0) levels.push(first);
        }
        return levels.map((level) => ({
          level,
          value: level === OFF_LEVEL ? "" : level,
          bad: false,
          raw: void 0
        }));
      };
      const nextReasoningLevel = (used) => {
        const highest = levelChoices.reduce(
          (position, level, index) => used.has(level) ? index : position,
          -1
        );
        return levelChoices.find((level, index) => index > highest && !used.has(level)) ?? levelChoices.find((level) => !used.has(level));
      };
      const levelOptionsFor = (current, used) => {
        const options = [...levelChoices];
        if (!options.includes(current)) options.unshift(current);
        return options.filter((level) => level === current || !used.has(level));
      };
      const toggleReasoning = (model, on) => {
        updateModel(model, { reasoning: on ? initialReasoning() : null });
      };
      const addReasoning = (model) => {
        const used = new Set((model.reasoning ?? []).map((entry) => entry.level));
        const level = nextReasoningLevel(used);
        if (level === void 0) return;
        updateModel(model, {
          reasoning: [
            ...model.reasoning ?? [],
            { level, value: level === OFF_LEVEL ? "" : level, bad: false, raw: void 0 }
          ]
        });
      };
      const removeReasoning = (model, index) => {
        const rows = model.reasoning ?? [];
        updateModel(model, { reasoning: rows.filter((_, position) => position !== index) });
      };
      const changeReasoningLevel = (model, index, level) => {
        const rows = model.reasoning ?? [];
        const row2 = rows[index];
        if (row2 === void 0 || row2.level === level) return;
        const keep = row2.level !== OFF_LEVEL && level !== OFF_LEVEL && row2.value !== "" && row2.value !== row2.level;
        updateModel(model, {
          reasoning: rows.map((entry, position) => position === index ? {
            level,
            value: level === OFF_LEVEL ? "" : keep ? row2.value : level,
            bad: false,
            raw: void 0
          } : entry)
        });
      };
      const changeReasoningValue = (model, index, value) => {
        const rows = model.reasoning ?? [];
        updateModel(model, {
          reasoning: rows.map((entry, position) => position === index ? { level: entry.level, value, bad: false, raw: void 0 } : entry)
        });
      };
      const settleReasoningValue = (model, index) => {
        const rows = model.reasoning ?? [];
        const row2 = rows[index];
        if (row2 === void 0 || row2.level === OFF_LEVEL) return;
        if (row2.value.trim() !== "") return;
        updateModel(model, {
          reasoning: rows.map((entry, position) => position === index ? { level: entry.level, value: entry.level, bad: false, raw: void 0 } : entry)
        });
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
        const firstProblem = [...problemsOf(merged, t2, levelChoices.length > 0).values()][0];
        if (firstProblem !== void 0) {
          setDiscovery({ ...discovery, note: firstProblem });
          return;
        }
        const written = await writeModels(merged);
        if (written && mounted.current) setDiscovery({ kind: "idle" });
      };
      const catalogHead = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-catalog-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "dmc-catalog-title", children: t2(KEYS["config.models.label"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-catalog-status", children: storedModels.length > 0 ? t2(KEYS["config.models.customized"]) : t2(KEYS["config.models.inherited"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-catalog-count zmd-num", children: t2(KEYS["config.models.count"], { count: String(models.length) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "zmd-btn-ghost dmc-catalog-close", onClick: onRequestClose, children: t2(KEYS["config.catalog.collapse"]) })
      ] });
      const guardLine = props.confirming ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-catalog-guard", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.catalog.unsaved"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-catalog-guard-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "zmd-btn-secondary", onClick: props.onKeepEditing, children: t2(KEYS["config.catalog.keepEditing"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "zmd-btn-danger", onClick: props.onDiscard, children: t2(KEYS["config.catalog.discard"]) })
        ] })
      ] }) : null;
      const panel = (body2, foot2) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          className: "dmc-catalog-panel zmd-well",
          id: `dmc-catalog-${row.entry.provider}`,
          ref: panelRef,
          children: [
            catalogHead,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-catalog-body", children: [
              guardLine,
              body2
            ] }),
            foot2
          ]
        }
      );
      if (namespace === void 0) {
        return panel(
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: snapshot.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.loadFailed"]) }),
            snapshot.error === null ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-error", children: snapshot.error })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-status", children: t2(KEYS["config.models.inherited"]) }) }),
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
        const disabled = !writable || busy;
        const alias = model.name.trim();
        const context = formatWindowStatement(model.contextWindow, model.storedWindow);
        const output = formatWindowStatement(model.maxTokens, model.storedTokens);
        const reasoningUsed = new Set((model.reasoning ?? []).map((entry) => entry.level));
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "li",
          {
            className: "dmc-model-row",
            "data-key": model.key,
            "data-invalid": message === void 0 ? void 0 : "true",
            "data-well": model.open ? "true" : void 0,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-model-ref", title: model.id === "" ? void 0 : model.id, children: model.id === "" ? t2(KEYS["config.model.newLabel"]) : model.id }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-model-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-model-delete zmd-btn-danger",
                    disabled,
                    "aria-label": t2(KEYS["config.model.removeAria"], { model: model.id === "" ? t2(KEYS["config.model.newLabel"]) : model.id }),
                    onClick: () => {
                      removeModel(model.key);
                    },
                    children: t2(KEYS["config.model.remove"])
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-model-edit zmd-btn-ghost",
                    "aria-expanded": model.open,
                    "aria-controls": wellId,
                    onClick: () => {
                      updateModel(model, { open: !model.open });
                    },
                    children: t2(model.open ? KEYS["config.catalog.collapse"] : KEYS["config.edit"])
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-model-sub", children: [
                alias === "" || alias === model.id ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-model-alias", children: alias }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-model-facts", children: [
                  context === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-model-fact", children: [
                    t2(KEYS["config.model.contextShort"]),
                    " ",
                    context
                  ] }),
                  output === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-model-fact", children: [
                    t2(KEYS["config.model.outputShort"]),
                    " ",
                    output
                  ] }),
                  context === "" && output === "" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-model-fact", children: t2(KEYS["config.model.capacityDefault"]) }) : null
                ] })
              ] }),
              model.open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-model-well", id: wellId, children: [
                message === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-model-error", children: message }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-model-fields", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-model-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "zmd-label", htmlFor: `dmc-model-id-${model.key}`, children: t2(KEYS["config.model.id"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "input",
                      {
                        className: "dmc-model-input zmd-input",
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
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-model-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "zmd-label", htmlFor: `dmc-model-name-${model.key}`, children: t2(KEYS["config.model.name"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "input",
                      {
                        className: "dmc-model-input zmd-input",
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
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-model-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "zmd-label", htmlFor: `dmc-model-window-${model.key}`, children: t2(KEYS["config.model.contextWindow"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "input",
                      {
                        className: "dmc-model-input zmd-input",
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
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-model-field", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "zmd-label", htmlFor: `dmc-model-tokens-${model.key}`, children: t2(KEYS["config.model.maxTokens"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "input",
                      {
                        className: "dmc-model-input zmd-input",
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
                levelChoices.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-reasoning", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-reasoning-head", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.reasoning.label"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      import_dsh_client_ui_primitives.Switch,
                      {
                        className: "dmc-reasoning-switch",
                        checked: model.reasoning !== void 0,
                        label: t2(KEYS["config.reasoning.label"]),
                        disabled,
                        onChange: (on) => {
                          toggleReasoning(model, on);
                        }
                      }
                    )
                  ] }),
                  model.reasoning === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                    model.reasoning.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-reasoning-columns", "aria-hidden": "true", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t2(KEYS["config.reasoning.level"]) }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t2(KEYS["config.reasoning.value"]) }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", {})
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "div",
                      {
                        className: "dmc-reasoning-rows",
                        role: "group",
                        "aria-label": t2(KEYS["config.reasoning.label"]),
                        children: model.reasoning.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-reasoning-row", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                            "select",
                            {
                              className: "zmd-select dmc-reasoning-select",
                              value: entry.level,
                              disabled,
                              "aria-label": `${t2(KEYS["config.reasoning.level"])} ${index + 1}`,
                              onChange: (event) => {
                                changeReasoningLevel(model, index, event.target.value);
                              },
                              children: levelOptionsFor(entry.level, reasoningUsed).map((level) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: level, children: level }, level))
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                            "input",
                            {
                              className: "zmd-input dmc-reasoning-value",
                              type: "text",
                              autoComplete: "off",
                              spellCheck: false,
                              value: entry.value,
                              disabled: disabled || entry.level === OFF_LEVEL,
                              "aria-invalid": entry.bad ? true : void 0,
                              "aria-label": `${entry.level} ${t2(KEYS["config.reasoning.value"])}`,
                              placeholder: entry.level === OFF_LEVEL ? t2(KEYS["config.reasoning.offPlaceholder"]) : entry.level,
                              onChange: (event) => {
                                changeReasoningValue(model, index, event.target.value);
                              },
                              onBlur: () => {
                                settleReasoningValue(model, index);
                              }
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                            "button",
                            {
                              type: "button",
                              className: "zmd-btn-danger dmc-reasoning-remove",
                              disabled,
                              "aria-label": `${t2(KEYS["config.reasoning.remove"])} ${entry.level}`,
                              onClick: () => {
                                removeReasoning(model, index);
                              },
                              children: t2(KEYS["config.reasoning.remove"])
                            }
                          )
                        ] }, `${entry.level}-${index}`))
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "zmd-btn-ghost dmc-reasoning-add",
                        disabled: disabled || levelChoices.every((level) => reasoningUsed.has(level)),
                        onClick: () => {
                          addReasoning(model);
                        },
                        children: t2(KEYS["config.reasoning.add"])
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-reasoning-help", children: t2(KEYS["config.reasoning.helpText"]) })
                  ] })
                ] })
              ] }) : null
            ]
          },
          model.key
        );
      };
      const body = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        writable ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.readOnly"]) }),
        storedModels.length === 0 && models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.models.empty"]) }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "dmc-model-list", children: models.map((model) => modelRow(model)) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-catalog-tools", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "zmd-btn-ghost dmc-model-add", disabled: !writable || busy, onClick: addModel, children: t2(KEYS["config.model.add"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-ghost dmc-discover",
              disabled: busy || discovery.kind === "fetching",
              onClick: () => {
                void fetchModels();
              },
              children: t2(KEYS["config.fetch.action"])
            }
          ),
          discovery.kind === "fetching" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-catalog-status", children: t2(KEYS["config.fetch.fetching"]) }) : null
        ] }),
        discovery.kind === "needsBaseUrl" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.needsBaseUrl"]) }) : null,
        discovery.kind === "empty" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.empty"]) }) : null,
        discovery.kind === "error" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-error", children: discovery.message }) : null,
        discovery.kind === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-discover-panel", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "dmc-catalog-section", children: t2(KEYS["config.fetch.title"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.description"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              className: "zmd-input dmc-discover-search",
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
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-discover-tools", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-catalog-status", children: t2(KEYS["config.fetch.count"], {
              count: String(visible.length),
              inCatalog: String(listedInCatalog)
            }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "zmd-btn-ghost",
                disabled: addable.length === 0 || allSelected,
                onClick: () => {
                  selectAll(true);
                },
                children: t2(KEYS["config.fetch.selectAll"])
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "zmd-btn-ghost",
                disabled: selectedAddable.length === 0,
                onClick: () => {
                  selectAll(false);
                },
                children: t2(KEYS["config.fetch.deselectAll"])
              }
            )
          ] }),
          visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-notice", children: t2(KEYS["config.fetch.noMatches"]) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "dmc-discover-list", children: listedGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react2.Fragment, { children: [
            grouped && group.label !== "" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "dmc-discover-group", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: group.label }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: group.items.length })
            ] }) : null,
            group.items.map((candidate) => {
              const present = presentIds.has(candidate.id);
              return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "li",
                {
                  className: "dmc-discover-candidate",
                  "data-present": present ? "true" : void 0,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dmc-discover-label", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-discover-id", children: candidate.id })
                    ] }),
                    candidate.name === void 0 || candidate.name === candidate.id ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-discover-name", children: candidate.name })
                  ]
                },
                candidate.id
              );
            })
          ] }, `group-${group.label}`)) }),
          discovery.note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dmc-catalog-error", children: discovery.note }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dmc-catalog-tools", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-primary",
              disabled: !writable || busy || selectedAddable.length === 0,
              onClick: () => {
                void adopt();
              },
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.fetch.adopt"])
            }
          ) })
        ] }) : null
      ] });
      const foot = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dmc-catalog-foot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-catalog-foot-note", children: t2(KEYS["config.models.count"], { count: String(models.length) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dmc-catalog-foot-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-ghost",
              disabled: !writable || busy || !canReset,
              onClick: () => {
                void reset();
              },
              children: t2(KEYS["config.models.reset"])
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
        note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dmc-catalog-note", children: note })
      ] });
      return panel(body, foot);
    }
    
    var import_react3 = require("react");
    
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
    
    var import_jsx_runtime3 = require("react/jsx-runtime");
    function RetryField(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-retry-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "zmd-label", htmlFor: props.id, children: props.label }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-retry-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              id: props.id,
              className: "zmd-input dmc-retry-input",
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
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-retry-unit", children: props.unit })
        ] })
      ] });
    }
    function RetryEditor(props) {
      const { row, namespace, store, t: t2, writable } = props;
      const provider = row.entry.provider;
      const ns = row.entry.settingsNs;
      const scope = row.entry.settingsPath;
      const [retriesDraft, setRetriesDraft] = (0, import_react3.useState)(null);
      const [capDraft, setCapDraft] = (0, import_react3.useState)(null);
      const [retriesInvalid, setRetriesInvalid] = (0, import_react3.useState)(false);
      const [capInvalid, setCapInvalid] = (0, import_react3.useState)(false);
      const [busy, setBusy] = (0, import_react3.useState)(false);
      const [note, setNote] = (0, import_react3.useState)(null);
      const mounted = (0, import_react3.useRef)(true);
      (0, import_react3.useEffect)(() => {
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
      const preview = (0, import_react3.useMemo)(() => {
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
      const settle = (0, import_react3.useCallback)((message) => {
        setRetriesDraft(null);
        setCapDraft(null);
        setNote(message);
      }, []);
      const commit = (0, import_react3.useCallback)(async () => {
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
      const reset = (0, import_react3.useCallback)(async () => {
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
      const silent = always || preview.retries === 0;
      const line = preview.retries === 0 ? t2(KEYS["config.retryPolicy.zero"]) : t2(KEYS["config.retryPolicy.preview"], {
        first: formatDuration(preview.first),
        total: formatDuration(preview.longest)
      });
      const problem = retriesInvalid ? t2(KEYS["config.retryPolicy.badRetries"], { count: String(MAX_RETRIES) }) : capInvalid ? t2(KEYS["config.retryPolicy.badCap"], { count: String(MAX_MAX_DELAY_MS / 1e3) }) : null;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-retry", id: `dmc-retry-${provider}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-retry-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "zmd-label", children: t2(KEYS["config.retryPolicy.trigger"]) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-retry-state", children: t2(view.declared ? KEYS["config.retryPolicy.declared"] : KEYS["config.retryPolicy.inherits"]) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-retry-fields", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
        problem === null ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-alert", children: problem }),
        always ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-retry-line zmd-num", children: line }),
        always ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.always"]) }) : null,
        silent || always ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.rateLimit"]) }),
        writable ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.retryPolicy.unavailable"]) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dmc-retry-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-primary",
              disabled: !editable || !dirty,
              onClick: () => {
                void commit();
              },
              children: busy ? t2(KEYS["config.applying"]) : t2(KEYS["config.apply"])
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "zmd-btn-ghost",
              disabled: !editable || !view.declared,
              onClick: () => {
                void reset();
              },
              children: t2(KEYS["config.retryPolicy.reset"])
            }
          ),
          note === null ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dmc-notice", children: note })
        ] })
      ] });
    }
    
    var STYLE_ELEMENT_ID2 = "dsh-rabbit-model-picker-model-config-styles";
    var CSS2 = `
    .dmc-page {
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 720px;
      padding: 4px 0 8px;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmc-page,
    .dmc-row,
    .dmc-add-choice,
    .dmc-picker-item,
    .dmc-manage,
    .dmc-danger,
    .dmc-retry-input,
    .dmc-well,
    .dmc-ledger,
    .dmc-picker {
      box-sizing: border-box;
    }
    
    .dmc-head {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    
    .dmc-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    
    .dmc-add-top {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      height: 32px;
      padding: 0 12px;
      border: 0.5px solid var(--zmd-line-strong);
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--zmd-fast) var(--zmd-ease),
        border-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-add-top:hover:not(:disabled) {
      background: var(--zmd-hover);
    }
    
    .dmc-add-top[aria-expanded='true'] {
      border-color: var(--zmd-ink);
    }
    
    .dmc-add-top:disabled {
      border-color: var(--zmd-line);
      color: var(--zmd-ink-dim);
      cursor: not-allowed;
    }
    
    .dmc-add-top:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    .dmc-add-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }
    
    .dmc-add-choices {
      display: inline-flex;
      flex: 0 1 auto;
      min-width: 0;
      gap: 2px;
      padding: 3px;
      border-radius: var(--zmd-radius-control);
      background: var(--zmd-hover);
    }
    
    .dmc-add-choice {
      height: 28px;
      padding: 0 12px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease), color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-add-choice[data-active='true'] {
      background: var(--zmd-field);
      color: var(--zmd-ink);
      box-shadow: var(--dsw-shadow-lv1);
    }
    
    .dmc-add-choice:hover:not(:disabled):not([data-active='true']) {
      color: var(--zmd-ink);
    }
    
    .dmc-add-choice:disabled {
      color: var(--zmd-ink-dim);
      cursor: not-allowed;
    }
    
    .dmc-add-choice:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    .dmc-custom {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px 16px;
    }
    
    .dmc-custom-head {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .dmc-custom-fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px 16px;
    }
    
    .dmc-field-span {
      grid-column: 1 / -1;
    }
    
    .dmc-custom-models {
      height: auto;
      min-height: 84px;
      padding: 8px 10px;
      line-height: 20px;
      resize: vertical;
      font-family: var(--zmd-font);
    }
    
    .dmc-custom-count {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmc-custom-error {
      margin: 0;
      color: var(--zmd-danger);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-custom-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-top: 12px;
      border-top: 0.5px solid var(--zmd-line-strong);
    }
    
    .dmc-custom-hint {
      flex: 1 1 200px;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-custom-foot .zmd-btn-ghost {
      margin-left: auto;
    }
    
    .dmc-notice {
      margin: 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      text-wrap: pretty;
    }
    
    .dmc-notice-action {
      margin-left: 8px;
      height: 24px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      line-height: 18px;
      cursor: pointer;
    }
    
    .dmc-notice-action:hover {
      background: var(--zmd-hover);
    }
    
    .dmc-alert {
      margin: 0;
      color: var(--zmd-danger);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-empty {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .dmc-ledger {
      margin: 0;
      padding: 0;
      overflow: hidden;
      list-style: none;
    }
    
    .dmc-listhead,
    .dmc-rowhead {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      column-gap: 12px;
      align-items: center;
      min-width: 0;
    }
    
    .dmc-listhead {
      min-height: 34px;
      padding: 0 14px;
      border-bottom: 0.5px solid var(--zmd-line);
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
    }
    
    .dmc-listhead-models,
    .dmc-listhead-action {
      justify-self: end;
    }
    
    .dmc-row {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 0 14px;
      border-bottom: 0.5px solid var(--zmd-line);
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-row:last-child {
      border-bottom: 0;
    }
    
    .dmc-row:hover,
    .dmc-row:focus-within,
    .dmc-row[data-open='true'] {
      background: var(--zmd-hover);
    }
    
    .dmc-rowhead {
      min-height: 52px;
    }
    
    .dmc-name {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
      color: var(--zmd-ink);
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
    }
    
    .dmc-name-dot {
      flex: 0 0 8px;
      align-self: center;
    }
    
    .dmc-name-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmc-route {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmc-models {
      display: inline-flex;
      align-items: center;
      justify-self: end;
      gap: 6px;
      min-width: 0;
      max-width: 100%;
      height: 28px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--zmd-fast) var(--zmd-ease),
        color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-models:hover {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmc-models[aria-expanded='true'] {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmc-models:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    
    .dmc-models-value {
      text-decoration: underline;
      text-decoration-color: var(--zmd-line-strong);
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
    }
    
    .dmc-models:hover .dmc-models-value,
    .dmc-models[aria-expanded='true'] .dmc-models-value {
      text-decoration-color: var(--zmd-accent);
    }
    
    .dmc-chevron {
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      transition: transform var(--zmd-base) var(--zmd-ease);
    }
    
    .dmc-chevron-open {
      transform: rotate(180deg);
    }
    
    
    
    .dmc-manage {
      justify-self: end;
    }
    
    .dmc-pending {
      padding-bottom: 8px;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-well {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0 0 14px;
      padding: 14px 16px;
    }
    
    .dmc-diagnostic {
      margin: 0;
      color: var(--zmd-danger);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
    
    .dmc-fields {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      gap: 12px 16px;
      margin: 0;
    }
    
    .dmc-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      margin: 0;
    }
    
    
    .dmc-field-label {
      margin: 0;
    }
    
    .dmc-field-value {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      min-width: 0;
      min-height: 32px;
      margin: 0;
      font-size: 14px;
      line-height: 22px;
    }
    
    .dmc-locked {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      height: 32px;
      padding: 0 10px;
      border: 0.5px dashed var(--zmd-line-control);
      border-radius: var(--zmd-radius-control);
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-size: 13px;
      line-height: 20px;
    }
    
    .dmc-locked > svg {
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
    }
    
    .dmc-api-override {
      align-self: flex-start;
    }
    
    .dmc-field-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 12px;
      flex: 1 1 100%;
      min-width: 0;
      margin-top: 2px;
    }
    
    .dmc-field-fact {
      flex: 1 1 96px;
      min-width: 0;
      margin: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      text-wrap: pretty;
    }
    
    .dmc-quiet {
      color: var(--zmd-ink-secondary);
    }
    
    .dmc-key-input {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    
    .dmc-key-input .zmd-input {
      padding-right: 34px;
    }
    
    .dmc-key-reveal {
      position: absolute;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink-mute);
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease), color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-key-reveal:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmc-key-reveal:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    .dmc-key-reveal:disabled {
      color: var(--zmd-ink-dim);
      cursor: default;
    }
    
    .dmc-well-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px 12px;
      padding-top: 12px;
      border-top: 0.5px solid var(--zmd-line-strong);
    }
    
    .dmc-well-foot-hint {
      flex: 1 1 260px;
      min-width: 0;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
      text-wrap: pretty;
    }
    
    .dmc-retry {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;
      border-top: 0.5px solid var(--zmd-line-strong);
    }
    
    .dmc-retry-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
    }
    
    .dmc-retry-state {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-retry-fields {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px 16px;
    }
    
    .dmc-retry-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    
    .dmc-retry-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .dmc-retry-input {
      width: 76px;
    }
    
    .dmc-retry-unit {
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmc-retry-line {
      margin: 0;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
    }
    
    .dmc-retry-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    .dmc-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    
    
    .dmc-picker {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
    }
    
    .dmc-picker-list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    .dmc-picker-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 40px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--zmd-radius-control);
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 22px;
      text-align: left;
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmc-picker-item:hover:not(:disabled) {
      background: var(--zmd-hover);
    }
    
    .dmc-picker-item:active:not(:disabled) {
      background: var(--zmd-active);
    }
    
    .dmc-picker-item:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    
    .dmc-picker-item:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: -2px;
    }
    
    
    .dmc-page .zmd-btn-ghost:focus-visible,
    .dmc-page .zmd-btn-secondary:focus-visible,
    .dmc-page .zmd-btn-primary:focus-visible,
    .dmc-page .zmd-btn-danger:focus-visible,
    .dmc-page .dmc-notice-action:focus-visible,
    .dmc-page .dmc-picker-item:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @container (max-width: 484px) {
      .dmc-listhead,
      .dmc-rowhead {
        grid-template-columns: minmax(0, 1fr) auto auto;
        column-gap: 10px;
      }
    
      .dmc-fields {
        gap: 12px;
      }
    }
    
    @container (max-width: 400px) {
      .dmc-listhead {
        display: none;
      }
    
      .dmc-rowhead {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 8px;
        padding: 10px 0;
      }
    
      .dmc-name {
        flex: 1 1 100%;
      }
    
      .dmc-models {
        order: 1;
      }
    
    
      .dmc-manage {
        order: 3;
        margin-left: auto;
      }
    
      .dmc-custom-fields {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    
    @container (max-width: 300px) {
      .dmc-row {
        padding: 0 12px;
      }
    
      .dmc-well {
        padding: 12px;
      }
    
      .dmc-fields {
        grid-template-columns: minmax(0, 1fr);
      }
    
      .dmc-field-value {
        min-height: 0;
      }
    
      .dmc-well-foot {
        align-items: flex-start;
        flex-direction: column;
      }
    
      .dmc-well-foot-hint {
        flex: 0 0 auto;
        margin-right: 0;
      }
    
      .dmc-add-top {
        align-self: flex-start;
      }
    
      .dmc-custom {
        padding: 12px;
      }
    
      .dmc-custom-foot .zmd-btn-ghost {
        margin-left: 0;
      }
    }
    
    @container (max-width: 240px) {
      .dmc-page {
        gap: 10px;
      }
    
      .dmc-row {
        padding: 0 10px;
      }
    
      .dmc-rowhead {
        padding: 10px 0;
        gap: 2px 6px;
      }
    
      .dmc-name {
        flex: 1 1 100%;
        flex-wrap: wrap;
        gap: 0 6px;
        font-size: 13px;
        line-height: 20px;
      }
    
      .dmc-name-text {
        white-space: normal;
        overflow-wrap: anywhere;
      }
    
      .dmc-route {
        flex: 1 1 100%;
        white-space: normal;
        overflow-wrap: anywhere;
      }
    
    
      .dmc-well {
        padding: 10px;
        gap: 10px;
      }
    
      .dmc-picker {
        padding: 10px;
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .dmc-row,
      .dmc-add-choice,
      .dmc-picker-item {
        transition: none;
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
    
    var import_jsx_runtime4 = require("react/jsx-runtime");
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
      const inheritedProtocol = inheritedProtocolOf(namespace, row);
      const keyRef = credentialRefFor(row);
      const keyPresent = keyConfigured(row);
      const models = namespace === void 0 ? 0 : modelsOf(namespace.value, row.entry.settingsPath).length;
      const removable = row.entry.settingsPath.length > 0 && namespace !== void 0 && isRemovable(namespace, row.entry.settingsPath);
      const retryable = retryCapable(namespace, row.entry.settingsPath);
      const clearsKey = keyPresent && keyWritable(row) && keyRefOf(row) === deriveKeyRef(provider);
      const [draft, setDraft] = (0, import_react4.useState)("");
      const [revealed, setRevealed] = (0, import_react4.useState)(false);
      const [wellOpen, setWellOpen] = (0, import_react4.useState)(false);
      const shown = reading.diagnostic;
      (0, import_react4.useEffect)(() => {
        if (!props.catalogOpen) return;
        setDraft("");
        setWellOpen(false);
      }, [props.catalogOpen]);
      const commit = (0, import_react4.useCallback)((explicit) => {
        const value = draft;
        setDraft("");
        if (!explicit && value.length === 0) return;
        props.onSaveKey(value);
      }, [draft, props]);
      const lifecycleHint = row.configured ? t2(
        clearsKey ? KEYS["config.delete.descriptionWithCredential"] : KEYS["config.delete.description"],
        { provider: displayName }
      ) : t2(KEYS["config.add.catalogHint"]);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "li",
        {
          className: "dmc-row",
          "data-open": props.catalogOpen || wellOpen ? "true" : void 0,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-rowhead", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dmc-name", title: t2(reading.word), children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "span",
                  {
                    className: "zmd-dot dmc-name-dot",
                    "data-tone": reading.answer === "ready" ? "ok" : "bad",
                    role: "img",
                    "aria-label": t2(reading.word)
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-name-text", children: displayName }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-route", children: provider })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dmc-models",
                  id: `dmc-catalog-btn-${provider}`,
                  "aria-expanded": props.catalogOpen,
                  "aria-controls": `dmc-catalog-${provider}`,
                  "aria-label": t2(KEYS["config.models.openAria"], {
                    provider: displayName,
                    count: models > 0 ? t2(KEYS["config.models.count"], { count: String(models) }) : t2(KEYS["config.models.default"])
                  }),
                  title: models === 0 ? t2(KEYS["config.models.inherited"]) : void 0,
                  onClick: props.onOpenCatalog,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-models-value", children: models > 0 ? t2(KEYS["config.models.count"], { count: String(models) }) : t2(KEYS["config.models.default"]) }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                      "svg",
                      {
                        className: props.catalogOpen ? "dmc-chevron dmc-chevron-open" : "dmc-chevron",
                        width: "12",
                        height: "12",
                        viewBox: "0 0 12 12",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        "aria-hidden": "true",
                        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3 4.5L6 7.5L9 4.5" })
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-manage zmd-btn-secondary",
                  "aria-expanded": wellOpen,
                  "aria-controls": `dmc-well-${provider}`,
                  "aria-label": t2(KEYS["config.manageAria"], { provider: displayName }),
                  onClick: () => {
                    if (wellOpen) setDraft("");
                    setWellOpen(!wellOpen);
                  },
                  children: t2(KEYS["config.manage"])
                }
              )
            ] }),
            busy ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-pending", children: props.pending }) : null,
            wellOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-well zmd-well", id: `dmc-well-${provider}`, children: [
              shown === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dmc-diagnostic", children: shown }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dl", { className: "dmc-fields", children: [
                session ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { className: "dmc-field-label zmd-label", children: t2(KEYS["config.credential.label"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { className: "dmc-field-value", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-quiet", children: t2(KEYS["config.credential.session"]) }) })
                ] }) : keyRef === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { className: "dmc-field-label zmd-label", children: t2(KEYS["config.credential.label"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dd", { className: "dmc-field-value", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-key-input", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                        "input",
                        {
                          className: "zmd-input",
                          type: revealed ? "text" : "password",
                          autoComplete: "new-password",
                          spellCheck: false,
                          value: draft,
                          disabled: !editable,
                          "aria-label": t2(KEYS["config.key.input"]),
                          placeholder: keyPresent ? t2(KEYS["config.key.placeholderSaved"]) : t2(KEYS["config.key.placeholderFallback"], { hint: keyRef }),
                          onChange: (event) => {
                            setRevealed(false);
                            setDraft(event.target.value);
                          },
                          onKeyDown: (event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commit(true);
                            }
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              setDraft("");
                            }
                          }
                        }
                      ),
                      draft.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "dmc-key-reveal",
                          "aria-label": t2(revealed ? KEYS["config.key.hide"] : KEYS["config.key.reveal"]),
                          "aria-pressed": revealed,
                          disabled: !editable,
                          onClick: () => {
                            setRevealed((current) => !current);
                          },
                          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                            "svg",
                            {
                              width: "16",
                              height: "16",
                              viewBox: "0 0 16 16",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: "1.3",
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                              "aria-hidden": "true",
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z" }),
                                revealed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M2.5 2.5L13.5 13.5" })
                              ]
                            }
                          )
                        }
                      )
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-field-foot", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dmc-field-fact", children: keyPresent ? t2(KEYS["config.key.stateSaved"]) : t2(KEYS["config.key.stateFallback"], { hint: keyRef }) }),
                      keyPresent ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "zmd-btn-ghost",
                          disabled: !editable || !keyWritable(row),
                          onClick: props.onClearKey,
                          children: t2(KEYS["config.key.clear"])
                        }
                      ) : null
                    ] })
                  ] })
                ] }),
                protocols.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { className: "dmc-field-label zmd-label", children: t2(KEYS["config.api.label"]) }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { className: "dmc-field-value", children: storedApi === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dmc-locked", "aria-label": t2(KEYS["config.api.lockedAria"]), children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                        "svg",
                        {
                          width: "14",
                          height: "14",
                          viewBox: "0 0 16 16",
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: "1.4",
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          "aria-hidden": "true",
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "3.5", y: "7", width: "9", height: "6.5", rx: "1" }),
                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: inheritedProtocol === void 0 ? t2(KEYS["config.api.followingDefault"]) : protocolLabel(t2, inheritedProtocol) })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-field-foot", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dmc-field-fact", children: t2(KEYS["config.api.inheritedNote"]) }),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                        "button",
                        {
                          type: "button",
                          className: "zmd-btn-ghost dmc-api-override",
                          disabled: !editable,
                          onClick: () => {
                            props.onProtocol(protocols[0] ?? "");
                          },
                          children: t2(KEYS["config.api.override"])
                        }
                      )
                    ] })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                      "select",
                      {
                        className: "zmd-select",
                        value: storedApi,
                        disabled: !editable,
                        "aria-label": t2(KEYS["config.api.label"]),
                        onChange: (event) => {
                          props.onProtocol(event.target.value);
                        },
                        children: protocols.map((protocol) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: protocol, children: protocolLabel(t2, protocol) }, protocol))
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "zmd-btn-ghost dmc-api-override",
                        disabled: !editable,
                        onClick: () => {
                          props.onProtocol("");
                        },
                        children: t2(KEYS["config.api.inheritReset"])
                      }
                    )
                  ] }) })
                ] })
              ] }),
              retryable && namespace !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                RetryEditor,
                {
                  row,
                  namespace,
                  store,
                  t: t2,
                  writable: props.writable
                }
              ) : null,
              row.entry.settingsPath.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-well-foot", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-well-foot-hint", children: lifecycleHint }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-danger zmd-btn-danger",
                    disabled: !editable || row.configured && !removable,
                    "aria-label": row.configured ? t2(KEYS["config.removeProvider"], { provider: displayName }) : t2(KEYS["config.add"]),
                    onClick: props.onLifecycle,
                    children: t2(row.configured ? KEYS["config.removeProvider"] : KEYS["config.add"], { provider: displayName })
                  }
                )
              ] })
            ] }) : null,
            props.catalogOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
      const snapshot = (0, import_react4.useSyncExternalStore)(store.subscribe, store.getSnapshot);
      const mounted = (0, import_react4.useRef)(true);
      const [pending, setPending] = (0, import_react4.useState)({});
      const [failures, setFailures] = (0, import_react4.useState)({});
      const [catalog, setCatalog] = (0, import_react4.useState)(null);
      const [catalogDirty, setCatalogDirty] = (0, import_react4.useState)(false);
      const [catalogGuard, setCatalogGuard] = (0, import_react4.useState)(null);
      const [adding, setAdding] = (0, import_react4.useState)(false);
      const [mode, setMode] = (0, import_react4.useState)("catalog");
      (0, import_react4.useEffect)(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);
      (0, import_react4.useEffect)(() => injectModelConfigStyles(), []);
      (0, import_react4.useEffect)(() => {
        void store.load();
      }, [store]);
      const focusCatalogTrigger = (0, import_react4.useCallback)((provider) => {
        if (typeof document === "undefined") return;
        document.getElementById(`dmc-catalog-btn-${provider}`)?.focus();
      }, []);
      const collapseCatalog = (0, import_react4.useCallback)(() => {
        const provider = catalog;
        setCatalog(null);
        setCatalogDirty(false);
        setCatalogGuard(null);
        if (provider !== null) focusCatalogTrigger(provider);
      }, [catalog, focusCatalogTrigger]);
      const requestCloseCatalog = (0, import_react4.useCallback)(() => {
        if (catalog === null) return;
        if (catalogDirty) {
          setCatalogGuard({ kind: "close" });
          return;
        }
        collapseCatalog();
      }, [catalog, catalogDirty, collapseCatalog]);
      const openCatalog = (0, import_react4.useCallback)((provider) => {
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
      const discardCatalogDraft = (0, import_react4.useCallback)(() => {
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
      const keepEditingCatalog = (0, import_react4.useCallback)(() => {
        setCatalogGuard(null);
      }, []);
      (0, import_react4.useEffect)(() => {
        if (catalog === null) return;
        if (snapshot.rows.some((row) => row.added && row.entry.provider === catalog)) return;
        setCatalog(null);
        setCatalogDirty(false);
        setCatalogGuard(null);
      }, [catalog, snapshot.rows]);
      const run = (0, import_react4.useCallback)(async (provider, word, action) => {
        setPending((current) => ({ ...current, [provider]: word }));
        setFailures((current) => without(current, provider));
        const failure = await action();
        if (!mounted.current) return;
        setPending((current) => without(current, provider));
        if (failure !== void 0) setFailures((current) => ({ ...current, [provider]: failure }));
      }, []);
      const saveKey = (0, import_react4.useCallback)((row, value) => {
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
      const clearKey = (0, import_react4.useCallback)((row) => {
        const ref = credentialRefFor(row);
        if (ref === void 0) return;
        void run(row.entry.provider, t2(KEYS["config.applying"]), () => store.removeCredential(ref));
      }, [run, store, t2]);
      const setProtocol = (0, import_react4.useCallback)((row, protocol) => {
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
      const lifecycle = (0, import_react4.useCallback)((row) => {
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
      const customHost = customProviderHost(snapshot.namespaces);
      const readings = listed.map((row) => readingOf(row, failures[row.entry.provider]));
      const readyCount = readings.filter((reading) => reading.answer === "ready").length;
      const issues = listed.length - readyCount;
      const summary = listed.length === 0 ? t2(KEYS["config.summary.none"]) : issues === 0 ? t2(KEYS["config.summary.ready"], { count: String(readyCount) }) : t2(KEYS["config.summary.attention"], { count: String(readyCount), issues: String(issues) });
      const empty = snapshot.status === "ready" && (listed.length === 0 || listed.every((row) => !providerUsable(row)));
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
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
            if (adding) {
              setAdding(false);
              return;
            }
            close();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "dmc-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h1", { className: "zmd-title", children: t2(KEYS["config.title"]) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "zmd-lede", children: summary })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-toolbar", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: "dmc-add-top",
                  "aria-expanded": adding,
                  "aria-controls": "dmc-add-panel",
                  disabled: readOnly || snapshot.status !== "ready",
                  onClick: () => {
                    setAdding((current) => !current);
                  },
                  children: adding ? t2(KEYS["config.add.close"]) : t2(KEYS["config.add"])
                }
              ),
              adding ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-add-choices", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-add-choice",
                    "data-active": mode === "catalog" ? "true" : void 0,
                    disabled: candidates.length === 0,
                    title: candidates.length === 0 ? t2(KEYS["config.add.catalogExhausted"]) : void 0,
                    onClick: () => {
                      setMode("catalog");
                    },
                    children: t2(KEYS["config.add.fromCatalog"])
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-add-choice",
                    "data-active": mode === "custom" ? "true" : void 0,
                    disabled: customHost === void 0,
                    title: customHost === void 0 ? t2(KEYS["config.add.customUnavailable"]) : void 0,
                    onClick: () => {
                      setMode("custom");
                    },
                    children: t2(KEYS["config.add.custom"])
                  }
                )
              ] }) : null
            ] }),
            adding && snapshot.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-add-panel", id: "dmc-add-panel", children: [
              mode === "catalog" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmc-picker zmd-card", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dmc-notice", children: t2(KEYS["config.add.catalogHint"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "dmc-picker-list", children: candidates.map((row) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dmc-picker-item",
                    disabled: readOnly || pending[row.entry.provider] !== void 0,
                    onClick: () => {
                      lifecycle(row);
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dmc-name", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-name-text", children: row.entry.displayName }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-route", children: row.entry.provider })
                      ] }),
                      pending[row.entry.provider] === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-pending", children: pending[row.entry.provider] })
                    ]
                  }
                ) }, row.entry.provider)) }),
                pickerFailures.map(({ row, message }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "dmc-notice", children: [
                  row.entry.displayName,
                  "：",
                  message
                ] }, row.entry.provider))
              ] }) : null,
              mode === "custom" && customHost !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                AddProviderCard,
                {
                  rows: snapshot.rows,
                  namespaces: snapshot.namespaces,
                  host: customHost,
                  store,
                  t: t2,
                  writable: snapshot.writable,
                  onDone: () => {
                    setAdding(false);
                  }
                }
              ) : null
            ] }) : null,
            snapshot.error === null ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "dmc-notice", children: [
              t2(KEYS["config.loadFailed"]),
              "：",
              snapshot.error,
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
            snapshot.credentialError === null ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dmc-notice", children: snapshot.credentialError }),
            readOnly ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dmc-alert", children: t2(KEYS["config.readOnly"]) }) : null,
            empty ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dmc-empty", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "zmd-lede", children: t2(KEYS["config.empty.description"]) }) }) : null,
            listed.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("ul", { className: "dmc-ledger zmd-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { className: "dmc-listhead", "aria-hidden": "true", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t2(KEYS["config.provider.label"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-listhead-models", children: t2(KEYS["config.listheadModels"]) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-listhead-action", children: t2(KEYS["config.listheadAction"]) })
              ] }),
              listed.map((row) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
              ))
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dmc-actions", children: candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dmc-notice", children: t2(KEYS["config.add.catalogExhausted"]) }) : null })
          ]
        }
      );
    }
    function protocolsOf(store, ns) {
      const view = store.namespace(ns);
      if (view === void 0) return [];
      return protocolChoices(view);
    }
    function inheritedProtocolOf(namespace, row) {
      const base = readPath(namespace?.base, row.entry.settingsPath);
      if (!isRecord4(base)) return void 0;
      const api = base.api;
      return typeof api === "string" && api !== "" ? api : void 0;
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
    
    var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react6 = require("react");
    var import_react_dom2 = require("react-dom");
    
    var import_jsx_runtime5 = require("react/jsx-runtime");
    var BADGE_STROKE = 1.6;
    var FRAME = "M3 2.5 H13 V13.5 H3 Z";
    function artworkOf(fact) {
      switch (fact) {
        case "text":
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M5.4 6.6 H10.6" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M5.4 9.8 H10.6" })
          ] });
        case "image":
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M4.8 11.2 L6.9 8.4 L8.4 10.2 L10.2 8.1 L11.2 11.2" })
          ] });
        case "effort":
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M5.6 10.6 V9.4" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M8 10.6 V7.6" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M10.4 10.6 V5.8" })
          ] });
        case "context":
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: FRAME }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M6.4 5.8 H5.4 V10.6 H6.4" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M9.6 5.8 H10.6 V10.6 H9.6" })
          ] });
      }
    }
    function BadgeIcon({ fact, size = 14, className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
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
    
    var import_jsx_runtime6 = require("react/jsx-runtime");
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
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          className: "dmp-rail",
          role: "listbox",
          "aria-label": t2("provider.group"),
          onKeyDown,
          children: options.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
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
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-rail-copy", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-rail-name", children: option.label }) }),
                option.failed ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dmp-provider-failed", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-provider-failed-dot", "aria-hidden": "true" }),
                  t2("provider.failed")
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dmp-provider-count zmd-num", children: option.count })
              ]
            },
            option.id ?? "all"
          ))
        }
      );
    }
    
    var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
    var import_react5 = require("react");
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
    
    var import_jsx_runtime7 = require("react/jsx-runtime");
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
      const [capacityDraft, setCapacityDraft] = (0, import_react5.useState)(null);
      const [capacityError, setCapacityError] = (0, import_react5.useState)(false);
      const [writing, setWriting] = (0, import_react5.useState)(false);
      const [writeError, setWriteError] = (0, import_react5.useState)(null);
      const current = (0, import_react5.useSyncExternalStore)(
        (subscribe) => directory.subscribe(subscribe),
        () => directory.getSnapshot().current
      );
      const snapshot = (0, import_react5.useSyncExternalStore)(
        (subscribe) => params.subscribe(subscribe),
        () => params.getSnapshot()
      );
      const catalog = (0, import_react5.useSyncExternalStore)(
        (subscribe) => capabilities.subscribe(subscribe),
        () => capabilities.getSnapshot()
      );
      const position = (0, import_dsh_client_ui_primitives2.useAnchoredPosition)({ open: true, anchorRef, panelRef, side, align: "end", gap: 8, margin: 12 });
      (0, import_react5.useEffect)(() => {
        void params.refresh();
      }, [params]);
      const route = current === null ? null : { provider: current.provider, model: current.model };
      const address = (0, import_react5.useMemo)(
        () => resolveRoute(snapshot, route),
        [snapshot, route?.provider, route?.model]
      );
      const capability = route === null ? null : catalog.routes[rowKey(route.provider, route.model)] ?? null;
      (0, import_react5.useEffect)(() => {
        if (route !== null) capabilities.ensure([route.provider]);
      }, [capabilities, route?.provider]);
      const model = route === null ? null : modelOf(directory, route);
      const reasoning = model?.reasoning;
      const choices = (0, import_react5.useMemo)(
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
          panel.querySelector(".dmp-settings-foot .zmd-btn-ghost")
        ].filter((item) => item !== null && !item.hasAttribute("disabled"));
      };
      const tookFocus = (0, import_react5.useRef)(false);
      (0, import_react5.useLayoutEffect)(() => {
        if (position === null || tookFocus.current) return;
        tookFocus.current = true;
        panelRef.current?.focus();
      }, [position]);
      const addressId = address === null ? "" : `${address.ns}#${address.entryPath.join(".")}`;
      (0, import_react5.useEffect)(() => {
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
      const notice = writeError !== null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-alert", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, { className: "dmp-settings-alert-icon" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("settings.writeFailed", { message: writeError }) })
      ] }) : sectionNotice === null ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-settings-notice", children: sectionNotice });
      return (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          import_dsh_client_ui_primitives2.MenuSurface,
          {
            ref: panelRef,
            id: `${idPrefix}-settings`,
            className: "dmp-menu dmp-settings",
            style: position === null ? MEASURE_STYLE : { ...position, maxHeight },
            role: "group",
            "aria-label": t2("settings.aria", { model: modelLabel }),
            "aria-busy": writing || busy,
            tabIndex: -1,
            onKeyDown,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-settings-head", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "dmp-settings-title", children: modelLabel }) }),
              notice,
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-body", children: [
                showsInputSection(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "zmd-label", children: t2("settings.input.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-settings-name", children: t2("settings.input.text") }),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-row", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-settings-name", children: t2("settings.input.image") }),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
                  inputHint !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-settings-hint", children: inputHint })
                ] }),
                showsContextField(address, capability) && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "zmd-label", children: t2("settings.context.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-settings-row", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
                  contextHint !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-settings-hint", children: contextHint })
                ] }),
                reasoning !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-section", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "zmd-label", children: t2("settings.effort.title") }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dmp-effort-list", role: "radiogroup", "aria-label": t2("settings.effort.title"), children: choices.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
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
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-effort-name", children: choice.label }),
                        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                          "span",
                          {
                            className: "dmp-effort-check",
                            "data-on": choice.effort === activeEffort ? "" : void 0,
                            children: choice.effort === activeEffort ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconCheckOutlineRegular, {}) : null
                          }
                        )
                      ]
                    },
                    choice.key
                  )) })
                ] }),
                address !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-target", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-settings-target-label", children: t2("settings.targetLabel") }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-settings-target-value", children: t2("settings.target", { ns: address.ns, path: address.entryPath.join(".") }) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-note", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.IconInfoOutlineRegular, { className: "dmp-settings-note-icon" }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t2("settings.note") })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dmp-settings-foot", children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dmp-settings-hint", children: t2("settings.scope") }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "zmd-btn-ghost",
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
    
    var import_jsx_runtime8 = require("react/jsx-runtime");
    var MEASURE_STYLE2 = { visibility: "hidden", left: 0, top: 0 };
    function orderProviders(groups) {
      return groups.slice().sort((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
    }
    function Picker(props) {
      const { locked, available, directory, load, select, params, capabilities, translate, sessionId } = props;
      const t2 = props.t ?? translate;
      const state = (0, import_react6.useSyncExternalStore)(
        (subscribe) => directory.subscribe(subscribe),
        () => directory.getSnapshot()
      );
      const [open, setOpen] = (0, import_react6.useState)(false);
      const [query, setQuery] = (0, import_react6.useState)("");
      const [highlight, setHighlight] = (0, import_react6.useState)(null);
      const [providerFilter, setProviderFilter] = (0, import_react6.useState)(null);
      const [settingsAt, setSettingsAt] = (0, import_react6.useState)(false);
      const [settingsSide, setSettingsSide] = (0, import_react6.useState)("bottom");
      const [settingsBudget, setSettingsBudget] = (0, import_react6.useState)(void 0);
      const [selectionFocus, setSelectionFocus] = (0, import_react6.useState)(false);
      const [toast, setToast] = (0, import_react6.useState)(null);
      const toastSeq = (0, import_react6.useRef)(0);
      const rootRef = (0, import_react6.useRef)(null);
      const triggerRef = (0, import_react6.useRef)(null);
      const settingsButtonRef = (0, import_react6.useRef)(null);
      const settingsMenuRef = (0, import_react6.useRef)(null);
      const searchRef = (0, import_react6.useRef)(null);
      const menuRef = (0, import_react6.useRef)(null);
      const groupsRef = (0, import_react6.useRef)(null);
      const rowRefs = (0, import_react6.useRef)([]);
      const railRefs = (0, import_react6.useRef)([]);
      const lastActionRef = (0, import_react6.useRef)("load");
      const id = (0, import_react6.useId)();
      const [settingsSession, setSettingsSession] = (0, import_react6.useState)(sessionId);
      if (settingsAt && settingsSession !== sessionId) {
        setSettingsAt(false);
        setSettingsSession(sessionId);
      }
      const [scopeSession, setScopeSession] = (0, import_react6.useState)(sessionId);
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
      const orderedGroups = (0, import_react6.useMemo)(() => orderProviders(state.groups), [state.groups]);
      const catalogRows = (0, import_react6.useMemo)(() => orderedGroups.flatMap((group) => group.models.map((model) => ({ key: `${group.id}:${model.id}`, provider: group.id, model }))), [orderedGroups]);
      const selectedKey = state.current === null ? null : rowKey(state.current.provider, state.current.model);
      const currentRow = catalogRows.find((row) => rowKey(row.provider, row.model.id) === selectedKey) ?? null;
      const currentReasoning = currentRow?.model.reasoning;
      const effectiveEffort = state.current?.reasoningEffort ?? currentReasoning?.defaultEffort;
      const effortLabel = currentReasoning === void 0 ? state.retainedEffort : effortLabelOf(currentReasoning, effectiveEffort, t2);
      const paramsSnapshot = (0, import_react6.useSyncExternalStore)(
        (subscribe) => params.subscribe(subscribe),
        () => params.getSnapshot()
      );
      const catalog = (0, import_react6.useSyncExternalStore)(
        (subscribe) => capabilities.subscribe(subscribe),
        () => capabilities.getSnapshot()
      );
      const declaredCurrent = resolveRoute(paramsSnapshot, state.current)?.declared === true;
      const specsByRow = (0, import_react6.useMemo)(() => {
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
      const providerLabel = (0, import_react6.useCallback)(
        (providerId, fallback) => providerId === "deepseek-account" ? t2("provider.account") : fallback,
        [t2]
      );
      const groups = (0, import_react6.useMemo)(() => {
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
      const modelCounts = (0, import_react6.useMemo)(() => new Map(
        orderedGroups.map((group) => [group.id, group.models.length])
      ), [orderedGroups]);
      const providerOptions = (0, import_react6.useMemo)(() => [
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
      const providerNameOf = (0, import_react6.useCallback)(
        (providerId) => providerOptions.find((option) => option.id === providerId)?.label ?? providerLabel(providerId, providerId),
        [providerLabel, providerOptions]
      );
      const railStop = (0, import_react6.useMemo)(() => {
        const selected = providerOptions.findIndex((option) => option.id === providerFilter && !option.failed);
        if (selected >= 0) return selected;
        return providerOptions.findIndex((option) => !option.failed);
      }, [providerOptions, providerFilter]);
      const currentProviderId = state.current?.provider ?? null;
      const currentProviderLabel = currentProviderId === null ? null : providerNameOf(currentProviderId);
      const knownProviders = (0, import_react6.useMemo)(() => new Set(providerOptions.map((option) => option.id)), [providerOptions]);
      (0, import_react6.useEffect)(() => {
        if (providerFilter === null || state.status !== "ready") return;
        if (knownProviders.has(providerFilter)) return;
        setProviderFilter(currentProviderId);
      }, [currentProviderId, knownProviders, providerFilter, state.status]);
      const rows = (0, import_react6.useMemo)(() => groups.flatMap((group) => group.rows), [groups]);
      const indexOfRow = (0, import_react6.useMemo)(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
      const currentVisibleIndex = rows.findIndex((row) => row.provider === state.current?.provider && row.model.id === state.current.model);
      const activeIndex = rows.length === 0 ? -1 : Math.min(highlight ?? Math.max(0, currentVisibleIndex), rows.length - 1);
      const pending = state.pending;
      const busy = pending !== null;
      const elsewhereCount = (0, import_react6.useMemo)(() => {
        if (providerFilter === null || trimmedQuery === "") return 0;
        const matches = (0, import_dsh_client_ui_primitives3.rankByName)(catalogRows.map((row) => row.model), trimmedQuery).length;
        return Math.max(0, matches - rows.length);
      }, [catalogRows, providerFilter, rows.length, trimmedQuery]);
      const reload = () => {
        lastActionRef.current = "load";
        load();
      };
      (0, import_react6.useEffect)(() => {
        params.ensure();
      }, [params]);
      (0, import_react6.useEffect)(() => {
        if (!open) return;
        void params.refresh();
      }, [open, params]);
      (0, import_react6.useEffect)(() => {
        if (!open) return;
        capabilities.ensure(catalogRows.map((row) => row.provider));
      }, [capabilities, catalogRows, open]);
      (0, import_react6.useEffect)(() => {
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
      (0, import_react6.useEffect)(() => {
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
      (0, import_react6.useEffect)(() => {
        const viewport = groupsRef.current;
        if (viewport === null) return;
        return (0, import_dsh_client_ui_primitives3.observeStickyMenuGroups)(viewport);
      }, [available, open, groups]);
      (0, import_react6.useLayoutEffect)(() => {
        if (!open || menuPos === null) return;
        const active = document.activeElement;
        if (active instanceof Node && menuRef.current?.contains(active) === true) return;
        searchRef.current?.focus();
      }, [open, menuPos]);
      (0, import_react6.useLayoutEffect)(() => {
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
        { fact: "text", label: t2("badge.head.text") },
        { fact: "image", label: t2("badge.head.image") },
        { fact: "effort", label: t2("badge.head.effort") },
        { fact: "context", label: t2("badge.head.context") }
      ];
      const waiting = state.current === null && state.status === "loading";
      const modelName = waiting ? t2("trigger.loading") : currentRow?.model.name ?? (state.current === null ? t2("trigger.fallback") : state.current.model);
      const triggerLabel = currentProviderLabel === null ? modelName : `${currentProviderLabel}/${modelName}`;
      const triggerAria = waiting ? t2("trigger.loading") : state.current === null || currentProviderLabel === null ? t2("trigger.selectAria") : effortLabel === void 0 ? t2("trigger.aria", { provider: currentProviderLabel, model: modelName }) : t2("trigger.ariaEffort", { provider: currentProviderLabel, model: modelName, effort: effortLabel });
      const settingsTitle = state.current === null ? t2("settings.openNoModel") : declaredCurrent ? `${t2("settings.open")} · ${t2("settings.openDeclared")}` : t2("settings.open");
      const scopeCount = t2("card.count", { count: String(rows.length) });
      const hiddenRows = Math.max(0, catalogRows.length - rows.length);
      const footNote = hiddenRows === 0 ? t2("card.footTotal", { count: String(rows.length) }) : t2("card.footPart", { shown: String(rows.length), total: String(catalogRows.length) });
      const footKeys = groups.length > 1 ? t2("card.footProviders", { count: String(groups.length) }) : "";
      const railKeys = providerOptions.filter((option) => !option.failed).length > 1 ? t2("card.railKeys") : "";
      rowRefs.current = [];
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: triggerLabel, side: "top", align: "end", portal: true, disabled: open, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconDataOutlineRegular, { className: "dmp-trigger-icon", size: 16 }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-trigger-label", children: triggerLabel }),
                  !waiting && effortLabel !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-trigger-effort", children: effortLabel }),
                  busy ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconChevronDownOutlineRegular, { className: open ? "dmp-chevron dmp-chevron-open" : "dmp-chevron" })
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: settingsTitle, side: "top", align: "end", portal: true, disabled: settingsAt, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
                children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconSettingsOutlineRegular, { className: "dmp-settings-icon", size: 16 })
              }
            ) }),
            open && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                import_dsh_client_ui_primitives3.MenuSurface,
                {
                  ref: menuRef,
                  id: `${id}-menu`,
                  className: "dmp-menu dmp-card",
                  "data-scope": providerFilter === null ? "all" : "one",
                  style: menuPos ?? MEASURE_STYLE2,
                  role: "group",
                  "aria-label": t2("menu.aria"),
                  "aria-busy": state.status === "loading" || busy,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-card-head", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-card-count zmd-num", children: scopeCount }),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                        import_dsh_client_ui_primitives3.Input,
                        {
                          ref: searchRef,
                          className: "dmp-search",
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
                      query !== "" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
                          children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { "aria-hidden": "true", children: "×" })
                        }
                      )
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-card-body", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-models", children: [
                        state.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-status", role: "status", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t2("status.loading") })
                        ] }),
                        "            ",
                        elsewhereCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-filter-hint", role: "status", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t2("provider.elsewhere", { count: String(elsewhereCount) }) }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
                        state.error !== null && lastActionRef.current === "load" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-error", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t2("error.action", { message: state.error }) }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t2("action.reload") })
                        ] }),
                        state.failures.map((failure) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-warning", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, { className: "dmp-error-icon" }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t2("warning.groupLoad", {
                            name: providerLabel(failure.id, failure.name),
                            message: failure.message
                          }) }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dmp-retry", onClick: reload, children: t2("action.reload") })
                        ] }, failure.id)),
                        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dmp-legend", role: "note", "aria-label": t2("badge.headAria"), children: legend.map((item) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: item.label }, item.fact)) }),
                        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                          "div",
                          {
                            ref: groupsRef,
                            id: `${id}-models`,
                            className: "dmp-groups scrollable",
                            role: "menu",
                            "aria-label": t2("menu.model"),
                            hidden: rows.length === 0,
                            children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.MenuGroup, { label: group.label, children: group.rows.map((row) => {
                              const index = indexOfRow.get(row.key) ?? -1;
                              const selected = row.provider === state.current?.provider && row.model.id === state.current.model;
                              const specs = specsByRow.get(rowKey(row.provider, row.model.id)) ?? [];
                              const facts = specs.map((spec) => spec.sentence).join(t2("settings.listJoin"));
                              const shown = specs.filter((spec) => !spec.off);
                              const shownByFact = new Map(shown.map((spec) => [spec.fact, spec]));
                              const rowPending = pending !== null && pending.provider === row.provider && pending.model === row.model.id;
                              return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
                                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dmp-row-copy", children: [
                                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-row-name", title: row.model.name, children: row.model.name }),
                                      shown.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-badges", title: facts, "aria-hidden": "true", children: BADGE_FACTS.map((fact) => {
                                        const spec = shownByFact.get(fact);
                                        if (spec === void 0) {
                                          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-badge-slot" }, fact);
                                        }
                                        return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                                          import_dsh_client_ui_primitives3.Tag,
                                          {
                                            tone: "neutral",
                                            className: "dmp-badge",
                                            children: [
                                              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-badge-fact", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BadgeIcon, { fact: spec.fact, className: "dmp-badge-icon" }) }),
                                              spec.value !== "" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-badge-value", children: spec.value })
                                            ]
                                          },
                                          spec.fact
                                        );
                                      }) })
                                    ] }),
                                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-check", "data-on": selected ? "" : void 0, children: rowPending ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : selected ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconCheckOutlineRegular, {}) : null })
                                  ]
                                },
                                row.key
                              );
                            }) }, group.id))
                          }
                        ),
                        state.status === "ready" && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-empty", role: "status", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconDataOutlineRegular, { className: "dmp-empty-icon", size: 20, "aria-hidden": "true" }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: providerFilter !== null ? trimmedQuery === "" ? t2("empty.provider") : t2("empty.providerSearch") : catalogRows.length === 0 ? t2("empty.models") : t2("search.empty") })
                        ] })
                      ] })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dmp-card-foot", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-card-foot-note zmd-num", children: footNote }),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-card-foot-providers zmd-num", children: footKeys }),
                      railKeys === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dmp-card-foot-keys", children: railKeys })
                    ] })
                  ]
                }
              ),
              document.body
            ),
            settingsAt && (0, import_react_dom2.createPortal)(
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
            toast !== null && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              import_dsh_client_ui_primitives3.Toast,
              {
                text: toast.text,
                icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives3.IconWarningOutlineRegular, {}),
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
    
    var STYLE_ELEMENT_ID3 = "dsh-rabbit-model-picker-design";
    var TOKENS = `body {
      --zmd-font: var(--dsw-font-family);
      --zmd-ease: var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      --zmd-fast: var(--ds-transition-duration-fast, 0.1s);
      --zmd-base: var(--ds-transition-duration, 0.2s);
    
      --zmd-surface: var(--dsw-alias-settings-card-fill);
      --zmd-stroke: var(--dsw-alias-settings-card-stroke);
      --zmd-line: var(--dsw-alias-border-l2);
      --zmd-line-strong: var(--dsw-alias-border-l3);
      --zmd-line-control: var(--dsw-alias-border-l4);
    
      --zmd-ink: var(--dsw-alias-label-primary);
      --zmd-ink-secondary: var(--dsw-alias-label-secondary);
      --zmd-ink-mute: var(--dsw-alias-label-tertiary);
      --zmd-ink-dim: var(--dsw-alias-label-dimmed);
      --zmd-ink-caption: var(--dsw-alias-label-caption);
    
      --zmd-hover: var(--dsw-alias-interactive-bg-hover);
      --zmd-active: var(--dsw-alias-interactive-bg-active);
      --zmd-hover-danger: var(--dsw-alias-interactive-bg-hover-danger);
    
      --zmd-accent: var(--dsw-alias-state-business-primary);
      --zmd-danger: var(--dsw-alias-state-error-primary);
      --zmd-ok: var(--dsw-alias-state-success-primary);
      --zmd-idle: var(--dsw-alias-state-idle-primary);
    
      --zmd-fill-primary: var(--dsw-alias-button-primary-fill);
      --zmd-fill-primary-hover: var(--dsw-alias-button-primary-hover);
      --zmd-on-primary: var(--dsw-alias-label-primary-foreground);
    
      --zmd-nested: var(--dsw-alias-bg-module-platform);
      --zmd-field: var(--dsw-alias-bg-layer-1);
      --zmd-menu: var(--dsw-alias-bg-layer-2);
      --zmd-elevation: var(--dsw-elevation-prominent);
    
      --zmd-radius-card: var(--dsw-radius-xl);
      --zmd-radius-well: var(--dsw-radius-lg);
      --zmd-radius-control: var(--dsw-radius-md);
      --zmd-radius-compact: var(--dsw-radius-sm);
    
      --zmd-focus: var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
      --zmd-focus-width: var(--dsw-focus-ring-width, 2px);
    
      --zmd-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    }
    
    body[data-ds-dark-theme] {
      --zmd-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23ADB2B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    }`;
    var PRIMITIVES = `
    .zmd-num {
      font-variant-numeric: tabular-nums;
    }
    
    .zmd-title {
      margin: 0;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 16px;
      line-height: 24px;
      font-weight: 500;
    }
    
    .zmd-lede {
      margin: 0;
      color: var(--zmd-ink-mute);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 22px;
      text-wrap: pretty;
    }
    
    .zmd-label {
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
    }
    
    
    .zmd-dot {
      flex: 0 0 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--zmd-idle);
    }
    
    .zmd-dot[data-tone='ok'] {
      background: var(--zmd-ok);
    }
    
    .zmd-dot[data-tone='bad'] {
      background: var(--zmd-danger);
    }
    
    
    .zmd-card {
      border: 0.5px solid var(--zmd-stroke);
      border-radius: var(--zmd-radius-card);
      background: var(--zmd-surface);
    }
    
    .zmd-well {
      border-radius: var(--zmd-radius-well);
      background: var(--zmd-nested);
    }
    
    .zmd-input,
    .zmd-select {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      height: 32px;
      padding: 0 10px;
      border: 0.5px solid var(--zmd-line-control);
      border-radius: var(--zmd-radius-control);
      background: var(--zmd-field);
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 22px;
      font-variant-numeric: tabular-nums;
      transition: border-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .zmd-input::placeholder {
      color: var(--zmd-ink-dim);
    }
    
    .zmd-input:focus,
    .zmd-input:focus-visible,
    .zmd-select:focus,
    .zmd-select:focus-visible {
      border-color: var(--zmd-accent);
      outline: 0;
    }
    
    .zmd-input:disabled,
    .zmd-select:disabled {
      opacity: 0.6;
      cursor: default;
    }
    
    .zmd-input[aria-invalid='true'] {
      border-color: var(--zmd-danger);
    }
    
    .zmd-select {
      max-width: 100%;
      padding-right: 32px;
      appearance: none;
      background-image: var(--zmd-chevron);
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 12px 12px;
      cursor: pointer;
    }
    
    .zmd-select option {
      background: var(--zmd-field);
      color: var(--zmd-ink);
    }
    
    .zmd-btn-primary,
    .zmd-btn-secondary,
    .zmd-btn-ghost,
    .zmd-btn-danger {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 0;
      border-radius: var(--zmd-radius-control);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 22px;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--zmd-fast) var(--zmd-ease),
        border-color var(--zmd-fast) var(--zmd-ease),
        color var(--zmd-fast) var(--zmd-ease);
    }
    
    .zmd-btn-primary {
      height: 36px;
      padding: 0 14px;
      background: var(--zmd-fill-primary);
      color: var(--zmd-on-primary);
      font-weight: 500;
    }
    
    .zmd-btn-primary:hover:not(:disabled) {
      background: var(--zmd-fill-primary-hover);
    }
    
    .zmd-btn-secondary {
      height: 36px;
      padding: 0 14px;
      border: 0.5px solid var(--zmd-line-strong);
      background: transparent;
      color: var(--zmd-ink);
      font-weight: 500;
    }
    
    .zmd-btn-secondary:hover:not(:disabled) {
      background: var(--zmd-hover);
    }
    
    .zmd-btn-secondary:active:not(:disabled) {
      background: var(--zmd-active);
    }
    
    .zmd-btn-ghost,
    .zmd-btn-danger {
      height: 28px;
      padding: 0 10px;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
    }
    
    .zmd-btn-ghost {
      color: var(--zmd-ink-secondary);
    }
    
    .zmd-btn-danger {
      color: var(--zmd-danger);
    }
    
    .zmd-btn-ghost:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .zmd-btn-ghost:active:not(:disabled) {
      background: var(--zmd-active);
    }
    
    .zmd-btn-danger:hover:not(:disabled) {
      background: var(--zmd-hover-danger);
    }
    
    .zmd-btn-primary:disabled,
    .zmd-btn-secondary:disabled,
    .zmd-btn-ghost:disabled,
    .zmd-btn-danger:disabled {
      color: var(--zmd-ink-dim);
      cursor: not-allowed;
    }
    
    .zmd-btn-primary:disabled {
      background: transparent;
      border: 0.5px solid var(--zmd-line-strong);
      color: var(--zmd-ink-dim);
    }
    
    .zmd-btn-primary:focus-visible,
    .zmd-btn-secondary:focus-visible,
    .zmd-btn-ghost:focus-visible,
    .zmd-btn-danger:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .zmd-input,
      .zmd-select,
      .zmd-btn-primary,
      .zmd-btn-secondary,
      .zmd-btn-ghost,
      .zmd-btn-danger {
        transition: none;
      }
    }
    `;
    var CSS3 = `${TOKENS}
    
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
    .dmp-root,
    .dmp-menu {
      --dmp-col-icon: 14px;
      --dmp-col-window: 47px;
      --dmp-col-gap: 8px;
      --dmp-row-pad-x: 8px;
    }
    
    .dmp-root {
      position: relative;
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }
    
    .dmp-trigger {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      max-width: min(220px, 45cqw);
      height: 28px;
      padding: 0 4px 0 8px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      outline: none;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font);
      font-size: 13px;
      line-height: 20px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color var(--zmd-fast) var(--zmd-ease),
        color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-trigger:hover:not(:disabled),
    .dmp-trigger-open {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-trigger:focus-visible:not([data-selection-focus]) {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    .dmp-trigger:disabled {
      opacity: 0.5;
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
      font-size: 11px;
      line-height: 16px;
      font-weight: 400;
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
      transition: transform var(--zmd-base) var(--zmd-ease);
    }
    
    .dmp-chevron-open {
      transform: rotate(180deg);
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
      border-radius: var(--zmd-radius-compact);
      outline: none;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font);
      cursor: pointer;
      transition:
        background-color var(--zmd-fast) var(--zmd-ease),
        color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-settings-button:hover:not(:disabled),
    .dmp-settings-open {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-settings-button:focus-visible:not([data-selection-focus]) {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 1px;
    }
    
    .dmp-settings-button:disabled {
      opacity: 0.5;
      cursor: default;
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
      border-radius: var(--zmd-radius-well);
      box-shadow: var(--zmd-elevation);
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
      --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
    }
    
    .dmp-menu [class*='material'] {
      background: var(--zmd-menu);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    
    .dmp-menu > :not([class*='material']) {
      position: relative;
      z-index: 1;
    }
    
    .dmp-card {
      width: min(520px, calc(100vw - 32px));
      height: min(420px, calc(100vh - 96px));
      max-height: min(420px, calc(100vh - 96px));
    }
    
    .dmp-card-head {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      min-width: 0;
      padding: 6px 10px 6px 12px;
      border-bottom: 0.5px solid var(--zmd-line);
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
      width: 168px;
      min-height: 0;
      overflow-y: auto;
      padding: 4px;
      scroll-snap-type: y proximity;
      scroll-padding-block: 4px;
      border-right: 0.5px solid var(--zmd-line);
    }
    
    .dmp-rail-row {
      position: relative;
      scroll-snap-align: start;
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-height: 30px;
      padding: 4px 8px;
      border: 0;
      border-radius: var(--zmd-radius-control);
      outline: none;
      background: transparent;
      color: var(--zmd-ink-secondary);
      font: inherit;
      font-family: var(--zmd-font);
      font-size: 13px;
      line-height: 20px;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-rail-row:hover:not(:disabled),
    .dmp-rail-row:focus-visible {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-rail-row[aria-selected='true'],
    .dmp-rail-row[aria-selected='true']:hover:not(:disabled) {
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-rail-row[aria-current='true']::before {
      content: '';
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 2px;
      border-radius: 1px;
      background: var(--zmd-accent);
    }
    
    .dmp-rail-row[aria-selected='true'] .dmp-rail-name,
    .dmp-rail-row[aria-current='true'] .dmp-rail-name {
      font-weight: 500;
      color: var(--zmd-ink);
    }
    
    .dmp-rail-row:disabled {
      opacity: 0.4;
      cursor: default;
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
    }
    
    .dmp-provider-count {
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      font-size: 11px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-provider-failed {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      color: var(--zmd-ink-mute);
      font-size: 11px;
      line-height: 16px;
      font-weight: 500;
    }
    
    .dmp-provider-failed-dot {
      flex: 0 0 6px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--zmd-danger);
    }
    
    .dmp-models {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      margin-left: 168px;
      padding: 4px 12px 0;
    }
    
    .dmp-status,
    .dmp-empty {
      padding: 8px 0;
      color: var(--zmd-ink-mute);
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
      padding: 8px 10px;
      border: 0.5px solid var(--zmd-line-control);
      border-radius: var(--zmd-radius-control);
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
      height: 24px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-family: var(--zmd-font);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-retry:hover {
      background: var(--zmd-hover);
    }
    
    .dmp-card-head .dmp-search {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      min-width: 96px;
      height: 30px;
      padding: 0 28px 0 10px;
      border: 0.5px solid var(--zmd-line-control);
      border-radius: var(--zmd-radius-control);
      background: var(--zmd-field);
      transition: border-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-card-head .dmp-search:focus-within {
      border-color: var(--zmd-accent);
    }
    
    .dmp-card-head .dmp-search input {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 13px;
      line-height: 20px;
    }
    
    .dmp-card-head .dmp-search input::placeholder {
      color: var(--zmd-ink-dim);
    }
    
    .dmp-search-clear {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink-mute);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-search-clear:hover,
    .dmp-search-clear:focus-visible {
      outline: none;
      background: var(--zmd-hover);
      color: var(--zmd-ink);
    }
    
    .dmp-legend {
      display: grid;
      grid-template-columns:
        var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-icon) var(--dmp-col-window);
      flex: 0 0 auto;
      align-items: center;
      justify-content: end;
      gap: var(--dmp-col-gap);
      padding: 2px calc(var(--dmp-row-pad-x) + 20px) 6px 0;
      color: var(--zmd-ink-mute);
      font-size: 11px;
      line-height: 16px;
      font-weight: 500;
    }
    
    .dmp-legend span {
      text-align: center;
    }
    
    .dmp-groups {
      min-height: 0;
      overflow-y: auto;
      scroll-padding-top: 22px;
    }
    
    .dmp-groups > [data-menu-group] + [data-menu-group] {
      margin-top: 2px;
    }
    
    .dmp-groups [data-menu-group-heading] {
      display: block;
      padding: 4px 7px 2px;
      border: 0;
      background: transparent;
      color: var(--zmd-ink-mute);
      font-size: 11px;
      line-height: 16px;
      font-weight: 500;
    }
    
    .dmp-groups [data-menu-group-heading][data-stuck] {
      background: var(--dsw-alias-menu-group-header-fill);
      border-radius: var(--zmd-radius-control);
    }
    
    .dmp-row {
      position: relative;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 6px;
      width: auto;
      min-width: 100%;
      min-height: 34px;
      padding: 6px var(--dmp-row-pad-x);
      border: 0;
      border-radius: var(--zmd-radius-control);
      outline: none;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 13px;
      line-height: 20px;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-row:hover:not([aria-disabled='true']):not(:disabled),
    .dmp-row:focus-visible,
    .dmp-row[data-active]:not([aria-disabled='true']) {
      background: var(--zmd-hover);
    }
    
    .dmp-row[aria-checked='true'] {
      background: var(--zmd-hover);
    }
    
    .dmp-row[aria-checked='true'] .dmp-row-name {
      font-weight: 500;
    }
    
    .dmp-row[aria-disabled='true'],
    .dmp-row:disabled {
      opacity: 0.4;
      cursor: default;
    }
    
    .dmp-row-copy {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    
    .dmp-row-name {
      flex: 1 1 auto;
      min-width: 48px;
      overflow: hidden;
      color: inherit;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      display: inline-grid;
      grid-auto-flow: column;
      align-items: center;
      gap: 3px;
      min-height: 16px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
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
      color: var(--zmd-ink-caption);
    }
    
    .dmp-badge-value {
      max-width: 47px;
      overflow: hidden;
      color: var(--zmd-ink-secondary);
      font-family: var(--zmd-font);
      font-size: 11px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
    }
    
    .dmp-check {
      display: grid;
      place-items: center;
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      color: var(--zmd-ink);
    }
    
    .dmp-check svg {
      width: 14px;
      height: 14px;
    }
    
    .dmp-filter-hint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 0 2px;
      color: var(--zmd-ink-mute);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-filter-clear {
      flex: 0 0 auto;
      height: 24px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      background: transparent;
      color: var(--zmd-ink);
      font: inherit;
      font-family: var(--zmd-font);
      font-size: 12px;
      line-height: 18px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-filter-clear:hover:not(:disabled) {
      background: var(--zmd-hover);
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
      border-top: 0.5px solid var(--zmd-line);
      color: var(--zmd-ink-mute);
      font-size: 11px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    
    .dmp-card-foot-note {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-card-foot-providers,
    .dmp-card-foot-keys {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    
    .dmp-card-foot-providers:empty {
      display: none;
    }
    
    .dmp-settings {
      width: min(300px, calc(100vw - 32px));
      max-height: min(460px, calc(100vh - 96px));
      overflow: hidden;
    }
    
    .dmp-settings:focus-visible {
      outline: none;
    }
    
    .dmp-settings-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex: 0 0 auto;
      padding: 12px 14px 10px;
      border-bottom: 0.5px solid var(--zmd-line);
    }
    
    .dmp-settings-title {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      color: var(--zmd-ink);
      font-size: 16px;
      line-height: 24px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dmp-settings-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1 1 auto;
      min-height: 0;
      padding: 12px 14px;
      overflow-y: auto;
    }
    
    .dmp-settings-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .dmp-settings-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 28px;
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
      text-wrap: pretty;
    }
    
    .dmp-settings-notice {
      padding: 0 14px 8px;
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
    }
    
    .dmp-settings-alert {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      padding: 0 14px 8px;
      color: var(--zmd-danger);
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
      padding-top: 10px;
      border-top: 0.5px solid var(--zmd-line);
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
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    
    .dmp-settings .dmp-settings-switch {
      box-sizing: border-box;
      flex: 0 0 auto;
      align-self: center;
      width: 36px;
      height: 20px;
      padding: 2px;
      border: 0;
      border-radius: 999px;
      background: var(--zmd-line-strong);
      color: var(--zmd-ink-caption);
      cursor: pointer;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-settings .dmp-settings-switch[aria-checked='true'] {
      background: var(--zmd-fill-primary);
      color: var(--zmd-on-primary);
    }
    
    .dmp-settings .dmp-settings-switch > span {
      display: block;
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: var(--dsw-alias-switch-thumb);
      transition: transform var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-settings .dmp-settings-switch[aria-checked='true'] > span {
      transform: translateX(16px);
    }
    
    .dmp-settings .dmp-settings-switch:disabled {
      opacity: 0.5;
      cursor: default;
    }
    
    .dmp-settings-input {
      box-sizing: border-box;
      flex: 1;
      min-width: 0;
      height: 32px;
      padding: 0 10px;
      border: 0.5px solid var(--zmd-line-control);
      border-radius: var(--zmd-radius-control);
      background: var(--zmd-field);
      transition: border-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-settings-input:focus-within {
      border-color: var(--zmd-accent);
    }
    
    .dmp-settings-input input {
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--zmd-ink);
      font-family: var(--zmd-font);
      font-size: 14px;
      line-height: 20px;
      font-variant-numeric: tabular-nums;
      outline: none;
    }
    
    .dmp-settings-input input::placeholder {
      color: var(--zmd-ink-dim);
    }
    
    .dmp-settings-input-bad {
      border-color: var(--zmd-danger);
    }
    
    .dmp-settings-note {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding-top: 10px;
      border-top: 0.5px solid var(--zmd-line);
      color: var(--zmd-ink-secondary);
      font-size: 12px;
      line-height: 18px;
      text-wrap: pretty;
    }
    
    .dmp-settings-note-icon {
      flex: 0 0 12px;
      margin-top: 3px;
      color: var(--zmd-ink-caption);
    }
    
    .dmp-settings-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex: 0 0 auto;
      padding: 8px 14px;
      border-top: 0.5px solid var(--zmd-line);
    }
    
    .dmp-effort-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .dmp-effort-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-height: 32px;
      padding: 4px 8px;
      border: 0;
      border-radius: var(--zmd-radius-compact);
      outline: none;
      background: transparent;
      color: inherit;
      font-family: var(--zmd-font);
      font-size: 13px;
      line-height: 20px;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color var(--zmd-fast) var(--zmd-ease);
    }
    
    .dmp-effort-item:hover:not(:disabled),
    .dmp-effort-item:focus-visible {
      background: var(--zmd-hover);
    }
    
    .dmp-effort-item[aria-checked='true'] {
      background: var(--zmd-hover);
      font-weight: 500;
    }
    
    .dmp-effort-item:disabled {
      opacity: 0.4;
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
      width: 14px;
      height: 14px;
      color: var(--zmd-ink);
    }
    
    .dmp-effort-check svg {
      width: 14px;
      height: 14px;
    }
    
    .dmp-root .dmp-trigger:focus-visible,
    .dmp-root .dmp-settings-button:focus-visible,
    .dmp-menu .dmp-rail-row:focus-visible,
    .dmp-menu .dmp-row:focus-visible,
    .dmp-menu .dmp-effort-item:focus-visible,
    .dmp-menu .dmp-search-clear:focus-visible,
    .dmp-menu .dmp-retry:focus-visible,
    .dmp-menu .dmp-filter-clear:focus-visible,
    .dmp-menu .dmp-settings-switch:focus-visible {
      outline: var(--zmd-focus-width) solid var(--zmd-focus);
      outline-offset: 2px;
    }
    
    @media (max-width: 536px) {
      .dmp-card {
        height: auto;
        max-height: min(560px, calc(100vh - 96px));
      }
    
      .dmp-card-head {
        gap: 6px;
        padding: 6px 10px 6px 12px;
      }
    
      .dmp-card-head .dmp-search {
        min-width: 72px;
        height: 28px;
        padding-right: 26px;
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
        padding: 4px;
        border-right: 0;
        border-bottom: 0.5px solid var(--zmd-line);
      }
    
      .dmp-models {
        margin-left: 0;
        padding: 6px 12px 0;
      }
    
      .dmp-rail-row {
        width: auto;
        flex: 0 0 auto;
        padding: 4px 10px;
      }
    
      .dmp-rail-copy {
        flex: 0 0 auto;
      }
    
      .dmp-rail-name {
        flex: 0 0 auto;
        max-width: 132px;
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
      .dmp-settings-switch,
      .dmp-settings-switch > span,
      .dmp-card-head .dmp-search,
      .dmp-settings-input,
      .dmp-chevron {
        transition: none;
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
