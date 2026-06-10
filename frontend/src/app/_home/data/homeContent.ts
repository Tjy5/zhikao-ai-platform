export const workflowLabels = [
  '诊断薄弱项',
  '专项训练',
  '智能批改',
  '复盘提分',
] as const;

export const pageCards = [
  {
    title: '学习首页',
    subtitle: '汇总训练数据、薄弱项和下一步学习任务。',
    metricLabel: '入口',
    metric: 'home',
    href: '/',
    badge: '总览',
  },
  {
    title: '申论批改',
    subtitle: '提交材料与作答，生成评分、评语和可执行修改建议。',
    metricLabel: '已批改',
    metric: 'totalWritings',
    href: '/writing',
    badge: '训练',
  },
  {
    title: '复盘档案',
    subtitle: '回看历史答案、得分走势和每次训练的扣分原因。',
    metricLabel: '档案',
    metric: 'history',
    href: '/history',
    badge: '复盘',
  },
  {
    title: '模型设置',
    subtitle: '配置 AI 模型、服务地址和测试状态，保持批改链路可用。',
    metricLabel: '配置',
    metric: 'settings',
    href: '/settings',
    badge: '系统',
  },
] as const;

export const ctaLines = [
  '下一套题，从薄弱项开始。',
  '把每次训练沉淀成提分路径。',
] as const;
