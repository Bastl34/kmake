#include <iostream>
#include <SDL.h>

int main(int argc, char** argv)
{
    std::cout << "SDL example" << std::endl;

    SDL_Init(SDL_INIT_VIDEO);

    SDL_Window* window = SDL_CreateWindow("SDL TEST", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 500, 650, SDL_WINDOW_RESIZABLE);

    SDL_Renderer* ren = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (ren == nullptr)
    {
        std::cerr << "SDL_CreateRenderer Error" << SDL_GetError() << std::endl;
        return EXIT_FAILURE;
    }

    std::string imagePath = std::string(ASSET_DIR) + "/grumpyCat.bmp";

    SDL_Surface* bmp = SDL_LoadBMP(imagePath.c_str());
    if (bmp == nullptr)
    {
        std::cerr << "SDL_LoadBMP Error: " << SDL_GetError() << std::endl;
        return EXIT_FAILURE;
    }

    SDL_Texture* tex = SDL_CreateTextureFromSurface(ren, bmp);
    if (tex == nullptr)
    {
        std::cerr << "SDL_CreateTextureFromSurface Error: " << SDL_GetError() << std::endl;
        return EXIT_FAILURE;
    }

    SDL_SetWindowIcon(window, bmp);

    int angle = 0;

    uint64_t lastTime = 0;
    uint64_t currentTime = 0;

    while (true)
    {
        SDL_Event e;
        if (SDL_PollEvent(&e))
        {
            if (e.type == SDL_QUIT)
                break;
            else if (e.type == SDL_KEYUP && e.key.keysym.sym == SDLK_ESCAPE)
                break;
        }

        SDL_RenderClear(ren);
        SDL_RenderCopyEx(ren, tex, nullptr, nullptr, angle, NULL, SDL_FLIP_NONE);
        SDL_RenderPresent(ren);

        currentTime = SDL_GetTicks();
        float fps = 1000.0f / (currentTime - lastTime);

        lastTime = currentTime;

        std::string fpsStr = "SDL TEST (FPS: " + std::to_string((uint32_t)fps) + ")";
        SDL_SetWindowTitle(window, fpsStr.c_str());

        //SDL_Delay(10);

        angle += 3 % 360;
    }

    SDL_FreeSurface(bmp);
    SDL_DestroyTexture(tex);
    SDL_DestroyRenderer(ren);

    SDL_DestroyWindow(window);
    SDL_Quit();

    return 0;
}
