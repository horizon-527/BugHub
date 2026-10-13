
import json,re,sqlite3,sys,glob,os
DB=os.path.join(os.path.dirname(__file__),"..","app-code",".data","bughub.sqlite")
def parse(path):
    t=open(path,encoding="utf-8").read().lstrip()
    m=re.match(r"^---\n(.*?)\n---\n(.*)$",t,re.S)
    if not m: raise ValueError("frontmatter not found: "+path)
    fm_raw,body=m.group(1),m.group(2).strip()
    fm={}
    for line in fm_raw.split("\n"):
        if not line.strip(): continue
        k,v=line.split(":",1)
        k=k.strip(); v=v.strip()
        if v.startswith("["): fm[k]=json.loads(v)
        else: fm[k]=v.strip().strip('"')
    fm["body"]=body
    return fm

COLS=["id","slug","title","severity","stage","date","status","impact","source","takeaway","category","subcategory"]
con=sqlite3.connect(DB)
con.execute("PRAGMA foreign_keys=ON")
files=sorted(glob.glob(os.path.join(os.path.dirname(__file__),"cards","*.md")))
n=0
for f in files:
    fm=parse(f)
    con.execute("INSERT INTO bugs(id,slug,title,severity,stage,date,status,domains_json,patterns_json,impact,source,takeaway,body_markdown,category_id,subcategory_id,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,severity=excluded.severity,stage=excluded.stage,date=excluded.date,status=excluded.status,domains_json=excluded.domains_json,patterns_json=excluded.patterns_json,impact=excluded.impact,source=excluded.source,takeaway=excluded.takeaway,body_markdown=excluded.body_markdown,category_id=excluded.category_id,subcategory_id=excluded.subcategory_id,sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP",(fm["id"],fm["slug"],fm["title"],fm["severity"],fm["stage"],fm["date"],fm["status"],json.dumps(fm["domains"],ensure_ascii=False),json.dumps(fm["patterns"],ensure_ascii=False),fm["impact"],fm["source"],fm["takeaway"],fm["body"],fm["category"],fm["subcategory"],int(fm["sortOrder"])))
    n+=1
    print("imported",fm["id"])
con.commit()
print("done, imported",n,"cards; total bugs=",con.execute("select count(*) from bugs").fetchone()[0])
con.close()
