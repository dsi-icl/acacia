import { FunctionComponent } from 'react';
import css from './scaffold.module.css';

export const StatusBar: FunctionComponent = () => {
    return (
        <div className={css.status_bar}>
            v{process.env.NX_REACT_APP_VERSION} - {process.env.NX_REACT_APP_COMMIT} ({process.env.NX_REACT_APP_BRANCH})
        </div>
    );
};
