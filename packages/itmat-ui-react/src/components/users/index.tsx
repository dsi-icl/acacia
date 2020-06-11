import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { CreateNewUser } from './createNewUser';
import { UserDetailsSection } from './userDetails';
import { UserListSection } from './userList';
import css from './userList.module.css';

export const UserPage: React.FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.user_list_section + ' page_section'}>
                <div className='page_ariane'>
                    USERS
                </div>
                <div className='page_content'>
                    <UserListSection />
                </div>
            </div>
            <div className='page_section additional_panel'>
                <Switch>
                    <Route path='/users/createNewUser' render={() =>
                        <>
                            <div className='page_ariane'>CREATE NEW USER</div>
                            <div className={css.create_new_user + ' page_content'}>
                                <CreateNewUser />
                            </div>
                        </>
                    } />
                    <Route path='/users/:userId' render={({ match }) =>
                        <UserDetailsSection userId={match.params.userId} />
                    } />
                    <Route path='/' render={() => <></>} />
                </Switch>
            </div>
        </div>
    );
};
