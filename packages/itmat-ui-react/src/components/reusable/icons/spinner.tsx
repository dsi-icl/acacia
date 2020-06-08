import * as React from 'react';
import './spinner.css';

export const Spinner: React.FunctionComponent = () => (
    <div style={{ width: '30%', margin: '0 auto' }}>
        <div style={{ display: 'block', transform: 'scale(0.5, 0.5)' }}>
            <div className='lds-css ng-scope'>
                <div style={{ width: '100%', height: '100%' }} className='lds-pacman'>
                    <div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                    <div>
                        <div></div>
                        <div></div>
                    </div>
                </div>
            </div>
        </div>
        <div style={{ position: 'relative', top: 55, right: 45 }}>Crunching...</div>
    </div>
);
