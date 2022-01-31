import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { UserDetailsSection } from './userDetails';
import { UserListSection } from './userList';
import css from './userList.module.css';

export const UserPage: React.FunctionComponent = () => {
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
            <div className='page_section additional_panel'>
                <Switch>
                    <Route path='/users/:userId?' component={UserDetailsSection} />
                </Switch>
            </div>
        </div>
    );
};
