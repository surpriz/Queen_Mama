#!/usr/bin/env bash
# sentry-issues.sh — Automated Sentry issue monitor for Queen Mama projects
# Usage: ./scripts/sentry-issues.sh <command> [options]
#
# Commands:
#   list       List unresolved issues
#   diagnose   Detailed diagnosis of an issue
#   resolve    Resolve an issue (with confirmation)
#   report     Generate a markdown report
#   monitor    Continuous surveillance mode
#
# Global Options:
#   -p, --project <slug>   Filter by project (queen-mama-macos | queenmama_landing)
#   --limit <n>            Number of issues (default: 25)
#   --no-color             Disable colors
#   -v, --verbose          Verbose mode
#   -h, --help             Show help

set -euo pipefail

# ============================================
# Section A: Configuration & Utilities
# ============================================

SENTRY_ORG="cloudwaste"
SENTRY_API="https://sentry.io/api/0"
DEFAULT_PROJECTS="queen-mama-macos queenmama_landing"
DEFAULT_LIMIT=25
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORTS_DIR="${SCRIPT_DIR}/reports"

# Colors (can be disabled with --no-color)
USE_COLOR=true
RED=""
GREEN=""
YELLOW=""
BLUE=""
MAGENTA=""
CYAN=""
BOLD=""
DIM=""
RESET=""

init_colors() {
    if [ "$USE_COLOR" = true ] && [ -t 1 ]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[0;33m'
        BLUE='\033[0;34m'
        MAGENTA='\033[0;35m'
        CYAN='\033[0;36m'
        BOLD='\033[1m'
        DIM='\033[2m'
        RESET='\033[0m'
    fi
}

# Logging
VERBOSE=false

log_info() {
    printf "${BLUE}[INFO]${RESET} %s\n" "$1" >&2
}

log_success() {
    printf "${GREEN}[OK]${RESET} %s\n" "$1" >&2
}

log_warn() {
    printf "${YELLOW}[WARN]${RESET} %s\n" "$1" >&2
}

log_error() {
    printf "${RED}[ERROR]${RESET} %s\n" "$1" >&2
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        printf "${DIM}[DEBUG] %s${RESET}\n" "$1" >&2
    fi
}

# Auth: read token from ~/.sentryclirc
SENTRY_TOKEN=""

load_auth() {
    local rcfile="$HOME/.sentryclirc"
    if [ ! -f "$rcfile" ]; then
        log_error "Auth file not found: $rcfile"
        log_error "Run 'sentry-cli login' to authenticate."
        exit 1
    fi

    SENTRY_TOKEN=$(awk -F'=' '/^\[auth\]/{found=1} found && /^token/{print $2; exit}' "$rcfile" | tr -d ' ')

    if [ -z "$SENTRY_TOKEN" ]; then
        log_error "No token found in $rcfile"
        log_error "Run 'sentry-cli login' to authenticate."
        exit 1
    fi

    log_verbose "Auth token loaded (${#SENTRY_TOKEN} chars)"
}

# Dependency check
check_deps() {
    local missing=""
    for cmd in jq curl; do
        if ! command -v "$cmd" &>/dev/null; then
            missing="$missing $cmd"
        fi
    done
    if [ -n "$missing" ]; then
        log_error "Missing dependencies:$missing"
        log_error "Install with: brew install$missing"
        exit 1
    fi
}

# ============================================
# Section B: API Functions
# ============================================

# Generic Sentry API call with error handling and rate limiting
sentry_api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local max_retries=3
    local retry=0
    local url="${SENTRY_API}${endpoint}"

    log_verbose "$method $url"

    while [ $retry -lt $max_retries ]; do
        local http_code
        local response
        local tmpfile
        tmpfile=$(mktemp)

        if [ "$method" = "GET" ]; then
            http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" \
                -H "Authorization: Bearer ${SENTRY_TOKEN}" \
                -H "Content-Type: application/json" \
                "$url")
        else
            http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" \
                -X "$method" \
                -H "Authorization: Bearer ${SENTRY_TOKEN}" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$url")
        fi

        response=$(cat "$tmpfile")
        rm -f "$tmpfile"

        case "$http_code" in
            200|201|202)
                echo "$response"
                return 0
                ;;
            401|403)
                log_error "Authentication failed (HTTP $http_code). Check your Sentry token."
                return 1
                ;;
            404)
                log_error "Resource not found (HTTP 404): $endpoint"
                return 1
                ;;
            429)
                local wait_time=5
                log_warn "Rate limited. Waiting ${wait_time}s..."
                sleep "$wait_time"
                retry=$((retry + 1))
                ;;
            5*)
                log_warn "Server error (HTTP $http_code). Retry $((retry + 1))/$max_retries..."
                sleep 2
                retry=$((retry + 1))
                ;;
            *)
                log_error "Unexpected HTTP $http_code for $endpoint"
                log_verbose "Response: $response"
                return 1
                ;;
        esac
    done

    log_error "Max retries reached for $endpoint"
    return 1
}

