import * as React from 'react';
import { Query, Mutation } from '@apollo/client/react/components';
import { NavLink } from 'react-router-dom';
import { LOGOUT, WHO_AM_I, IProject, userTypes } from 'itmat-commons';
import css from './scaffold.module.css';
import { DatabaseOutlined, TeamOutlined, PoweroffOutlined, HistoryOutlined, SettingOutlined, ProjectOutlined } from '@ant-design/icons';
import LoadSpinner from '../reusable/loadSpinner';

type MainMenuBarProps = {
    projects: IProject[];
}
export const MainMenuBar: React.FunctionComponent<MainMenuBarProps> = ({ projects }) => (
    <div className={css.main_menubar}>

        <div>
            <NavLink to={projects.length === 1 ? `/projects/${projects[0].id}` : '/projects'} title='Projects' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><ProjectOutlined /> Projects</div>
            </NavLink>
        </div>


        <div>
            <NavLink to='/datasets' title='Datasets' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><DatabaseOutlined /> Datasets</div>
            </NavLink>
        </div>
        <Query<any, any> query={WHO_AM_I}>
            {({ loading, error, data }) => {
                if (loading) return <LoadSpinner />;
                if (error) return <p>{error.toString()}</p>;
                if (data.whoAmI.type === userTypes.ADMIN)
                    return (
                        <>
                            <div>
                                <NavLink to='/users' title='Users' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                                    <div className={css.button}><TeamOutlined /> Users</div>
                                </NavLink>
                            </div>

                            <div>
                                <NavLink to='/logs' title='Logs' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                                    <div className={css.button}><HistoryOutlined /> Logs</div>
                                </NavLink>
                            </div>
                        </>
                    );
                return null;
            }}
        </Query>
        {/*
        <div>
            <NavLink to="/notifications" title="Notifications" className={({isActive}) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><BellOutlined /></div>
            </NavLink>
        </div>

        <div>
            <NavLink to="/settings" title="Settings" className={({isActive}) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><SettingOutlined /></div>
            </NavLink>
        </div>
        */}

        <div>
            <NavLink to='/profile' title='My account' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><SettingOutlined />My account</div>
            </NavLink>
        </div>

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
