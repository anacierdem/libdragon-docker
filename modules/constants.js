module.exports = /** @type {const} */ ({
  DOCKER_HUB_IMAGE: 'ghcr.io/dragonminded/libdragon:latest',
  LIBDRAGON_GIT: 'https://github.com/DragonMinded/libdragon',
  LIBDRAGON_BRANCH: 'trunk',
  LIBDRAGON_SUBMODULE: 'libdragon',
  CONTAINER_TARGET_PATH: '/libdragon',
  LIBDRAGON_PROJECT_MANIFEST: '.libdragon',
  CACHED_CONTAINER_FILE: 'libdragon-docker-container',
  CONFIG_FILE: 'config.json',
  DEFAULT_STRATEGY: 'submodule',

  ACCEPTED_STRATEGIES: ['submodule', 'subtree', 'manual'],

  // cli exit codes
  STATUS_OK: 0,
  STATUS_ERROR: 1,
  STATUS_BAD_PARAM: 2,
  STATUS_VALIDATION_ERROR: 4,

  IMAGE_FILE: 'docker-image', // deprecated
});
