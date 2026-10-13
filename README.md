# BugHub

系统整理常见软件 Bug，用精炼案例记录「发生了什么、问题本质、下次要警惕什么」，方便开发、测试和质量团队按失效机制检索。

网站：https://bughub.vip

## 仓库结构

```text
app-code/     站点代码（Next.js），数据库、种子数据和后台都在这里
bughub-mcp/   MCP 服务：让 AI 在写代码或测试用例前检索这里的经验
workflow/     内容入库工具：卡片格式说明和命令行入库脚本
```

下面的命令除特别说明外，都在 `app-code/` 目录里执行。

## 当前能力

- 首页按一级、二级失效机制浏览，每条 Bug 使用不可变的 `BH-XXXX` 编号作为稳定 URL，正文以 Markdown 保存并由详情页渲染。
- 内容主源是本地 SQLite，不依赖 GitHub 内容仓库或外部网络请求。
- 提供 sitemap、robots、RSS `/feed.xml`、页面 metadata 和 TechArticle 结构化数据。
- 独立域名的管理后台（账号密码登录）：内容列表、按状态筛选和搜索、一键发布 / 下线、新建与编辑、粘贴整张卡片一键导入。主站匿名只读。

## 技术栈

- Next.js 14 App Router、TypeScript、React 18
- Tailwind CSS 与自定义编辑式样式
- SQLite、better-sqlite3
- ByteMD（后台 Markdown 编辑器）

## 本地开发

```bash
cd app-code
npm install
cp .env.example .env     # 然后按下文“环境变量”配置后台账号
npm run dev
```

访问 http://localhost:3000 ，后台在 http://localhost:3000/admin 。

数据库不存在或为空时，首次访问会自动建表并导入 `db/seeds/common-bugs.json` 作为初始数据。

## 数据存储

默认数据库位于 `app-code/.data/bughub.sqlite`，它是运行时内容的**唯一主源**。该文件、WAL 文件、导出目录和备份都被 `.gitignore` 忽略，不会进入仓库。可通过环境变量放到其它持久化位置：

```text
BUGHUB_DATABASE_PATH=/absolute/path/to/bughub.sqlite
```

线上后台可以直接写入内容，所以**线上数据库才是最新的**。不要用本地库整体覆盖线上库；需要备份时用 SQLite 的在线备份命令：

```bash
sqlite3 .data/bughub.sqlite ".backup .data/bughub-backup.sqlite"
```

字段约束、备份方式和表结构见 [`app-code/db/README.md`](app-code/db/README.md)。

## 添加内容

推荐流程：

1. 把原始 bug 记录交给 AI，让它按 `workflow/提示词.md` 的规范输出一张卡片。
2. 登录后台，进入“导入卡片”，把整张卡片粘贴进去，点“导入”。严重度、问题摘要、分类、标签等一并入库。

勾选“先导入为草稿”可以先不公开，检查脱敏后再在列表里点“发布”。

命令行方式：`python3 workflow/add_bug.py <card.md>`，说明见 [`workflow/README.md`](workflow/README.md)。

> 注意：`workflow/提示词.md` 里为了教 AI 脱敏，写了真实的内部标识作为示例，所以它被 `.gitignore` 排除、只保留在本地，请自行备份。

## 环境变量

复制 `app-code/.env.example` 为 `.env`：

```text
BUGHUB_DATABASE_PATH=可选的 SQLite 绝对路径
REVALIDATE_SECRET=可选的手动页面刷新密钥
ADMIN_HOST / ADMIN_USERNAME / ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET / PUBLIC_SITE_URL
```

后台相关的几项用于启用独立域名的管理后台。密码哈希用下面的命令生成（至少 10 位）：

```bash
npm run admin:hash-password -- '你的强密码'
```

输出是可以整行粘贴进 `.env` 的内容，其中的 `$` 已转义为 `\$`。不要手写或手动改动这一行：`.env` 里未转义的 `$` 会被 Next 当成变量展开，登录页会提示“缺少或格式无效：ADMIN_PASSWORD_HASH”。修改密码后，所有已登录的会话会立即失效。

## 管理后台

- 本地开发：访问 `http://localhost:3000/admin`。
- 生产环境：只能通过独立的后台域名（如 `admin.bughub.vip`）访问，主域名下的 `/admin` 返回 404。
- 登录失败 5 次后同一 IP 锁定 15 分钟。Nginx 必须设置 `proxy_set_header X-Real-IP $remote_addr;`，限流依赖它识别真实 IP；两个域名都要透传原始 `Host`，应用靠它区分主站和后台。
- 保存带乐观锁，防止两个窗口互相覆盖；删除前会二次确认。

内容查询不使用长缓存，数据库写入后刷新页面即可看到变化。若部署层仍缓存页面，可调用：

```bash
curl -X POST https://bughub.vip/api/revalidate \
  -H "Authorization: Bearer <REVALIDATE_SECRET>"
```

## 构建与检查

```bash
npx tsc --noEmit
npm run lint
npm run build
npm start
```

## 内容边界与参考

公开的内容是脱敏后的经验卡片：不包含公司、业务线、内部系统名、用户信息、密钥或可直接利用的漏洞步骤。其中既有真实案例脱敏整理的（`source: real-anonymized`），也有按通用场景重构的（`source: scenario-reconstruction`）。分类覆盖以常见工程失效模式为主，并参考 [MITRE CWE](https://cwe.mitre.org/)、[NIST CWE 分类说明](https://nvd.nist.gov/vuln/categories) 和 [OWASP Top 10](https://owasp.org/www-project-top-ten/) 校准安全类范围。

Content was rephrased for compliance with licensing restrictions.
