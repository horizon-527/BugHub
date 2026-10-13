# BugHub

系统整理常见软件 Bug，用精炼案例记录「发生了什么、问题本质、下次要警惕什么」，方便开发、测试和质量团队按失效机制检索。

网站：https://bughub.vip

## 当前能力

- 首页按一级、二级失效机制浏览，现有种子包含 18 个一级分类、72 个二级分类、144 条常见 Bug。
- 每条 Bug 使用不可变 `BH-XXXX` 编号作为稳定 URL，正文以 Markdown 保存并由详情页渲染。
- 内容主源是本地 SQLite，不依赖 GitHub 内容仓库或网络请求。
- 提供 sitemap、robots、RSS `/feed.xml`、页面 metadata 和 TechArticle 结构化数据。
- 支持 Markdown 导出、编辑后导入、按 ID 删除、统计和种子重置。
- 提供独立域名的管理后台（账号密码登录），支持 Bug 内容的增删查改、草稿/发布切换与 Markdown 实时预览；主站匿名只读，后台需登录。

## 技术栈

- Next.js 14 App Router、TypeScript、React 18
- Tailwind CSS 与自定义编辑式样式
- SQLite、better-sqlite3
- react-markdown、remark-gfm

## 数据存储

默认数据库位于：

```text
.data/bughub.sqlite
```

该文件、WAL 文件和导出目录均被 `.gitignore` 忽略。可通过环境变量把数据库放到其它持久化位置：

```text
BUGHUB_DATABASE_PATH=/absolute/path/to/bughub.sqlite
```

数据库中的 `body_markdown` 列保存完整 Markdown；分类、子分类和展示顺序均使用显式字段，不再依赖目录名排序。可复现的初始数据位于 `db/seeds/common-bugs.json`。

## 本地开发

```bash
npm install
npm run db:init
npm run dev
```

`npm run dev` 和 `npm run build` 前都会自动执行 `db:init`。初始化只会在数据库为空时写入种子，不会覆盖已有本地编辑。访问 http://localhost:3000。

## 内容编辑

推荐流程是导出一篇 Markdown、编辑后再写回数据库：

```bash
# 查看数据量
npm run db:stats

# 导出全部内容到 .data/exports
npm run db:export

# 编辑导出的 Markdown 后，按 ID 新增或更新
npm run db:import -- ".data/exports/状态与生命周期/状态流转/BH-1001-重复点击提交后状态跳过审核直接变成已完成.md"

# 删除指定条目
npm run db:delete -- BH-1001
```

如需把本地数据库完全恢复成仓库种子：

```bash
npm run db:reset
```

> `db:reset` 会删除数据库中的本地增删改，再完整导入种子；执行前请先备份或导出。

字段规范、Markdown 模板、备份方式和数据库表结构见 [`db/README.md`](db/README.md)。

## 环境变量

复制 `.env.example` 为 `.env`：

```text
BUGHUB_DATABASE_PATH=可选的 SQLite 绝对路径
REVALIDATE_SECRET=可选的手动页面刷新密钥
```

后台功能可在同一个 `.env` 中另行配置 `ADMIN_HOST`、`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET`、`PUBLIC_SITE_URL`，用于启用独立域名的管理后台。

密码哈希用 `npm run admin:hash-password -- '强密码'` 生成（至少 10 位），输出是可直接整行粘贴进 `.env` 的内容，其中的 `$` 已转义为 `\$`。不要手写或手动改动这一行：`.env` 里未转义的 `$` 会被 Next 当成变量展开，登录页会提示“缺少或格式无效：ADMIN_PASSWORD_HASH”。修改密码后，所有已登录的会话会立即失效。

### 管理后台

- 本地开发：`npm run dev` 后访问 `http://localhost:3000/admin`。
- 生产环境：只能通过独立的后台域名（如 `admin.bughub.vip`）访问，主域名下的 `/admin` 返回 404。
- 内容列表显示“已发布 / 草稿”状态和分类，支持按状态筛选、搜索，以及一键发布 / 下线；只有“已发布”的内容会出现在公开站点。
- 新建和编辑时可以选择状态与一级、二级分类；删除前会二次确认，保存带乐观锁，防止两个窗口互相覆盖。
- 登录失败 5 次后同一 IP 锁定 15 分钟。Nginx 必须设置 `proxy_set_header X-Real-IP $remote_addr;`，限流依赖它识别真实 IP。

内容查询不使用长缓存，数据库写入后刷新页面即可看到变化。若部署层仍缓存页面，可调用：

```bash
curl -X POST https://bughub.vip/api/revalidate \
  -H "Authorization: Bearer <REVALIDATE_SECRET>"
```

## 构建与检查

```bash
npm run db:stats
npx tsc --noEmit
npm run lint
npm run build
```

## 内容边界与参考

当前 144 条均为通用场景化重构案例，不声称来自某个具体公司、项目或线上事故，也不包含内部系统名、用户信息、密钥或可直接利用的漏洞步骤。分类覆盖以常见工程失效模式为主，并参考 [MITRE CWE](https://cwe.mitre.org/)、[NIST CWE 分类说明](https://nvd.nist.gov/vuln/categories) 和 [OWASP Top 10](https://owasp.org/www-project-top-ten/) 校准安全类范围。

Content was rephrased for compliance with licensing restrictions.

部署说明见 [`DEPLOY.md`](DEPLOY.md)。
