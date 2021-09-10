module.exports = {
  DOCKER_HUB_IMAGE: 'anacierdem/libdragon:toolchain',
  PROJECT_NAME: process.env.npm_package_name,

  LIBDRAGON_GIT: 'https://github.com/DragonMinded/libdragon',
  LIBDRAGON_BRANCH: 'trunk',
  LIBDRAGON_SUBMODULE: 'libdragon-source',

  LIBDRAGON_PROJECT_MANIFEST: '.libdragon',
  CACHED_CONTAINER_FILE: 'libdragon-docker-container',
  IMAGE_FILE: 'docker-image',
};
