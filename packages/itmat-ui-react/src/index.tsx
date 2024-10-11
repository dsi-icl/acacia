import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import registerServiceWorker, { unregister as unregisterServiceWorker } from './registerServiceWorker';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './utils/trpc';
import { httpLink } from '@trpc/client';

const AppWithTRPC = () => {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false
            }
        }
    }));
    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpLink({
                    url: `${window.location.origin}/trpc`,
                    async headers() {
                        return {
                            authorization: document.cookie
                        };
                    }
                })
            ]
        })
    );
    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </trpc.Provider>
    );
};

const mountApp = () => {
    const container = document.getElementById('root');
    if (!container)
        return;
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <AppWithTRPC />
        </StrictMode>
    );
};

mountApp();
registerServiceWorker();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const module: any;
if (module.hot) {
    module.hot.accept('./index', mountApp);
    module.hot.accept('./App', mountApp);
    module.hot.accept('./registerServiceWorker', () => {
        unregisterServiceWorker();
        registerServiceWorker();
    });
}
