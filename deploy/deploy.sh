#!/usr/bin/env bash
# Ship an update to the hosted MCP connector.
#
#   sudo bash /opt/porkbun-mcp/app/deploy/deploy.sh            # latest main
#   sudo bash /opt/porkbun-mcp/app/deploy/deploy.sh 3a83903    # a specific commit (or tag)
#
# Pulls, builds, restarts, and health-checks. If the new build does not come up
# healthy it rebuilds and restarts the previous commit, so a bad deploy costs a
# few seconds instead of an outage. The service is stateless, so a restart drops
# no user sessions — clients simply retry the request.
set -euo pipefail

APP=/opt/porkbun-mcp/app
BASE=/opt/porkbun-mcp
SVC=porkbun-mcp
USER_NAME=porkbun-mcp
ENV_FILE=/etc/porkbun-mcp.env
TARGET="${1:-origin/main}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root"
[ -d "$APP/.git" ] || die "$APP is not a checkout — run setup.sh first"

as_svc() { sudo -u "$USER_NAME" env HOME="$BASE" "$@"; }
# Every git call runs as the checkout's owner: git refuses to touch a repository
# owned by another user ("detected dubious ownership"), root included.
g() { as_svc git -C "$APP" "$@"; }

PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"; PORT="${PORT:-8787}"

healthy() {
	for i in $(seq 1 20); do
		curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && return 0
		sleep 1
	done
	return 1
}

build_and_restart() {
	as_svc npm ci --no-audit --no-fund
	as_svc npm run build
	as_svc npm prune --omit=dev --no-audit --no-fund
	[ -f "$APP/dist/http.js" ] || return 1
	# The unit ships in the repo; pick up any change to it.
	install -m 0644 "$APP/deploy/porkbun-mcp.service" "/etc/systemd/system/$SVC.service"
	systemctl daemon-reload
	systemctl restart "$SVC"
}

cd "$APP"
PREVIOUS="$(g rev-parse HEAD)"

log "Fetching"
g fetch --tags --prune origin
NEW="$(g rev-parse --verify "$TARGET^{commit}")" || die "unknown target $TARGET"

if [ "$NEW" = "$PREVIOUS" ]; then
	echo "already at $(g log --oneline -1)"; exit 0
fi

log "Deploying $(g log --oneline -1 "$NEW")   (was $(g log --oneline -1 "$PREVIOUS"))"
g checkout --quiet --detach "$NEW"

if build_and_restart && healthy; then
	log "Healthy on $(g log --oneline -1)"
	exit 0
fi

log "New build is NOT healthy — rolling back to $(g log --oneline -1 "$PREVIOUS")"
journalctl -u "$SVC" -n 30 --no-pager || true
g checkout --quiet --detach "$PREVIOUS"
if build_and_restart && healthy; then
	die "rolled back to $(g log --oneline -1); the deploy of $NEW failed"
fi
die "rollback ALSO failed — the service is down; check: journalctl -u $SVC -n 100"
