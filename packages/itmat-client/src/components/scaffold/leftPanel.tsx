import * as React from 'react';
import { NavLink } from 'react-router-dom';
import * as css from '../../css/scaffold.css';
import { Icons } from '../icons';
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

            <NavLink to='/notification' title='Notifications' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='notification'/>Messages</div>
            </NavLink>

            <NavLink to='/settings' title='Settings' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='settings'/>Settings</div>
            </NavLink>

            <NavLink title='Logout' to='/logout' id='logoutButton' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='logout'/>Logout</div>
            </NavLink>
        </div>
    );
};