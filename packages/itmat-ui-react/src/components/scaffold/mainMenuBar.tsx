import * as React from 'react';
import { Mutation, useMutation, useQuery } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import { LOGOUT, WHO_AM_I, IProject, LOG_ACTION, WRITE_LOG, LOG_STATUS } from 'itmat-commons';
import { Icons } from '../icons';
import css from './scaffold.module.css';
import { logFun } from '../../utils/logUtils';

export const MainMenuBar: React.FunctionComponent<{ projects: IProject[] }> = ({ projects }) => {
    const [writeLog] = useMutation(WRITE_LOG);
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    return (
        <div className={css.main_menubar}>
            <div>
                <NavLink to={projects.length === 1 ? `/projects/${projects[0].id}` : '/projects'} title='Projects' activeClassName={css.clickedButton}>
                    <div className={css.button}><Icons type='query' /></div>
                </NavLink>
            </div>

            <div>
                <NavLink to='/datasets' title='Datasets' activeClassName={css.clickedButton}>
                    <div className={css.button}><Icons type='studies' /></div>
                </NavLink>
            </div>

            <div>
                <NavLink to='/users' title='Users' activeClassName={css.clickedButton}>
                    <div className={css.button}><Icons type='users' /></div>
                </NavLink>
            </div>

            { whoamidata.whoAmI.type ? <div>
                <NavLink to='/logs' title='Logs' activeClassName={css.clickedButton}>
                    <div className={css.button}><Icons type='users' /></div>
                </NavLink>
            </div> : null }

            {/*
            <div>
                <NavLink to="/notifications" title="Notifications" activeClassName={css.clickedButton}>
                    <div className={css.button}><Icons type="notification" /></div>
                </NavLink>
            </div>

            <div>
                <NavLink to="/settings" title="Settings" activeClassName={css.clickedButton}>
                    <div className={css.button}><Icons type="settings" /></div>
                </NavLink>
            </div>
            */}

            <div>
                <NavLink title='Logout' to='/logout' id='logoutButton'>
                    <Mutation<any, any>
                        mutation={LOGOUT}
                        update={(cache, { data: { logout } }) => {
                            if (logout.successful === true) {
                                logFun(writeLog, whoamidata, LOG_ACTION.LOGOUT_USER, {}, LOG_STATUS.SUCCESS);
                                cache.writeQuery({
                                    query: WHO_AM_I,
                                    data: { whoAmI: null }
                                });
                            }
                        }}
                    >
                        {(logout) => (
                            <div className={css.button} onClick={() => { logout(); }}><Icons type='logout' /></div>
                        )}
                    </Mutation>
                </NavLink>
            </div>
        </div>
    );
};
