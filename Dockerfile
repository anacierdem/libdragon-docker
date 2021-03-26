#This just builds the toolchain
FROM ubuntu:18.04

ENV N64_INST=/usr/local

WORKDIR /libdragon

RUN apt-get update && \
    apt-get install -yq wget bzip2 gcc g++ make file libmpfr-dev libmpc-dev libpng-dev zlib1g-dev texinfo git gcc-multilib && \
    apt-get clean && \
    git clone https://github.com/anacierdem/libdragon.git/ ./libdragon-source && \
    cd ./libdragon-source && \
    git checkout 6c29a9da72971063c33e72e3fb884d3470fce941 && \
    cp -r ./tools /tmp/tools && \
    cd .. && \
    cd /tmp/tools && \
    ./build && \
    cd /libdragon && \
    rm -rf /tmp/tools && \
    rm -rf * && \
    find /usr/local/bin -type f | xargs strip && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/plugin/gengtype && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/liblto_plugin.so.0.0.0 && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/liblto_plugin.so.0 && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/lto-wrapper && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/collect2 && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/cc1plus && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/cc1 && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/install-tools/fixincl && \
    strip /usr/local/libexec/gcc/mips64-elf/10.2.0/lto1 && \
    rm -rf /usr/local/share/locale/* && \
    apt autoremove -yq
