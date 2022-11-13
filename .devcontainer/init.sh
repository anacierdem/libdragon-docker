#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Install nodejs & npm
apt-get update
apt install curl -y
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install nodejs