import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoreTarget, CustomRule, CustomRuleSet, GenerateOptions, ProxyNode } from '../core/types';
import { defaultOptions } from '../core/generator';
import { dedupe, importFromText } from '../core/parsers';
import { newNodeId } from '../core/types';
import { defaultRouterOsProfile, RouterOsProfile } from '../core/deploy';

export interface SavedConfig {
  id: string;
  name: string;
  core: CoreTarget;
  device: string;
  content: string;
  nodeCount: number;
  ruleSetCount: number;
  createdAt: number;
  updatedAt: number;
  note?: string;
  /** 快照，便于「载入并继续编辑」 */
  snapshot?: { nodes: ProxyNode[]; options: GenerateOptions };
}

export interface ImportReport {
  added: number;
  errors: { line: string; reason: string }[];
}

/** 已保存的订阅（可一键刷新） */
export interface SavedSubscription {
  id: string;
  name: string;
  url: string;
  nodeCount: number;
  addedAt: number;
  lastUpdated?: number;
}

interface AppState {
  nodes: ProxyNode[];
  options: GenerateOptions;
  /** RouterOS 引导表单（部署页） */
  routerOs: RouterOsProfile;
  library: SavedConfig[];
  savedNodes: ProxyNode[];
  subscriptions: SavedSubscription[];
  lastImport: ImportReport | null;

  addNodes: (list: ProxyNode[]) => number;
  replaceNodes: (list: ProxyNode[]) => void;
  updateNode: (id: string, patch: Partial<ProxyNode>) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  clearNodes: () => void;
  importText: (text: string, replace?: boolean) => ImportReport;
  setNodeEnabled: (id: string, enabled: boolean) => void;
  setAllEnabled: (enabled: boolean) => void;

  setOptions: (patch: Partial<GenerateOptions>) => void;
  setRouterOs: (patch: Partial<RouterOsProfile>) => void;
  toggleScenario: (id: string) => void;
  setScenarioAnswer: (scenarioId: string, questionId: string, values: string[]) => void;
  toggleRuleSet: (id: string) => void;
  addCustomRuleSet: () => void;
  updateCustomRuleSet: (id: string, patch: Partial<CustomRuleSet>) => void;
  removeCustomRuleSet: (id: string) => void;
  addCustomRule: () => void;
  updateCustomRule: (id: string, patch: Partial<CustomRule>) => void;
  removeCustomRule: (id: string) => void;

  saveConfig: (name: string, content: string, nodeCount: number, ruleSetCount: number, note?: string) => string;
  updateSavedConfig: (id: string, patch: Partial<SavedConfig>) => void;
  loadConfig: (id: string) => boolean;
  deleteConfig: (id: string) => void;

  saveNodeToVault: (node: ProxyNode) => void;
  removeSavedNode: (id: string) => void;

  addSubscription: (name: string, url: string, nodeCount: number) => void;
  removeSubscription: (id: string) => void;
  markSubscriptionUpdated: (id: string, nodeCount: number) => void;

  resetAll: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      nodes: [],
      options: defaultOptions(),
      routerOs: defaultRouterOsProfile(),
      library: [],
      savedNodes: [],
      subscriptions: [],
      lastImport: null,

