# TURN setup and validation for the existing Hostinger VPS

Prepared commands only; none have been run against production. Next.js stays on Netlify. Socket.IO and MySQL keep their existing VPS services. Local `.env` and `.env.local` currently have no TURN or STUN variables configured; that does not establish what production uses. No real external relay success is claimed.

## Architecture and prerequisites

Netlify issues five-minute TURN credentials from its authenticated `/api/calls/:id/ice` endpoint after call membership and accepted-device checks. Only Netlify and coturn need the shared secret; it must never use a `NEXT_PUBLIC_` variable. The browser communicates directly with coturn. Socket.IO carries authorized invitations/signaling, never live media bytes. No production migration is required for this TURN change.

The client refreshes with a two-minute lead, coalesces concurrent requests, retries failed refreshes with bounded backoff, and checks freshness after foreground/network recovery and before offer/answer negotiation. Refreshed servers are installed before a deferred ICE restart. Both participants refresh their own credentials; only the existing initiator creates offers. Sleeping devices cannot guarantee continuous media: reconnection revalidates their credentials. Changing ICE configuration can require new gathering through ICE restart. [WebRTC specification](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection-setconfiguration).

Required operator inputs: approved staging target and SSH key, reviewed release path, a dedicated TURN hostname, verified public/interface IP and NAT mapping, valid certificate/private-key paths with a renewal procedure, and current firewall/process ownership. No pasted passwords are used. The staging app must use isolated MySQL and Clerk development accounts.

## Read-only audit first

After explicit access authorization, run on the intended server and keep output private:

```sh
uname -a
free -m
df -h
ip -brief address
ip route
sudo ss -lntup
sudo ufw status verbose
sudo nft list ruleset
systemctl list-unit-files coturn.service
systemctl show coturn.service -p User -p Group -p ExecStart -p ActiveState
command -v turnserver
timedatectl status
```

Inspect the existing CloudPanel socket vhost through its admin UI and confirm its listener/upstream. Do not print environment files, private keys or the full Nginx configuration to shared logs. Confirm whether Nginx binds port 443 on all interfaces: a second hostname on the same IP does not free port 443 for TURN. Confirm Hostinger's upstream firewall separately. Stop the release if the audit identifies an existing TURN service or occupied required port without an agreed change plan.

## Approved staging installation and configuration

These commands assume Ubuntu 24.04, **coturn is absent**, and an administrator approved installation. They prevent an unconfigured newly installed service from starting. Do not run them over an existing coturn deployment.

```sh
sudo systemctl mask coturn.service
sudo apt-get update
sudo env NEEDRESTART_MODE=l apt-get install --no-install-recommends coturn
turnserver --version
turnserver --help
systemctl cat coturn.service
getent passwd turnserver
getent group turnserver
```

Verify the installed unit runs as the unprivileged `turnserver` account and the installed version supports the template options. If the package differs, adapt its reviewed service before proceeding. No other service should be restarted by this procedure.

Use a reviewed absolute checkout path in your operator shell:

```sh
GOGA_RELEASE=/absolute/path/to/reviewed/release
sudo install -d -o root -g turnserver -m 0750 /etc/goga-turn
sudo install -o root -g turnserver -m 0640 "$GOGA_RELEASE/ops/coturn.conf.example" /etc/turnserver.conf
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/goga-turn/shared-secret'
sudoedit /etc/turnserver.conf
```

Substitute the verified listener/relay IP, realm/hostname and certificate paths. Insert the new secret from the private file through your secure administrator workflow, and set the identical value in Netlify's **server-side** environment. Never paste it into chat, a command argument, Git or a build log. Ensure the `turnserver` group can read the certificate/key but cannot modify them; arrange certificate renewal copying with restricted modes. Never make a TLS private key world-readable.

The template uses temporary HMAC authentication, bounded allocations/bandwidth and denied private/loopback/multicast peers. UDP and TCP clients use port 3478; TLS clients use port 5349. Disabling TCP *relay allocations* does not disable TCP clients. Its `max-bps`/`bps-capacity` values measure bytes/second separately in each direction. `user-quota` applies to a temporary username, so total quota and application credential rate limits remain necessary. [Current coturn configuration reference](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf).

For a new coturn service only, stage this initial resource ceiling; measure before production:

```sh
sudo install -d -m 0755 /etc/systemd/system/coturn.service.d
sudoedit /etc/systemd/system/coturn.service.d/goga-limits.conf
```

```ini
[Service]
CPUAccounting=true
CPUQuota=25%
CPUWeight=10
MemoryAccounting=true
MemoryHigh=192M
MemoryMax=256M
TasksMax=32
LimitNOFILE=4096
NoNewPrivileges=true
```

The 25% CPU ceiling is a containment starting point, not validated capacity. Stop at saturation, dropped media or service OOM; do not raise it blindly on the VPS with one vCPU.

Open only the approved rules in the **existing** firewall manager and Hostinger firewall. For an already active UFW setup, the exact additions are:

```sh
sudo ufw allow 3478/udp comment 'Goga TURN UDP'
sudo ufw allow 3478/tcp comment 'Goga TURN TCP'
sudo ufw allow 5349/tcp comment 'Goga TURN TLS'
sudo ufw allow 49160:49200/udp comment 'Goga TURN relay range'
```

