import * as React from 'react';
import css from './loadingBalls.module.css';

export const LoadingBalls: React.FC = () => (
    <div style={{ width: '100%', height: '100%' }} className={css.ldsFlickr}>
        <div />
        <div />
        <div />
    </div>
);
