import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
import './css/antdOverride.css';
import './css/global.css';
import registerServiceWorker, { unregister as unregisterServiceWorker } from './registerServiceWorker';

const mountApp = () => {
    ReactDOM.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
        document.getElementById('root') as HTMLElement
    );
};

mountApp();
registerServiceWorker();

if (module.hot) {
    module.hot.accept('./index', mountApp);
    module.hot.accept('./App', mountApp);
    module.hot.accept('./registerServiceWorker', () => {
        unregisterServiceWorker();
        registerServiceWorker();
    });
}
