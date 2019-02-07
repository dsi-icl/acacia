import * as React from 'react';
import * as css from '../css/scaffold.module.css';

export const WarningTooNarrow: React.FunctionComponent = () => {
    const [disabled, setDisabled] = React.useState(false);
    if (disabled) return null;
    return (
        <div className={css.warning}>
            Warning: Your view area is too narrow! This may cause the website to misrender.
            Please widen your browser or <span onClick={() => { setDisabled(true); }}>disable warning for current session</span>
        </div>
    );
};