import * as React from 'react';
import { ProfileManagementSection } from './profile';
import css from './profile.module.css';

export const ProfilePage: React.FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.user_list_section + ' page_section'}>
                <div className='page_ariane'>
                    My account
                </div>
                <div className='page_section additional_panel'>
                    <ProfileManagementSection />
                </div>
            </div>
        </div>
    );
};
