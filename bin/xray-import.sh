#!/usr/bin/env bash
# Imports Cucumber `.feature` files into XRay Cloud and round-trips the
# returned `@HE-XXXX` Test issue keys back into the source files.
#
# Sibling of `bin/xray-import.ps1`. Both scripts implement DT-10
# (see docs/SPEC.md sec.15.7, sec.17.8). Use this on Linux/macOS and
# in CI; use the PowerShell sibling for local Windows dev.
#
# Required env, or .env at:
#   1. $HOME/.tree-map-viz/.env  (user-scoped, preferred -- survives
#                                  repo reset; the right home for secrets)
#   2. <repo-root>/.env          (legacy fallback)
#   XRAY_CLIENT_ID
#   XRAY_CLIENT_SECRET
# Optional env:
#   XRAY_PROJECT_KEY (default: HE)
#   XRAY_BASE_URL    (default: https://xray.cloud.getxray.app)
#
# Flags:
#   --dry-run                    Don't authenticate or POST; just count placeholders.
#   --features-path <DIR>        Override .feature scan root.
#   --project-key <KEY>          Override XRAY_PROJECT_KEY.
#
# Exit 0 on success, non-zero on any error.

set -euo pipefail

# --- repo root anchoring -----------------------------------------------------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# --- .env loader (best-effort; explicit env wins) ----------------------------
# Load user-scoped first, then repo-root as legacy fallback. The
# `[[ -z "${!key:-}" ]]` check below means the FIRST source to set a
# key wins — so user-scoped takes precedence over repo-root, and
# shell env vars (already set) take precedence over both.
load_dotenv() {
    local file="$1"
    [[ -f "$file" ]] || return 0
    while IFS='=' read -r key val || [[ -n "$key" ]]; do
        # skip blanks and comments
        [[ -z "${key// }" || "${key:0:1}" == "#" ]] && continue
        # trim surrounding whitespace and quotes
        key="$(echo -n "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        val="$(echo -n "$val" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"\(.*\)"$/\1/;s/^'"'"'\(.*\)'"'"'$/\1/')"
        # only set if not already in env
        if [[ -z "${!key:-}" ]]; then
            export "$key=$val"
        fi
    done < "$file"
}
load_dotenv "$HOME/.tree-map-viz/.env"
load_dotenv "$REPO_ROOT/.env"

# --- parse flags -------------------------------------------------------------
FEATURES_PATH="$REPO_ROOT/src/test/e2e/features"
DRY_RUN=0
PROJECT_KEY="${XRAY_PROJECT_KEY:-HE}"
BASE_URL="${XRAY_BASE_URL:-https://xray.cloud.getxray.app}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)         DRY_RUN=1; shift ;;
        --features-path)   FEATURES_PATH="$2"; shift 2 ;;
        --project-key)     PROJECT_KEY="$2"; shift 2 ;;
        --base-url)        BASE_URL="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
            exit 0 ;;
        *)
            echo "Unknown flag: $1" >&2; exit 2 ;;
    esac
done

# --- preflight ---------------------------------------------------------------
command -v curl >/dev/null 2>&1 || { echo "curl is required"; exit 2; }
command -v jq   >/dev/null 2>&1 || { echo "jq is required";   exit 2; }

if [[ ! -d "$FEATURES_PATH" ]]; then
    echo "FeaturesPath not found: $FEATURES_PATH" >&2
    exit 2
fi

# discover .feature files in deterministic order
mapfile -t FEATURES < <(find "$FEATURES_PATH" -type f -name '*.feature' | sort)

