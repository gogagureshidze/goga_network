# Minimal one-time secure access setup

No deployment credentials were assumed. The supplied production root target rejected key authentication. Passwords pasted into chat were not used. Revoke/rotate those exposed credentials through the appropriate secure admin consoles; do not paste replacements here.

## Local preparation (interactive, no VPS changes)

Run `bash scripts/prepare-deployment-key.sh` in your own terminal. Choose a passphrase at the native prompt. This creates a dedicated encrypted Ed25519 private key outside Git, preserves any existing key, and prints only its public key/fingerprint. Add it to your local SSH agent using `ssh-add ~/.ssh/goga_deploy_ed25519` (or your macOS keychain workflow). Neither the private key nor passphrase belongs in this repository or chat.

## Administrator action requiring your approval

1. Supply a **separate staging host or isolated staging site**, a Netlify staging context, disposable staging MySQL database, and a Clerk development instance with two test accounts. Do not point staging at production MySQL or production webhook secrets. Supply secrets directly into server environment configuration, never chat.
2. In an authenticated Hostinger console/CloudPanel admin session, confirm the existing socket site user, process manager, release path, database backup policy, proxy, actual firewall and listener output from `scripts/read-only-vps-audit.sh`. Next.js stays on Netlify: provide the approved project/release role there separately. The new media API needs its own loopback service and HTTPS vhost, described in [VPS-MEDIA-DEPLOYMENT.md](VPS-MEDIA-DEPLOYMENT.md).
3. Authorize the dedicated public key for the existing non-root deployment user where possible. Otherwise create a restricted `goga-deploy` account with access only to its approved incoming/release directories. The proposed `goga-media` runtime account is separate, has no login/sudo, and owns only `/srv/goga/private-voice`; it cannot modify deployed code. Use `restrict ssh-ed25519 ...` in the deployment account's `authorized_keys` to disable forwarding, agent forwarding, PTY, and X11. Do not grant broad passwordless sudo. An administrator performs privileged package/proxy/service changes separately after review.
4. Verify the SSH host key fingerprint through the Hostinger console, then record the verified key in local `known_hosts`. Use `ops/ssh-config.example` with the approved username and staging target. Do not disable strict host checking.
5. Grant app-specific database credentials at staging and production separately. Migration user can perform approved DDL; runtime user needs only application DML. Root DB access is unnecessary. Back up and test restores before any production DDL.
6. Only after staging verification and explicit production approval: authorize an app-specific release command or operator-controlled process restart. Keep CloudPanel ownership/config intact. A verified release contains application assets only, never `.env`, keys, or private uploads.

This is prepared access configuration, not an installed remote account. No SSH keys were installed remotely, no firewall/DNS settings changed, and no deployment happened. The only information needed back in chat is the approved SSH alias/username and a confirmation that the public key was authorized; use the existing local agent for secure authentication.
