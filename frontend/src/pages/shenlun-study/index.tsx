'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Layers3,
  Lightbulb,
  ListChecks,
  Map,
  PenTool,
  Route,
  Scale,
  Search,
  Table2,
  Target,
  Timer,
  Workflow,
} from 'lucide-react';

import InkWashShell from '../../components/InkWashShell';

interface KnowledgeCard {
  title: string;
  eyebrow: string;
  summary: string;
  points: readonly string[];
  icon: LucideIcon;
}

interface ReviewRule {
  title: string;
  cue: string;
  detail: string;
}

interface QuestionGuide {
  title: string;
  badge: string;
  icon: LucideIcon;
  principle: string;
  method: readonly string[];
  variants: readonly string[];
  mistakes: readonly string[];
}

interface FormatRow {
  genre: string;
  format: string;
  body: string;
  caution: string;
}

interface EssayRule {
  title: string;
  detail: string;
  checks: readonly string[];
}

interface Pitfall {
  issue: string;
  correction: string;
}

interface TrainingWeek {
  week: string;
  title: string;
  focus: string;
  tasks: readonly string[];
}

const examScanCards: readonly KnowledgeCard[] = [
  {
    title: '先看整张卷',
    eyebrow: '全卷地图',
    summary:
      '系统课按题型拆开讲，考试却是一整张卷。先读全部作答要求，再决定每题怎么读材料。',
    points: [
      '数清材料篇数和题目数量',
      '标出每题对应材料范围',
      '识别两题共用或重复使用的材料',
      '留意是否有未用材料可能服务作文',
    ],
    icon: Map,
  },
  {
    title: '用分值和字数控节奏',
    eyebrow: '时间分配',
    summary:
      '分值决定投入时间，字数约束答案点数。小题字数少但分值密度高，不能被作文焦虑挤占。',
    points: [
      '按分值占比粗分答题时间',
      '200 字题常见 4 到 5 个要点',
      '低分题避免过度深挖',
      '作文留足范围判断和成文时间',
    ],
    icon: Timer,
  },
  {
    title: '材料是答案边界',
    eyebrow: '材料为王',
    summary:
      '申论不是自由发挥。题干规定方向，材料提供内容，技巧只是帮助你更快找到该写的信息。',
    points: [
      '问什么写什么',
      '有啥写啥，不脑补背景',
      '宏观材料不一定服务小题',
      '口语材料要翻译成答题语言',
    ],
    icon: BookOpenCheck,
  },
  {
    title: '类别卷方法相通',
    eyebrow: '场景迁移',
    summary:
      '行政执法、乡镇、普通卷的场景会变，但审题、分层、提炼、成文的底层动作一致。',
    points: [
      '场景不同不等于方法重学',
      '先抓主体权限再写动作',
      '具体案例提炼成通用规则',
      '题干特殊限制优先于经验模板',
    ],
    icon: Scale,
  },
] as const;

const reviewRules: readonly ReviewRule[] = [
  {
    title: '范围',
    cue: '用哪几则材料',
    detail:
      '先看题干是否指定材料；没有指定时，用关键词、主题、前面小题使用情况和未用材料共同判断。',
  },
  {
    title: '内容',
    cue: '围绕谁写什么',
    detail:
      '拆出主体、对象、要素和动作。题干问做法就写做法，问原因就写原因，问变化就写变化。',
  },
  {
    title: '要求',
    cue: '怎么写才算合格',
    detail:
      '看字数、条理、全面准确、观点明确、对策可行等限制。字数不是装饰，它会反推点数和压缩程度。',
  },
] as const;

