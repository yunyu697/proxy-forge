import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button, Card, Field, Icon, Input, Notice, Select, Toggle } from './ui';
import { ProxyNode, ProxyType, REQUIRED_FIELDS, createEmptyNode, PROXY_TYPE_LABELS } from '../core/types';
import { useStore } from '../store/useStore';

/* ------------------------------------------------------------------ */
/* 引导式字段配置：按协议声明「需要什么」，界面自动跟随                    */
/* ------------------------------------------------------------------ */

interface FieldDef {
  /** ProxyNode 上的字段名；UI 扩展字段（securityMode / wsHost）保存时再做语义转换 */
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'password' | 'textarea' | 'select' | 'toggle';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  group: 'basic' | 'auth' | 'transport' | 'tls' | 'misc';
  /** 仅在 node.network === when 时显示 */
  when?: (n: ProxyNode) => boolean;
}

const NETWORK_OPTIONS = [
  { value: 'tcp', label: 'TCP（无额外传输层）' },
  { value: 'ws', label: 'WebSocket' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'h2', label: 'HTTP/2 (h2)' },
  { value: 'httpupgrade', label: 'HTTPUpgrade' },
];

const COMMON_TLS: FieldDef[] = [
  { key: 'sni', label: 'SNI / 伪装域名', placeholder: '留空则使用服务器地址', group: 'tls' },
  {
    key: 'fingerprint',
    label: 'uTLS 指纹',
    placeholder: 'chrome / firefox / safari / random',
    group: 'tls',
    hint: '模拟浏览器 TLS 指纹，抗探测',
  },
  {
    key: 'alpn',
    label: 'ALPN',
    placeholder: 'h2,http/1.1',
    group: 'tls',
    hint: '逗号分隔；hysteria 系列留空会自动填默认值',
  },
  {
    key: 'skipCertVerify',
    label: '跳过证书校验',
    type: 'toggle',
    group: 'tls',
    hint: '自签证书时开启，存在中间人风险',
  },
];

const TRANSPORT_FIELDS: FieldDef[] = [
  { key: 'network', label: '传输层', type: 'select', options: NETWORK_OPTIONS, group: 'transport' },
  {
    key: 'wsPath',
    label: 'WebSocket 路径',
    placeholder: '/path?ed=2048',
    group: 'transport',
    when: (n) => n.network === 'ws' || n.network === 'httpupgrade',
  },
  {
    key: 'wsHost',
    label: 'WebSocket Host 头',
    placeholder: '伪装域名',
    group: 'transport',
    when: (n) => n.network === 'ws' || n.network === 'httpupgrade',
  },
  {
    key: 'grpcServiceName',
    label: 'gRPC serviceName',
    placeholder: 'GunService',
    group: 'transport',
    when: (n) => n.network === 'grpc',
  },
  { key: 'h2Path', label: 'h2 路径', placeholder: '/path', group: 'transport', when: (n) => n.network === 'h2' },
  { key: 'h2Host', label: 'h2 Host', placeholder: '伪装域名', group: 'transport', when: (n) => n.network === 'h2' },
];

