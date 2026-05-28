#!/usr/bin/env bash
# Exports the latest Cucumber JSON from `npm run test:e2e` into XRay Cloud
# as a Test Execution issue, grouped per Test Plan. DRY-RUN by default;
# pass --live to actually POST.
#
# Sibling of `bin/xray-export-execution.ps1`. Both scripts implement the
# §17.148 scaffold (see docs/SPEC.md). Use this on Linux/macOS and in CI;
# use the PowerShell sibling for local Windows dev.
#
# Required env (only when --live is set), or .env at:
#   1. $HOME/.tree-map-viz/.env  (user-scoped, preferred)
#   2. <repo-root>/.env          (legacy fallback)
#   XRAY_CLIENT_ID
#   XRAY_CLIENT_SECRET
# Optional env:
#   XRAY_PROJECT_KEY              (default: HE)
#   XRAY_BASE_URL                 (default: https://xray.cloud.getxray.app)
#   XRAY_EXECUTION_KEY_<BRANCH>   per-branch reuse (Q1 update-shared)
#   XRAY_TEST_EXEC_REUSE_TAG      §17.150 PR-scoped reuse tag (e.g. "PR #123").
#                                 When set, the script labels each created
#                                 Test Execution with `tmv-e2e-<slug>-<tp>`
#                                 and runs a GraphQL `getTestExecutions`
#                                 lookup by that label so subsequent runs
#                                 UPDATE the same issue rather than CREATE
#                                 a new one.
#
# Flags:
#   --cucumber-report <PATH>  Override the cucumber.json path.
#   --branch <NAME>           Override the detected branch.
#   --commit <SHA>            Override the detected commit SHA.
#   --environment <NAME>      Override the test environment label.
#   --reuse-tag <TAG>         Override $XRAY_TEST_EXEC_REUSE_TAG. See above.
#   --live                    Actually POST. Pre-flight refuses if any
#                             scenario still carries an @HE-???? placeholder
#                             (the §17.149 pairing-bug follow-up fixed
#                             this in the import script). Without this
#                             flag the script is a dry-run and never
#                             touches the network.
#
# Exit 0 on success (dry-run or live), non-zero on any error.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

load_dotenv() {
    local file="$1"
    [[ -f "$file" ]] || return 0
    while IFS='=' read -r key val || [[ -n "$key" ]]; do
        [[ -z "${key// }" || "${key:0:1}" == "#" ]] && continue
        key="$(echo -n "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        val="$(echo -n "$val" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"\(.*\)"$/\1/;s/^'"'"'\(.*\)'"'"'$/\1/')"
        if [[ -z "${!key:-}" ]]; then
            export "$key=$val"
        fi
    done < "$file"
}
load_dotenv "$HOME/.tree-map-viz/.env"
load_dotenv "$REPO_ROOT/.env"

CUCUMBER_REPORT="$REPO_ROOT/src/test/e2e/test-results/cucumber.json"
BRANCH=""
COMMIT_SHA=""
ENVIRONMENT=""
LIVE=0
REUSE_TAG="${XRAY_TEST_EXEC_REUSE_TAG:-}"
PROJECT_KEY="${XRAY_PROJECT_KEY:-HE}"
BASE_URL="${XRAY_BASE_URL:-https://xray.cloud.getxray.app}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cucumber-report) CUCUMBER_REPORT="$2"; shift 2 ;;
        --branch)          BRANCH="$2";          shift 2 ;;
        --commit)          COMMIT_SHA="$2";      shift 2 ;;
        --environment)     ENVIRONMENT="$2";     shift 2 ;;
        --reuse-tag)       REUSE_TAG="$2";       shift 2 ;;
        --project-key)     PROJECT_KEY="$2";     shift 2 ;;
        --base-url)        BASE_URL="$2";        shift 2 ;;
        --live)            LIVE=1;               shift   ;;
        -h|--help)         sed -n '1,40p' "$0" | sed 's/^# //;s/^#//'; exit 0 ;;
        *) echo "Unknown flag: $1" >&2; exit 2 ;;
    esac
