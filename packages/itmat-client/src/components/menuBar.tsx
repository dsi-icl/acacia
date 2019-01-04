import * as React from 'react';
import { NavLink } from 'react-router-dom';

export const MenuBar: React.FunctionComponent = () => {
    return (
        <div className='menuBar'>
            <br />
            <NavLink to='/users' title='Users' activeClassName='clickedButton'>
                Users
            </NavLink>

            <NavLink to='/curation' title='Curation' activeClassName='clickedButton'>
                Curation
            </NavLink>

            <NavLink title='Logout' to='/logout' id='logoutButton' activeClassName='clickedButton'>
                Logout
            </NavLink>
        </div>
    );
}