# Fetch issues for a project
fetch_issues() {
    local project="$1"
    local limit="${2:-$DEFAULT_LIMIT}"
    sentry_api GET "/projects/${SENTRY_ORG}/${project}/issues/?query=is:unresolved&limit=${limit}&sort=date"
}

# Fetch issue detail
fetch_issue_detail() {
    local issue_id="$1"
    sentry_api GET "/organizations/${SENTRY_ORG}/issues/${issue_id}/"
}

# Fetch latest event for an issue
fetch_latest_event() {
    local issue_id="$1"
    sentry_api GET "/organizations/${SENTRY_ORG}/issues/${issue_id}/events/latest/"
}

# Resolve/update an issue
update_issue() {
    local issue_id="$1"
    local status="$2"
    sentry_api PUT "/organizations/${SENTRY_ORG}/issues/${issue_id}/" "{\"status\": \"${status}\"}"
}

# ============================================
# Section C: Display Functions
# ============================================

# Severity badge
severity_badge() {
    local severity="$1"
    case "$severity" in
        CRITICAL) printf "${RED}${BOLD}[CRITICAL]${RESET}" ;;
        HIGH)     printf "${RED}[HIGH]${RESET}" ;;
        MEDIUM)   printf "${YELLOW}[MEDIUM]${RESET}" ;;
        LOW)      printf "${GREEN}[LOW]${RESET}" ;;
        *)        printf "[%s]" "$severity" ;;
    esac
}

# Priority label
priority_label() {
    local level="$1"
    case "$level" in
        critical) printf "${RED}${BOLD}critical${RESET}" ;;
        high)     printf "${RED}high${RESET}" ;;
        medium)   printf "${YELLOW}medium${RESET}" ;;
        low)      printf "${GREEN}low${RESET}" ;;
        *)        printf "%s" "$level" ;;
    esac
}

# Relative time display
relative_time() {
    local timestamp="$1"
    if [ -z "$timestamp" ] || [ "$timestamp" = "null" ]; then
        echo "unknown"
        return
    fi

    local now
    now=$(date +%s)
    # Handle ISO 8601 timestamps — strip fractional seconds and trailing Z for macOS date
    local clean_ts
    clean_ts=$(echo "$timestamp" | sed 's/\.[0-9]*Z$//' | sed 's/Z$//' | sed 's/T/ /')
    local ts
    ts=$(date -j -f "%Y-%m-%d %H:%M:%S" "$clean_ts" +%s 2>/dev/null || echo "0")

    if [ "$ts" = "0" ]; then
        echo "$timestamp"
        return
    fi

    local diff=$((now - ts))

    if [ $diff -lt 60 ]; then
        echo "${diff}s ago"
    elif [ $diff -lt 3600 ]; then
        echo "$((diff / 60))m ago"
    elif [ $diff -lt 86400 ]; then
        echo "$((diff / 3600))h ago"
    elif [ $diff -lt 604800 ]; then
        echo "$((diff / 86400))d ago"
    else
        echo "$((diff / 604800))w ago"
    fi
}

# Print a separator line
separator() {
    local width="${1:-80}"
    printf '%*s\n' "$width" '' | tr ' ' '─'
}

# Print a table header
table_header() {
    printf "${BOLD}%-14s %-10s %-40s %7s %6s %-12s${RESET}\n" \
        "SHORT ID" "PRIORITY" "TITLE" "EVENTS" "USERS" "LAST SEEN"
    separator 95
}

# Print an issue row
issue_row() {
    local short_id="$1"
    local priority="$2"
    local title="$3"
    local events="$4"
    local users="$5"
    local last_seen="$6"

    # Truncate title to 38 chars
    if [ ${#title} -gt 38 ]; then
        title="${title:0:35}..."
    fi

    local priority_display
    case "$priority" in
        critical) priority_display="${RED}${BOLD}critical${RESET}" ;;
        high)     priority_display="${RED}high${RESET}    " ;;
        medium)   priority_display="${YELLOW}medium${RESET}  " ;;
        low)      priority_display="${GREEN}low${RESET}     " ;;
        *)        priority_display="$(printf '%-8s' "$priority")" ;;
    esac

    local rel_time
    rel_time=$(relative_time "$last_seen")

    printf "%-14s " "$short_id"
    printf "%b " "$priority_display"
    printf "%-40s " "$title"
    printf "%7s " "$events"
    printf "%6s " "$users"
    printf "%-12s\n" "$rel_time"
}

# ============================================
# Section D: Diagnosis Algorithm
# ============================================

