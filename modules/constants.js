module.exports = {
  DOCKER_HUB_IMAGE: 'ghcr.io/dragonminded/libdragon:latest',
  PROJECT_NAME: process.env.npm_package_name,

  LIBDRAGON_GIT: 'https://github.com/DragonMinded/libdragon',
  LIBDRAGON_BRANCH: 'trunk',
  LIBDRAGON_SUBMODULE: 'libdragon',
  CONTAINER_TARGET_PATH: '/libdragon',

  LIBDRAGON_PROJECT_MANIFEST: '.libdragon',
  CACHED_CONTAINER_FILE: 'libdragon-docker-container',
  IMAGE_FILE: 'docker-image',
  CONFIG_FILE: 'config.json',
  DEFAULT_STRATEGY: 'submodule',
};
