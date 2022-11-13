# syntax=docker/dockerfile:1
FROM ghcr.io/dragonminded/libdragon:latest

ENV DOCKER_CONTAINER=true

COPY ./.devcontainer/init.sh /tmp/init.sh

WORKDIR /tmp
RUN /bin/bash -c ./init.sh