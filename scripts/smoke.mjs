#!/usr/bin/env node
// Smoke test: spawn the MCP server, exercise tools/list and every read-only
// tool against the real Porkbun API, report pass/fail.
//
// Usage:
//   PORKBUN_API_KEY=pk1_... PORKBUN_SECRET_API_KEY=sk1_... \
//   [TEST_DOMAIN=example.com] [PORKBUN_BASE_URL=...] \
//     node scripts/smoke.mjs
//
// Exits non-zero if any test fails.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "..", "dist", "index.js");

const apiKey = process.env.PORKBUN_API_KEY;
const secretApiKey = process.env.PORKBUN_SECRET_API_KEY;
const testDomain = process.env.TEST_DOMAIN; // optional — for list_dns_records / get_ssl_bundle

if (!apiKey || !secretApiKey) {
  console.error("ERROR: set PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY");
  process.exit(2);
}

const child = spawn("node", [SERVER_PATH], {
  env: { ...process.env, PORKBUN_API_KEY: apiKey, PORKBUN_SECRET_API_KEY: secretApiKey },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pendingByID = new Map();

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id != null && pendingByID.has(msg.id)) {
      pendingByID.get(msg.id)(msg);
      pendingByID.delete(msg.id);
    }
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pendingByID.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pendingByID.has(id)) {
        pendingByID.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 30000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const results = []; // {name, ok, detail}

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function callTool(name, args = {}) {
  const res = await send("tools/call", { name, arguments: args });
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  const isError = res.result?.isError === true;
  const text = res.result?.content?.[0]?.text ?? "";
  if (isError) throw new Error(`${name} returned isError: ${text}`);
  // Tools return JSON-stringified results — parse for sanity checks.
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  // 1. Initialize handshake.
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "1.0" },
  });
  record("initialize", !!init.result?.serverInfo, init.result?.serverInfo?.name);
  notify("notifications/initialized");

  // 2. tools/list — confirm count and presence.
  const listed = await send("tools/list");
  const tools = listed.result?.tools ?? [];
  const expected = [
    "ping", "check_domain", "get_pricing", "list_domains", "get_balance",
    "get_nameservers", "list_dns_records", "list_dnssec_records", "list_url_forwards",
    "list_transfers", "get_transfer_status", "get_ssl_bundle",
    "register_domain", "renew_domain", "transfer_domain",
    "update_auto_renew", "update_nameservers",
    "create_dns_record", "update_dns_record", "delete_dns_record",
    "create_dnssec_record", "delete_dnssec_record",
    "create_url_forward", "delete_url_forward",
  ];
  const names = new Set(tools.map((t) => t.name));
  const missing = expected.filter((n) => !names.has(n));
  record("tools/list", missing.length === 0, missing.length ? `missing: ${missing.join(",")}` : `${tools.length} tools`);

  // 3. Read-only tool calls.
  try {
    const r = await callTool("ping");
    record("ping", r?.status === "SUCCESS", `ip=${r?.yourIp ?? "?"}`);
  } catch (e) { record("ping", false, e.message); }

  try {
    const r = await callTool("get_balance");
    record("get_balance", r?.status === "SUCCESS" && typeof r?.balance === "number", `${r?.display ?? "?"}`);
  } catch (e) { record("get_balance", false, e.message); }

  try {
    const r = await callTool("get_pricing");
    const tldCount = r?.pricing ? Object.keys(r.pricing).length : 0;
    record("get_pricing", tldCount > 100, `${tldCount} TLDs`);
  } catch (e) { record("get_pricing", false, e.message); }

  try {
    const r = await callTool("check_domain", { domain: "example.com" });
    record("check_domain", r?.status === "SUCCESS" && r?.response, `avail=${r?.response?.avail ?? "?"}`);
  } catch (e) { record("check_domain", false, e.message); }

  try {
    const r = await callTool("list_domains");
    const count = Array.isArray(r?.domains) ? r.domains.length : 0;
    record("list_domains", r?.status === "SUCCESS", `${count} domains in first page`);
  } catch (e) { record("list_domains", false, e.message); }

  try {
    const r = await callTool("list_transfers");
    const count = Array.isArray(r?.transfers) ? r.transfers.length : 0;
    record("list_transfers", r?.status === "SUCCESS", `${count} active`);
  } catch (e) { record("list_transfers", false, e.message); }

  if (testDomain) {
    try {
      const r = await callTool("get_nameservers", { domain: testDomain });
      const count = Array.isArray(r?.ns) ? r.ns.length : 0;
      record("get_nameservers", r?.status === "SUCCESS", `${count} nameservers on ${testDomain}`);
    } catch (e) { record("get_nameservers", false, e.message); }

    try {
      const r = await callTool("list_dns_records", { domain: testDomain });
      const count = Array.isArray(r?.records) ? r.records.length : 0;
      record("list_dns_records", r?.status === "SUCCESS", `${count} records on ${testDomain}`);
    } catch (e) { record("list_dns_records", false, e.message); }

    try {
      const r = await callTool("list_dnssec_records", { domain: testDomain });
      record("list_dnssec_records", r?.status === "SUCCESS", "ok");
    } catch (e) { record("list_dnssec_records", false, e.message); }

    try {
      const r = await callTool("list_url_forwards", { domain: testDomain });
      const count = Array.isArray(r?.forwards) ? r.forwards.length : 0;
      record("list_url_forwards", r?.status === "SUCCESS", `${count} forwards`);
    } catch (e) { record("list_url_forwards", false, e.message); }

    try {
      const r = await callTool("get_ssl_bundle", { domain: testDomain });
      const hasCert = typeof r?.certificatechain === "string" && r.certificatechain.includes("BEGIN CERTIFICATE");
      record("get_ssl_bundle", hasCert, hasCert ? "got cert chain" : "no cert chain in response");
    } catch (e) { record("get_ssl_bundle", false, e.message); }
  } else {
    console.log("· per-domain reads skipped (set TEST_DOMAIN to enable)");
  }

  // Tear down.
  child.stdin.end();
  child.kill();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  child.kill();
  process.exit(1);
});
