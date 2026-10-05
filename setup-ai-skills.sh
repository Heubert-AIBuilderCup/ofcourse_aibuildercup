#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=false

for arg in "$@"; do
  case $arg in
    --force) FORCE=true ;;
  esac
done

if ! command -v npx &>/dev/null; then
  echo -e "${RED}Error: npx is not available. Install Node.js >= 22.x first.${NC}"
  exit 1
fi

echo "Setting up Claude Code skills..."
echo ""

VERCEL_REPO="vercel-labs/agent-skills"
CUSTOM_REPO="jenishshrestha/ai-skills"

VERCEL_SKILLS=("vercel-composition-patterns" "vercel-react-best-practices")
CUSTOM_SKILLS=("FDD-architecture" "tailwind-v4-best-practices")

INSTALLED=0
SKIPPED=0
FAILED=0

install_skill() {
  local repo="$1"
  local skill="$2"
  local skill_dir="$PROJECT_ROOT/.agents/skills/$skill"

  if [[ -d "$skill_dir" && "$FORCE" == "false" ]]; then
    echo -e "  ${YELLOW}⊘ $skill${NC} (already installed, use --force to reinstall)"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if npx skills add "$repo" --skill "$skill" -y 2>/dev/null; then
    echo -e "  ${GREEN}✓ $skill${NC}"
    INSTALLED=$((INSTALLED + 1))
  else
    echo -e "  ${RED}✗ $skill${NC} (failed to install from $repo)"
    FAILED=$((FAILED + 1))
  fi
}

echo "Installing from $VERCEL_REPO..."
for skill in "${VERCEL_SKILLS[@]}"; do
  install_skill "$VERCEL_REPO" "$skill"
done

echo ""

echo "Installing from $CUSTOM_REPO..."
for skill in "${CUSTOM_SKILLS[@]}"; do
  install_skill "$CUSTOM_REPO" "$skill"
done

echo ""

# ── Link each installed skill into .claude/skills (CHANGED from the sister repos:
# .claude/skills is a real directory here, holding impeccable, so it is never replaced) ──
mkdir -p "$PROJECT_ROOT/.claude/skills"
for dir in "$PROJECT_ROOT"/.agents/skills/*/; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  link="$PROJECT_ROOT/.claude/skills/$name"
  if [[ -e "$link" && ! -L "$link" ]]; then
    echo -e "${YELLOW}⊘${NC} .claude/skills/$name is a real directory; left as is"
    continue
  fi
  ln -sfn "../../.agents/skills/$name" "$link"
  echo -e "${GREEN}✓${NC} .claude/skills/$name -> .agents/skills/$name"
done

echo ""

SETTINGS_FILE="$PROJECT_ROOT/.claude/settings.local.json"
mkdir -p "$(dirname "$SETTINGS_FILE")"
if [[ ! -f "$SETTINGS_FILE" || "$FORCE" == "true" ]]; then
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "WebFetch(*)",
      "WebSearch"
    ]
  }
}
EOF
  echo -e "${GREEN}✓${NC} Created .claude/settings.local.json"
else
  echo -e "${YELLOW}⊘${NC} .claude/settings.local.json already exists"
fi

echo ""
echo "Done! Installed: $INSTALLED | Skipped: $SKIPPED | Failed: $FAILED"

if [[ "$FAILED" -gt 0 ]]; then
  echo -e "${RED}Some skills failed to install. Check the output above.${NC}"
  exit 1
fi