# Classify severity based on issue data
classify_severity() {
    local title="$1"
    local events="$2"
    local users="$3"
    local priority="$4"

    # Priority-based
    if [ "$priority" = "critical" ]; then
        echo "CRITICAL"
        return
    fi

    # Pattern-based
    case "$title" in
        *"App Hanging"*|*"ANR"*|*"Watchdog"*)
            echo "CRITICAL"
            return
            ;;
        *"crash"*|*"SIGABRT"*|*"SIGSEGV"*|*"EXC_BAD_ACCESS"*)
            echo "CRITICAL"
            return
            ;;
        *"HTTP 5"*|*"502"*|*"503"*|*"504"*)
            echo "HIGH"
            return
            ;;
        *"timeout"*|*"Timeout"*)
            echo "HIGH"
            return
            ;;
    esac

    # Volume-based
    if [ "$events" -gt 100 ] || [ "$users" -gt 20 ]; then
        echo "HIGH"
        return
    fi

    if [ "$events" -gt 10 ] || [ "$users" -gt 5 ]; then
        echo "MEDIUM"
        return
    fi

    echo "LOW"
}

# Generate recommendation based on error pattern
recommend() {
    local title="$1"
    local exception_type="${2:-}"
    local mechanism="${3:-}"

    case "$title" in
        *"App Hanging"*|*"ANR"*)
            echo "CAUSE: Main thread blocked for 2+ seconds (likely SwiftData/IO on main thread)"
            echo "FIX: Move heavy operations to background with Task { } or actor isolation"
            echo "REF: Use SwiftDataSaveHelper actor pattern for database writes"
            return
            ;;
        *"502"*|*"HTTP 502"*|*"502 Bad Gateway"*|*"status code: 502"*)
            echo "CAUSE: Backend server returned 502 (gateway error, server overloaded or down)"
            echo "FIX: Implement retry with exponential backoff (1s, 2s, 4s)"
            echo "REF: ProxyAPIClient already has retry logic — verify it covers this path"
            return
            ;;
        *"503"*|*"HTTP 503"*|*"503 Service Unavailable"*|*"status code: 503"*)
            echo "CAUSE: Backend service temporarily unavailable"
            echo "FIX: Retry with backoff + show user-friendly 'service unavailable' message"
            return
            ;;
        *"504"*|*"HTTP 504"*|*"504 Gateway Timeout"*|*"status code: 504"*)
            echo "CAUSE: Backend request timed out at gateway level"
            echo "FIX: Increase timeout or add retry logic with user notification"
            return
            ;;
        *"PrismaClient"*)
            echo "CAUSE: Database query/connection error (Prisma ORM)"
            echo "FIX: Check schema/migration, verify connection pool, review query constraints"
            return
            ;;
        *"ModuleBuildError"*)
            echo "CAUSE: Build-time module compilation failure"
            echo "FIX: Check module imports, dependency versions, and build configuration"
            return
            ;;
    esac

    case "$exception_type" in
        *"PrismaClient"*)
            echo "CAUSE: Database query error (Prisma ORM)"
            echo "FIX: Check schema/migration, verify connection pool, review query"
            return
            ;;
        *"TypeError"*)
            echo "CAUSE: JavaScript type error (accessing property on null/undefined)"
            echo "FIX: Add null checks, use optional chaining (?.), review data flow"
            return
            ;;
        *"ReferenceError"*)
            echo "CAUSE: Accessing undeclared variable"
            echo "FIX: Check variable scope and imports"
            return
            ;;
        *"NetworkError"*|*"FetchError"*)
            echo "CAUSE: Network request failed"
            echo "FIX: Add retry logic and offline handling"
            return
            ;;
        *"NSError"*|*"Swift"*)
            echo "CAUSE: Native macOS/Swift error"
            echo "FIX: Check error domain and code, handle specific error cases"
            return
            ;;
    esac

    case "$mechanism" in
        *"AppHang"*|*"app_hang"*)
            echo "CAUSE: Application unresponsive (main thread blocked)"
            echo "FIX: Profile main thread, move blocking work to background"
            return
            ;;
    esac

    echo "CAUSE: Review the stack trace and event context for root cause"
    echo "FIX: Investigate the error pattern and add appropriate error handling"
}

# ============================================
# Command: list
# ============================================

