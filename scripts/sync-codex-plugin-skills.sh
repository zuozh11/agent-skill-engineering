#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
source_dir="$repo_root/skills/"
target_dir="$repo_root/plugins/agent-skill-engineering/skills/"

mkdir -p "$target_dir"
rsync -a --delete --exclude='.DS_Store' "$source_dir" "$target_dir"

diff -qr --exclude=.DS_Store "$source_dir" "$target_dir"
