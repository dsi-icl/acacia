import * as React from 'react';
import { NavLink } from 'react-router-dom';
import * as css from '../../css/userList.css';

export const SettingOptions: React.FunctionComponent = props =>
    <div className={css.userList}>
        <NavLink to='/settings/user'>
            <button>User Settings</button>
        </NavLink>
        <NavLink to='/settings/application'>
            <button>Application Settings</button>
        </NavLink>
    </div>
;