# BugHub 入库工具

`add_bug.py`：单条 Bug 卡片快速入库。秒级完成，带校验。

## 用法

```bash
python3 add_bug.py <card.md>            # 新增(自动分配 BH-XXXX)
python3 add_bug.py <card.md> --update   # 按 frontmatter 里的 id 覆盖更新
python3 add_bug.py <card.md> --dry-run  # 只校验不写库
```

card.md 格式见 `提示词.md` 第四步：`---` 包裹的 frontmatter + 六段正文。

## 它做了什么

- 解析 frontmatter + 正文；校验 severity/stage 枚举、title≤30 字、六段齐全、category 与 subcategory 在库里且匹配。
- id 留 `BH-XXXX` 或省略时自动取下一个编号；sortOrder 省略时自动取该分类当前最大值+1。
- 写入 `app-code/.data/bughub.sqlite`，并把规范化后的卡片存到 `cards/BH-XXXX.md`。
- 校验不过直接报错退出(非 0)，不写脏数据；标题重复会提示。

## 相关脚本

- `import_cards.py`：批量把 `cards/*.md` 整个目录 upsert 进库(注意会跳过/报错空文件)。
- `recategorize.py`：初始化 catXX 分类体系(一次性)。
