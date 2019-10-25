import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
import './css/antdOverride.css';
import './css/global.css';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root') as HTMLElement
);

registerServiceWorker();
