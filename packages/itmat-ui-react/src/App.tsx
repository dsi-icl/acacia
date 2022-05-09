import * as React from 'react';
import { Helmet } from 'react-helmet-async';
import Providers from './Providers';
import Fence from './Fence';

export const App: React.FunctionComponent = () => {

    return <Providers>
        <Helmet>
            <title>{process.env.REACT_APP_NAME ?? 'Data Portal'}</title>
        </Helmet>
        <Fence />
    </Providers>;
};

export default App;
