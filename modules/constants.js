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

  // These do not need a project to exist and their actions do not need the whole
  // structure. Actions that need the full project information should not be
  // listed here.
  NO_PROJECT_ACTIONS: ['help', 'version'],

  // cli exit codes
  STATUS_OK: 0,
  STATUS_ERROR: 1,
  STATUS_BAD_PARAM: 2,
  STATUS_VALIDATION_ERROR: 4,
});
