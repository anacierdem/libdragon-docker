
#include "libdragon.h"

#ifndef LIBDRAGON_VERSION_MAJOR
#define LIBDRAGON_VERSION_MAJOR -1
#endif

#ifndef LIBDRAGON_VERSION_MINOR
#define LIBDRAGON_VERSION_MINOR -1
#endif

#ifndef LIBDRAGON_VERSION_REVISION
#define LIBDRAGON_VERSION_REVISION -1
#endif

libdragon_version_t libdragon_version = { LIBDRAGON_VERSION_MAJOR, LIBDRAGON_VERSION_MINOR, LIBDRAGON_VERSION_REVISION };