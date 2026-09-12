#!/usr/bin/env bash

OUTPUT="$HOME/homelab/inventory/system.txt"

mkdir -p "$(dirname "$OUTPUT")"

{
    echo "=== HOMELAB SYSTEM INVENTORY ==="
    echo "Generated: $(date)"
    echo

    echo "=== SYSTEM ==="
    hostnamectl

    echo
    echo "=== KERNEL ==="
    uname -r

    echo
    echo "=== CPU ==="
    lscpu | grep -E 'Model name|CPU\(s\):'

    echo
    echo "=== MEMORY ==="
    free -h

    echo
    echo "=== STORAGE ==="
    lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS

    echo
    echo "=== NETWORK ==="
    ip -br addr

    echo
    echo "=== ROUTES ==="
    ip route
} > "$OUTPUT"

echo "Inventory saved to: $OUTPUT"

