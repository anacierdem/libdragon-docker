FROM node:22

# Add Docker's official GPG key:
RUN apt-get update
RUN apt-get install ca-certificates curl
RUN install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
RUN chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
RUN echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt-get update

ARG DOCKER_VERSION="5:27.2.1-1~debian.12~bookworm"

RUN apt-get install docker-ce-cli=$DOCKER_VERSION docker-buildx-plugin docker-compose-plugin

USER node

# Enable rootless linking
RUN npm config set prefix '~/.local/'

# vscode doesn't use a login shell by default, include .local/bin in PATH
RUN echo "PATH=\"$HOME/.local/bin:$PATH\"" >> ~/.bashrc