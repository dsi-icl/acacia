import { ProjectOutlined, DatabaseOutlined, TeamOutlined, PoweroffOutlined } from '@ant-design/icons';
import { IProject } from 'itmat-commons/dist/models/study';
import * as React from 'react';
import { Mutation } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import { LOGOUT, WHO_AM_I } from 'itmat-commons/dist/graphql/user';
import css from './scaffold.module.css';

type MainMenuBarProps = {
    projects: IProject[]
}
export const MainMenuBar: React.FunctionComponent<MainMenuBarProps> = ({ projects }) => (
    <div className={css.main_menubar}>
        <div>
            <NavLink to={projects.length === 1 ? `/projects/${projects[0].id}` : '/projects'} title="Projects" activeClassName={css.clickedButton}>
                <div className={css.button}><ProjectOutlined /> Projects</div>
            </NavLink>
        </div>

        <div>
            <NavLink to="/datasets" title="Datasets" activeClassName={css.clickedButton}>
                <div className={css.button}><DatabaseOutlined /> Datasets</div>
            </NavLink>
        </div>

        <div>
            <NavLink to="/users" title="Users" activeClassName={css.clickedButton}>
                <div className={css.button}><TeamOutlined /> Users</div>
            </NavLink>
        </div>
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
            <NavLink title="Logout" to="/logout" id="logoutButton">
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
    );
};
