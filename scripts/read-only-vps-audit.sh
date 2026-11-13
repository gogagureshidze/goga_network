#!/usr/bin/env bash
# Run manually inside an authorized SSH session. Does not install or mutate services.
# Review output before sharing; hostnames/IP addresses are infrastructure information.
set -u
printf '\nCapacity\n'
uptime
nproc
free -m
df -h /
printf '\nLargest resident processes (no command arguments)\n'
ps -eo comm,rss,%cpu --sort=-rss | head -20
printf '\nListening ports\n'
ss -lntup
printf '\nFirewall\n'
if command -v ufw >/dev/null; then ufw status verbose; fi
printf '\nService status\n'
systemctl is-active nginx mysql mariadb redis-server || true
printf '\nSelected proxy directives (no certificate contents or application secrets)\n'
nginx -T 2>/dev/null | awk '/^[[:space:]]*(listen|server_name|location|proxy_pass|proxy_read_timeout|proxy_send_timeout|client_max_body_size|worker_processes|worker_connections)[[:space:]]/ {print}'
printf '\nRecent kernel resource failures\n'
journalctl -k --since '24 hours ago' --no-pager 2>/dev/null | awk 'tolower($0) ~ /out of memory|oom-kill|killed process/ {print}'
