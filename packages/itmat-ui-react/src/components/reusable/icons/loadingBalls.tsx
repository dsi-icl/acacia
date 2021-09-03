import * as React from 'react';
import './loadingBalls.css';

export const LoadingBalls: React.FunctionComponent = () => (
    <div className='lds-css ng-scope'>
        <div style={{ width: '100%', height: '100%' }} className='lds-flickr'>
            <div></div>
            <div></div>
            <div></div>
        </div></div>
);