const materialMoves: readonly KnowledgeCard[] = [
  {
    title: '先分层再摘点',
    eyebrow: '材料处理法',
    summary:
      '按时间、主体、事件、转折、说话人、问题和做法切层，先确定每层作用，再摘可用信息。',
    points: [
      '同一人连续表达通常是一层',
      '转折、并列、因果常提示新层次',
      '事例材料先找共性再写细节',
      '长材料先压缩，不急着下结论',
    ],
    icon: Layers3,
  },
  {
    title: '找代表信息',
    eyebrow: '上位表达',
    summary:
      '每层都要找能统领细节的代表句或归纳词。被上位信息含住的举例、修饰和铺垫可以删。',
    points: [
      '先画可能匹配题干的词',
      '代表句优先于零散细节',
      '并列细节要么全写要么合并',
      '标题或归纳词必须含住后文',
    ],
    icon: Target,
  },
  {
    title: '判断配不配',
    eyebrow: '答案筛选',
    summary:
      '不是看到关键词就抄。每条信息都要判断是否符合题干主体、范围、要素和作答目的。',
    points: [
      '主体不对的信息慎用',
      '意义材料不一定能生成对策',
      '问题材料不能强行写成成绩',
      '服务作文的宏观段不要硬塞小题',
    ],
    icon: Search,
  },
  {
    title: '把材料翻译成答案',
    eyebrow: '表达成形',
    summary:
      '讲述、口语、案例和情绪化表述要转化为规范、准确、可阅卷识别的答题语言。',
    points: [
      '土话翻译为政策或治理表达',
      '负面现象可反推出正面特征',
      '先进事例要提炼经验而非复述情节',
      '并列点尽量保持同类句式',
    ],
    icon: FileCheck2,
  },
] as const;

