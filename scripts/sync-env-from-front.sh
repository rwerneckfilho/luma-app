#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  npm run env:from-front
  npm run env:from-front -- --source ../luma-front-webapp/.env.local
  npm run env:from-front -- --api-base-url http://10.0.2.2:8000

Copies public client env values from luma-front-webapp to luma-app/.env.
Only public VITE_* values are read.

Options:
  --source <path>       Source env file. Default: ../luma-front-webapp/.env
  --target <path>       Target env file. Default: .env
  --api-base-url <url>  Override EXPO_PUBLIC_API_BASE_URL for iOS/Android target.
  --eas-project-id <id> Set EXPO_PUBLIC_EAS_PROJECT_ID.
  --onboarding <bool>   Set EXPO_PUBLIC_WHATSAPP_PHONE_VERIFICATION_ONBOARDING_REQUIRED.
  --help                Show this message.
USAGE
}

source_file="../luma-front-webapp/.env"
target_file=".env"
api_base_url=""
eas_project_id=""
onboarding=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      source_file="${2:-}"
      shift 2
      ;;
    --target)
      target_file="${2:-}"
      shift 2
      ;;
    --api-base-url)
      api_base_url="${2:-}"
      shift 2
      ;;
    --eas-project-id)
      eas_project_id="${2:-}"
      shift 2
      ;;
    --onboarding)
      onboarding="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$source_file" ]]; then
  echo "Source env file not found: $source_file" >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$source_file" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

supabase_url="$(read_env VITE_SUPABASE_URL)"
supabase_key="$(read_env VITE_SUPABASE_ANON_KEY)"
front_api_base_url="$(read_env VITE_API_BASE_URL)"
front_onboarding="$(read_env VITE_WHATSAPP_PHONE_VERIFICATION_ONBOARDING_REQUIRED)"

if [[ -z "$supabase_url" || -z "$supabase_key" ]]; then
  echo "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in $source_file" >&2
  exit 1
fi

if [[ -z "$api_base_url" ]]; then
  api_base_url="$front_api_base_url"
fi

if [[ -z "$onboarding" ]]; then
  onboarding="${front_onboarding:-false}"
fi

if [[ -z "$api_base_url" ]]; then
  api_base_url="http://localhost:8000"
fi

cat > "$target_file" <<ENV
EXPO_PUBLIC_SUPABASE_URL=$supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$supabase_key
EXPO_PUBLIC_API_BASE_URL=$api_base_url
EXPO_PUBLIC_EAS_PROJECT_ID=$eas_project_id
EXPO_PUBLIC_AUTH_REDIRECT_URL=luma://auth/update-password
EXPO_PUBLIC_WHATSAPP_PHONE_VERIFICATION_ONBOARDING_REQUIRED=$onboarding
ENV

echo "Wrote $target_file from $source_file"
echo "EXPO_PUBLIC_API_BASE_URL=$api_base_url"
if [[ -z "$eas_project_id" ]]; then
  echo "EXPO_PUBLIC_EAS_PROJECT_ID is empty. Set it before testing real Expo push builds."
fi