done

if [[ -z "$BRANCH" ]]; then
    BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
fi
if [[ -z "$COMMIT_SHA" ]]; then
    COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi
if [[ -z "$ENVIRONMENT" ]]; then
    if [[ -n "${CI:-}" ]]; then ENVIRONMENT="CI"; else ENVIRONMENT=""; fi
fi

# Per-branch reused Test Execution key (Q1 update-shared).
slug="$(echo -n "$BRANCH" | tr '[:lower:]' '[:upper:]' | sed -E 's/[^A-Z0-9]+/_/g; s/^_+//; s/_+$//')"
PER_BRANCH_VAR="XRAY_EXECUTION_KEY_$slug"
PER_BRANCH_KEY="${!PER_BRANCH_VAR:-}"

[[ -f "$CUCUMBER_REPORT" ]] || { echo "Cucumber report not found at $CUCUMBER_REPORT. Run \`npm run test:e2e\` first." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required; install it before running this script." >&2; exit 1; }

# Test Plan routing (Q2 tp-by-feature). Update when new top-level feature
# dirs land; the same table lives in the .ps1 sibling.
test_plan_for_feature_uri() {
    local uri="$1"
    local normalised="${uri//\\//}"
    local dir
    dir="$(echo "$normalised" | sed -E 's#^.*/features/([^/]+)/.*$#\1#')"
    case "$dir" in
        layout|shell)               echo "HE-2587" ;;
        modal)                      echo "HE-2580" ;;
        boot|persistence|routing|views) echo "HE-2585" ;;
        *)                          echo "HE-2585" ;;
    esac
}

