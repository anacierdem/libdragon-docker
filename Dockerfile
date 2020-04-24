#This just builds the toolchain
FROM ubuntu:18.04

ENV N64_INST=/usr/local

WORKDIR /libdragon

# 5cc5336366a5a7c2aec5bbfe68e6e548129a035e is the SHA before releasing version 2.0.0
RUN apt-get update && \
    apt-get install -yq wget bzip2 gcc g++ make file libmpfr-dev libmpc-dev libpng-dev zlib1g-dev texinfo git gcc-multilib && \
    apt-get clean && \
    git clone https://github.com/DragonMinded/libdragon.git/ ./libdragon-source && \
    cd ./libdragon-source && \
    git checkout 5cc5336366a5a7c2aec5bbfe68e6e548129a035e && \
    cp -r ./tools /tmp/tools && \
    cd .. && \
    cd /tmp/tools && \
    JOBS=8 ./build && \
    cd /libdragon && \
    rm -rf /tmp/tools && \
    rm -rf *
