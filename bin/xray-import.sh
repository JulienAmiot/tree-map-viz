#!/usr/bin/env bash
# Imports Cucumber `.feature` files into XRay Cloud and round-trips the
# returned `@HE-XXXX` Test issue keys back into the source files.
#
# Sibling of `bin/xray-import.ps1`. Both scripts implement DT-10
# (see docs/SPEC.md sec.15.7, sec.17.8). Use this on Linux/macOS and
# in CI; use the PowerShell sibling for local Windows dev.
#
# Behaviour update (SPEC §17.149, 2026-05-28):
#   - Feature-level `@HE-????` placeholders are auto-defaulted to
#     `@HE-2570` (the OBEYA Epic) BEFORE the POST so XRay establishes
#     the cover link from the first run. The default is configurable
#     via --feature-level-cover-default <KEY>.
#   - Scenario -> Test pairing now uses XRay's GraphQL `getTests`
#     endpoint to fetch each returned Test's summary, then matches
#     each `@HE-????` to its scenario title (rather than the source
#     position used pre-§17.149, which scrambled on >3-scenario files).
#     If the GraphQL call fails or any title can't be matched, the
#     affected placeholder falls back to source-position pairing.
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
#   --dry-run                            Don't authenticate or POST; just count placeholders.
#   --features-path <DIR>                Override .feature scan root.
#   --project-key <KEY>                  Override XRAY_PROJECT_KEY.
#   --feature-level-cover-default <KEY>  Real Jira key used to replace feature-level
#                                        placeholders (default: HE-2570).
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
FEATURE_LEVEL_COVER_DEFAULT="HE-2570"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)                     DRY_RUN=1; shift ;;
        --features-path)               FEATURES_PATH="$2"; shift 2 ;;
        --project-key)                 PROJECT_KEY="$2"; shift 2 ;;
        --base-url)                    BASE_URL="$2"; shift 2 ;;
        --feature-level-cover-default) FEATURE_LEVEL_COVER_DEFAULT="$2"; shift 2 ;;
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

# --- §17.149 helpers ---------------------------------------------------------
# Returns the 1-based line number of the first `Feature:` keyword, or empty
# string if there is none. Used to split feature-level vs scenario-level
# placeholders.
feature_line_for() {
    awk '/^[[:space:]]*Feature[[:space:]]*:/ { print NR; exit }' "$1"
}

# Counts `@HE-????` placeholders that appear AT OR AFTER the `Feature:` line
# (i.e. scenario-level only). Prints the count to stdout.
count_scenario_placeholders() {
    local file="$1"
    local fl
    fl=$(feature_line_for "$file")
    fl=${fl:-0}
    awk -v fl="$fl" '
        NR >= fl {
            line = $0
            while (match(line, /@HE-\?\?+/)) {
                c++
                line = substr(line, RSTART + RLENGTH)
            }
        }
        END { print c + 0 }
    ' "$file"
}

# Counts `@HE-????` placeholders BEFORE the `Feature:` line. Prints count.
count_feature_level_placeholders() {
    local file="$1"
    local fl
    fl=$(feature_line_for "$file")
    fl=${fl:-0}
    if [[ "$fl" -eq 0 ]]; then echo 0; return 0; fi
    awk -v fl="$fl" '
        NR < fl {
            line = $0
            while (match(line, /@HE-\?\?+/)) {
                c++
                line = substr(line, RSTART + RLENGTH)
            }
        }
        END { print c + 0 }
    ' "$file"
}

# Rewrites every `@HE-????` BEFORE the `Feature:` line to `@<default_key>`.
# Writes back to disk in place. Prints the number of rewrites (0 = no-op).
set_feature_level_cover_default() {
    local file="$1"
    local default_key="$2"
    local fl
    fl=$(feature_line_for "$file")
    [[ -z "$fl" ]] && { echo 0; return 0; }
    local count
    count=$(count_feature_level_placeholders "$file")
    if [[ "$count" -eq 0 ]]; then echo 0; return 0; fi
    awk -v fl="$fl" -v k="$default_key" '
        NR < fl {
            while (match($0, /@HE-\?\?+/)) {
                $0 = substr($0, 1, RSTART - 1) "@" k substr($0, RSTART + RLENGTH)
            }
        }
        { print }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    echo "$count"
}