# Pre-flight: detect unresolved @HE-???? scenario tags. See the .ps1
# sibling for the reasoning behind the placeholder-only check.
mapfile -t UNRESOLVED < <(
    jq -r '
        .[] as $f | $f.elements[]? as $s
        | ($s.tags // []) as $tags
        | if any($tags[]; .name | test("^@HE-\\?+$")) then
              "\($f.uri) :: \($s.name)"
          else empty end
    ' "$CUCUMBER_REPORT"
)
UNRESOLVED_COUNT=${#UNRESOLVED[@]}

echo "[xray-export-execution] Project    : $PROJECT_KEY"
echo "[xray-export-execution] BaseUrl    : $BASE_URL"
echo "[xray-export-execution] Branch     : $BRANCH"
echo "[xray-export-execution] Commit     : $COMMIT_SHA"
echo "[xray-export-execution] Environment: $ENVIRONMENT"
echo "[xray-export-execution] ReuseTag   : ${REUSE_TAG:-<unset>}"
echo "[xray-export-execution] Source     : $CUCUMBER_REPORT"
echo "[xray-export-execution] Features   : $(jq 'length' "$CUCUMBER_REPORT")"
if [[ "$LIVE" -eq 1 ]]; then
    echo "[xray-export-execution] Mode       : LIVE (will POST)"
else
    echo "[xray-export-execution] Mode       : DRY-RUN (no network calls)"
fi
echo

if [[ "$UNRESOLVED_COUNT" -gt 0 ]]; then
    echo "[pre-flight] $UNRESOLVED_COUNT scenario(s) have an unresolved @HE-???? placeholder."
    echo "[pre-flight] Such scenarios cannot be linked to an existing XRay Test; on --live, XRay would"
    echo "[pre-flight] create a NEW Test per scenario per run (the §17.147 duplication bug)."
    for line in "${UNRESOLVED[@]:0:5}"; do echo "  - $line"; done
    if [[ "$UNRESOLVED_COUNT" -gt 5 ]]; then
        echo "  ... and $((UNRESOLVED_COUNT - 5)) more"
    fi
    echo
    if [[ "$LIVE" -eq 1 ]]; then
        echo "Refusing to --live with unresolved @HE-???? placeholders. Land the §17.149 follow-up first." >&2
        exit 1
    fi
fi

# Group features by Test Plan key.
mapfile -t TP_KEYS < <(
    jq -r '.[] | .uri' "$CUCUMBER_REPORT" |
    while IFS= read -r uri; do
        test_plan_for_feature_uri "$uri"
    done |
    sort -u
)

JWT=""
get_jwt() {
    [[ -n "$JWT" ]] && { echo "$JWT"; return 0; }
    [[ -n "${XRAY_CLIENT_ID:-}" && -n "${XRAY_CLIENT_SECRET:-}" ]] || {
        echo "XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set for --live. See bin/README.md." >&2
        return 1
    }
    JWT="$(curl -fsS -X POST "$BASE_URL/api/v2/authenticate" \
        -H "Content-Type: application/json" \
        -d "{\"client_id\":\"$XRAY_CLIENT_ID\",\"client_secret\":\"$XRAY_CLIENT_SECRET\"}" \
        | sed 's/^"//;s/"$//')"
    echo "$JWT"
}

# --- §17.150 reuse-tag helpers -----------------------------------------------
reuse_tag_label() {
    local reuse_tag="$1"
    local tp_key="$2"
    [[ -z "$reuse_tag" ]] && return 0
    local combined slug
    combined="${reuse_tag}-${tp_key}"
    slug="$(echo -n "$combined" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
    echo "tmv-e2e-$slug"
}

find_existing_test_execution() {
    local jwt="$1"
    local reuse_tag="$2"
    local tp_key="$3"
    [[ -z "$reuse_tag" || -z "$jwt" ]] && return 0
    local label
    label="$(reuse_tag_label "$reuse_tag" "$tp_key")"
    [[ -z "$label" ]] && return 0
    local jql query resp
    jql="labels = \\\"$label\\\""
    query=$(jq -nc --arg jql "$jql" \
        '{ query: ("{ getTestExecutions(jql: \"" + $jql + "\", limit: 5) { results { jira(fields: [\"key\", \"summary\"]) } } }") }')
    resp=$(curl -sS -X POST "$BASE_URL/api/v2/graphql" \
        -H "Authorization: Bearer $jwt" \
        -H "Content-Type: application/json" \
        -d "$query" 2>/dev/null) || return 0
    echo "$resp" | jq -r '.data.getTestExecutions.results[0]?.jira.key // empty' 2>/dev/null || true
}

build_info_json() {
    local tp_key="$1"
    local scenarios="$2"
    local passed="$3"
    local failed="$4"
    local reuse_tag="$5"
    local reuse_key="$6"
    local timestamp
    timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    local summary
    if [[ -n "$reuse_tag" ]]; then
        summary="E2E run -- $reuse_tag -- $tp_key"
    else
        summary="E2E run -- $BRANCH@$COMMIT_SHA -- $timestamp -- $tp_key"
    fi
    local description
    description=$'Automated XRay Test Execution import.\n\n'
    description+="Branch       : $BRANCH"$'\n'
    description+="Commit       : $COMMIT_SHA"$'\n'
    description+="Environment  : $ENVIRONMENT"$'\n'
    description+="Test Plan    : $tp_key"$'\n'
    description+="Scenarios    : $scenarios (passed: $passed, failed: $failed)"$'\n'
    description+="Reuse Tag    : ${reuse_tag:-<none>}"$'\n'
    description+="Source       : src/test/e2e/test-results/cucumber.json"

    local label
    label="$(reuse_tag_label "$reuse_tag" "$tp_key")"
    # Precedence for testExecutionKey: explicit reuse-lookup result > PER_BRANCH_KEY.
    local key_to_use=""
    if [[ -n "$reuse_key" ]]; then
        key_to_use="$reuse_key"
    elif [[ -n "$PER_BRANCH_KEY" ]]; then
        key_to_use="$PER_BRANCH_KEY"
    fi

    jq -n \
        --arg project "$PROJECT_KEY" \
        --arg summary "$summary" \
        --arg description "$description" \
        --arg tp "$tp_key" \
        --arg env "$ENVIRONMENT" \
        --arg label "$label" \
        '{
            fields: {
                project:     { key: $project },
                summary:     $summary,
                description: $description,
                issuetype:   { name: "Test Execution" }
            },
            xrayFields: {
                testPlanKey: $tp
            }
        }
        | if ($env   | length) > 0 then .xrayFields += { environments: [ $env ] } else . end
        | if ($label | length) > 0 then .fields += { labels: [ $label ] } else . end'
}

GRAND_SCEN=0
GRAND_PASS=0
GRAND_FAIL=0
GRAND_SKIP=0

for tp_key in "${TP_KEYS[@]}"; do
    # Build the per-group subset of features.
    subset="$(jq --arg tp "$tp_key" '
        map(
            select(
                (.uri | gsub("\\\\"; "/")) as $u
                | $u | test("/features/(layout|shell)/")  and $tp == "HE-2587"
                  or
                  $u | test("/features/modal/")           and $tp == "HE-2580"
                  or
                  $u | test("/features/(boot|persistence|routing|views)/") and $tp == "HE-2585"
            )
        )
    ' "$CUCUMBER_REPORT" 2>/dev/null || echo "[]")"
    # The compound jq above can be brittle on edge cases (e.g. unexpected
    # dirs). Fall back to a per-uri pass that mirrors test_plan_for_feature_uri.
    subset="$(jq -c --arg target "$tp_key" '
        def tp(uri):
            (uri | gsub("\\\\"; "/")) as $u
            | if ($u | test("/features/(layout|shell)/")) then "HE-2587"
              elif ($u | test("/features/modal/")) then "HE-2580"
              elif ($u | test("/features/(boot|persistence|routing|views)/")) then "HE-2585"
              else "HE-2585" end;
        map(select(tp(.uri) == $target))
    ' "$CUCUMBER_REPORT")"

    feat_count="$(echo "$subset" | jq 'length')"
    scen_count="$(echo "$subset" | jq '[.[] | (.elements // []) | length] | add // 0')"
    pass_count="$(echo "$subset" | jq '[
        .[] | (.elements // [])[]
        | select(all((.steps // [])[]; .result.status == "passed"))
    ] | length')"
    fail_count="$(echo "$subset" | jq '[
        .[] | (.elements // [])[]
        | select(any((.steps // [])[]; .result.status == "failed"))
    ] | length')"
    skip_count="$(echo "$subset" | jq '[
        .[] | (.elements // [])[]
        | select(any((.steps // [])[]; .result.status == "skipped"))
            and all((.steps // [])[]; .result.status != "failed")
    ] | length')"

    GRAND_SCEN=$((GRAND_SCEN + scen_count))
    GRAND_PASS=$((GRAND_PASS + pass_count))
    GRAND_FAIL=$((GRAND_FAIL + fail_count))
    GRAND_SKIP=$((GRAND_SKIP + skip_count))

    echo "=== Group: $tp_key ($feat_count feature(s), $scen_count scenarios) ==="
    reuse_key=""
    if [[ "$LIVE" -eq 1 && -n "$REUSE_TAG" ]]; then
        jwt="$(get_jwt)"
        reuse_key="$(find_existing_test_execution "$jwt" "$REUSE_TAG" "$tp_key")"
        reuse_label="$(reuse_tag_label "$REUSE_TAG" "$tp_key")"
        if [[ -n "$reuse_key" ]]; then
            echo "  reuse lookup     : found $reuse_key via label '$reuse_label' (UPDATE)"
        else
            echo "  reuse lookup     : no existing Test Execution for '$REUSE_TAG' + $tp_key (CREATE, label '$reuse_label' attached for next run)"
        fi
    fi
    if [[ -n "$reuse_key" ]]; then
        echo "  testExecutionKey : $reuse_key (UPDATE via reuse-tag)"
    elif [[ -n "$PER_BRANCH_KEY" ]]; then
        echo "  testExecutionKey : $PER_BRANCH_KEY (UPDATE via XRAY_EXECUTION_KEY_<BRANCH>)"
    elif [[ -n "$REUSE_TAG" ]]; then
        echo "  testExecutionKey : <unset> (would CREATE; labelled for reuse on next run)"
    else
        echo "  testExecutionKey : <unset> (would CREATE a new Test Execution issue)"
    fi
    echo "  scenarios        : passed=$pass_count, failed=$fail_count, skipped=$skip_count"

    info_json="$(build_info_json "$tp_key" "$scen_count" "$pass_count" "$fail_count" "$REUSE_TAG" "$reuse_key")"

    if [[ "$LIVE" -eq 0 ]]; then
        echo "  --- info JSON (would POST) ---"
        echo "$info_json" | sed 's/^/    /'
        echo "  --- end info JSON ---"
    else
        jwt="$(get_jwt)"
        if [[ -n "$reuse_key" ]]; then
            # UPDATE path -- XRay Cloud's cucumber endpoint does NOT honor a
            # `?testExecKey=` query parameter (only XRay Server / DC does).
            # The canonical Cloud mechanism is to inject the existing Test
            # Execution key as a feature-level @-tag in the cucumber JSON;
            # XRay's tag-prefix-driven router then routes the results into
            # the existing Test Execution issue.
            # See: https://community.atlassian.com/forums/App-Central-questions/XRay-import-cucumber-results-to-an-existing-test-execution-issue
            echo "  Posting to $BASE_URL/api/v2/import/execution/cucumber (with injected @$reuse_key feature tag) ..."
            tagged="$(echo "$subset" | jq --arg key "@$reuse_key" \
                '[ .[] | .tags = ([{name: $key, line: 1}] + (.tags // [])) ]')"
            resp="$(curl -fsS -X POST "$BASE_URL/api/v2/import/execution/cucumber" \
                -H "Authorization: Bearer $jwt" \
                -H "Content-Type: application/json" \
                --data-binary "$tagged")"
            issue_key="$(echo "$resp" | jq -r '.key // .testExecIssue.key // ""')"
            if [[ -z "$issue_key" ]]; then issue_key="$reuse_key"; fi
            echo "  Test Execution: $issue_key"
        else
            # CREATE path -- multipart with info + results.
            echo "  Posting to $BASE_URL/api/v2/import/execution/cucumber/multipart ..."
            result_file="$(mktemp)"
            info_file="$(mktemp)"
            echo "$subset"    > "$result_file"
            echo "$info_json" > "$info_file"
            resp="$(curl -fsS -X POST "$BASE_URL/api/v2/import/execution/cucumber/multipart" \
                -H "Authorization: Bearer $jwt" \
                -F "info=@$info_file;type=application/json" \
                -F "results=@$result_file;type=application/json")"

            rm -f "$result_file" "$info_file"
            issue_key="$(echo "$resp" | jq -r '.key // .testExecIssue.key // ""')"
            echo "  Test Execution: $issue_key"
        fi
    fi
    echo
done

echo "[xray-export-execution] === Grand total ==="
echo "  groups    : ${#TP_KEYS[@]}"
echo "  scenarios : $GRAND_SCEN"
echo "  passed    : $GRAND_PASS"
echo "  failed    : $GRAND_FAIL"
echo "  skipped   : $GRAND_SKIP"
if [[ "$LIVE" -eq 0 ]]; then
    echo
    echo "[xray-export-execution] DRY-RUN complete. No XRay calls were made."
    echo "[xray-export-execution] Re-run with --live to actually POST (blocked until §17.149 pairing-bug fix)."
fi