if [[ ${#FEATURES[@]} -eq 0 ]]; then
    echo "No .feature files under $FEATURES_PATH. Nothing to do."
    exit 0
fi

echo "[xray-import] Project    : $PROJECT_KEY"
echo "[xray-import] BaseUrl    : $BASE_URL"
echo "[xray-import] Features   : ${#FEATURES[@]} under $FEATURES_PATH"
echo "[xray-import] DryRun     : $DRY_RUN"
echo ""

# --- auth (lazy) -------------------------------------------------------------
JWT=""
get_jwt() {
    if [[ -z "${XRAY_CLIENT_ID:-}" || -z "${XRAY_CLIENT_SECRET:-}" ]]; then
        if [[ "$DRY_RUN" -eq 1 ]]; then
            echo "[dry-run] XRAY_CLIENT_ID / XRAY_CLIENT_SECRET not set -- skipping auth."
            return 0
        fi
        echo "XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set (env, \$HOME/.tree-map-viz/.env, or <repo>/.env). See bin/README.md." >&2
        exit 2
    fi
    local body
    body=$(jq -nc --arg id "$XRAY_CLIENT_ID" --arg sec "$XRAY_CLIENT_SECRET" \
        '{client_id:$id, client_secret:$sec}')
    # Endpoint returns the JWT as a JSON string ("eyJ..."); strip the wrapping quotes.
    JWT=$(curl -sS -X POST \
        -H 'Content-Type: application/json' \
        -d "$body" \
        "$BASE_URL/api/v2/authenticate" | sed -E 's/^"//; s/"$//')
    if [[ -z "$JWT" ]]; then
        echo "Failed to obtain XRay JWT" >&2
        exit 1
    fi
}

# --- per-file processing -----------------------------------------------------
total_created=0
total_updated=0
files_rewritten=0
failed_files=()

for feature in "${FEATURES[@]}"; do
    name=$(basename "$feature")
    echo "[$name]"

    # existing real keys (sorted, unique)
    mapfile -t existing < <(grep -oE '@HE-[0-9]+' "$feature" | sed 's/^@//' | sort -u || true)
    placeholders=$(grep -cE '@HE-\?{2,}' "$feature" || true)
    placeholders=${placeholders:-0}

    if [[ ${#existing[@]} -gt 0 ]]; then
        echo "  existing keys  : ${#existing[@]} - $(IFS=,; echo "${existing[*]}" | sed 's/,/, /g')"
    else
        echo "  existing keys  : 0"
    fi
    echo "  placeholders   : $placeholders"

    if [[ $placeholders -eq 0 && ${#existing[@]} -eq 0 ]]; then
        echo "  (no scenario tags; nothing to do)"
        echo ""
        continue
    fi

    if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "  [dry-run] would POST $feature and rewrite $placeholders placeholder(s)."
        echo ""
        continue
    fi

    if [[ -z "$JWT" ]]; then get_jwt; fi

    # POST the file as multipart. Capture the HTTP status separately so we
    # can detect XRay rejections (e.g. non-coverable epic tag) and continue
    # to the next file with a useful diagnostic, rather than treating an
    # error body as a silent count-mismatch.
    http_resp=$(curl -sS -X POST \
        -w '\n__HTTP_STATUS__:%{http_code}' \
        -H "Authorization: Bearer $JWT" \
        -F "file=@$feature;type=text/plain" \
        "$BASE_URL/api/v1/import/feature?projectKey=$PROJECT_KEY") || true
    http_status="${http_resp##*__HTTP_STATUS__:}"
    resp="${http_resp%$'\n'__HTTP_STATUS__:*}"

    if [[ "$http_status" != "200" && "$http_status" != "201" ]]; then
        err_msg=$(echo "$resp" | jq -r '.error // .message // "(no error field)"' 2>/dev/null || echo "$resp")
        echo "  POST failed (HTTP $http_status): $err_msg" >&2
        failed_files+=("$feature -- HTTP $http_status: $err_msg")
        echo ""
        continue
    fi

    # extract returned keys (in response order)
    mapfile -t returned < <(echo "$resp" | jq -r '.updatedOrCreatedTests[]?.key // empty')

    # split into new vs updated relative to the existing set
    new_keys=()
    updated_keys=()
    for k in "${returned[@]}"; do
        is_existing=0
        for e in "${existing[@]}"; do
            if [[ "$e" == "$k" ]]; then is_existing=1; break; fi
        done
        if [[ $is_existing -eq 1 ]]; then
            updated_keys+=("$k")
        else
            new_keys+=("$k")
        fi
    done

    echo "  returned tests : ${#returned[@]} (${#new_keys[@]} new, ${#updated_keys[@]} updated)"
    if [[ ${#new_keys[@]} -gt 0 ]]; then
        echo "  new keys       : $(IFS=,; echo "${new_keys[*]}" | sed 's/,/, /g')"
    fi

    if [[ ${#new_keys[@]} -ne $placeholders ]]; then
        echo "  WARN: placeholder count ($placeholders) != new keys (${#new_keys[@]}); leaving file untouched." >&2
    elif [[ ${#new_keys[@]} -gt 0 ]]; then
        # Rewrite each `@HE-????` placeholder in source order with the next new key.
        # Use awk so the substitution is exact and one-shot per match.
        awk -v keys="$(IFS=,; echo "${new_keys[*]}")" '
            BEGIN { n = split(keys, k, ","); i = 1 }
            {
                while (match($0, /@HE-\?+/)) {
                    if (i <= n) {
                        $0 = substr($0, 1, RSTART - 1) "@" k[i] substr($0, RSTART + RLENGTH)
                        i++
                    } else {
                        # leave further placeholders alone (can only happen on count mismatch above)
                        break
                    }
                }
                print
            }
        ' "$feature" > "$feature.tmp" && mv "$feature.tmp" "$feature"

        echo "  rewrote        : $feature"
        files_rewritten=$((files_rewritten + 1))
    fi

    total_created=$((total_created + ${#new_keys[@]}))
    total_updated=$((total_updated + ${#updated_keys[@]}))
    echo ""
done

# --- summary -----------------------------------------------------------------
echo "=========================================="
echo "Created : $total_created"
echo "Updated : $total_updated"
echo "Files rewritten : $files_rewritten"
echo "Files failed    : ${#failed_files[@]}"
if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Mode    : DRY-RUN (no network, no file writes)"
fi

if [[ ${#failed_files[@]} -gt 0 ]]; then
    echo ""
    echo "Failed files:" >&2
    for ff in "${failed_files[@]}"; do
        echo "  - $ff" >&2
    done
    exit 1
fi
