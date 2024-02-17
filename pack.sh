#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

tar --transform='s/-linux//' -cvzf libdragon-linux-x86_64.tar.gz libdragon-linux
tar --transform='s/-macos//' -cvzf libdragon-macos-x86_64.tar.gz libdragon-macos
zip libdragon-win-x86_64.zip libdragon.exe