const questionGuides: readonly QuestionGuide[] = [
  {
    title: '归纳概括',
    badge: '基础题',
    icon: ListChecks,
    principle:
      '核心是问啥答啥、有啥写啥。先审主体、对象、内容和要求，再从材料层次里提炼归纳词与具体信息。',
    method: [
      '先审范围、内容、要求；要求里最容易被忽视的是字数。',
      '题干主体出现之前的材料多半不能直接当答案，除非能证明它服务后文。',
      '每个点先给上位概括，再接材料中的具体表现，做到形式清楚、意义能统领。',
      '同类项要合并，细节被代表句含住就删；字数足够时不要压到失去关键词。',
      '示例型材料要先找共同特征，把口语和故事翻译成答题语言。',
    ],
    variants: [
      '过程题：本质仍是概括题，抓“时间、事件、状态”或“政策、动作、结果”。',
      '小标题题：标题先含住内容，再追求句式整齐；不能为了好看牺牲覆盖面。',
      '对比概括：先分别压缩两边材料，再找差异角度，避免直接堆原文。',
      '现状题：成绩、问题、做法、结果可能混在一起，按题干要素取舍。',
    ],
    mistakes: [
      '角度过抽象，写成“观念变化、行为变化”却含不住具体内容。',
      '只罗列不概括，答案看起来像材料碎片。',
      '题干问做法，却把原因、问题、背景混进去。',
    ],
  },
  {
    title: '综合分析',
    badge: '逻辑题',
    icon: BrainCircuit,
    principle: '综合分析比概括多一层逻辑。要素由题干和材料决定，不由模板决定。',
    method: [
      '先解释题干中的词、句或现象，明确它是好事、坏事、中性概念还是矛盾表达。',
      '近邻段落通常最关键，尤其是题干句前后的原因、表现和结论。',
      '好事多写解释、价值和如何更好；坏事多写问题、危害和如何解决。',
      '“是什么、为什么、怎么办”只是常见结构，材料不是这个结构时要服从材料。',
      '理论段和事例段并存时，先写理论解释，事例只保留能支撑结论的压缩信息。',
    ],
    variants: [
      '理解一句话：先拆关键词，再写材料里的表现、原因、影响或对策。',
      '问题型理解：题干出现“如果不能打破”“仅仅满足”这类限制时，重点常在问题。',
      '矛盾型概念：说明两面如何统一，避免只写其中一边。',
      '多人座谈材料：不同发言人往往自带层次，先找共性和区别。',
    ],
    mistakes: [
      '看到宏观政策段就塞进 150 字小题，导致挤掉真正近邻信息。',
      '机械套三段式，材料没有的意义或对策硬编。',
      '把综合分析写成概括清单，缺少解释和逻辑连接。',
    ],
  },
  {
    title: '对策启示',
    badge: '转化题',
    icon: Lightbulb,
    principle:
      '答案最终落到怎么做，但对策不是凭空想。来源有三类：已有做法、正面经验、问题或原因反推。',
    method: [
      '材料已有对策时直接概括，写清主体、对象、动作和目标。',
      '正面案例要提炼成可迁移做法，不能照搬地方工程名或行业专名。',
      '有原因时优先针对原因提措施；没有原因时再针对问题本身反推。',
      '题干要求问题和建议都写时，问题略写、措施详写，并保持一一对应。',
      '主体权限要准确：地方政府写贯彻落实、机制建设、部门协同，不写越权事项。',
    ],
    variants: [
      '借鉴经验题：把案例做法抽象为普适动作，再迁移到题干场景。',
      '全材料题：先排除纯意义材料，抓能产生对策的材料。',
      '争议建议题：先回应争议和担忧，再提出调整、试点、评估、沟通等办法。',
      '保护、传承、利用类题：三者常是一体系统工程，要看材料如何支撑拆分。',
    ],
    mistakes: [
      '机械“缺什么补什么”，写出不可行措施。',
      '把问题堆一段、对策堆一段，丢掉对应关系。',
      '把“提出意见建议”误判成应用文，题干没有“写一篇 + 文种”就不套格式。',
    ],
  },
  {
    title: '应用文',
    badge: '场景题',
    icon: FileText,
    principle:
      '应用文是用来用的。本质仍是材料整合，只是多了使用场景、对象、身份和格式。',
    method: [
      '先判断文章目的：宣传、解释、倡议、汇报、介绍、评论还是回应质疑。',
      '标题几乎都写；称谓看是否有明确对象；落款看是否有明确发文身份。',
      '开头高度概括背景、问题、意义或目的，不能拖成材料复述。',
      '主体按材料结构和使用目的分层，必要时加小标题帮助阅卷识别。',
      '结尾可号召、表态、收束或说明后续处理，但不能承诺超出主体权限的结果。',
    ],
    variants: [
      '公开信：要有理解、解释、姿态和后续处理，不要只写“没办法”。',
      '介绍提纲：标题即可，正文按“特点 + 运行情况”或题干要求分层。',
      '报道、简报、新闻稿：多为标题加正文，不需要乱加称谓落款。',
      '短评、网评、评论：像小作文，观点先行，再用正反材料支撑。',
    ],
    mistakes: [
      '只背格式，不看这篇文要解决什么问题。',
      '没有序数词和层次，导致 400 字正文看不出结构。',
      '字数给得多却写得空，材料里的成绩、问题、意义、做法没有用足。',
    ],
  },
  {
    title: '大作文',
    badge: '整合题',
    icon: PenTool,
    principle:
      '大作文不是纯主观写作。题干和材料共同确定方向，阅卷首先看写作角度、中心论点、结构和逻辑。',
    method: [
      '三步法：确定材料范围，提炼总分论点，填充论证内容。',
      '有指定材料时优先用指定材料；若存在未用材料，要判断它是否补充作文方向。',
      '无指定材料时，找与题干关键词相关的所有材料，不把小题答案简单拼起来。',
      '标题来自总论点，不要先套漂亮标题再倒推内容。',
      '优先用材料概括、材料推算和材料翻译；现实储备只作补充。',
    ],
    variants: [
      '抽象题：抓题干核心词，分论点围绕中心展开，不能只按领域粗分。',
      '基层题：常围绕为民初心、党建引领、增收致富、工作方式变化等材料逻辑提炼。',
      '执法善治题：聚焦执法者能做的接近群众、组织群众、做思想工作，不空写制度建设。',
      '互联互通类题：从具体材料提炼沟通交流、开放包容、共同发展的普遍意义。',
    ],
    mistakes: [
      '材料范围判断错，文章从开头就跑偏。',
      '分论点只是材料领域罗列，没有抓住题干本质。',
      '依赖万能素材，忽略材料已经给出的事例和论证路径。',
    ],
  },
] as const;