Do not enable UFW or replace CloudPanel rules when another firewall manager is in use. No HTTP proxy, Nginx location, MySQL port opening, or public socket port change is needed. For a NATed VPS, relay ports must retain their public/private mapping.

After reviewing the configuration and certificate permissions:

```sh
sudo systemctl daemon-reload
sudo systemctl unmask coturn.service
sudo systemctl enable --now coturn.service
sudo systemctl status coturn.service --no-pager
sudo ss -lntup
```

`daemon-reload` rereads units; it does not restart unrelated services. Initial startup is the installed coturn version's configuration check: inspect its private journal for errors, and stop only coturn if validation fails. Do not assume an undocumented `--check-config` option exists.

**Optional TLS on port 443:** leave disabled on the current shared IP. Networks blocking port 5349 may require an approved separate TURN host or dedicated IP whose port 443 is demonstrably free, with a separately reviewed listener/relay range. A hostname alone is insufficient, and a wildcard Nginx listener on port 443 also owns added IPs. Do not rebind or restart CloudPanel/Nginx to create this fallback as part of this release.

## Environment and frontend release

Netlify server environment, with the real approved hostname:

```dotenv
RTC_STUN_URLS=stun:turn.example.test:3478
TURN_URLS=turn:turn.example.test:3478?transport=udp,turn:turn.example.test:3478?transport=tcp,turns:turn.example.test:5349?transport=tcp
TURN_SHARED_SECRET=<private value matching coturn>
NEXT_PUBLIC_RTC_FORCE_RELAY=false
```

No secret belongs in Socket.IO signaling. Existing Clerk/database settings remain intact. Redeploy the reviewed frontend through the approved Netlify process. Leave the force-relay build flag `false` for normal calling. For staging tests only, set it to `true` and rebuild the staging frontend; the UI labels this mode and refuses to start if TURN is absent.

## Real-device acceptance matrix

Use two separate accounts on separate devices/networks. Each test must confirm sound both ways, moving video, microphone mute, screen video/tab sound, camera toggling, and hangup cleanup. A listening port or gathered relay candidate alone does not prove media traversed TURN.

1. Validate TLS from an external machine: `openssl s_client -connect turn.example.test:5349 -servername turn.example.test -verify_return_error </dev/null`. This proves certificate connectivity only.
2. With forced relay enabled, test each server URL independently by setting staging `TURN_URLS` to **only** UDP on port 3478, then only TCP on port 3478, then only TLS on port 5349, redeploying the staging server environment each time. Keep the real static secret server-side. Check both browsers' Connection details and confirm TURN relay plus the expected protocol where reported. Confirm sent/received byte counters increase while real audio/video plays.
3. Connection details derive actual selected candidate pairs via `getStats`, showing only route/protocol, round-trip time and byte totals. No IP, SDP, token, username or complete stats object is logged/uploaded. A browser that omits the selected pair must show “not available”; use its local WebRTC diagnostics privately for manual confirmation. [WebRTC statistics specification](https://www.w3.org/TR/webrtc-stats/#dom-rtctransportstats-selectedcandidatepairid).
4. Run a forced-relay call for at least 20 minutes, observing renewals near three-minute intervals and uninterrupted audio through multiple five-minute credential lifetimes. Test background/foreground, 10–30-second network loss, Wi-Fi/mobile transition, signaling reconnect, and a delayed permission prompt. A sleeping mobile device may suspend media; confirm recovery after waking.
5. Deny microphone/camera, cancel screen selection, end sharing from browser UI, revoke membership and attempt outsider credentials. Confirm no media-device tracks remain after hangup.
6. Restore the full URL list and ordinary transport policy, rebuild staging, and retest direct and fallback paths. Remove the force-relay flag before the production release approval.

## Load gate, rollback and service boundaries

Start with one relayed two-person call, then two and four concurrent calls only while headroom remains. Include one screen share and simultaneous synthetic messaging/voice upload on staging. Measure at idle and each step:

```sh
vmstat 1 60
free -m
systemctl show coturn.service -p MemoryCurrent -p CPUUsageNSec -p TasksCurrent
ip -s link
sudo ss -s
```

Record CPU average/peaks, available memory, interface byte deltas, relay allocations, dropped frames, round-trip time, socket reconnects and database response latency. Require available memory above 750 MiB, no OOM/sustained swap, and no sustained host CPU above 70% or material social/chat latency regression. These are proposed acceptance thresholds, not measured VPS results.

Two peers each sending 2 Mbps create about 4 Mbps relay egress, approximately 1.8 GB/hour, plus similar ingress and overhead. Confirm what Hostinger's 4 TB allowance counts. This does not establish group SFU capacity; keep its independent production gate.

Rollback: restore the previous reviewed Netlify release/environment; drain active relay calls, then stop **only** the new coturn service if necessary. Remove only firewall rules added by this change after draining, restore its saved config/drop-in, and revoke temporary credentials via the approved secret rotation procedure. Short-lived credentials and active allocations are not an instantaneous universal revocation mechanism. Never reset MySQL.

Do **not** restart MySQL, Nginx/CloudPanel, the existing Socket.IO process, private voice API, or an unrelated LiveKit service for a TURN-only configuration release. The separate application/signaling release follows its own reviewed instructions. No Next.js process is installed on the VPS.
