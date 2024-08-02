import { FunctionComponent } from 'react';
import { NavLink } from 'react-router-dom';
import { enumUserTypes } from '@itmat-broker/itmat-types';
import css from './scaffold.module.css';
import { DatabaseOutlined, TeamOutlined, PoweroffOutlined, HistoryOutlined, SettingOutlined, DesktopOutlined, WarningTwoTone, CloudOutlined, ApartmentOutlined, ClusterOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import LoadSpinner from '../reusable/loadSpinner';
import dayjs from 'dayjs';
import { Collapse, Tooltip } from 'antd';
import { trpc } from '../../utils/trpc';
import { useAuth } from '../../utils/dmpWebauthn/webauthn.context';

export const MainMenuBar: FunctionComponent = () => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const logout = trpc.user.logout.useMutation({
        onSuccess: () => {
            window.location.reload();
        },
        onError: () => {
            window.location.reload();
        }
    });
    const { isWebauthAvailable } = useAuth(); // Access the WebAuthn state from context
    const fetchedDevices = trpc.webauthn.getWebauthnRegisteredDevices.useQuery();

    if (whoAmI.isLoading || fetchedDevices.isLoading) {
        return <LoadSpinner />;
    }
    if (whoAmI.isError || fetchedDevices.isError) {
        return <p>
            An error occured, please contact your administrator
        </p>;
    }

    return <div className={css.main_menubar}>
        <div>
            <NavLink to='/datasets' title='Datasets' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><DatabaseOutlined /> Datasets</div>
            </NavLink>
        </div>
        <div>
            <NavLink to='/profile' title='My account' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}>
                    <SettingOutlined />
                    <span> My Account </span>

                    {/* Check if the account is expiring soon and show a warning */}
                    {
                        (whoAmI.data.type !== enumUserTypes.ADMIN && dayjs().add(2, 'week').valueOf() - dayjs(whoAmI.data.expiredAt).valueOf() > 0) && (
                            <Tooltip title={'Your account will expire soon. You can make a request on the login page in your profile settings.'}>
                                <WarningTwoTone twoToneColor="#ffcc00" style={{ marginLeft: '8px' }} />
                            </Tooltip>
                        )
                    }

                    {/* Check if WebAuthn registration is needed and show another warning */}
                    {
                        (isWebauthAvailable && fetchedDevices.data.length === 0) &&
                        (
                            <Tooltip title="You could register a Authenticator on this device.">
                                <ExclamationCircleOutlined twoToneColor="#ff0000" style={{ marginLeft: '8px' }} />
                            </Tooltip>
                        )
                    }
                </div>
            </NavLink >
        </div >
        <div>
            <NavLink to='/drive' title='Drives' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><CloudOutlined /> My Drive</div>
            </NavLink>
        </div>
        <div>
            <NavLink to='/pun/sys/dashboard' target='_blank' title='Analytical Environment' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                <div className={css.button}><DesktopOutlined /> Analytical Environment</div>
            </NavLink>
        </div>
        {
            (whoAmI.data.type === enumUserTypes.ADMIN) ?
                <div>
                    <Collapse
                        items={[{
                            key: 'admin_tab_list',
                            label: <span style={{ color: 'white' }}>Admin</span>,
                            children: <div>
                                <div>
                                    <NavLink to='/logs' title='Logs' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                                        <div className={css.button} style={{ color: 'black' }}><HistoryOutlined /> Logs</div>
                                    </NavLink>
                                </div>
                                <div>
                                    <NavLink to='/users' title='Users' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                                        <div className={css.button} style={{ color: 'black' }}><TeamOutlined /> Users</div>
                                    </NavLink>
                                </div>
                                <div>
                                    <NavLink to='/domains' title='Domains' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                                        <div className={css.button} style={{ color: 'black' }}><ApartmentOutlined /> Domains</div>
                                    </NavLink>
                                </div>
                                <div>
                                    <NavLink to='/organisations' title='Organisations' className={({ isActive }) => isActive ? css.clickedButton : undefined}>
                                        <div className={css.button} style={{ color: 'black' }}><ClusterOutlined /> Organisations</div>
                                    </NavLink>
                                </div>
                            </div>
                        }]}
                    />
                </div>
                : null
        }
        <div>
            <NavLink title='Logout' to='/'>
                <div className={css.button} onClick={() => { logout.mutate(); }}><PoweroffOutlined /> Logout</div>
            </NavLink>
        </div>
    </div >;
};
