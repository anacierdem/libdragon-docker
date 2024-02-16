/**
 *
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 */
function dockerHostUserParams(libdragonInfo) {
  const { uid, gid } = libdragonInfo.userInfo;
  return ['-u', `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`];
}

module.exports = {
  dockerHostUserParams,
};