# For each scenario-level `@HE-????` placeholder in source order, emits the
# title of the next `Scenario:` / `Scenario Outline:` header below it.
# One line per placeholder. Used to drive summary-lookup pairing.
get_scenario_placeholder_titles() {
    local file="$1"
    local fl
    fl=$(feature_line_for "$file")
    fl=${fl:-0}
    awk -v fl="$fl" '
        function ph_count(s,   n) {
            n = 0
            while (match(s, /@HE-\?\?+/)) {
                n++
                s = substr(s, RSTART + RLENGTH)
            }
            return n
        }
        NR >= fl {
            n = ph_count($0)
            if (n > 0) {
                for (j = 0; j < n; j++) phs[++phc] = NR
            }
            if (match($0, /^[[:space:]]*Scenario([[:space:]]+Outline)?[[:space:]]*:[[:space:]]*/)) {
                slines[++sln] = NR
                stitles[sln] = substr($0, RSTART + RLENGTH)
                # Trim trailing whitespace.
                sub(/[[:space:]]+$/, "", stitles[sln])
            }
        }
        END {
            for (i = 1; i <= phc; i++) {
                title = ""
                for (j = 1; j <= sln; j++) {
                    if (slines[j] >= phs[i]) { title = stitles[j]; break }
                }
                print title
            }
        }
    ' "$file"
}

# Fetches the `summary` field for each Test key via XRay's GraphQL endpoint.
# Outputs TSV "KEY\tsummary" (one line per resolved Test). Returns success
# even on network errors (caller falls back to positional pairing).
get_xray_test_summaries() {
    local keys_csv="$1"
    local jwt="$2"
    [[ -z "$keys_csv" || -z "$jwt" ]] && return 0
    local limit=100
    local query
    query=$(jq -nc --arg jql "key in ($keys_csv)" \
        '{ query: ("{ getTests(jql: \"" + $jql + "\", limit: " + ('"$limit"'|tostring) + ") { results { jira(fields: [\"key\", \"summary\"]) } } }") }')
    local resp
    resp=$(curl -sS -X POST "$BASE_URL/api/v2/graphql" \
        -H "Authorization: Bearer $jwt" \
        -H "Content-Type: application/json" \
        -d "$query" 2>/dev/null) || return 0
    echo "$resp" | jq -r '.data.getTests.results[]? | [.jira.key, .jira.summary] | @tsv' 2>/dev/null || true
}

