# BugHub 本地内容数据库

## 数据模型

- `categories`：一级分类、说明和展示顺序。
- `subcategories`：二级分类、所属一级分类和展示顺序。
- `bugs`：稳定 ID、标题、严重度、收录日期、标签、摘要、Markdown 正文和分类引用。
- `schema_version`：数据库 schema 版本。

正文存放在 `bugs.body_markdown`，`domains_json` 和 `patterns_json` 为 JSON 字符串数组。数据库启用外键、WAL 和 5 秒 busy timeout。

## 内容怎么进库

数据库文件是 `.data/bughub.sqlite`，是运行时内容的唯一主源，不进 git。首次访问时如果数据库不存在或为空，会自动建表并导入 `db/seeds/common-bugs.json`。

日常新增内容有两种方式：

1. **后台“导入卡片”（推荐）**：登录后台，把 AI 按 `workflow/提示词.md` 输出的整张卡片粘贴进去，点“导入”。严重度、问题摘要、分类、标签等一并保存。
2. **命令行**：`python3 workflow/add_bug.py <card.md>`，写入本地数据库，并把卡片存到 `workflow/cards/`。

两种方式共用同一套卡片格式和校验规则，详见 `workflow/README.md`。

## 卡片字段约束

- `id` 形如 `BH-0000`，留空或写 `BH-XXXX` 会自动分配；发布后不得修改或复用。
- `severity` 只能是 `P0/P1/P2/P3`。
- `stage` 只能是 `线上/灰度发布/常规测试`。
- `status` 只能是 `published/draft`，只有 `published` 会出现在公开站点。
- `source` 只能是 `real-anonymized/scenario-reconstruction`。
- `title` 不超过 30 字，且在库中唯一。
- `domains`、`patterns` 是自由标签（字符串数组），没有预设列表；它们参与搜索和 SEO，但不决定分类。
- `category`、`subcategory` 必须引用数据库中已存在且相互匹配的分类（当前使用 `cat01` 到 `cat10` 这套）。
- 正文必须包含六段：问题现象、背景、根本原因、解决方案、测试建议、经验总结。

## 备份

应用运行时推荐使用 SQLite 在线备份命令，避免只复制主文件而漏掉 WAL 中尚未检查点的数据：

```bash
sqlite3 .data/bughub.sqlite ".backup .data/bughub-backup.sqlite"
```

线上后台也可以直接写入，所以线上数据库才是最新的。需要保留历史时，定期把线上库用上面的命令备份下来，不要用本地库整体覆盖线上库。

## 种子数据

`db/seeds/common-bugs.json` 只是新环境的初始数据，修改它不会影响已有数据库。

## 内容来源边界

初始数据是通用软件工程场景化重构，不使用具体公司、用户或生产事故信息。安全分类覆盖参考 [MITRE CWE](https://cwe.mitre.org/)、[NIST CWE 分类说明](https://nvd.nist.gov/vuln/categories) 和 [OWASP Top 10](https://owasp.org/www-project-top-ten/)；条目均为重新组织的简洁中文表达。

Content was rephrased for compliance with licensing restrictions.
