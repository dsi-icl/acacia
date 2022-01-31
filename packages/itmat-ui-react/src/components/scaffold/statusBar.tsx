import * as React from 'react';
import GitInfo from 'react-git-info/macro';
import css from './scaffold.module.css';

const gitInfo = GitInfo();

export const StatusBar: React.FunctionComponent = () => {
    return (
        <div className={css.status_bar}>
            v{process.env.REACT_APP_VERSION} - {gitInfo.commit.shortHash} ({gitInfo.branch})
        </div>
    );
};
