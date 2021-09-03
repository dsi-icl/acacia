import * as React from 'react';
import { LogListSection } from './logList';
import css from './logList.module.css';

export const LogPage: React.FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.user_list_section + ' page_section'}>
                <div className='page_ariane'>
                    LOG HISTORY
                </div>
                <div className='page_content'>
                    <LogListSection />
                </div>
            </div>
        </div>
    );
};