const SCHEMA: Record<ProxyType, FieldDef[]> = {
  shadowsocks: [
    { key: 'server', label: '服务器地址', placeholder: 'example.com 或 IP', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', placeholder: '香港 01', group: 'basic' },
    {
      key: 'cipher',
      label: '加密方式',
      type: 'select',
      required: true,
      group: 'auth',
      options: [
        '2022-blake3-aes-128-gcm',
        '2022-blake3-aes-256-gcm',
        '2022-blake3-chacha20-poly1305',
        'aes-128-gcm',
        'aes-192-gcm',
        'aes-256-gcm',
        'chacha20-ietf-poly1305',
        'xchacha20-ietf-poly1305',
        'none',
      ].map((v) => ({ value: v, label: v })),
    },
    { key: 'password', label: '密码', type: 'password', required: true, group: 'auth' },
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
    {
      key: 'plugin',
      label: '混淆插件',
      type: 'select',
      group: 'transport',
      options: [
        { value: '', label: '无' },
        { value: 'obfs', label: 'simple-obfs' },
        { value: 'v2ray-plugin', label: 'v2ray-plugin' },
      ],
    },
    {
      key: 'wsPath',
      label: '插件参数',
      placeholder: 'obfs=http;obfs-host=xxx 或 path=/;host=xxx',
      group: 'transport',
      when: (n) => !!n.plugin,
    },
  ],
  shadowsocksr: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    {
      key: 'cipher',
      label: '加密方式',
      type: 'select',
      required: true,
      group: 'auth',
      options: ['rc4-md5', 'aes-128-cfb', 'aes-256-cfb', 'chacha20-ietf', 'chacha20-ietf-poly1305'].map((v) => ({
        value: v,
        label: v,
      })),
    },
    { key: 'password', label: '密码', type: 'password', required: true, group: 'auth' },
    { key: 'ssrProtocol', label: '协议 (protocol)', placeholder: 'auth_aes128_md5', required: true, group: 'auth' },
    { key: 'ssrProtocolParam', label: '协议参数', group: 'auth' },
    { key: 'ssrObfs', label: '混淆 (obfs)', placeholder: 'tls1.2_ticket_auth', required: true, group: 'auth' },
    { key: 'ssrObfsParam', label: '混淆参数', group: 'auth' },
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
  ],
  vmess: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'uuid', label: 'UUID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true, group: 'auth' },
    { key: 'alterId', label: 'alterId', type: 'number', hint: 'VMess V2 通常为 0', group: 'auth' },
    {
      key: 'vmessSecurity',
      label: '加密方式',
      type: 'select',
      group: 'auth',
      options: ['auto', 'none', 'aes-128-gcm', 'chacha20-poly1305', 'zero'].map((v) => ({ value: v, label: v })),
    },
    ...TRANSPORT_FIELDS,
    { key: 'tls', label: '启用 TLS', type: 'toggle', group: 'tls' },
    ...COMMON_TLS,
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
  ],
  vless: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'uuid', label: 'UUID', required: true, group: 'auth' },
    { key: 'flow', label: 'flow', placeholder: 'xtls-rprx-vision（Vision 时必填）', group: 'auth' },
    ...TRANSPORT_FIELDS,
    {
      key: 'securityMode',
      label: '安全层',
      type: 'select',
      group: 'tls',
      options: [
        { value: 'tls', label: 'TLS' },
        { value: 'reality', label: 'REALITY' },
        { value: 'none', label: '无' },
      ],
    },
    {
      key: 'realityPublicKey',
      label: 'REALITY public key',
      required: true,
      group: 'tls',
      when: (n) => (n as any).securityMode === 'reality',
    },
    {
      key: 'realityShortId',
      label: 'REALITY shortId',
      group: 'tls',
      when: (n) => (n as any).securityMode === 'reality',
    },
    ...COMMON_TLS,
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
  ],
  trojan: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'password', label: '密码', type: 'password', required: true, group: 'auth' },
    ...TRANSPORT_FIELDS,
    ...COMMON_TLS,
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
  ],
  hysteria: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'authStr', label: '认证密码 (auth)', group: 'auth', hint: '留空表示服务端未开启认证' },
    {
      key: 'up',
      label: '上行带宽',
      placeholder: '100 Mbps',
      group: 'auth',
      hint: '尽量按真实带宽填写，过大会造成拥塞',
    },
    { key: 'down', label: '下行带宽', placeholder: '200 Mbps', group: 'auth' },
    { key: 'obfsPassword', label: '混淆密码 (obfs)', group: 'auth' },
    { key: 'hopPorts', label: '端口跳跃范围', placeholder: '20000-40000', group: 'misc' },
    ...COMMON_TLS,
  ],
  hysteria2: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'password', label: '认证密码', type: 'password', required: true, group: 'auth' },
    { key: 'obfsPassword', label: '混淆密码 (salamander)', group: 'auth' },
    { key: 'up', label: '上行带宽', placeholder: '100 Mbps', group: 'auth' },
    { key: 'down', label: '下行带宽', placeholder: '200 Mbps', group: 'auth' },
    { key: 'hopPorts', label: '端口跳跃范围', placeholder: '20000-40000', group: 'misc' },
    ...COMMON_TLS,
  ],
  tuic: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'uuid', label: 'UUID', required: true, group: 'auth' },
    { key: 'password', label: '密码', type: 'password', required: true, group: 'auth' },
    {
      key: 'congestion',
      label: '拥塞控制',
      type: 'select',
      group: 'auth',
      options: ['bbr', 'cubic', 'new_reno'].map((v) => ({ value: v, label: v })),
    },
    {
      key: 'udpRelayMode',
      label: 'UDP 中继模式',
      type: 'select',
      group: 'auth',
      options: [
        { value: 'native', label: 'native' },
        { value: 'quic', label: 'quic' },
      ],
    },
    ...COMMON_TLS,
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
  ],
  anytls: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'password', label: '密码', type: 'password', required: true, group: 'auth' },
    ...COMMON_TLS,
  ],
  wireguard: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'wgPrivateKey', label: '本机私钥', type: 'password', required: true, group: 'auth' },
    { key: 'wgPeerPublicKey', label: '对端公钥', required: true, group: 'auth' },
    { key: 'wgPreSharedKey', label: '预共享密钥', type: 'password', group: 'auth' },
    { key: 'wgLocalAddress', label: '本机地址', placeholder: '10.0.0.2/32', required: true, group: 'auth' },
    { key: 'wgReserved', label: 'reserved', placeholder: '0, 0, 0', group: 'auth' },
    { key: 'wgMtu', label: 'MTU', type: 'number', group: 'misc' },
  ],
  http: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'username', label: '用户名', group: 'auth' },
    { key: 'password', label: '密码', type: 'password', group: 'auth' },
    { key: 'tls', label: '使用 HTTPS', type: 'toggle', group: 'tls' },
    ...COMMON_TLS,
  ],
  socks: [
    { key: 'server', label: '服务器地址', required: true, group: 'basic' },
    { key: 'port', label: '端口', type: 'number', required: true, group: 'basic' },
    { key: 'name', label: '节点名称', group: 'basic' },
    { key: 'username', label: '用户名', group: 'auth' },
    { key: 'password', label: '密码', type: 'password', group: 'auth' },
    { key: 'udp', label: '启用 UDP', type: 'toggle', group: 'misc' },
  ],
};

