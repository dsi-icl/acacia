import { FunctionComponent } from 'react';
import { UserListSection } from './userList';
import css from './users.module.css';

export const UserPage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.user_list_section + ' page_section'}>
                <div className='page_ariane'>
                    Users
                </div>
                <div className='page_content'>
                    <UserListSection />
                </div>
            </div>
        </div>
    );
};
