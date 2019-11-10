#This just builds the toolchain
FROM ubuntu:18.04

ARG LIBDRAGON_VERSION_MAJOR
ARG LIBDRAGON_VERSION_MINOR
ARG LIBDRAGON_VERSION_REVISION

ENV N64_INST=/usr/local

WORKDIR /libdragon

# 46dbd48e145649ac248e9a75c923c57d063dff1f is the SHA at the point of separation (v1.3.15)
RUN apt-get update && \
    apt-get install -yq wget bzip2 gcc g++ make file libmpfr-dev libmpc-dev libpng-dev zlib1g-dev texinfo git gcc-multilib && \
    apt-get clean && \
    git clone https://github.com/DragonMinded/libdragon.git/ ./libdragon-code && \
    cd ./libdragon-code && \
    git checkout 46dbd48e145649ac248e9a75c923c57d063dff1f && \
    cp -r ./tools /tmp/tools && \
    cd .. && \
    cd /tmp/tools && \
    JOBS=8 ./build && \
    cd /libdragon && \
    rm -rf /tmp/tools && \
    rm -rf *
