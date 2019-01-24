import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as css from '../../css/userList.css';
import { UserDetailsSection } from './userDetails';
import { UserListSection } from './userList';
import { CreateNewUser } from './createNewUser';

export const UserPage: React.FunctionComponent = props => {
    return (
        <div className={css.pageContainer}>
            <UserListSection/>
            <Switch>
                <Route path='/users/createNewUser' render={() => <CreateNewUser/>}/>                
                <Route path='/users/:username' render={({ match }) => <UserDetailsSection username={match.params.username}/>}/>
                <Route path='/' render={() => <></>}/>
            </Switch>
        </div>
    );
};