const formatRows: readonly FormatRow[] = [
  {
    genre: '倡议书 / 公开信 / 通知 / 汇报',
    format: '标题 + 称谓 + 正文 + 落款',
    body: '开头说明背景、问题或目的，主体写理由和做法，结尾表态、号召或安排。',
    caution: '称谓和落款必须来自题干身份与对象，不能为了格式硬加。',
  },
  {
    genre: '发言稿 / 讲话稿',
    format: '标题 + 称谓 + 正文',
    body: '先亮明发言场景和主题，再按经验、问题、做法或倡议分层展开。',
    caution: '通常不写落款；分享经验时要把材料做法提炼成可学习经验。',
  },
  {
    genre: '报道 / 新闻稿 / 简报',
    format: '标题 + 正文',
    body: '围绕事件、成绩、做法、意义组织，正文要像给读者看的信息成品。',
    caution: '不用写“各位读者”等称谓，也不要套复杂公文版式。',
  },
  {
    genre: '提纲 / 调研报告提纲',
    format: '标题 + 分层正文',
    body: '按题干要点列出定义、特点、运行情况、问题、建议等模块。',
    caution: '提纲不等于空架子，正文仍要有材料信息和可读层次。',
  },
  {
    genre: '短评 / 网评 / 评论',
    format: '标题 + 观点正文',
    body: '观点前置，围绕现象、原因、意义、问题和对策展开，逻辑接近小作文。',
    caution: '不要只写态度口号；评论也要回到材料证据。',
  },
  {
    genre: '建议意见',
    format: '通常不套应用文格式',
    body: '若题干只是“提出建议意见”，按对策题写清问题和措施。',
    caution: '只有出现“写一篇 / 一份 + 文种”时，才按应用文处理。',
  },
] as const;

const essayRules: readonly EssayRule[] = [
  {
    title: '范围先定',
    detail:
      '作文范围不是凭感觉。指定材料、未用材料、题干关键词和全卷结构一起决定论点来源。',
    checks: [
      '指定材料有没有足够论点信息',
      '前面小题是否已经覆盖其他材料',
      '是否存在明显服务作文的宏观材料',
    ],
  },
  {
    title: '总论点要抓本质',
    detail:
      '中心论点应回应题干关键词和材料共同主题。分论点要从同一个中心展开，而不是各写一块材料。',
    checks: [
      '标题是否能改写成中心论点',
      '每个分论点是否都回扣题干核心词',
      '分论点之间是否并列且不重复',
    ],
  },
  {
    title: '材料要会翻译',
    detail: '作文不是照抄材料故事，而是把故事、人物和政策翻译成论证语言。',
    checks: [
      '事例是否提炼出可证明的观点',
      '口语和情节是否转成治理、发展或价值表达',
      '多个事例是否写出共性和区别',
    ],
  },
  {
    title: '储备只做补充',
    detail:
      '现实素材能锦上添花，但不能替代题干和材料。没有外部储备时，也要能用材料完成论证。',
    checks: [
      '外部例子是否真正服务论点',
      '是否出现脱离材料的万能表述',
      '论证是否仍以材料逻辑为主线',
    ],
  },
] as const;

const pitfalls: readonly Pitfall[] = [
  {
    issue: '只盯当前题，没先看全卷作答要求。',
    correction:
      '先建立材料范围地图，避免把共用材料、未用材料和作文范围判断错。',
  },
  {
    issue: '看到材料就摘句，不判断是否匹配题干。',
    correction: '每条信息都用“范围、内容、要求”过一遍，配不上的不写。',
  },
  {
    issue: '归纳词太空，含不住后面的材料。',
    correction: '先让标题或概括词覆盖内容，再考虑表达是否工整。',
  },
  {
    issue: '综合分析机械套“是什么、为什么、怎么办”。',
    correction: '材料给什么要素就写什么要素，题干暗示问题就重点写问题。',
  },
  {
    issue: '对策只会“加强、完善、提高”。',
    correction: '写清主体、对象、动作和目标；有原因就优先针对原因。',
  },
  {
    issue: '主体越权，地方部门写成国家层面决策。',
    correction:
      '把动作改成贯彻落实、制定本地意见、建立机制、协调部门、组织宣传等可执行事项。',
  },
  {
    issue: '应用文只纠结格式，正文内容空。',
    correction: '先判断这篇文的目的，再选择材料里的问题、成绩、意义和做法。',
  },
  {
    issue: '作文把小题答案拼起来。',
    correction: '小题答案只能提供材料理解，作文仍要重新确定中心和分论点。',
  },
  {
    issue: '宏观材料一出现就塞进所有题。',
    correction: '判断宏观段是服务小题、服务作文，还是只是背景。',
  },
  {
    issue: '过度依赖万能素材。',
    correction: '优先使用材料概括、材料推算和材料翻译，再补现实储备。',
  },
] as const;

