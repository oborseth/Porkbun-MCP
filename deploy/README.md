# Hosted connector — mcp.porkbun.com

The remote MCP endpoint that ChatGPT and Claude connect to. Same tools as the
npm package, served over Streamable HTTP, authenticated per request with an
OAuth token issued by porkbun.com (`/oauth2/*`). Stateless: any number of
instances can run behind the ALB, and a restart drops no sessions.

```
ChatGPT / Claude ──HTTPS──> ALB (mcp.porkbun.com) ──:8787──> this instance ──HTTPS──> api.porkbun.com
                                                                          └──────────> porkbun.com (docs)
```

## Instance

Amazon Linux 2023, small ARM (t4g.small is plenty — it mostly waits on the API).
It holds **no secrets**: the repo is public and every request carries the
caller's own token. The instance role needs only `AmazonSSMManagedInstanceCore`
(for Session Manager instead of SSH).

**Security group**

| Direction | Port | From / to |
|---|---|---|
| inbound  | TCP 8787 | the ALB's security group only |
| outbound | TCP 443  | `0.0.0.0/0` (API, docs, dnf, SSM) |

**Networking:** public subnet with an **Elastic IP**. Tool calls reach
`api.porkbun.com` from that address, and it is the one address to exempt from the
API's per-IP rate limits (below). Behind a NAT gateway the source would be the
NAT's IP, and exempting that would exempt everything behind it.

> **IPv4 only, on purpose.** `api.porkbun.com` has AAAA records, and if the
> subnet gives the instance an IPv6 address Node will happily use it, which
> bypasses the EIP and therefore the exemption. `src/http.ts` pins outbound
> connections to IPv4 for exactly this reason. To check which address the API
> sees, call the `ping` tool through the connector: `yourIp` must be the EIP.

**ALB:** HTTPS 443 → target group HTTP 8787 **with protocol version HTTP1**,
health check HTTP on the **traffic port** (8787, not the default 80), path
**`/health`** (not the default `/`, which is a 404 here) → 200,
idle timeout ~120 s (some tool calls wait on slow registry or provisioning work),
deregistration delay ~30 s. No WAF rule may block Anthropic (`160.79.104.0/21`)
or OpenAI's connector ranges — both fetch the discovery documents from there, and
a block fails the connection with no useful error on our side.

> **Target group protocol version must be HTTP1.** With HTTP2 the ALB opens every
> connection with the h2c preface (`PRI * HTTP/2.0`), Node's HTTP/1.1 server
> rejects it at the parser with a 400 *before the app sees it*, and the target fails
> health checks with nothing at all in the journal — it looks exactly like a
> security-group problem, but the TCP handshake is fine. The protocol version
> cannot be changed on an existing target group; create a new one. Clients still
> get HTTP/2 to the ALB; only the ALB→instance hop is HTTP/1.1. (Found the hard way
> on first install, with a packet capture.)

## First install

```bash
sudo dnf install -y git
git clone https://github.com/oborseth/Porkbun-MCP.git /tmp/pb && sudo bash /tmp/pb/deploy/setup.sh
```

`setup.sh` installs Node 22 and git from the Amazon Linux repos, creates the
`porkbun-mcp` service user, clones to `/opt/porkbun-mcp/app`, builds, installs
`/etc/porkbun-mcp.env` from the example and the systemd unit, starts it, and
checks `/health`, the protected-resource metadata and the 401. Safe to re-run.

## Updates

```bash
sudo bash /opt/porkbun-mcp/app/deploy/deploy.sh            # latest main
sudo bash /opt/porkbun-mcp/app/deploy/deploy.sh v0.30.0    # a tag or commit
```

Pulls, builds, restarts, health-checks — and if the new build is not healthy it
rebuilds and restarts the previous commit automatically.

## Operating it

```bash
journalctl -u porkbun-mcp -f      # one line per request; never contains tokens or bodies
systemctl status porkbun-mcp
```

The unit is sandboxed (read-only filesystem, no home, no new privileges, 768 MB
memory cap) and restarts on failure, giving up after 10 crashes in a minute so
the ALB health check can take the instance out.

## Checks from outside

```bash
# Discovery: what ChatGPT and Claude read first. `resource` must be exactly this URL.
curl -s https://mcp.porkbun.com/.well-known/oauth-protected-resource

# Unauthenticated: must be 401 with WWW-Authenticate pointing at the metadata above.
curl -si -X POST https://mcp.porkbun.com/mcp -d '{}' | grep -iE '^HTTP|www-authenticate'

# The authorization server it points at.
curl -s https://porkbun.com/.well-known/oauth-authorization-server
```

## Things outside this instance that it depends on

1. **The OAuth server on porkbun.com must be deployed** (`/oauth2/*` and the
   `pbo_at_` token branch in `MY_ApiController`). Until it is, every token fails
   validation and the connector answers 401 to everyone.
2. **api.porkbun.com rate limits.** All connector traffic arrives from this
   instance's Elastic IP, so the per-IP `limit_req` zones on the API vhost would
   throttle every ChatGPT and Claude user together at a couple of requests a
   second. Exempt this instance's EIP from those zones. Per-key limits still apply
   per connection, because every connection is its own API key.
3. **Fraud scoring** on registrations uses the request IP, which through the
   connector is this instance's EIP, not the end user's. Orders under $50 are
   scored but not blocked. Above that, all connector traffic shares one IP's
   signals.

## Tools

Everything in the npm package except the four sandbox-only ones
(`create_sandbox_key`, `sandbox_topup`, `sandbox_reset`, `sandbox_trigger_webhook`):
a hosted connection is always a live account.
