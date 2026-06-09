# Contributing Content

本仓库欢迎原创、可审查、可授权的公考学习内容。提交内容前，请先阅读 [CONTENT_POLICY.md](CONTENT_POLICY.md)。

## Contribution Rules

- 不提交真题、原题、试卷、题库、答案、解析、培训资料或旧私有内容。
- 不把网上材料改几个词后当作原创。
- 不提交没有来源、没有许可证、没有审核状态的内容。
- 不提交个人隐私、商业秘密、国家秘密、内部事务或过程性材料。
- 不提交本地私有目录中的任何文件。

## Content Types

当前公开 demo 包支持三类内容：

- `knowledge_point`：知识点讲解。
- `practice_question`：原创练习。
- `writing_task`：申论类写作任务或公共议题写作任务。

## Origin Policies

内容项必须选择一个来源策略：

- `original_only`：完全原创，需填写 `originality_declaration`。
- `official_source_based`：基于官方法律、法规、政策或公开事实写成的原创解释，需填写 `source_refs`。
- `mixed_with_review`：混合来源并经过人工审核，需同时说明原创部分和外部来源。
- `licensed_private`：私有或商业授权内容，不得放入公开 demo 包。

## Review Status

公开仓库只接受 `approved` 状态的内容项。其他状态应停留在本地或私有仓库：

- `draft`
- `needs_review`
- `approved`
- `rejected`

## Manifest Example

```json
{
  "schema_version": "1.0",
  "pack_id": "open-civil-service-demo",
  "title": "Open Civil Service Demo Content Pack",
  "version": "0.1.0",
  "license": "CC-BY-4.0",
  "copyright_holder": "Tjy5 contributors",
  "origin_policy": "mixed_with_review",
  "items": [
    {
      "path": "questions/service-design-practice.json",
      "item_id": "practice-service-design-001",
      "item_type": "practice_question",
      "title": "Service Design Practice",
      "license": "CC-BY-4.0",
      "origin_policy": "original_only",
      "review_status": "approved",
      "originality_declaration": "Created from scratch for this repository."
    }
  ]
}
```

## Item Example

```json
{
  "item_id": "practice-service-design-001",
  "item_type": "practice_question",
  "title": "Service Design Practice",
  "license": "CC-BY-4.0",
  "copyright_holder": "Tjy5 contributors",
  "origin_policy": "original_only",
  "review_status": "approved",
  "source_refs": [],
  "originality_declaration": "Created from scratch for this repository.",
  "body": {
    "stem": "A city office wants to simplify an online workflow. Which action best fits a service-oriented approach?",
    "options": [
      {"key": "A", "text": "Add more approval pages."},
      {"key": "B", "text": "Merge repeated fields and publish clear status updates."}
    ],
    "answer_key": "B",
    "explanation": "The answer is based on process simplification and transparency, not on a real exam source."
  }
}
```

## Validation

Run the validator before committing:

```powershell
python backend/scripts/validate_content_packs.py
```

Run focused tests when changing the validator:

```powershell
cd backend
pytest tests/test_content_pack_validator.py
```

## Attribution

If content uses an open license, attribution must include:

- creator or copyright holder;
- license identifier;
- original source URL when available;
- modification note if the content was adapted.

Record attribution in the content item and, when the package is public, in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
