import * as React from 'react';
import { Mutation, Query } from 'react-apollo';
import * as css from './scaffold.module.css';
import { Icons } from '../icons';
import { LOGOUT, WHO_AM_I } from '../../graphql/user';
import { IShortCut } from 'itmat-utils/dist/models/user';

export const StatusBar: React.FunctionComponent = () => {
    return (
        <div className={css.status_bar}>
            v0.1.0
        </div>
    );
};