cmd_list() {
    local projects="$FILTER_PROJECTS"
    local limit="$LIMIT"

    printf "\n${BOLD}${CYAN}Sentry Issues — %s${RESET}\n" "$SENTRY_ORG"
    separator 95
    printf "\n"

    local total_issues=0

    for project in $projects; do
        printf "${BOLD}Project: ${MAGENTA}%s${RESET}\n\n" "$project"

        local issues_json
        if ! issues_json=$(fetch_issues "$project" "$limit"); then
            log_error "Failed to fetch issues for $project"
            printf "\n"
            continue
        fi

        local count
        count=$(echo "$issues_json" | jq 'length')

        if [ "$count" = "0" ]; then
            printf "  ${GREEN}No unresolved issues${RESET}\n\n"
            continue
        fi

        table_header

        echo "$issues_json" | jq -c '.[]' | while IFS= read -r issue; do
            local short_id title events users last_seen priority
            short_id=$(echo "$issue" | jq -r '.shortId')
            title=$(echo "$issue" | jq -r '.title')
            events=$(echo "$issue" | jq -r '.count // "0"')
            users=$(echo "$issue" | jq -r '.userCount // "0"')
            last_seen=$(echo "$issue" | jq -r '.lastSeen // "unknown"')
            priority=$(echo "$issue" | jq -r '.priority // "unknown"')

            issue_row "$short_id" "$priority" "$title" "$events" "$users" "$last_seen"
        done

        total_issues=$((total_issues + count))
        printf "\n  ${DIM}%s unresolved issue(s)${RESET}\n\n" "$count"
    done

    separator 95
    printf "${BOLD}Total: %d unresolved issue(s)${RESET}\n\n" "$total_issues"
}

# ============================================
# Command: diagnose
# ============================================

