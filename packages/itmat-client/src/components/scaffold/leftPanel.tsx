import * as React from 'react';
import { Mutation } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import * as css from '../../css/scaffold.css';
import { Icons } from '../icons';
import { LOGOUT, WHO_AM_I } from '../../graphql/user';

export const LeftPanel: React.FunctionComponent = props => {
    return (
        <div className={css.leftPanel}>
            <div>
                ITMAT-BROKER
            </div>

            <NavLink to='/studies' title='Studies' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='studies'/>Studies</div>
            </NavLink>

            <NavLink to='/users' title='Users' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='users'/>Users</div>
            </NavLink>

            <NavLink to='/notifications' title='Notifications' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='notification'/>Messages</div>
            </NavLink>

            <NavLink to='/settings' title='Settings' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='settings'/>Settings</div>
            </NavLink>

            <NavLink title='Logout' to='/logout' id='logoutButton' activeClassName={css.clickedButton}>
                <Mutation
                    mutation={LOGOUT}
                    update={(cache, { data: { logout } }) => {
                        if (logout.successful === true) {
                            cache.writeQuery({
                                query: WHO_AM_I,
                                data: { whoAmI: null }
                            })
                        }
                    }}
                >
                    {(logout, { data }) => (
                        <div className={css.button} onClick={() => {logout();}}><Icons type='logout'/>Logout</div>
                    )}
                </Mutation>
            </NavLink>
        </div>
    );
};
