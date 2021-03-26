FROM ubuntu:18.04

ENV N64_INST=/usr/local

WORKDIR /libdragon

COPY ./libdragon-source /libdragon/libdragon-source

RUN apt-get update && \
    apt-get install -yq wget bzip2 gcc g++ make file libmpfr-dev libmpc-dev libpng-dev zlib1g-dev texinfo git gcc-multilib && \
    apt-get clean

# RUN cp -r ./tools /tmp/tools && \
#     cd .. && \
#     cd /tmp/tools && \
#     ./build