cmd_diagnose() {
    local issue_id="$1"

    if [ -z "$issue_id" ]; then
        log_error "Usage: sentry-issues.sh diagnose <issue-id>"
        log_error "  issue-id: Sentry issue ID (numeric) or short ID (e.g., QUEEN-MAMA-MACOS-2)"
        exit 1
    fi

    printf "\n${BOLD}${CYAN}Diagnosing Issue: %s${RESET}\n" "$issue_id"
    separator 80

    # Fetch issue detail
    log_info "Fetching issue details..."
    local issue_json
    if ! issue_json=$(fetch_issue_detail "$issue_id"); then
        log_error "Failed to fetch issue $issue_id"
        exit 1
    fi

    # Extract issue info
    local title short_id project_slug status priority events users first_seen last_seen
    title=$(echo "$issue_json" | jq -r '.title')
    short_id=$(echo "$issue_json" | jq -r '.shortId')
    project_slug=$(echo "$issue_json" | jq -r '.project.slug // "unknown"')
    status=$(echo "$issue_json" | jq -r '.status')
    priority=$(echo "$issue_json" | jq -r '.priority // "unknown"')
    events=$(echo "$issue_json" | jq -r '.count // "0"')
    users=$(echo "$issue_json" | jq -r '.userCount // "0"')
    first_seen=$(echo "$issue_json" | jq -r '.firstSeen')
    last_seen=$(echo "$issue_json" | jq -r '.lastSeen')

    # Header
    printf "\n${BOLD}%s${RESET}\n" "$title"
    printf "${DIM}%s  |  Project: %s  |  Status: %s${RESET}\n" "$short_id" "$project_slug" "$status"
    printf "Priority: "
    priority_label "$priority"
    printf "  |  Events: ${BOLD}%s${RESET}  |  Users: ${BOLD}%s${RESET}\n" "$events" "$users"
    printf "First: %s  |  Last: %s\n" "$(relative_time "$first_seen")" "$(relative_time "$last_seen")"
    separator 80

    # Fetch latest event
    log_info "Fetching latest event..."
    local event_json
    if ! event_json=$(fetch_latest_event "$issue_id"); then
        log_warn "Could not fetch latest event"
        printf "\n${YELLOW}No event data available for detailed analysis.${RESET}\n\n"
        return
    fi

    # OS/Device context
    printf "\n${BOLD}Context${RESET}\n"
    local os_name os_version device_name
    os_name=$(echo "$event_json" | jq -r '.contexts.os.name // "unknown"')
    os_version=$(echo "$event_json" | jq -r '.contexts.os.version // "unknown"')
    device_name=$(echo "$event_json" | jq -r '.contexts.device.name // "unknown"')
    printf "  OS: %s %s  |  Device: %s\n" "$os_name" "$os_version" "$device_name"

    local runtime_name runtime_version
    runtime_name=$(echo "$event_json" | jq -r '.contexts.runtime.name // empty')
    runtime_version=$(echo "$event_json" | jq -r '.contexts.runtime.version // empty')
    if [ -n "$runtime_name" ]; then
        printf "  Runtime: %s %s\n" "$runtime_name" "$runtime_version"
    fi

    local app_version app_build
    app_version=$(echo "$event_json" | jq -r '.contexts.app.app_version // .tags[] | select(.key=="app.version") | .value // empty' 2>/dev/null || true)
    app_build=$(echo "$event_json" | jq -r '.contexts.app.app_build // empty' 2>/dev/null || true)
    if [ -n "$app_version" ]; then
        printf "  App: v%s" "$app_version"
        if [ -n "$app_build" ]; then
            printf " (build %s)" "$app_build"
        fi
        printf "\n"
    fi
    separator 80

    # Exception info
    local exception_json
    exception_json=$(echo "$event_json" | jq '.entries[] | select(.type=="exception") | .data.values[0] // empty' 2>/dev/null || echo "")

    if [ -n "$exception_json" ] && [ "$exception_json" != "" ]; then
        printf "\n${BOLD}${RED}Exception${RESET}\n"
        local exc_type exc_value exc_mechanism
        exc_type=$(echo "$exception_json" | jq -r '.type // "unknown"')
        exc_value=$(echo "$exception_json" | jq -r '.value // "no message"')
        exc_mechanism=$(echo "$exception_json" | jq -r '.mechanism.type // "unknown"')

        printf "  Type: ${BOLD}%s${RESET}\n" "$exc_type"
        printf "  Value: %s\n" "$exc_value"
        printf "  Mechanism: %s\n" "$exc_mechanism"
        separator 80

        # Stack trace
        local frames_count
        frames_count=$(echo "$exception_json" | jq '.stacktrace.frames | length' 2>/dev/null || echo "0")

        if [ "$frames_count" -gt 0 ]; then
            printf "\n${BOLD}Stack Trace${RESET} (%s frames)\n\n" "$frames_count"

            # Print frames in reverse order (most recent first)
            echo "$exception_json" | jq -c '.stacktrace.frames | reverse | .[]' 2>/dev/null | while IFS= read -r frame; do
                local func filename lineno in_app
                func=$(echo "$frame" | jq -r '.function // "?"')
                filename=$(echo "$frame" | jq -r '.filename // .absPath // .module // "?"')
                lineno=$(echo "$frame" | jq -r '.lineNo // ""')
                in_app=$(echo "$frame" | jq -r '.inApp // false')

                if [ "$in_app" = "true" ]; then
                    # In-app frames: bold
                    printf "  ${BOLD}${CYAN}>>  %s${RESET}" "$func"
                    if [ "$filename" != "?" ]; then
                        printf "  ${DIM}at %s" "$filename"
                        if [ -n "$lineno" ] && [ "$lineno" != "null" ]; then
                            printf ":%s" "$lineno"
                        fi
                        printf "${RESET}"
                    fi
                    printf "\n"
                else
                    # System frames: dim
                    printf "  ${DIM}    %s" "$func"
                    if [ "$filename" != "?" ]; then
                        printf "  at %s" "$filename"
                        if [ -n "$lineno" ] && [ "$lineno" != "null" ]; then
                            printf ":%s" "$lineno"
                        fi
                    fi
                    printf "${RESET}\n"
                fi
            done
        fi
    else
        # Check for threads (common in app hanging issues)
        local threads_json
        threads_json=$(echo "$event_json" | jq '.entries[] | select(.type=="threads") | .data.values // empty' 2>/dev/null || echo "")

        if [ -n "$threads_json" ] && [ "$threads_json" != "" ]; then
            printf "\n${BOLD}Threads${RESET}\n"
            local crashed_thread
            crashed_thread=$(echo "$threads_json" | jq -c '.[] | select(.crashed==true or .current==true) | .name // .id' 2>/dev/null | head -1)
            if [ -n "$crashed_thread" ]; then
                printf "  Crashed/Current thread: ${BOLD}%s${RESET}\n" "$crashed_thread"
            fi

            local thread_count
            thread_count=$(echo "$threads_json" | jq 'length' 2>/dev/null || echo "0")
            printf "  Total threads: %s\n" "$thread_count"
        fi
    fi

    separator 80

    # Breadcrumbs
    local breadcrumbs_json
    breadcrumbs_json=$(echo "$event_json" | jq '.entries[] | select(.type=="breadcrumbs") | .data.values // empty' 2>/dev/null || echo "")

    if [ -n "$breadcrumbs_json" ] && [ "$breadcrumbs_json" != "" ]; then
        local bc_count
        bc_count=$(echo "$breadcrumbs_json" | jq 'length' 2>/dev/null || echo "0")

        printf "\n${BOLD}Breadcrumbs${RESET} (last 10 of %s)\n\n" "$bc_count"

        echo "$breadcrumbs_json" | jq -c '.[-10:][]' 2>/dev/null | while IFS= read -r bc; do
            local bc_cat bc_msg bc_level bc_ts
            bc_cat=$(echo "$bc" | jq -r '.category // "?"')
            bc_msg=$(echo "$bc" | jq -r '.message // .data // "?"')
            bc_level=$(echo "$bc" | jq -r '.level // "info"')
            bc_ts=$(echo "$bc" | jq -r '.timestamp // ""')

            local bc_color=""
            case "$bc_level" in
                error)   bc_color="$RED" ;;
                warning) bc_color="$YELLOW" ;;
                *)       bc_color="$DIM" ;;
            esac

            # Truncate message
            if [ ${#bc_msg} -gt 80 ]; then
                bc_msg="${bc_msg:0:77}..."
            fi

            printf "  ${bc_color}[%s]${RESET} %s: %s\n" "$bc_level" "$bc_cat" "$bc_msg"
        done
        separator 80
    fi

    # Severity classification
    local severity
    severity=$(classify_severity "$title" "$events" "$users" "$priority")

    printf "\n${BOLD}Diagnosis${RESET}\n\n"
    printf "  Severity: "
    severity_badge "$severity"
    printf "\n\n"

    # Recommendation
    local exc_type_for_rec exc_mechanism_for_rec
    exc_type_for_rec=$(echo "$exception_json" | jq -r '.type // ""' 2>/dev/null || echo "")
    exc_mechanism_for_rec=$(echo "$exception_json" | jq -r '.mechanism.type // ""' 2>/dev/null || echo "")

    printf "  ${BOLD}Recommendation:${RESET}\n"
    recommend "$title" "$exc_type_for_rec" "$exc_mechanism_for_rec" | while IFS= read -r line; do
        printf "  %s\n" "$line"
    done

    printf "\n"
}

# ============================================
# Command: resolve
# ============================================

cmd_resolve() {
    local issue_id="$1"
    local auto_yes="${2:-false}"
    local status="${3:-resolved}"

    if [ -z "$issue_id" ]; then
        log_error "Usage: sentry-issues.sh resolve <issue-id> [-y] [--status resolved|ignored|resolvedInNextRelease]"
        exit 1
    fi

    # Fetch issue summary
    log_info "Fetching issue details..."
    local issue_json
    if ! issue_json=$(fetch_issue_detail "$issue_id"); then
        log_error "Failed to fetch issue $issue_id"
        exit 1
    fi

    local title short_id current_status events users
    title=$(echo "$issue_json" | jq -r '.title')
    short_id=$(echo "$issue_json" | jq -r '.shortId')
    current_status=$(echo "$issue_json" | jq -r '.status')
    events=$(echo "$issue_json" | jq -r '.count // "0"')
    users=$(echo "$issue_json" | jq -r '.userCount // "0"')

    printf "\n${BOLD}Resolve Issue${RESET}\n"
    separator 60
    printf "  ID:      %s\n" "$short_id"
    printf "  Title:   %s\n" "$title"
    printf "  Status:  %s -> ${BOLD}%s${RESET}\n" "$current_status" "$status"
    printf "  Events:  %s  |  Users: %s\n" "$events" "$users"
    separator 60

    if [ "$auto_yes" != "true" ]; then
        printf "\n${YELLOW}Are you sure you want to mark this issue as '%s'? [y/N]${RESET} " "$status"
        read -r confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            log_info "Cancelled."
            return 0
        fi
    fi

    log_info "Updating issue status..."
    if update_issue "$issue_id" "$status" >/dev/null; then
        log_success "Issue $short_id marked as '$status'"
    else
        log_error "Failed to update issue $issue_id"
        return 1
    fi

    printf "\n"
}

# ============================================
# Command: report
# ============================================

cmd_report() {
    local projects="$FILTER_PROJECTS"
    local limit="$LIMIT"
    local date_str
    date_str=$(date +%Y-%m-%d)
    local report_file="${REPORTS_DIR}/report-${date_str}.md"

    mkdir -p "$REPORTS_DIR"

    log_info "Generating report..."

    {
        echo "# Sentry Issues Report"
        echo ""
        echo "**Organization:** ${SENTRY_ORG}"
        echo "**Date:** ${date_str}"
        echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "---"
        echo ""

        local total_issues=0
        local total_events=0
        local total_users=0
        local count_critical=0
        local count_high=0
        local count_medium=0
        local count_low=0

        # Collect all issues
        local all_issues_file
        all_issues_file=$(mktemp)

        for project in $projects; do
            local issues_json
            if ! issues_json=$(fetch_issues "$project" "$limit"); then
                echo "## ${project}"
                echo ""
                echo "> Failed to fetch issues"
                echo ""
                continue
            fi

            local count
            count=$(echo "$issues_json" | jq 'length')

            if [ "$count" = "0" ]; then
                continue
            fi

            # Add project field to each issue
            echo "$issues_json" | jq -c --arg p "$project" '.[] | . + {project_slug: $p}' >> "$all_issues_file"
        done

        # Summary section
        echo "## Summary"
        echo ""

        local issue_count=0
        if [ -s "$all_issues_file" ]; then
            issue_count=$(wc -l < "$all_issues_file" | tr -d ' ')
        fi

        # Classify and count
        while IFS= read -r issue; do
            local title events users priority severity
            title=$(echo "$issue" | jq -r '.title')
            events=$(echo "$issue" | jq -r '.count // "0"')
            users=$(echo "$issue" | jq -r '.userCount // "0"')
            priority=$(echo "$issue" | jq -r '.priority // "unknown"')

            severity=$(classify_severity "$title" "$events" "$users" "$priority")
            total_events=$((total_events + events))
            total_users=$((total_users + users))

            case "$severity" in
                CRITICAL) count_critical=$((count_critical + 1)) ;;
                HIGH)     count_high=$((count_high + 1)) ;;
                MEDIUM)   count_medium=$((count_medium + 1)) ;;
                LOW)      count_low=$((count_low + 1)) ;;
            esac
        done < "$all_issues_file"

        total_issues=$issue_count

        echo "| Metric | Value |"
        echo "|--------|-------|"
        echo "| Total Issues | **${total_issues}** |"
        echo "| Total Events | ${total_events} |"
        echo "| Total Users Affected | ${total_users} |"
        echo "| Critical | ${count_critical} |"
        echo "| High | ${count_high} |"
        echo "| Medium | ${count_medium} |"
        echo "| Low | ${count_low} |"
        echo ""
        echo "---"
        echo ""

        # Issues table
        echo "## Issues"
        echo ""
        echo "| Project | Short ID | Severity | Title | Events | Users | Last Seen |"
        echo "|---------|----------|----------|-------|--------|-------|-----------|"

        while IFS= read -r issue; do
            local short_id title events users last_seen priority project_slug severity
            short_id=$(echo "$issue" | jq -r '.shortId')
            title=$(echo "$issue" | jq -r '.title')
            events=$(echo "$issue" | jq -r '.count // "0"')
            users=$(echo "$issue" | jq -r '.userCount // "0"')
            last_seen=$(echo "$issue" | jq -r '.lastSeen // "unknown"')
            priority=$(echo "$issue" | jq -r '.priority // "unknown"')
            project_slug=$(echo "$issue" | jq -r '.project_slug')

            severity=$(classify_severity "$title" "$events" "$users" "$priority")

            # Truncate title for table
            if [ ${#title} -gt 50 ]; then
                title="${title:0:47}..."
            fi

            echo "| ${project_slug} | ${short_id} | ${severity} | ${title} | ${events} | ${users} | $(relative_time "$last_seen") |"
        done < "$all_issues_file"

        echo ""
        echo "---"
        echo ""

        # Detailed diagnosis per issue
        echo "## Detailed Diagnosis"
        echo ""

        while IFS= read -r issue; do
            local issue_id short_id title events users priority project_slug
            issue_id=$(echo "$issue" | jq -r '.id')
            short_id=$(echo "$issue" | jq -r '.shortId')
            title=$(echo "$issue" | jq -r '.title')
            events=$(echo "$issue" | jq -r '.count // "0"')
            users=$(echo "$issue" | jq -r '.userCount // "0"')
            priority=$(echo "$issue" | jq -r '.priority // "unknown"')
            project_slug=$(echo "$issue" | jq -r '.project_slug')

            local severity
            severity=$(classify_severity "$title" "$events" "$users" "$priority")

            echo "### ${short_id}: ${title}"
            echo ""
            echo "- **Project:** ${project_slug}"
            echo "- **Severity:** ${severity}"
            echo "- **Priority:** ${priority}"
            echo "- **Events:** ${events} | **Users:** ${users}"
            echo ""

            echo "**Recommendation:**"
            echo ""
            recommend "$title" "" "" | while IFS= read -r line; do
                echo "- ${line}"
            done
            echo ""
        done < "$all_issues_file"

        echo "---"
        echo ""
        echo "*Report generated by sentry-issues.sh*"

        rm -f "$all_issues_file"

    } > "$report_file"

    log_success "Report generated: $report_file"
    printf "\n  ${DIM}%s${RESET}\n\n" "$report_file"
}

