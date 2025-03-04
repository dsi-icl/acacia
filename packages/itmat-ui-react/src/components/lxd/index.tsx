import React, { FunctionComponent } from 'react';
import css from './lxd.module.css';
import LXDInstanceList from './lxd.instance.list';
// import LXDCommandExecutor from './lxd.instance.terminal';

export const LXDPage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.lxdSection}>
                <div className={css.pageAriane}>
                    LXD Management
                </div>
                <div className={css.pagePanel}>
                    <LXDInstanceList />
                </div>
            </div>
        </div>
    );
};
