#include <stdio.h>
#include <malloc.h>
#include <string.h>
#include <stdint.h>

#include <libdragon.h>

int main(void)
{
    init_interrupts();

    display_close();
    console_init();
    timer_init();

    debug_init_usblog();

    while(1)
    {
        printf("Test counter: %llu\n", timer_ticks() / (TICKS_PER_SECOND / 1000));

        // Wait to limit data
        unsigned long stop = 100 + get_ticks_ms();
        while (stop > get_ticks_ms());
    }
}