# Rewrites scenario-level `@HE-????` placeholders in $file using summary-
# lookup pairing. Inputs:
#   $1 = file path
#   $2 = comma-separated new keys (returned order)
#   $3 = jwt
#   $4 = feature_line (output of feature_line_for; may be empty)
# Writes file back in place. Prints the fallback count (placeholders paired
# positionally because their title wasn't in the GraphQL response).
rewrite_placeholders_by_summary() {
    local file="$1"
    local keys_csv="$2"
    local jwt="$3"
    local fl="${4:-0}"
    fl=${fl:-0}

    local summaries_tsv titles_text
    summaries_tsv=$(get_xray_test_summaries "$keys_csv" "$jwt")
    titles_text=$(get_scenario_placeholder_titles "$file")

    # Parse summaries into parallel arrays.
    local -a sum_keys=() sum_titles=()
    if [[ -n "$summaries_tsv" ]]; then
        while IFS=$'\t' read -r k s; do
            [[ -z "$k" ]] && continue
            sum_keys+=("$k")
            sum_titles+=("$s")
        done <<< "$summaries_tsv"
    fi
    local n_sum=${#sum_keys[@]}

    # Parse titles (one per scenario placeholder).
    local -a titles=()
    if [[ -n "$titles_text" ]]; then
        mapfile -t titles <<< "$titles_text"
    fi

    # Walk each placeholder; for each title look for the first unused summary entry matching it.
    local -a assigned=()
    local -a used_sum=()
    for ((i = 0; i < n_sum; i++)); do used_sum[i]=0; done
    local -a unmatched_indices=()
    local i j t
    for ((i = 0; i < ${#titles[@]}; i++)); do
        t="${titles[i]}"
        local match=-1
        for ((j = 0; j < n_sum; j++)); do
            if [[ "${used_sum[j]}" -eq 0 && "${sum_titles[j]}" == "$t" ]]; then
                match=$j
                used_sum[j]=1
                break
            fi
        done
        if [[ $match -ge 0 ]]; then
            assigned[i]="${sum_keys[match]}"
        else
            assigned[i]=""
            unmatched_indices+=("$i")
        fi
    done

    # Drain unused new keys (those returned but not matched by any title) into the unmatched slots,
    # preserving source-position order on both sides.
    local -a all_keys=()
    IFS=',' read -ra all_keys <<< "$keys_csv"
    for ((i = 0; i < ${#all_keys[@]}; i++)); do
        all_keys[i]="${all_keys[i]// /}"
    done
    local -A matched_keys=()
    for k in "${assigned[@]}"; do
        [[ -n "$k" ]] && matched_keys["$k"]=1
    done
    local -a unused=()
    for k in "${all_keys[@]}"; do
        if [[ -z "${matched_keys["$k"]+_}" ]]; then unused+=("$k"); fi
    done
    local fallback_count=0
    for idx in "${unmatched_indices[@]}"; do
        if [[ ${#unused[@]} -eq 0 ]]; then break; fi
        assigned[idx]="${unused[0]}"
        unused=("${unused[@]:1}")
        fallback_count=$((fallback_count + 1))
    done

    # Apply assignments via awk in source order.
    local keys_for_awk
    keys_for_awk="$(IFS=,; echo "${assigned[*]}")"
    awk -v fl="$fl" -v keys="$keys_for_awk" '
        BEGIN { n = split(keys, k, ","); i = 1 }
        {
            if (fl > 0 && NR < fl) { print; next }
            while (match($0, /@HE-\?\?+/)) {
                if (i <= n && k[i] != "") {
                    $0 = substr($0, 1, RSTART - 1) "@" k[i] substr($0, RSTART + RLENGTH)
                    i++
                } else {
                    break
                }
            }
            print
        }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

    echo "$fallback_count"
}

# --- per-file processing -----------------------------------------------------
total_created=0
total_updated=0
files_rewritten=0
failed_files=()

for feature in "${FEATURES[@]}"; do
    name=$(basename "$feature")
    echo "[$name]"

    # Step 1: auto-default any feature-level @HE-???? to the cover Epic key
    # (SPEC §17.149 bug-fix 2).
    fl_count=$(count_feature_level_placeholders "$feature")
    if [[ "$fl_count" -gt 0 ]]; then
        if [[ "$DRY_RUN" -eq 1 ]]; then
            echo "  [dry-run] would default feature-level @HE-???? to @$FEATURE_LEVEL_COVER_DEFAULT (count: $fl_count)"
        else
            n_rewritten=$(set_feature_level_cover_default "$feature" "$FEATURE_LEVEL_COVER_DEFAULT")
            if [[ "$n_rewritten" -gt 0 ]]; then
                echo "  feature-level  : @HE-???? -> @$FEATURE_LEVEL_COVER_DEFAULT (cover default; rewritten $n_rewritten)"
                files_rewritten=$((files_rewritten + 1))
            fi
        fi
    fi

    # Re-read counts after the feature-level rewrite.
    mapfile -t existing < <(grep -oE '@HE-[0-9]+' "$feature" | sed 's/^@//' | sort -u || true)
    scenario_phs=$(count_scenario_placeholders "$feature")
    fl_phs_now=$(count_feature_level_placeholders "$feature")

    if [[ ${#existing[@]} -gt 0 ]]; then
        echo "  existing keys  : ${#existing[@]} - $(IFS=,; echo "${existing[*]}" | sed 's/,/, /g')"
    else
        echo "  existing keys  : 0"
    fi
    echo "  placeholders   : $scenario_phs scenario-level, $fl_phs_now feature-level"

    if [[ "$scenario_phs" -eq 0 && ${#existing[@]} -eq 0 && "$fl_phs_now" -eq 0 ]]; then
        echo "  (no scenario tags; nothing to do)"
        echo ""
        continue
    fi

    if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "  [dry-run] would POST $feature and rewrite $scenario_phs scenario placeholder(s)."
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

    if [[ ${#new_keys[@]} -ne "$scenario_phs" ]]; then
        echo "  WARN: scenario-level placeholders ($scenario_phs) != new keys (${#new_keys[@]}); leaving scenario tags untouched." >&2
    elif [[ ${#new_keys[@]} -gt 0 ]]; then
        # Step 2: pair scenarios to new keys by summary (SPEC §17.149 bug-fix 1).
        new_keys_csv="$(IFS=,; echo "${new_keys[*]}")"
        fl_for_rewrite="$(feature_line_for "$feature")"
        fallback_count=$(rewrite_placeholders_by_summary "$feature" "$new_keys_csv" "$JWT" "${fl_for_rewrite:-0}")
        if [[ "$fallback_count" -gt 0 ]]; then
            echo "  WARN: $fallback_count scenario(s) paired by source-position (title match unavailable)." >&2
        fi
        echo "  rewrote        : $feature"
        # If the feature-level rewrite already counted this file, don't double-count.
        if [[ "$fl_count" -eq 0 ]]; then
            files_rewritten=$((files_rewritten + 1))
        fi
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
