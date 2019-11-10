ARG BASE_VERSION
ARG DOCKER_HUB_NAME

FROM $DOCKER_HUB_NAME:$BASE_VERSION

WORKDIR /libdragon

ARG LIBDRAGON_VERSION_MAJOR
ARG LIBDRAGON_VERSION_MINOR
ARG LIBDRAGON_VERSION_REVISION

COPY ./libdragon-source /libdragon/libdragon-source
# Build the actual library here & build and install mikmod
RUN cd ./libdragon-source && \
    ./build.sh && \
    rm -rf *