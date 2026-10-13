#!/usr/bin/env python3
"""BugHub 快速入库工具。

用法:
  python3 add_bug.py <card.md>            # 新增一条
  python3 add_bug.py <card.md> --update   # 按 id 覆盖更新
  python3 add_bug.py <card.md> --dry-run  # 只校验不写库

card.md 格式 = frontmatter(--- 包裹) + 六段正文, 见 workflow/提示词.md。
id/slug 可留 BH-XXXX 或省略, 工具自动分配下一个编号。
"""
import sqlite3, json, sys, os, re, datetime

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app-code", ".data", "bughub.sqlite")
SEVERITIES = {"P0", "P1", "P2", "P3"}
STAGES = {"线上", "灰度发布", "常规测试"}
SECTIONS = ["问题现象", "背景", "根本原因", "解决方案", "测试建议", "经验总结"]
SCALAR = {"id", "slug", "title", "severity", "stage", "date", "status", "impact", "source", "takeaway", "category", "subcategory", "sortOrder"}
LIST = {"domains", "patterns"}

def die(msg):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(1)

def strip_inline_comment(v):
    # 去掉 value 后面的 # 注释(引号内的 # 不算)
    out, q = [], None
    for ch in v:
        if q:
            out.append(ch)
            if ch == q: q = None
        elif ch in "\"'":
            q = ch; out.append(ch)
        elif ch == "#":
            break
        else:
            out.append(ch)
    return "".join(out).strip()

def unquote(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v

def parse_list(v):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        v = v[1:-1]
    items = []
    for part in re.split(r",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", v):
        part = unquote(part.strip())
        if part: items.append(part)
    return items

def parse_card(text):
    text = text.replace("\r\n", "\n")
    m = re.match(r"\s*---\n(.*?)\n---\n(.*)", text, re.S)
    if not m:
        die("未找到 frontmatter(--- 包裹)")
    fm_raw, body = m.group(1), m.group(2).strip()
    fm = {}
    for line in fm_raw.split("\n"):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = strip_inline_comment(val)
        if key in LIST:
            fm[key] = parse_list(val)
        else:
            fm[key] = unquote(val)
    return fm, body

def validate(fm, body, con):
    for k in ["title", "severity", "stage", "impact", "takeaway", "category", "subcategory"]:
        if not fm.get(k):
            die("frontmatter 缺少必填字段: " + k)
    if fm["severity"] not in SEVERITIES:
        die("severity 非法: " + fm["severity"])
    if fm["stage"] not in STAGES:
        die("stage 非法: " + fm["stage"])
    if len(fm["title"]) > 30:
        die("title 超过 30 字: " + fm["title"])
    row = con.execute("SELECT 1 FROM subcategories WHERE id=? AND category_id=?", (fm["subcategory"], fm["category"])).fetchone()
    if not row:
        die("category/subcategory 不匹配或不存在: %s / %s" % (fm["category"], fm["subcategory"]))
    for sec in SECTIONS:
        if ("## " + sec) not in body:
            die("正文缺少段落: ## " + sec)

def next_id(con):
    row = con.execute("SELECT max(CAST(substr(id,4) AS INTEGER)) FROM bugs").fetchone()[0]
    return "BH-%04d" % ((row or 0) + 1)

def save_card(bid, slug, fm, domains, patterns, date, status, source, sort_order, body):
    cards_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cards")
    os.makedirs(cards_dir, exist_ok=True)
    dj = json.dumps(domains, ensure_ascii=False)
    pj = json.dumps(patterns, ensure_ascii=False)
    fmt = (
        '---\n'
        'id: "%s"\nslug: "%s"\ntitle: "%s"\nseverity: "%s"\nstage: "%s"\ndate: "%s"\n'
        'status: "%s"\ndomains: %s\npatterns: %s\nimpact: "%s"\nsource: "%s"\n'
        'takeaway: "%s"\ncategory: "%s"\nsubcategory: "%s"\nsortOrder: %d\n'
        '---\n\n%s\n'
    ) % (bid, slug, fm["title"], fm["severity"], fm["stage"], date, status, dj, pj,
         fm["impact"], source, fm["takeaway"], fm["category"], fm["subcategory"], sort_order, body)
    open(os.path.join(cards_dir, bid + ".md"), "w", encoding="utf-8").write(fmt)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) != 1:
        die("用法: python3 add_bug.py <card.md> [--update] [--dry-run]")
    path = args[0]
    if not os.path.exists(path):
        die("文件不存在: " + path)
    text = open(path, encoding="utf-8").read()
    fm, body = parse_card(text)
    if not os.path.exists(DB):
        die("数据库不存在: " + DB)
    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys=ON")
    validate(fm, body, con)

    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    date = fm.get("date") or datetime.date.today().isoformat()
    status = fm.get("status") or "published"
    source = fm.get("source") or "real-anonymized"
    domains = fm.get("domains") or []
    patterns = fm.get("patterns") or []
    update = "--update" in flags
    dry = "--dry-run" in flags

    bid = fm.get("id", "").strip()
    if not bid or bid == "BH-XXXX":
        if update: die("--update 需要 frontmatter 指定真实 id")
        bid = next_id(con)
    slug = fm.get("slug", "").strip() or bid
    if slug == "BH-XXXX": slug = bid

    if "sortOrder" in fm and str(fm["sortOrder"]).strip().isdigit():
        sort_order = int(fm["sortOrder"])
    else:
        sort_order = con.execute("SELECT COALESCE(max(sort_order),0)+1 FROM bugs WHERE category_id=?", (fm["category"],)).fetchone()[0]

    if dry:
        print("[dry-run] 校验通过:", bid, "|", fm["title"], "|", fm["category"], "/", fm["subcategory"], "| sort_order", sort_order)
        con.close(); return

    dj = json.dumps(domains, ensure_ascii=False)
    pj = json.dumps(patterns, ensure_ascii=False)
    vals = (bid, slug, fm["title"], fm["severity"], fm["stage"], date, status, dj, pj,
            fm["impact"], source, fm["takeaway"], body, fm["category"], fm["subcategory"], sort_order)
    try:
        if update:
            n = con.execute("""UPDATE bugs SET slug=?, title=?, severity=?, stage=?, date=?, status=?,
                domains_json=?, patterns_json=?, impact=?, source=?, takeaway=?, body_markdown=?,
                category_id=?, subcategory_id=?, sort_order=?, updated_at=? WHERE id=?""",
                vals[1:] + (ts, bid)).rowcount
            if n != 1: die("未找到要更新的 id: " + bid)
            action = "更新"
        else:
            con.execute("""INSERT INTO bugs (id, slug, title, severity, stage, date, status,
                domains_json, patterns_json, impact, source, takeaway, body_markdown,
                category_id, subcategory_id, sort_order, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", vals + (ts, ts))
            action = "新增"
        con.commit()
    except sqlite3.IntegrityError as e:
        msg = str(e)
        if "bugs.title" in msg:
            die("标题已存在(title 唯一): " + fm["title"])
        die("写库失败(约束冲突): " + msg)
    con.close()
    save_card(bid, slug, fm, domains, patterns, date, status, source, sort_order, body)
    print("%s成功: %s | %s | %s/%s | sort_order=%d" % (action, bid, fm["title"], fm["category"], fm["subcategory"], sort_order))
    print("已存卡片: cards/%s.md" % bid)
    print("访问: /bug/%s" % bid)

if __name__ == "__main__":
    main()
