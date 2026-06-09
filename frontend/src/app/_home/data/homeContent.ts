export const workflowLabels = ['提交作答', '智能批改', '历史复盘'] as const;

export const pageCards = [
  {
    title: '首页',
    subtitle: '查看批改概览、最近统计和快捷操作。',
    metricLabel: '学习台:',
    metric: 'home',
    href: '/',
    badge: '概览',
  },
  {
    title: '写作反馈',
    subtitle: '提交材料和答案，查看评分、评语与修改建议。',
    metricLabel: '批改记录:',
    metric: 'totalWritings',
    href: '/writing',
    badge: '批改',
  },
  {
    title: '历史记录',
    subtitle: '回看已保存的写作反馈记录、分数和反馈。',
    metricLabel: '历史:',
    metric: 'history',
    href: '/history',
    badge: '复盘',
  },
] as const;

export const ctaLines = ['马上提交作答。', '回看历史反馈。'] as const;
