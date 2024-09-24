import { FunctionComponent } from 'react';
import { List, Progress, Table, Tooltip } from 'antd';
import { trpc } from '../../utils/trpc';
import LoadSpinner from '../reusable/loadSpinner';
import { ISystemConfig, IUserWithoutToken, enumConfigType } from '@itmat-broker/itmat-types';
import css from './logList.module.css';
import { ResponsiveTimeRange } from '@nivo/calendar';
import dayjs from 'dayjs';

type DailyCount = {
    dayIndex: number;
    count: number;
};

type EventStatistics = {
    event: string;
    count: number;
    dailyCounts: DailyCount[];
    avgTimeConsumed: number;
    stdDevTimeConsumed: number;
};

type RequesterStatistics = {
    requester: string;
    count: number;
    dailyCounts: DailyCount[];
    avgTimeConsumed: number;
    stdDevTimeConsumed: number;
};

type LogsSummary = {
    eventStatistics: EventStatistics[];
    requesterStatistics: RequesterStatistics[];
};

export const LogSection: FunctionComponent = () => {
    const getLogs = trpc.log.getLogs.useQuery({ indexRange: [0, 100] });
    const getUsers = trpc.user.getUsers.useQuery({});
    const getSystemConfig = trpc.config.getConfig.useQuery({ configType: enumConfigType.SYSTEMCONFIG, key: null, useDefault: true });
    const getLogsSummary = trpc.log.getLogsSummary.useQuery();
    if (getLogs.isLoading || getUsers.isLoading || getSystemConfig.isLoading || getLogsSummary.isLoading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }

    if (getLogs.isError || getUsers.isError || getSystemConfig.isError || getLogsSummary.isError) {
        return <>An error occurred.</>;
    }

    return <div className={css.page_container}>
        <List
            header={
                <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={css['overview-icon']}></div>
                            <div>Logs</div>
                        </div>
                    </div>
                    <div>
                    </div>
                </div>
            }
        >
            <List.Item >
                <Table
                    style={{ width: '100%' }}
                    dataSource={getLogs.data}
                    columns={generateLogColumns(getUsers.data, (getSystemConfig.data.properties as ISystemConfig).defaultEventTimeConsumptionBar)}
                />
            </List.Item>
        </List><br />
        <List
            header={
                <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={css['overview-icon']}></div>
                            <div>Statistics</div>
                        </div>
                    </div>
                    <div>
                    </div>
                </div>
            }
        >
            <List.Item>
                <Table
                    style={{ width: '100%' }}
                    dataSource={(getLogsSummary.data as LogsSummary).eventStatistics}
                    columns={generateEventStatisticsColumns((getSystemConfig.data.properties as ISystemConfig).defaultEventTimeConsumptionBar)}
                />
            </List.Item>
            <List.Item>
                <Table
                    style={{ width: '100%' }}
                    dataSource={(getLogsSummary.data as LogsSummary).requesterStatistics}
                    columns={generateRequesterStatisticsColumns((getSystemConfig.data.properties as ISystemConfig).defaultEventTimeConsumptionBar, getUsers.data)}
                />
            </List.Item>
        </List>
    </div>;
};

const generateEventStatisticsColumns = (barThreshold: number[]) => {
    return [{
        title: 'Event',
        dataIndex: 'event',
        key: 'event',
        width: '20%',
        render: (__unused__value, record) => {
            return record.event;
        }
    }, {
        title: 'Number Calls',
        dataIndex: 'count',
        key: 'count',
        width: '20%',
        sorter: (a, b) => a.count - b.count,
        render: (__unused__value, record) => {
            return record.count;
        }
    }, {
        title: 'Avg Time Consuming/ms',
        dataIndex: 'avgTimeConsumed',
        key: 'avgTimeConsumed',
        width: '20%',
        sorter: (a, b) => a.avgTimeConsumed - b.avgTimeConsumed,
        render: (__unused__value, record) => {
            const value = Math.round(record.avgTimeConsumed * 100) / 100;
            return <Tooltip title={`${value} ms`}>
                <Progress
                    percent={value}
                    strokeColor={getColor(value, barThreshold)}
                    showInfo={false}
                />
            </Tooltip>;
        }
    }, {
        title: 'Activity',
        dataIndex: 'activity',
        key: 'activity',
        width: '40%',
        render: (__unused__value, record) => {
            return <div style={{ height: '200px' }}>
                <ResponsiveTimeRange
                    data={record.dailyCounts.map(rel => {
                        return {
                            day: dayjs().add(rel.dayIndex, 'day').format('YYYY-MM-DD'),
                            value: rel.count
                        };
                    })}
                    from={dayjs().subtract(40, 'day').format('YYYY-MM-DD')}
                    to={dayjs().format('YYYY-MM-DD')}
                    emptyColor="#eeeeee"
                    colors={['#61cdbb', '#97e3d5', '#e8c1a0', '#f47560']}
                    margin={{ top: 40, right: 40, bottom: 100, left: 40 }}
                    dayBorderWidth={2}
                    dayBorderColor="#ffffff"
                />
            </div>;
        }
    }];
};

