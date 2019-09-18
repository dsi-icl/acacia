import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
import registerServiceWorker from './registerServiceWorker';
import './css/global.css';
import './css/antdOverride.css';

ReactDOM.render(
    <App />,
    document.getElementById('root') as HTMLElement
);

registerServiceWorker();
