#pragma once

#if __has_include("config.local.h")
#include "config.local.h"
#else
#error "Missing esp32-console/include/config.local.h. Copy include/config.example.h to include/config.local.h and fill in local credentials."
#endif
