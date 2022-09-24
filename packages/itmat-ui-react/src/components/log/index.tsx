import { FunctionComponent } from 'react';
import { LogListSection } from './logList';
import css from './logList.module.css';

export const LogPage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.user_list_section + ' page_section'}>
                <div className='page_ariane'>
                    Log History
                </div>
                <div className='page_content'>
                    <LogListSection />
                </div>
            </div>
        </div>
    );
};
