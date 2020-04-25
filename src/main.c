#include <stdio.h>
#include <malloc.h>
#include <string.h>
#include <stdint.h>

#include <libdragon.h>
#include <libed64.h>

int main(void)
{
    resolution_t res = RESOLUTION_320x240;
    bitdepth_t bit = DEPTH_32_BPP;

    init_interrupts();

    display_close();
    display_init( res, bit, 2, GAMMA_NONE, ANTIALIAS_RESAMPLE );

    everdrive_init(false);

    while(1)
    {
        handle_everdrive();
    }
}