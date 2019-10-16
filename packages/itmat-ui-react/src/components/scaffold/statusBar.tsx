import * as React from 'react';
import * as css from './scaffold.module.css';

export const StatusBar: React.FunctionComponent = () => {
    return (
        <div className={css.status_bar}>
            v0.1.0
        </div>
    );
};