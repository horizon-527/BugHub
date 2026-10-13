# BugHub 本地内容数据库

## 数据模型

- `categories`：一级分类、说明和展示顺序。
- `subcategories`：二级分类、所属一级分类和展示顺序。
- `bugs`：稳定 ID、标题、严重度、收录日期、标签、摘要、Markdown 正文和分类引用。
- `schema_version`：数据库 schema 版本。

正文存放在 `bugs.body_markdown`，`domains_json` 和 `patterns_json` 为 JSON 字符串数组。数据库启用外键、WAL 和 5 秒 busy timeout。

## 正文规范

每条正文固定使用三段，保持简洁：

```markdown
## 发生了什么

一句话说明触发场景和错误结果。

## 本质

一句话说明被破坏的约束或设计缺口。

## 下次遇到这些场景要警惕

一句话给出可执行的测试与设计检查点。
```

标题必须是「具体触发场景 + 明确错误结果」，避免只有“异常”“有问题”等空泛描述。

## Markdown 导入字段

`npm run db:export` 生成的文件可直接编辑后导入。frontmatter 示例：

```yaml
---
id: "BH-1001"
slug: "BH-1001"
title: "重复点击提交后状态跳过审核直接变成已完成"
severity: "P1"
stage: "常规测试"
date: "2026-07-21"
status: "published"
domains: ["状态与生命周期", "状态流转"]
patterns: ["非法状态跳转", "状态机缺陷"]
impact: "状态与实际业务不一致，后续流程判断错误"
source: "scenario-reconstruction"
takeaway: "所有状态变更都应校验来源状态、目标状态和操作者权限。"
category: "01-state-lifecycle"
subcategory: "01-state-lifecycle-transition"
sortOrder: 1
---
```

约束：

- `id` 必须符合 `BH-XXXX`，发布后不得修改或复用。
- `severity` 只能是 `P0/P1/P2/P3`。
- `status` 只能是 `published/draft`。
- `source` 只能是 `real-anonymized/scenario-reconstruction`；当前种子全部为后者。
- `domains`、`patterns` 必须是非空字符串数组。
- `category`、`subcategory` 必须引用数据库中已存在且相互匹配的分类。

## 常用命令

```bash
npm run db:init                 # 建表；空库时导入种子
npm run db:stats                # 查看分类和内容数量
npm run db:export               # 导出到 .data/exports
npm run db:import -- <file.md>  # 按 ID 新增或更新
npm run db:delete -- BH-1001    # 按 ID 删除
npm run db:reset                # 清空并恢复成种子，具有破坏性
```

`db/seeds/common-bugs.json` 是新环境的可复现初始数据；`.data/bughub.sqlite` 是运行时内容主源。修改种子不会自动覆盖已有数据库，确需同步时应先备份，再明确执行 `db:reset`。

## 备份

应用运行时推荐使用 SQLite 在线备份命令，避免只复制主文件而漏掉 WAL 中尚未检查点的数据：

```bash
sqlite3 .data/bughub.sqlite ".backup .data/bughub-backup.sqlite"
```

恢复操作应先停止内容写入，并在恢复后运行 `npm run db:stats` 核对数量。

## 内容来源边界

初始数据是通用软件工程场景化重构，不使用具体公司、用户或生产事故信息。安全分类覆盖参考 [MITRE CWE](https://cwe.mitre.org/)、[NIST CWE 分类说明](https://nvd.nist.gov/vuln/categories) 和 [OWASP Top 10](https://owasp.org/www-project-top-ten/)；条目均为重新组织的简洁中文表达。

Content was rephrased for compliance with licensing restrictions.