# ============================================
# Command: monitor
# ============================================

cmd_monitor() {
    local projects="$FILTER_PROJECTS"
    local interval="${MONITOR_INTERVAL:-60}"
    local notify="${MONITOR_NOTIFY:-false}"

    printf "\n${BOLD}${CYAN}Sentry Monitor${RESET}\n"
    printf "Projects: %s\n" "$projects"
    printf "Interval: %ss\n" "$interval"
    printf "Notifications: %s\n" "$notify"
    separator 80
    printf "${DIM}Press Ctrl+C to stop${RESET}\n\n"

    # Baseline: track known issue IDs in temp file
    local baseline_file
    baseline_file=$(mktemp)

    # Graceful shutdown
    trap 'printf "\n${YELLOW}Monitor stopped.${RESET}\n"; rm -f "$baseline_file"; exit 0' INT TERM

    # Initial baseline
    log_info "Building baseline..."
    for project in $projects; do
        local issues_json
        if issues_json=$(fetch_issues "$project" 100); then
            echo "$issues_json" | jq -r '.[].id' >> "$baseline_file"
        fi
    done

    local baseline_count
    baseline_count=$(wc -l < "$baseline_file" | tr -d ' ')
    log_success "Baseline: $baseline_count known issues"
    printf "\n"

    # Polling loop
    while true; do
        sleep "$interval"

        local ts
        ts=$(date '+%H:%M:%S')
        printf "${DIM}[%s]${RESET} Checking...\n" "$ts"

        local new_count=0

        for project in $projects; do
            local issues_json
            if ! issues_json=$(fetch_issues "$project" 100); then
                continue
            fi

            echo "$issues_json" | jq -c '.[]' | while IFS= read -r issue; do
                local issue_id short_id title events
                issue_id=$(echo "$issue" | jq -r '.id')
                short_id=$(echo "$issue" | jq -r '.shortId')
                title=$(echo "$issue" | jq -r '.title')
                events=$(echo "$issue" | jq -r '.count // "0"')

                if ! grep -q "^${issue_id}$" "$baseline_file" 2>/dev/null; then
                    # New issue detected
                    printf "  ${RED}${BOLD}NEW${RESET} [%s] %s (%s events)\n" "$short_id" "$title" "$events"
                    echo "$issue_id" >> "$baseline_file"

                    # macOS notification
                    if [ "$notify" = "true" ]; then
                        osascript -e "display notification \"${title}\" with title \"Sentry: New Issue\" subtitle \"${short_id}\"" 2>/dev/null || true
                    fi

                    new_count=$((new_count + 1))
                fi
            done
        done

        if [ "$new_count" -eq 0 ]; then
            printf "  ${GREEN}No new issues${RESET}\n"
        fi
    done
}

