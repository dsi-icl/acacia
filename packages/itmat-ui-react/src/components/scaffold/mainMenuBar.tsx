import { FunctionComponent } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery } from '@apollo/client/react/hooks';
import { NavLink } from 'react-router-dom';
import { LOGOUT, WHO_AM_I } from '@itmat-broker/itmat-models';
import { IGenericResponse, IProject, userTypes } from '@itmat-broker/itmat-types';
import css from './scaffold.module.css';
import { DatabaseOutlined, TeamOutlined, PoweroffOutlined, HistoryOutlined, SettingOutlined, ProjectOutlined, DesktopOutlined, WarningTwoTone } from '@ant-design/icons';
import LoadSpinner from '../reusable/loadSpinner';
import dayjs from 'dayjs';
import { Tooltip } from 'antd';

type MainMenuBarProps = {
    projects: IProject[];
}
export const MainMenuBar: FunctionComponent<MainMenuBarProps> = ({ projects }) => {
    const { loading: whoAmILoading, error: whoAmIError, data: whoAmIData } = useQuery(WHO_AM_I);
    if (whoAmILoading) {
        return <LoadSpinner />;
    }
    if (whoAmIError) {
        return <p>
            An error occured, please contact your administrator
        </p>;
    }
    return <div className={css.main_menubar}>

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
        {whoAmIData.whoAmI.type === userTypes.ADMIN ?
            <div>
                <NavLink to='/users' title='Users' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                    <div className={css.button}><TeamOutlined /> Users</div>
                </NavLink>
            </div> : null
        }
        {(whoAmIData.whoAmI.type === userTypes.ADMIN || whoAmIData.whoAmI.metadata?.logPermission) ?
            <div>
                <NavLink to='/logs' title='Logs' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                    <div className={css.button}><HistoryOutlined /> Logs</div>
                </NavLink>
            </div> : null
        }
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
                <div className={css.button}>
                    {
                        (whoAmIData.whoAmI.type !== userTypes.ADMIN && dayjs().add(2, 'week').valueOf() - dayjs(whoAmIData.whoAmI.expiredAt).valueOf() > 0) ?
                            <><SettingOutlined /><Tooltip title={'Your account will expire soon. You can make a request on the login page.'}> My Account<WarningTwoTone /></Tooltip></> :
                            <><SettingOutlined /> My Account</>
                    }
                </div>
            </NavLink >
        </div >
        {(whoAmIData.whoAmI.type === userTypes.ADMIN || whoAmIData.whoAmI.metadata?.aePermission === true)
            ? <div>
                <NavLink to='/pun/sys/dashboard' target='_blank' title='Analytical Environment' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                    <div className={css.button}><DesktopOutlined /> Analytical Environment</div>
                </NavLink>
            </div>
            : null
        }

        <div>
            <NavLink title='Logout' to='/'>
                <Mutation<{ logout: IGenericResponse }, never>
                    mutation={LOGOUT}
                    update={(cache, { data }) => {
                        if (data && data.logout.successful === true) {
                            cache.writeQuery({
                                query: WHO_AM_I,
                                data: { whoAmI: null }
                            });
                        }
                    }}
                >
                    {(logout) => (
                        <div className={css.button} onClick={() => { logout().catch(() => { return; }); }}><PoweroffOutlined /> Logout</div>
                    )}
                </Mutation>
            </NavLink>
        </div>
    </div >;
};
