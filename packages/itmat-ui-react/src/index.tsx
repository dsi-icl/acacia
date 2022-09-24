import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import registerServiceWorker, { unregister as unregisterServiceWorker } from './registerServiceWorker';

const mountApp = () => {
    const container = document.getElementById('root');
    if (!container)
        return;
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <App />
        </StrictMode>
    );
};

mountApp();
registerServiceWorker();

declare const module: any;
if (module.hot) {
    module.hot.accept('./index', mountApp);
    module.hot.accept('./App', mountApp);
    module.hot.accept('./registerServiceWorker', () => {
        unregisterServiceWorker();
        registerServiceWorker();
    });
}
