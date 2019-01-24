import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as css from '../../css/userList.css';
import { SettingOptions } from './options';

export const SettingsPage: React.FunctionComponent = props => {
    return (
        <div className={css.pageContainer}>
            <SettingOptions/>
            <Switch>
                <Route path='/' render={() => <></>}/>
            </Switch>
        </div>
    );
};