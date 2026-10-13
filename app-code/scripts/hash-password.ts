import { randomBytes, scryptSync } from "node:crypto";

// 用法：
//   npm run admin:hash-password -- '你的强密码'          输出可直接粘贴进 .env 的整行（$ 已转义为 \$）
//   npm run admin:hash-password -- --raw '你的强密码'    只输出原始哈希（用于不经过 .env 展开的场景，如 PM2 env）
// 为什么要转义：Next 读取 .env 时会把 $xxx 当成变量展开，未转义的哈希会被破坏，
// 登录页就会提示“缺少或格式无效：ADMIN_PASSWORD_HASH”。
const MIN_PASSWORD_LENGTH = 10;

const args = process.argv.slice(2);
const raw = args.includes("--raw");
const password = args.find((arg) => arg !== "--raw") ?? process.env.ADMIN_PASSWORD_INPUT;

if (!password) {
  console.error("请通过命令参数或 ADMIN_PASSWORD_INPUT 提供密码。");
  process.exitCode = 1;
} else if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`密码至少 ${MIN_PASSWORD_LENGTH} 个字符。`);
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  const hash = `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
  console.log(raw ? hash : `ADMIN_PASSWORD_HASH=${hash.replace(/\$/g, "\\$")}`);
}
