module.exports = {
  DOCKER_HUB_IMAGE: 'ghcr.io/dragonminded/libdragon:latest',
  DOCKER_SERVICE_NAME: 'toolchain',
  LIBDRAGON_GIT: 'https://github.com/DragonMinded/libdragon',
  LIBDRAGON_BRANCH: 'trunk',
  LIBDRAGON_SUBMODULE: 'libdragon',
  CONTAINER_TARGET_PATH: '/libdragon',
  LIBDRAGON_PROJECT_MANIFEST: '.libdragon',
  LIBDRAGON_COMPOSE_FILE: 'docker-compose.json',

  CONFIG_FILE: 'config.json',
  DEFAULT_STRATEGY: 'submodule',

  // cli exit codes
  STATUS_OK: 0,
  STATUS_ERROR: 1,
  STATUS_BAD_PARAM: 2,
  STATUS_VALIDATION_ERROR: 4,

  IMAGE_FILE: 'docker-image', // deprecated
  CACHED_CONTAINER_FILE: 'libdragon-docker-container', // deprecated
};