const GROUP_META: { id: FieldDef['group']; title: string; desc?: string }[] = [
  { id: 'basic', title: '基础信息' },
  { id: 'auth', title: '认证与加密' },
  { id: 'transport', title: '传输层', desc: '没有特殊要求保持默认即可' },
  { id: 'tls', title: 'TLS / 安全层' },
  { id: 'misc', title: '其他' },
];

export function NodeEditor({ initial, onClose }: { initial?: ProxyNode; onClose: (saved?: boolean) => void }) {
  const addNodes = useStore((s) => s.addNodes);
  const updateNode = useStore((s) => s.updateNode);
  const [type, setType] = useState<ProxyType>(initial?.type || 'shadowsocks');
  const [node, setNode] = useState<ProxyNode>(() => initial || createEmptyNode('shadowsocks'));
  const [touched, setTouched] = useState(false);

  const fields = SCHEMA[type];
  const pickedType = type !== node.type;

  const patch = (p: Partial<ProxyNode>) => setNode((n) => ({ ...n, ...p }));

  const switchType = (t: ProxyType) => {
    setType(t);
    const fresh = createEmptyNode(t);
    if (t === 'vless') (fresh as any).securityMode = 'tls';
    setNode(fresh);
    setTouched(false);
  };

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!node.server.trim()) errs.push('服务器地址不能为空');
    if (!node.port || node.port <= 0 || node.port > 65535) errs.push('端口无效');
    for (const f of REQUIRED_FIELDS[type]) {
      const v = node[f];
      if (v === undefined || v === null || v === '') errs.push(`缺少必填项：${String(f)}`);
    }
    return errs;
  }, [node, type]);

  const save = () => {
    setTouched(true);
    if (errors.length) return;
    // 把 securityMode 语义落到 tls / reality
    const finalNode: ProxyNode = { ...node, type };
    const sec = (finalNode as any).securityMode;
    if (type === 'vless') {
      finalNode.tls = sec !== 'none';
      if (sec !== 'reality') {
        finalNode.realityPublicKey = undefined;
        finalNode.realityShortId = undefined;
      }
    }
    // 把 wsHost 收进 wsHeaders
    if (finalNode.network === 'ws' || finalNode.network === 'httpupgrade') {
      const host = (finalNode as any).wsHost;
      finalNode.wsHeaders = host ? { Host: host } : undefined;
    }
    if (initial) {
      updateNode(initial.id, finalNode);
    } else {
      addNodes([finalNode]);
    }
    onClose(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm sm:p-8">
      <Card className="w-full max-w-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink-800">{initial ? '编辑节点' : '手动添加节点'}</h2>
          <button className="btn-ghost p-1.5" onClick={() => onClose()}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* 协议选择 */}
        <Field label="协议类型" className="mb-5">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PROXY_TYPE_LABELS) as ProxyType[]).map((t) => (
              <button
                key={t}
                onClick={() => switchType(t)}
                className={clsx(
                  'rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition',
                  type === t
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 text-ink-600 hover:bg-ink-50',
                )}
              >
                {PROXY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>

        {pickedType && !initial && (
          <div className="mb-4">
            <Notice tone="info">已切换到 {PROXY_TYPE_LABELS[type]}，表单已重置为该协议的默认值。</Notice>
          </div>
        )}

        {/* 分组渲染字段 */}
        <div className="space-y-5">
          {GROUP_META.map((g) => {
            const groupFields = fields.filter((f) => f.group === g.id && (!f.when || f.when(node)));
            if (!groupFields.length) return null;
            return (
              <div key={g.id}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold text-ink-700">{g.title}</h3>
                  {g.desc && <span className="text-[11px] text-ink-400">{g.desc}</span>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {groupFields.map((f) => {
                    const value = (node as any)[f.key];
                    if (f.type === 'toggle') {
                      return (
                        <div key={String(f.key)} className="sm:col-span-2">
                          <Toggle
                            checked={Boolean(value)}
                            onChange={(v) => patch({ [f.key]: v } as Partial<ProxyNode>)}
                            label={f.label}
                            desc={f.hint}
                          />
                        </div>
                      );
                    }
                    if (f.type === 'select') {
                      return (
                        <Field key={String(f.key)} label={f.label} hint={f.hint} required={f.required}>
                          <Select
                            value={String(value ?? '')}
                            onChange={(e) => patch({ [f.key]: e.target.value } as Partial<ProxyNode>)}
                          >
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      );
                    }
                    return (
                      <Field
                        key={String(f.key)}
                        label={f.label}
                        hint={f.hint}
                        required={f.required}
                        className={f.key === 'name' ? '' : undefined}
                      >
                        <Input
                          type={f.type === 'number' ? 'number' : f.type === 'password' ? 'password' : 'text'}
                          placeholder={f.placeholder}
                          value={value ?? ''}
                          onChange={(e) =>
                            patch({
                              [f.key]: f.type === 'number' ? Number(e.target.value) || '' : e.target.value,
                            } as Partial<ProxyNode>)
                          }
                        />
                      </Field>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 校验结果 */}
        {touched && errors.length > 0 && (
          <div className="mt-5">
            <Notice tone="error">
              <ul className="list-inside list-disc space-y-0.5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onClose()}>
            取消
          </Button>
          <Button icon="save" onClick={save}>
            {initial ? '保存修改' : '添加节点'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