const generateRequesterStatisticsColumns = (barThreshold: number[], users: IUserWithoutToken[]) => {
    return [{
        title: 'Requester',
        dataIndex: 'requester',
        key: 'requester',
        width: '20%',
        render: (__unused__value, record) => {
            const user = users.filter(el => el.id === record.requester)[0];
            if (user) {
                return `${user.firstname} ${user.lastname}`;
            } else {
                return 'NA';
            }
        }
    }, {
        title: 'Number Calls',
        dataIndex: 'count',
        key: 'count',
        width: '20%',
        sorter: (a, b) => a.count - b.count,
        render: (__unused__value, record) => {
            return record.count;
        }
    }, {
        title: 'Avg Time Consuming/ms',
        dataIndex: 'avgTimeConsumed',
        key: 'avgTimeConsumed',
        width: '20%',
        sorter: (a, b) => a.avgTimeConsumed - b.avgTimeConsumed,
        render: (__unused__value, record) => {
            const value = Math.round(record.avgTimeConsumed * 100) / 100;
            return <Tooltip title={`${value} ms`}>
                <Progress
                    percent={value}
                    strokeColor={getColor(value, barThreshold)}
                    showInfo={false}
                />
            </Tooltip>;
        }
    }, {
        title: 'Activity',
        dataIndex: 'activity',
        key: 'activity',
        width: '40%',
        render: (__unused__value, record) => {
            return <div style={{ height: '200px' }}>
                <ResponsiveTimeRange
                    data={record.dailyCounts.map(rel => {
                        return {
                            day: dayjs().add(rel.dayIndex, 'day').format('YYYY-MM-DD'),
                            value: rel.count
                        };
                    })}
                    from={dayjs().subtract(40, 'day').format('YYYY-MM-DD')}
                    to={dayjs().format('YYYY-MM-DD')}
                    emptyColor="#eeeeee"
                    colors={['#61cdbb', '#97e3d5', '#e8c1a0', '#f47560']}
                    margin={{ top: 40, right: 40, bottom: 100, left: 40 }}
                    dayBorderWidth={2}
                    dayBorderColor="#ffffff"
                />
            </div>;
        }
    }];
};

const generateLogColumns = (users: IUserWithoutToken[], barThreshold: number[]) => {
    return [{
        title: 'Caller',
        dataIndex: 'caller',
        key: 'caller',
        render: (__unused__value, record) => {
            const user = users.filter(el => el.id === record.requester)[0];
            return user ? `${user.firstname} ${user.lastname}` : 'NA';
        }
    }, {
        title: 'type',
        dataIndex: 'type',
        key: 'type',
        render: (__unused__value, record) => {
            return record.type;
        }
    }, {
        title: 'Resolver',
        dataIndex: 'apiResolver',
        key: 'apiResolver',
        render: (__unused__value, record) => {
            return record.apiResolver;
        }
    }, {
        title: 'Event',
        dataIndex: 'event',
        key: 'event',
        render: (__unused__value, record) => {
            return record.event;
        }
    }, {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (__unused__value, record) => {
            return record.status;
        }
    }, {
        title: 'Time Elapsed/ms',
        dataIndex: 'timeConsumed',
        key: 'timeConsumed',
        sorter: (a, b) => a.timeConsumed - b.timeConsumed,
        render: (__unused__value, record) => {
            // return <Progress percent={record.timeConsumed} showInfo={false} />;
            const percent = Math.min(100, (record.timeConsumed / barThreshold[1]) * 100);
            return (
                <Tooltip title={`${record.timeConsumed} ms`}>
                    <Progress
                        percent={percent}
                        strokeColor={getColor(record.timeConsumed, barThreshold)}
                        showInfo={false}
                    />
                </Tooltip>
            );
        }
    }, {
        title: 'Execution Time',
        dataIndex: 'time',
        key: 'time',
        sorter: (a, b) => a.life.createdTime ?? 0 - b.life.createdTime ?? 0,
        render: (__unused__value, record) => {
            return new Date(record.life.createdTime).toUTCString();
        }
    }];
};

const greenRGB = [0, 255, 0];   // RGB for green
const blueRGB = [0, 0, 255];   // RGB for blue
const redRGB = [255, 0, 0];    // RGB for red

const lerp = (start, end, t) => {
    return start + t * (end - start);
};

const getColor = (value, threshold) => {
    let startColor, endColor, t;

    if (value < threshold[0]) {
        startColor = greenRGB;
        endColor = blueRGB;
        t = value / threshold[0];  // Normalize between 0 and 1
    } else if (value <= threshold[1]) {
        startColor = blueRGB;
        endColor = redRGB;
        t = (value - threshold[0]) / (threshold[1] - threshold[0]);  // Normalize between 0 and 1
    } else {
        return `rgb(${redRGB.join(',')})`; // If it's over b, just return red
    }

    const r = Math.round(lerp(startColor[0], endColor[0], t));
    const g = Math.round(lerp(startColor[1], endColor[1], t));
    const b = Math.round(lerp(startColor[2], endColor[2], t));

    return `rgb(${r},${g},${b})`;
};
