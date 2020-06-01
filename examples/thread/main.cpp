#include <thread>
#include <mutex>

#include <iostream>
#include <vector>

int main()
{
    int threadAmount = 100;

    std::vector<std::shared_ptr<std::thread>> threads;
    std::mutex mutex;

    for(int i=0;i<threadAmount;++i)
    {
        auto t = std::shared_ptr<std::thread>(new std::thread([i, &mutex]
        {
            std::lock_guard<std::mutex> lock(mutex);
            std::cout << "Hello from thread #" << i << std::endl;
        }));

        threads.push_back(t);
    }

    for(auto t : threads)
        t->join();
    
    return 0;
}