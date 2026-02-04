FROM ghcr.io/dragonminded/libdragon:latest

# This is for libdragon-cli
ENV DOCKER_CONTAINER=true

ARG USERNAME=dev
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Create dev user for rootless access
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME --shell /bin/bash

# This is the default location for the toolchain in the upstream image. Should be owned by the dev user
RUN chown -R $USER_UID:$USER_GID /n64_toolchain

USER dev

WORKDIR /libdragon