
CATS = [
 ("cat01","功能逻辑缺陷",[("cat01-1","计算与判断错误"),("cat01-2","流程与状态错误"),("cat01-3","规则与策略错误"),("cat01-4","时间与数据处理错误")]),
 ("cat02","数据一致性缺陷",[("cat02-1","主从与副本不同步"),("cat02-2","跨服务数据不一致"),("cat02-3","数据丢失与错乱"),("cat02-4","对账与资损问题")]),
 ("cat03","并发与幂等缺陷",[("cat03-1","重复提交与重复消费"),("cat03-2","幂等缺失"),("cat03-3","竞态与锁问题"),("cat03-4","消息乱序与丢失")]),
 ("cat04","性能与容量缺陷",[("cat04-1","慢查询与大数据量"),("cat04-2","超时与雪崩"),("cat04-3","资源耗尽"),("cat04-4","高并发压垮")]),
 ("cat05","接口与兼容性缺陷",[("cat05-1","字段与协议变更"),("cat05-2","新老版本兼容"),("cat05-3","第三方对接问题"),("cat05-4","契约不一致")]),
]
CATS += [
 ("cat06","安全与权限缺陷",[("cat06-1","越权与权限绕过"),("cat06-2","数据泄露"),("cat06-3","认证与会话问题"),("cat06-4","攻击与滥用")]),
 ("cat07","前端与交互缺陷",[("cat07-1","展示错误"),("cat07-2","交互异常"),("cat07-3","表单与输入问题"),("cat07-4","导航与路由问题")]),
 ("cat08","配置与发布缺陷",[("cat08-1","配置错误"),("cat08-2","灰度与发布问题"),("cat08-3","迁移与下线问题"),("cat08-4","依赖升级踩坑")]),
 ("cat09","稳定性与容灾缺陷",[("cat09-1","异常处理不当"),("cat09-2","监控与告警缺失"),("cat09-3","降级与容错缺失"),("cat09-4","故障恢复问题")]),
 ("cat10","兼容性与环境缺陷",[("cat10-1","设备与机型兼容"),("cat10-2","弱网与网络切换"),("cat10-3","系统与版本兼容"),("cat10-4","权限与系统能力")]),
]

import sqlite3,os
DB=os.path.join(os.path.dirname(__file__),"..",".data","bughub.sqlite")
con=sqlite3.connect(DB)
con.execute("PRAGMA foreign_keys=ON")
BASE=100  # 新分类 sort_order 从100起，避免和旧分类冲突
for i,(cid,cname,subs) in enumerate(CATS):
    con.execute("INSERT INTO categories(id,name,description,sort_order) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order",
                (cid,cname,cname,BASE+i))
    for j,(sid,sname) in enumerate(subs):
        con.execute("INSERT INTO subcategories(id,category_id,name,sort_order) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,name=excluded.name,sort_order=excluded.sort_order",
                    (sid,cid,sname,j+1))
con.commit()
print("新分类已建:", con.execute("select count(*) from categories where id like 'cat%'").fetchone()[0], "大类,",
      con.execute("select count(*) from subcategories where id like 'cat%'").fetchone()[0], "子类")
con.close()
