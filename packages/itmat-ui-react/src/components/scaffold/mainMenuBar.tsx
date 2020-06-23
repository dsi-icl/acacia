import { DatabaseOutlined, TeamOutlined, PoweroffOutlined } from '@ant-design/icons';
import * as React from 'react';
import { Mutation, Query } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import { LOGOUT, WHO_AM_I, GET_GRANTED_PERMISSIONS, IProject } from 'itmat-commons';
import css from './scaffold.module.css';
import LoadSpinner from '../reusable/loadSpinner';

type MainMenuBarProps = {
    projects: IProject[];
}
export const MainMenuBar: React.FunctionComponent<MainMenuBarProps> = ({ projects: __unused__projects }) => (
    <div className={css.main_menubar}>
        {/*
        <div>
            <NavLink to={projects.length === 1 ? `/projects/${projects[0].id}` : '/projects'} title='Projects' activeClassName={css.clickedButton}>
                <div className={css.button}><ProjectOutlined /> Projects</div>
            </NavLink>
        </div>
        */}

        <div>
            <NavLink to='/datasets' title='Datasets' activeClassName={css.clickedButton}>
                <div className={css.button}><DatabaseOutlined /> Datasets</div>
            </NavLink>
        </div>
        <Query<any, any> query={GET_GRANTED_PERMISSIONS}>
            {({ loading, error }) => {
                if (loading) return <LoadSpinner />;
                if (error) return <p>{error.toString()}</p>;
                return (
                    <div>
                        <NavLink to='/users' title='Users' activeClassName={css.clickedButton}>
                            <div className={css.button}><TeamOutlined /> Users</div>
                        </NavLink>
                    </div>
                );
            }}
        </Query>
        {/*
        <div>
            <NavLink to="/notifications" title="Notifications" activeClassName={css.clickedButton}>
                <div className={css.button}><BellOutlined /></div>
            </NavLink>
        </div>

        <div>
            <NavLink to="/settings" title="Settings" activeClassName={css.clickedButton}>
                <div className={css.button}><SettingOutlined /></div>
            </NavLink>
        </div>
        */}
        <div>
            <NavLink title='Logout' to='/'>
                <Mutation<any, any>
                    mutation={LOGOUT}
                    update={(cache, { data: { logout } }) => {
                        if (logout.successful === true) {
                            cache.writeQuery({
                                query: WHO_AM_I,
                                data: { whoAmI: null },
                            });
                        }
                    }}
                >
                    {(logout) => (
                        <div className={css.button} onClick={() => { logout(); }}><PoweroffOutlined /> Logout</div>
                    )}
                </Mutation>
            </NavLink>
        </div>
    </div>
);
