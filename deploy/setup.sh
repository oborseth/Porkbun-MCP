#!/usr/bin/env bash
# One-time bootstrap of the hosted MCP connector on Amazon Linux 2023.
#
#   sudo bash setup.sh
#
# Safe to re-run: every step checks before it acts. Afterwards, ship updates
# with deploy.sh. Nothing here needs a secret — the repo is public, and the
# service authenticates each request with the caller's own OAuth token.
set -euo pipefail

REPO="${REPO:-https://github.com/oborseth/Porkbun-MCP.git}"
BRANCH="${BRANCH:-main}"
BASE=/opt/porkbun-mcp
APP="$BASE/app"
SVC=porkbun-mcp
USER_NAME=porkbun-mcp
ENV_FILE=/etc/porkbun-mcp.env

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root (sudo bash setup.sh)"
grep -q 'Amazon Linux' /etc/os-release || echo "warning: this was written for Amazon Linux 2023; continuing anyway"

log "Packages: Node 22 (and its npm, a separate package on AL2023), git"
dnf install -y nodejs22 nodejs22-npm git
/usr/bin/node-22 -v | grep -q '^v22\.' || die "node-22 is not Node 22"

log "Service user $USER_NAME (no shell, no home login)"
if ! id "$USER_NAME" >/dev/null 2>&1; then
	useradd --system --home-dir "$BASE" --shell /sbin/nologin "$USER_NAME"
fi
install -d -o "$USER_NAME" -g "$USER_NAME" -m 0755 "$BASE"

log "Code: $REPO ($BRANCH) -> $APP"
if [ ! -d "$APP/.git" ]; then
	sudo -u "$USER_NAME" git clone --branch "$BRANCH" "$REPO" "$APP"
else
	echo "already cloned; deploy.sh updates it"
fi

log "Build"
cd "$APP"
# typescript is a devDependency, so install everything, build, then drop the dev
# packages so the running tree is only what production needs.
sudo -u "$USER_NAME" env HOME="$BASE" npm ci --no-audit --no-fund
sudo -u "$USER_NAME" env HOME="$BASE" npm run build
sudo -u "$USER_NAME" env HOME="$BASE" npm prune --omit=dev --no-audit --no-fund
[ -f "$APP/dist/http.js" ] || die "build did not produce dist/http.js — is the hosted-mode code on $BRANCH yet?"

log "Environment file $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
	install -m 0644 "$APP/deploy/porkbun-mcp.env.example" "$ENV_FILE"
	echo "installed from the example — review it"
else
	echo "exists; left alone"
fi

log "systemd unit"
install -m 0644 "$APP/deploy/porkbun-mcp.service" "/etc/systemd/system/$SVC.service"
systemctl daemon-reload
systemctl enable "$SVC" >/dev/null
systemctl restart "$SVC"

log "Health check"
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"; PORT="${PORT:-8787}"
for i in $(seq 1 20); do
	if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
		echo "healthy on :$PORT"
		break
	fi
	[ "$i" = 20 ] && { journalctl -u "$SVC" -n 40 --no-pager; die "service did not become healthy"; }
	sleep 1
done

log "Protected-resource metadata (what ChatGPT and Claude read first)"
curl -fsS "http://127.0.0.1:$PORT/.well-known/oauth-protected-resource"; echo

log "Unauthenticated /mcp must be a 401 with a WWW-Authenticate header"
curl -s -o /dev/null -D - -X POST "http://127.0.0.1:$PORT/mcp" -H 'Content-Type: application/json' -d '{}' \
	| grep -iE '^HTTP|^www-authenticate' || true

cat <<EOF

Done. Useful commands:
  journalctl -u $SVC -f          # live log (never contains tokens)
  systemctl status $SVC
  sudo bash $APP/deploy/deploy.sh  # ship an update (pull, build, restart, auto-rollback)

From outside, once DNS and the ALB are in place:
  curl -s https://mcp.porkbun.com/.well-known/oauth-protected-resource
EOF
