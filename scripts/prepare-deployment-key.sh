#!/usr/bin/env bash
# Local, interactive operator step. Never paste a passphrase into chat.
set -euo pipefail
key_file="$HOME/.ssh/goga_deploy_ed25519"
if [ -e "$key_file" ]; then
  if ssh-keygen -y -P '' -f "$key_file" >/dev/null 2>&1; then
    printf 'Existing key is not encrypted. Add a passphrase with ssh-keygen -p -a 100 -f %s before using it.\n' "$key_file"
    exit 1
  fi
  printf 'Existing key preserved. Public fingerprint:\n'
  ssh-keygen -lf "$key_file.pub"
  exit 0
fi
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
# ssh-keygen prompts in the local terminal for an encryption passphrase.
ssh-keygen -t ed25519 -a 100 -f "$key_file" -C 'goga-deployment'
if ssh-keygen -y -P '' -f "$key_file" >/dev/null 2>&1; then
  printf 'The new key has no passphrase. Encrypt it with ssh-keygen -p -a 100 -f %s before authorizing it.\n' "$key_file"
  exit 1
fi
printf '\nOnly send this PUBLIC key to the server administrator:\n'
cat "$key_file.pub"
printf '\nFingerprint:\n'
ssh-keygen -lf "$key_file.pub"
