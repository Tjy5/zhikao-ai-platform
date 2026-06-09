# Public Content Policy

本仓库可以做公考学习平台，但公开仓库不能变成未经授权的题库、网课资料库或真题解析库。本政策用于工程治理，不构成法律意见；重大商业发布、争议内容或高风险内容应由具备资质的法律顾问复核。

## Policy Goals

- 公开仓库只保存可审查、可追溯、可授权的内容。
- 私有、商业授权或本地备份内容通过外部内容包接入，不提交到公开仓库。
- 贡献者必须声明内容来源、授权方式和审核状态。
- 示例内容只用于演示平台能力，不冒充真实考试材料。

## Allowed Public Content

- 项目原创的知识点讲解、练习、写作任务、评分维度和示例反馈。
- 基于官方法律、法规、规章、政策文件和公开事实写成的原创解释。
- 明确采用开放许可证的第三方内容，并完整保留许可证、作者和来源信息。
- 纯事实性元数据，例如公开发布机关、发布日期、文号、链接和分类。

## Restricted Content

这些内容只有在授权、来源和审核材料齐全时才能进入公开仓库：

- 第三方开放许可材料。
- 政府网站、事业单位网站或高校网站上的非法律法规文本。
- 新闻报道、评论文章、图表、图片、音视频、课件或书籍摘录。
- 由合作方、出版社、培训机构或企业提供的授权内容。

受限内容必须在内容包中记录：

```json
{
  "license": "CC-BY-4.0",
  "copyright_holder": "Example Author",
  "source_refs": [
    {
      "type": "open_license",
      "title": "Example Source",
      "url": "https://example.com/source"
    }
  ],
  "review_status": "approved"
}
```

## Prohibited Public Content

以下内容不得提交到公开仓库：

- 未授权的真题、原题、试卷、题库、答案、解析或评分细则。
- 培训机构、出版物、课程、讲义、押题资料、截图、PDF 或录播内容。
- 从网上题库、论坛、社群、网盘、公众号或商业平台搬运的材料。
- 对未授权内容做轻度改写、同义替换、顺序调整或摘要后的内容。
- 本地私有目录、备份目录、旧语料、旧提示词资产或商业授权包。
- 包含个人隐私、商业秘密、国家秘密、内部事务或过程性材料的内容。

## Official Sources And Facts

可以引用官方来源作为事实依据，但引用不等于可以复制所有表达。内容贡献者应优先自己撰写解释，并在 `source_refs` 中记录来源。

已核对的一手来源：

- 国家版权局，《中华人民共和国著作权法》，第五条列明法律法规、国家机关具有立法/行政/司法性质的文件及其官方正式译文、单纯事实消息、历法、通用数表、通用表格和公式不适用著作权法：<https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html>
- 国务院令第 711 号，《中华人民共和国政府信息公开条例》，第五条规定公开原则，第十四至十七条规定国家秘密、第三方权益、内部事务、过程性信息和公开审查边界：<https://www.most.gov.cn/xxgk/xinxifenlei/zfxxgkzd/202005/t20200527_156016.html>
- Creative Commons BY 4.0 法律文本，说明共享、改编和署名义务：<https://creativecommons.org/licenses/by/4.0/legalcode.en>
- Apache License 2.0 官方文本和 SPDX 许可证列表，用于许可证标识参考：<https://www.apache.org/licenses/LICENSE-2.0>、<https://spdx.org/licenses/>

## Repository Licensing

- 代码授权以仓库根目录 `LICENSE` 为准。
- 本政策文档和原创示例内容默认采用 `CC-BY-4.0`，除非文件或内容包 manifest 另有声明。
- 私有或商业授权内容包不得提交到公开仓库；它们应使用 `LicenseRef-Private-Commercial` 或类似内部标识，并保存在外部位置。

## Content-Pack Gate

公开内容应通过内容包 manifest 进入仓库。每个内容包必须声明：

- `pack_id`
- `version`
- `license`
- `copyright_holder`
- `origin_policy`
- `items`

每个内容项必须声明：

- `item_id`
- `item_type`
- `license`
- `origin_policy`
- `review_status`
- `source_refs` 或 `originality_declaration`

运行校验：

```powershell
python backend/scripts/validate_content_packs.py
```

校验器只能提供工程门禁，不能证明内容绝对无风险。内容相似性、授权链和司法辖区问题仍需人工判断。