# ============================================
# Help
# ============================================

show_help() {
    cat <<'HELP'
Usage: sentry-issues.sh <command> [options]

Commands:
  list                    List unresolved issues
  diagnose <issue-id>     Detailed diagnosis of an issue
  resolve  <issue-id>     Resolve an issue (with confirmation)
  report                  Generate a markdown report
  monitor                 Continuous surveillance mode

Global Options:
  -p, --project <slug>    Filter by project (queen-mama-macos | queenmama_landing)
  --limit <n>             Number of issues (default: 25)
  --no-color              Disable colored output
  -v, --verbose           Verbose/debug output
  -h, --help              Show this help

Resolve Options:
  -y                      Skip confirmation prompt
  --status <status>       Status to set: resolved (default), ignored, resolvedInNextRelease

Monitor Options:
  --interval <seconds>    Polling interval (default: 60)
  --notify                Enable macOS native notifications

Examples:
  ./scripts/sentry-issues.sh list
  ./scripts/sentry-issues.sh list -p queen-mama-macos
  ./scripts/sentry-issues.sh diagnose 90912234
  ./scripts/sentry-issues.sh resolve 90912234 -y
  ./scripts/sentry-issues.sh report
  ./scripts/sentry-issues.sh monitor --interval 30 --notify
HELP
}

