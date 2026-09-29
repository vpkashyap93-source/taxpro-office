// `npm run mobile` — builds the app and serves it on the local network so a phone on the same
// Wi-Fi can open it. Uses a fresh random session secret and allows cookies over plain http
// (COOKIE_SECURE=false) because LAN addresses have no HTTPS. For testing only — not for production.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import os from "node:os";

const port = process.env.PORT ?? "3000";
const win = process.platform === "win32";
const run = (args, env = {}) => spawnSync("npx", args, { stdio: "inherit", shell: win, env: { ...process.env, ...env } });

console.log("\n  Building TaxPro Office (1–2 minutes the first time)…\n");
if (run(["next", "build"]).status !== 0) process.exit(1);

const ips = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i.address);

console.log("\n  ─────────────────────────────────────────────");
console.log("  TaxPro Office is ready for your phone");
console.log("  Phone aur computer ek hi Wi-Fi par hone chahiye.");
console.log("  Phone ke browser (Chrome) mein ye address kholiye:\n");
for (const ip of ips.length ? ips : ["<computer-ka-IP>"]) console.log(`      http://${ip}:${port}`);
console.log("\n  Login: varinder@taxpro.demo  /  TaxPro@2026");
console.log("  Band karne ke liye: Ctrl + C");
console.log("  ─────────────────────────────────────────────\n");

const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: win,
  env: { ...process.env, COOKIE_SECURE: "false", SESSION_SECRET: process.env.SESSION_SECRET ?? randomBytes(32).toString("hex") },
});
child.on("exit", (code) => process.exit(code ?? 0));
