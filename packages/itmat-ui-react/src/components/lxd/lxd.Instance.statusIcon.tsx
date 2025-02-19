import React from 'react';
import { Tooltip } from 'antd';
import {
    CheckCircleOutlined,
    SyncOutlined, // This icon can spin
    PauseCircleOutlined,
    ExclamationCircleOutlined,
    StopOutlined,
    QuestionCircleOutlined
} from '@ant-design/icons';
import css from './lxd.module.css';

const iconStyle = { fontSize: '16px' };

const statusToIcon = {
    Running: <CheckCircleOutlined style={{ color: 'green', ...iconStyle }} />,
    Stopped: <StopOutlined style={{ color: 'red', ...iconStyle }} />,
    Starting: <SyncOutlined spin style={{ color: 'orange', ...iconStyle }} />,
    Stopping: <PauseCircleOutlined style={{ color: 'orange', ...iconStyle }} />,
    Error: <ExclamationCircleOutlined style={{ color: 'red', ...iconStyle }} />,
    default: <QuestionCircleOutlined style={{ color: 'gray', ...iconStyle }} />
};

const InstanceStatusIcon = ({ status }) => {
    const IconComponent = statusToIcon[status] || statusToIcon.default;
    return (
        <Tooltip title={`Status: ${status}`}>
            <span className={status === 'Starting' ? css.icon_spinning : ''}>
                {IconComponent}
            </span>
        </Tooltip>
    );
};

export default InstanceStatusIcon;