# ============================================
# Argument Parsing & Main
# ============================================

COMMAND=""
ISSUE_ID=""
FILTER_PROJECTS="$DEFAULT_PROJECTS"
LIMIT=$DEFAULT_LIMIT
AUTO_YES=false
RESOLVE_STATUS="resolved"
MONITOR_INTERVAL=60
MONITOR_NOTIFY=false

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            list|diagnose|resolve|report|monitor)
                COMMAND="$1"
                shift
                ;;
            -p|--project)
                FILTER_PROJECTS="$2"
                shift 2
                ;;
            --limit)
                LIMIT="$2"
                shift 2
                ;;
            --no-color)
                USE_COLOR=false
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -y)
                AUTO_YES=true
                shift
                ;;
            --status)
                RESOLVE_STATUS="$2"
                shift 2
                ;;
            --interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            --notify)
                MONITOR_NOTIFY=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                # Positional arg: likely issue ID
                if [ -z "$ISSUE_ID" ]; then
                    ISSUE_ID="$1"
                fi
                shift
                ;;
        esac
    done
}

main() {
    parse_args "$@"
    init_colors
    check_deps
    load_auth

    case "$COMMAND" in
        list)
            cmd_list
            ;;
        diagnose)
            cmd_diagnose "$ISSUE_ID"
            ;;
        resolve)
            cmd_resolve "$ISSUE_ID" "$AUTO_YES" "$RESOLVE_STATUS"
            ;;
        report)
            cmd_report
            ;;
        monitor)
            cmd_monitor
            ;;
        "")
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