const trainingPlan: readonly TrainingWeek[] = [
  {
    week: '第 1 周',
    title: '审题和分层',
    focus: '每天 1 道归纳概括，只练范围、内容、要求和材料层次。',
    tasks: [
      '答题前写出材料范围',
      '给每段标层次作用',
      '复盘每个点是否被上位词含住',
    ],
  },
  {
    week: '第 2 周',
    title: '概括到分析',
    focus: '加入综合分析题，先写答案逻辑，再写正文。',
    tasks: [
      '标出解释、问题、意义、对策要素',
      '练 150 到 300 字压缩',
      '检查是否硬套模板',
    ],
  },
  {
    week: '第 3 周',
    title: '对策和应用文',
    focus: '集中训练问题反推、经验迁移和格式服务目的。',
    tasks: [
      '对策逐条标主体和动作',
      '把正面案例改写成通用经验',
      '按文种判断标题、称谓、落款',
    ],
  },
  {
    week: '第 4 周',
    title: '套题和作文',
    focus: '按整卷计时，把小题节奏和作文范围判断合并训练。',
    tasks: [
      '先读全部作答要求',
      '作文先定范围和总分论点',
      '复盘跑题、漏点和超时原因',
    ],
  },
] as const;

export default function ShenlunStudyPage() {
  return (
    <InkWashShell
      title='申论学习'
      context='申论学习'
      description='基于 19 份申论转写资料整理的学习知识库，把读题、读材料、搭结构、写答案拆成可训练的方法。'
      actions={[
        { label: '开始申论批改', to: '/writing', variant: 'primary' },
        { label: '查看复盘档案', to: '/history', variant: 'secondary' },
      ]}
      metrics={[
        { label: '原始转写', value: '19份' },
        { label: '知识模块', value: '9' },
        { label: '题型细分', value: '18+' },
        { label: '训练路径', value: '4周' },
      ]}
    >
      <div className='grid gap-10'>
        <section
          aria-labelledby='study-route-title'
          className='retained-surface overflow-hidden px-5 py-6 sm:px-8 lg:px-10'
        >
          <div className='grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-center'>
            <div>
              <div className='mb-4 flex flex-wrap items-center gap-3'>
                <span className='seal-mark text-lg'>学</span>
                <p className='font-semi-cursive text-3xl text-civic-blue'>
                  先会读卷，再去下笔
                </p>
              </div>
              <h2
                id='study-route-title'
                className='font-running-script text-4xl font-normal leading-tight text-ink sm:text-5xl'
              >
                一张申论卷，拆成九个可训练模块
              </h2>
              <p className='mt-5 max-w-4xl font-kaishu text-lg leading-9 text-ink-wash'>
                申论学习不是背模板，而是建立稳定流程：先看全卷作答要求，审清范围、内容、要求，再把材料层次转成题型需要的答案结构。
              </p>
            </div>

            <div className='grid gap-3 border-l-0 border-civic-blue/16 pl-0 lg:border-l lg:pl-6'>
              {[
                '全卷扫描',
                '审题三件事',
                '材料处理法',
                '题型结构库',
                '作文三步法',
              ].map((item, index) => (
                <div
                  key={item}
                  className='flex items-center justify-between gap-4 border-b border-ink-light/10 pb-3 last:border-b-0 last:pb-0'
                >
                  <span className='font-kaishu text-base text-ink'>{item}</span>
                  <span className='font-mono text-sm text-civic-blue'>
                    0{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby='exam-scan-title'>
          <SectionHeader
            id='exam-scan-title'
            eyebrow='先读全卷'
            title='考场第一步：建立作答地图'
            description='源材料反复强调，申论是整体卷面。先读作答要求，才能判断每题范围、材料用法、时间投入和作文方向。'
          />
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            {examScanCards.map(card => (
              <KnowledgeCardView key={card.title} card={card} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby='review-material-title'
          className='grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'
        >
          <div>
            <SectionHeader
              id='review-material-title'
              eyebrow='审题三件事'
              title='范围、内容、要求'
              description='每道小题都先拆这三件事。拆不清楚，后面读材料就会变成随手摘句。'
            />
            <div className='grid gap-4'>
              {reviewRules.map((rule, index) => (
                <article key={rule.title} className='retained-surface p-5'>
                  <div className='mb-3 flex items-center gap-3'>
                    <span className='flex h-9 w-9 items-center justify-center rounded-[6px] bg-civic-blue/10 font-mono text-xs text-civic-blue'>
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className='font-running-script text-3xl font-normal leading-none text-ink'>
                        {rule.title}
                      </h3>
                      <p className='mt-1 font-kaishu text-sm text-civic-blue'>
                        {rule.cue}
                      </p>
                    </div>
                  </div>
                  <p className='font-kaishu text-base leading-8 text-ink-wash'>
                    {rule.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader
              id='material-method-title'
              eyebrow='材料处理法'
              title='从材料到答案的四个动作'
              description='先切层次，再找代表信息；先判断配不配，再把材料翻译成答题语言。'
            />
            <div className='grid gap-4 md:grid-cols-2'>
              {materialMoves.map(card => (
                <KnowledgeCardView key={card.title} card={card} compact />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby='question-library-title'>
          <SectionHeader
            id='question-library-title'
            eyebrow='题型知识库'
            title='五类题不背模板，背判断'
            description='每类题都按原则、方法、变形题处理和避坑拆开。题型只是帮助你选择答案结构，不能代替材料理解。'
          />
          <div className='grid gap-5'>
            {questionGuides.map(guide => (
              <QuestionGuideView key={guide.title} guide={guide} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby='format-matrix-title'
          className='retained-surface overflow-hidden p-5 sm:p-7'
        >
          <div className='mb-6 flex flex-wrap items-center gap-3'>
            <Table2 className='h-6 w-6 text-civic-blue' aria-hidden='true' />
            <div>
              <p className='font-semi-cursive text-2xl text-civic-blue'>
                应用文格式矩阵
              </p>
              <h2
                id='format-matrix-title'
                className='font-running-script text-4xl font-normal text-ink'
              >
                格式跟着文种和目的走
              </h2>
            </div>
          </div>
          <div className='overflow-x-auto'>
            <table className='min-w-[880px] border-separate border-spacing-0 font-kaishu text-base text-ink'>
              <thead>
                <tr className='text-left text-sm text-civic-blue'>
                  <th className='border-b border-ink-light/12 px-3 py-3 font-normal'>
                    常见文种
                  </th>
                  <th className='border-b border-ink-light/12 px-3 py-3 font-normal'>
                    推荐格式
                  </th>
                  <th className='border-b border-ink-light/12 px-3 py-3 font-normal'>
                    正文重点
                  </th>
                  <th className='border-b border-ink-light/12 px-3 py-3 font-normal'>
                    避坑
                  </th>
                </tr>
              </thead>
              <tbody>
                {formatRows.map(row => (
                  <tr key={row.genre} className='align-top'>
                    <td className='border-b border-ink-light/10 px-3 py-4 text-ink'>
                      {row.genre}
                    </td>
                    <td className='border-b border-ink-light/10 px-3 py-4 text-ink-wash'>
                      {row.format}
                    </td>
                    <td className='border-b border-ink-light/10 px-3 py-4 leading-7 text-ink-wash'>
                      {row.body}
                    </td>
                    <td className='border-b border-ink-light/10 px-3 py-4 leading-7 text-ink-wash'>
                      {row.caution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby='essay-method-title'>
          <SectionHeader
            id='essay-method-title'
            eyebrow='大作文三步法'
            title='确定范围，提炼论点，填充内容'
            description='作文也要从材料出发。关键不是有没有万能素材，而是能不能把材料里的事例、政策和主题翻译成论证。'
          />
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            {essayRules.map(rule => (
              <article key={rule.title} className='retained-surface p-5'>
                <div className='mb-4 flex items-center gap-3'>
                  <PenTool
                    className='h-5 w-5 text-seal-red'
                    aria-hidden='true'
                  />
                  <h3 className='font-running-script text-3xl font-normal text-ink'>
                    {rule.title}
                  </h3>
                </div>
                <p className='font-kaishu text-base leading-8 text-ink-wash'>
                  {rule.detail}
                </p>
                <ul className='mt-4 grid gap-2 font-kaishu text-sm leading-6 text-ink'>
                  {rule.checks.map(check => (
                    <li key={check} className='flex gap-2'>
                      <CheckCircle2
                        className='mt-1 h-4 w-4 flex-none text-civic-green'
                        aria-hidden='true'
                      />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby='pitfall-title'>
          <SectionHeader
            id='pitfall-title'
            eyebrow='常见误区自检'
            title='写完后用这些问题反查'
            description='这些坑来自不同题型反复出现的同一类错误：范围错、层次乱、主体越权、模板化、材料翻译不足。'
          />
          <div className='grid gap-3 md:grid-cols-2'>
            {pitfalls.map(item => (
              <article key={item.issue} className='retained-surface-soft p-4'>
                <div className='mb-2 flex items-start gap-3'>
                  <AlertTriangle
                    className='mt-1 h-5 w-5 flex-none text-seal-red'
                    aria-hidden='true'
                  />
                  <h3 className='font-kaishu text-base leading-7 text-ink'>
                    {item.issue}
                  </h3>
                </div>
                <p className='pl-8 font-kaishu text-sm leading-7 text-ink-wash'>
                  {item.correction}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby='training-title'
          className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]'
        >
          <div>
            <SectionHeader
              id='training-title'
              eyebrow='训练路径'
              title='四周把方法练成动作'
              description='不要一次性把所有题型混练。先把审题和材料层次练稳，再逐步加入分析、对策、应用文和作文。'
            />
            <div className='grid gap-4 md:grid-cols-2'>
              {trainingPlan.map(week => (
                <article key={week.week} className='retained-surface p-5'>
                  <p className='font-mono text-xs text-civic-blue'>
                    {week.week}
                  </p>
                  <h3 className='mt-2 font-running-script text-3xl font-normal text-ink'>
                    {week.title}
                  </h3>
                  <p className='mt-3 font-kaishu text-base leading-8 text-ink-wash'>
                    {week.focus}
                  </p>
                  <ul className='mt-4 grid gap-2 font-kaishu text-sm leading-6 text-ink'>
                    {week.tasks.map(task => (
                      <li key={task} className='flex gap-2'>
                        <CheckCircle2
                          className='mt-1 h-4 w-4 flex-none text-civic-green'
                          aria-hidden='true'
                        />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <aside className='retained-surface p-5 sm:p-7'>
            <div className='mb-5 flex items-center gap-3'>
              <Route className='h-6 w-6 text-civic-blue' aria-hidden='true' />
              <h2
                id='review-check-title'
                className='font-running-script text-4xl font-normal text-ink'
              >
                考前复盘口径
              </h2>
            </div>
            <div className='grid gap-4 font-kaishu text-base leading-8 text-ink-wash'>
              <p>
                小题复盘只看三件事：范围有没有找错，层次有没有合并，答案是否写出了题干要求的要素。
              </p>
              <p>
                应用文复盘看目的是否明确、格式是否够用、正文是否充实。作文复盘看范围、总论点、分论点和材料翻译。
              </p>
              <div className='border-t border-ink-light/12 pt-4'>
                <p className='font-semi-cursive text-2xl text-seal-red'>
                  不把漂亮话当答案
                </p>
                <p className='mt-2'>
                  阅卷能识别的是要点、逻辑和结构。文采可以加分，但不能替代材料依据。
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </InkWashShell>
  );
}

function SectionHeader({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className='mb-5 flex flex-wrap items-end justify-between gap-4'>
      <div>
        <p className='font-semi-cursive text-2xl text-civic-blue'>{eyebrow}</p>
        <h2
          id={id}
          className='mt-2 font-running-script text-4xl font-normal text-ink'
        >
          {title}
        </h2>
      </div>
      <p className='max-w-3xl font-kaishu text-base leading-7 text-ink-wash'>
        {description}
      </p>
    </div>
  );
}

function KnowledgeCardView({
  card,
  compact = false,
}: {
  card: KnowledgeCard;
  compact?: boolean;
}) {
  const Icon = card.icon;

  return (
    <article
      className={`retained-surface flex flex-col p-5 ${
        compact ? 'min-h-[300px]' : 'min-h-[340px]'
      }`}
    >
      <div className='mb-4 flex items-center justify-between gap-3'>
        <span className='font-kaishu text-sm text-civic-blue'>
          {card.eyebrow}
        </span>
        <span className='flex h-10 w-10 items-center justify-center rounded-[6px] border border-civic-blue/16 bg-civic-blue/8 text-civic-blue'>
          <Icon className='h-5 w-5' aria-hidden='true' />
        </span>
      </div>
      <h3 className='font-running-script text-3xl font-normal text-ink'>
        {card.title}
      </h3>
      <p className='mt-3 font-kaishu text-base leading-8 text-ink-wash'>
        {card.summary}
      </p>
      <ul className='mt-5 grid gap-2 font-kaishu text-sm leading-6 text-ink'>
        {card.points.map(point => (
          <li key={point} className='flex items-start gap-2'>
            <span
              className='mt-2 h-1.5 w-1.5 flex-none rounded-full bg-seal-red'
              aria-hidden='true'
            />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function QuestionGuideView({ guide }: { guide: QuestionGuide }) {
  const Icon = guide.icon;

  return (
    <article className='retained-surface p-5 sm:p-6'>
      <div className='grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
        <div>
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <span className='flex h-11 w-11 items-center justify-center rounded-[6px] border border-civic-blue/16 bg-civic-blue text-paper'>
              <Icon className='h-5 w-5' aria-hidden='true' />
            </span>
            <div>
              <p className='font-kaishu text-sm text-civic-blue'>
                {guide.badge}
              </p>
              <h3 className='font-running-script text-4xl font-normal leading-none text-ink'>
                {guide.title}
              </h3>
            </div>
          </div>
          <p className='font-kaishu text-base leading-8 text-ink-wash'>
            {guide.principle}
          </p>
        </div>

        <div className='grid gap-5 md:grid-cols-3'>
          <GuideList
            icon={Workflow}
            title='作答方法'
            items={guide.method}
            tone='blue'
          />
          <GuideList
            icon={ClipboardCheck}
            title='变形题处理'
            items={guide.variants}
            tone='green'
          />
          <GuideList
            icon={AlertTriangle}
            title='高频误区'
            items={guide.mistakes}
            tone='red'
          />
        </div>
      </div>
    </article>
  );
}

function GuideList({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  items: readonly string[];
  tone: 'blue' | 'green' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-civic-green bg-civic-green/8 border-civic-green/18'
      : tone === 'red'
        ? 'text-seal-red bg-seal-red/6 border-seal-red/18'
        : 'text-civic-blue bg-civic-blue/8 border-civic-blue/18';

  return (
    <div className='border-t border-ink-light/12 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0'>
      <div className='mb-3 flex items-center gap-2'>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-[6px] border ${toneClass}`}
        >
          <Icon className='h-4 w-4' aria-hidden='true' />
        </span>
        <h4 className='font-kaishu text-base text-ink'>{title}</h4>
      </div>
      <ul className='grid gap-2 font-kaishu text-sm leading-6 text-ink-wash'>
        {items.map(item => (
          <li key={item} className='flex gap-2'>
            <span
              className='mt-2 h-1.5 w-1.5 flex-none rounded-full bg-ink-light/45'
              aria-hidden='true'
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
