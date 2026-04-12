#!/bin/bash

# ============================================
# Migration Monitoring & Alert System
# ============================================
# Monitors migration scripts and sends alerts on failure
# 
# Usage: ./scripts/monitor-migrations.sh [command]
# ============================================

set -e

LOG_FILE="logs/migration-monitor.log"
ALERT_LOG="logs/migration-alerts.log"
EMAIL_TO="${ALERT_EMAIL:-admin@omuto.com}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" | tee -a "$ALERT_LOG"
    
    if [ "$level" = "ERROR" ]; then
        # Email alert (if sendmail available)
        if command -v sendmail &> /dev/null; then
            echo "$message" | sendmail -t "$EMAIL_TO"
        fi
        
        # Slack webhook alert
        if [ -n "$SLACK_WEBHOOK" ]; then
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"🚨 Migration Alert: $message\"}" \
                "$SLACK_WEBHOOK" || true
        fi
    fi
}

check_migration_status() {
    local script="$1"
    local last_run=$(grep -r "Starting migration" "$LOG_FILE" | tail -1 || echo "")
    
    if [ -n "$last_run" ]; then
        local run_time=$(echo "$last_run" | grep -oP '\[\K[^\]]+')
        local end_marker="[$(date -d "$run_time" '+%Y-%m-%d %H:%M:%S')]"
        
        if grep -q "$end_marker.*SUCCESS" "$LOG_FILE" 2>/dev/null; then
            log "Migration $script completed successfully"
            return 0
        else
            alert "ERROR" "Migration $script may have failed - no success confirmation found"
            return 1
        fi
    fi
}

run_migration_with_monitoring() {
    local script="$1"
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log "Starting migration: $script at $start_time"
    
    if bash "$script" 2>&1 | tee -a "$LOG_FILE"; then
        log "Migration $script completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"
        alert "INFO" "Migration $script completed successfully"
        return 0
    else
        alert "ERROR" "Migration $script FAILED at $(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
}

case "${1:-run}" in
    run)
        if [ -z "$2" ]; then
            log "Usage: $0 run <migration-script>"
            exit 1
        fi
        run_migration_with_monitoring "$2"
        ;;
    check)
        check_migration_status "${2:-all}"
        ;;
    alert)
        alert "${2:-INFO}" "${3:-Test alert}"
        ;;
    *)
        echo "Usage: $0 {run|check|alert} [args]"
        exit 1
        ;;
esac