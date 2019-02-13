import * as React from 'react';
import { Mutation, Query } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import * as css from '../../css/scaffold.module.css';
import { Icons } from '../icons';
import { LOGOUT, WHO_AM_I } from '../../graphql/user';
import { IShortCut } from 'itmat-utils/dist/models/user';

export const MainMenuBar: React.FunctionComponent<{ shortcuts: IShortCut[]}> = ({ shortcuts }) => {
    return (
        <div className={css.mainMenuBar}>
            <div className={css.hiddenIfTooNarrow}>
                ITMAT-BROKER
            </div>

            <Query query={WHO_AM_I}>
            {({ data, loading, error}) => {
                if (loading) return <div></div>;
                return <div className={css.hiddenIfTooNarrow}>Welcome, {data.whoAmI.realName || data.whoAmI.username}</div>;
            }}
            </Query>

            <div>
            <NavLink to='/studies' title='Studies' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='studies'/>Studies</div>
            </NavLink>
            </div>


            <div>
            <NavLink to='/queries' title='Queries' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='query'/>Queries</div>
            </NavLink>
            </div>

            <div>
            <NavLink to='/users' title='Users' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='users'/>Users</div>
            </NavLink>
            </div>

            <div>
            <NavLink to='/notifications' title='Notifications' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='notification'/>Messages</div>
            </NavLink>
            </div>

            <div>
            <NavLink to='/settings' title='Settings' activeClassName={css.clickedButton}>
                <div className={css.button}><Icons type='settings'/>Settings</div>
            </NavLink>
            </div>

            {shortcuts.map(el => 
                <div key={el.id}>
                <NavLink to={ el.application ? `/studies/details/${el.study}/application/${el.application}` : `/studies/details/${el.study}`} title={el.application || el.study}>
                    <div className={css.button}><Icons type='settings'/>{el.application || el.study}</div>
                </NavLink>
                </div>
            )}
            <div>
            <NavLink title='Logout' to='/logout' id='logoutButton'>
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
        </div>
    );
};