      addNodes: (list) => {
        const merged = dedupe([...get().nodes, ...list]);
        set({ nodes: merged });
        return merged.length - get().nodes.length;
      },
      replaceNodes: (list) => set({ nodes: dedupe(list) }),
      updateNode: (id, patch) => set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }),
      removeNode: (id) => set({ nodes: get().nodes.filter((n) => n.id !== id) }),
      removeNodes: (ids) => set({ nodes: get().nodes.filter((n) => !ids.includes(n.id)) }),
      clearNodes: () => set({ nodes: [] }),
      importText: (text, replace = false) => {
        const { nodes, errors } = importFromText(text);
        const report: ImportReport = { added: nodes.length, errors };
        if (replace) set({ nodes, lastImport: report });
        else set({ nodes: dedupe([...get().nodes, ...nodes]), lastImport: report });
        return report;
      },
      setNodeEnabled: (id, enabled) => set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, enabled } : n)) }),
      setAllEnabled: (enabled) => set({ nodes: get().nodes.map((n) => ({ ...n, enabled })) }),

      setOptions: (patch) => set({ options: { ...get().options, ...patch } }),
      setRouterOs: (patch) => set({ routerOs: { ...get().routerOs, ...patch } }),
      toggleScenario: (id) => {
        const o = get().options;
        const has = o.scenarios.includes(id);
        const scenarios = has ? o.scenarios.filter((s) => s !== id) : [...o.scenarios, id];
        const answers = { ...o.scenarioAnswers };
        if (!has) answers[id] = answers[id] || {};
        set({ options: { ...o, scenarios, scenarioAnswers: answers } });
      },
      setScenarioAnswer: (scenarioId, questionId, values) => {
        const o = get().options;
        set({
          options: {
            ...o,
            scenarioAnswers: {
              ...o.scenarioAnswers,
              [scenarioId]: { ...(o.scenarioAnswers[scenarioId] || {}), [questionId]: values },
            },
          },
        });
      },
      toggleRuleSet: (id) => {
        const o = get().options;
        const has = o.ruleSets.includes(id);
        set({ options: { ...o, ruleSets: has ? o.ruleSets.filter((r) => r !== id) : [...o.ruleSets, id] } });
      },
      addCustomRuleSet: () => {
        const o = get().options;
        const item: CustomRuleSet = {
          id: `custom_${newNodeId()}`,
          name: '自定义规则集',
          url: '',
          kind: 'domain',
          action: 'proxy',
          enabled: true,
        };
        set({ options: { ...o, customRuleSets: [...o.customRuleSets, item] } });
      },
      updateCustomRuleSet: (id, patch) =>
        set({
          options: {
            ...get().options,
            customRuleSets: get().options.customRuleSets.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        }),
      removeCustomRuleSet: (id) =>
        set({
          options: {
            ...get().options,
            customRuleSets: get().options.customRuleSets.filter((c) => c.id !== id),
          },
        }),

      addCustomRule: () => {
        const o = get().options;
        const item: CustomRule = {
          id: `rule_${newNodeId()}`,
          type: 'DOMAIN-SUFFIX',
          value: '',
          target: 'direct',
          enabled: true,
        };
        set({ options: { ...o, customRules: [...o.customRules, item] } });
      },
      updateCustomRule: (id, patch) =>
        set({
          options: {
            ...get().options,
            customRules: get().options.customRules.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        }),
      removeCustomRule: (id) =>
        set({
          options: {
            ...get().options,
            customRules: get().options.customRules.filter((c) => c.id !== id),
          },
        }),

      saveConfig: (name, content, nodeCount, ruleSetCount, note) => {
        const id = `cfg_${newNodeId()}`;
        const item: SavedConfig = {
          id,
          name,
          core: get().options.core,
          device: get().options.device,
          content,
          nodeCount,
          ruleSetCount,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          note,
          snapshot: { nodes: get().nodes, options: get().options },
        };
        set({ library: [item, ...get().library] });
        return id;
      },
      updateSavedConfig: (id, patch) =>
        set({ library: get().library.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) }),
      loadConfig: (id) => {
        const item = get().library.find((c) => c.id === id);
        if (!item?.snapshot) return false;
        set({ nodes: item.snapshot.nodes, options: item.snapshot.options });
        return true;
      },
      deleteConfig: (id) => set({ library: get().library.filter((c) => c.id !== id) }),

      saveNodeToVault: (node) => {
        if (get().savedNodes.some((n) => n.id === node.id)) return;
        set({ savedNodes: [...get().savedNodes, { ...node }] });
      },
      removeSavedNode: (id) => set({ savedNodes: get().savedNodes.filter((n) => n.id !== id) }),

      addSubscription: (name, url, nodeCount) => {
        if (get().subscriptions.some((s) => s.url === url)) return;
        set({
          subscriptions: [
            { id: `sub_${newNodeId()}`, name, url, nodeCount, addedAt: Date.now(), lastUpdated: Date.now() },
            ...get().subscriptions,
          ],
        });
      },
      removeSubscription: (id) => set({ subscriptions: get().subscriptions.filter((s) => s.id !== id) }),
      markSubscriptionUpdated: (id, nodeCount) =>
        set({
          subscriptions: get().subscriptions.map((s) =>
            s.id === id ? { ...s, lastUpdated: Date.now(), nodeCount } : s,
          ),
        }),

      resetAll: () => set({ nodes: [], options: defaultOptions(), lastImport: null }),
    }),
    {
      name: 'proxy-forge-v1',
      version: 3,
      migrate: (persisted: unknown) => {
        const s = persisted as Partial<AppState> | undefined;
        if (!s) return undefined as unknown as AppState;
        // v1 -> v2：customRules 旧结构（{outbound,value}）迁移为空列表，补齐 blockQuic
        const options = { ...defaultOptions(), ...(s.options || {}) } as GenerateOptions;
        if (!Array.isArray(options.customRules) || options.customRules.some((r) => !('type' in r))) {
          options.customRules = [];
        }
        // v2 -> v3：补 RouterOS 引导表单
        const routerOs = { ...defaultRouterOsProfile(), ...(s.routerOs || {}) };
        return { ...s, options, routerOs } as AppState;
      },
      partialize: (s) => ({
        nodes: s.nodes,
        options: s.options,
        routerOs: s.routerOs,
        library: s.library,
        savedNodes: s.savedNodes,
        subscriptions: s.subscriptions,
      }),
    },
  ),
);
