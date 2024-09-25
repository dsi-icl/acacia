import { FunctionComponent } from 'react';
import css from './tabContent.module.css';
import { trpc } from '../../../../utils/trpc';
import { Button, Card, Col, Divider, Form, Input, List, Row, Statistic, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { IDataSetSummary, IStudy } from '@itmat-broker/itmat-types';
import { ResponsivePieCanvas } from '@nivo/pie';
import { ResponsiveCalendar } from '@nivo/calendar';

export const DashboardTabContent: FunctionComponent<{ study: IStudy }> = ({ study }) => {
    const getStudyDataSummary = trpc.data.getStudyDataSummary.useQuery({ studyId: study.id, useCache: false });

    if (getStudyDataSummary.isLoading) {
        return <div className={css.tab_page_wrapper}>
            Loading...
        </div>;
    }
    if (getStudyDataSummary.isError) {
        return <div className={css.tab_page_wrapper}>
            An error occured.
        </div>;
    }

    return <div className={`${css.tab_page_wrapper} fade_in`}>
        <div className={css.page_container}>
            <List
                header={
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className={css['overview-icon']}></div>
                                <div>Meta</div>
                            </div>
                        </div>
                        <div>
                        </div>
                    </div>
                }
            >
                <List.Item>
                    <MetaBlock study={study} dataSummary={getStudyDataSummary.data} />
                </List.Item>
            </List><br />
            <List
                header={
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className={css['overview-icon']}></div>
                                <div>Data Versioning</div>
                            </div>
                        </div>
                        <div>
                        </div>
                    </div>
                }
            >
                <List.Item>
                    <DataVersionBlock study={study} dataSummary={getStudyDataSummary.data} />
                </List.Item>
            </List>
        </div>;
    </div>;
};

export const MetaBlock: FunctionComponent<{ study: IStudy, dataSummary: IDataSetSummary }> = ({ study, dataSummary }) => {
    const getStudyRoles = trpc.role.getStudyRoles.useQuery({ studyId: study.id });
    const getUsers = trpc.user.getUsers.useQuery({});

    if (getStudyRoles.isLoading || getUsers.isLoading) {
        return <div className={css.tab_page_wrapper}>
            Loading...
        </div>;
    }

    if (getStudyRoles.isError || getUsers.isError) {
        return <div className={css.tab_page_wrapper}>
            An error occured.
        </div>;
    }

    const totalUploaders = dataSummary.dataByUploaders.reduce((a, c) => a + c.count, 0);

    const dataByUploaders: { id: string, label: string, value: number }[] = [{
        id: 'Others',
        label: 'Others',
        value: 0
    }];
    dataSummary.dataByUploaders.sort((a, b) => b.count - a.count).forEach((el, index) => {
        if (index < 10) {
            const user = getUsers.data.find(user => user.id === el.userId);
            dataByUploaders.push({
                id: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
                label: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
                value: el.count / totalUploaders
            });
        } else {
            dataByUploaders[0].value += el.count / totalUploaders;
        }
    });
    dataByUploaders.forEach(el => el.value = parseFloat((el.value * 100).toFixed(2)));

    const dataByUsers: { id: string, label: string, value: number }[] = [{
        id: 'Others',
        label: 'Others',
        value: 0
    }];

    const totalUsers = dataSummary.dataByUsers.reduce((a, c) => a + c.count, 0);
    dataSummary.dataByUsers.sort((a, b) => b.count - a.count).forEach((el, index) => {
        if (index < 10) {
            const user = getUsers.data.find(user => user.id === el.userId);
            dataByUsers.push({
                id: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
                label: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
                value: el.count / totalUsers
            });
        } else {
            dataByUsers[0].value += el.count / totalUsers;
        }
    });
    dataByUsers.forEach(el => el.value = parseFloat((el.value * 100).toFixed(2)));


    return <div style={{ width: '100%' }}>
        <Row gutter={16}><br />
            <Col span={12}>
                <Card title='Description' bordered={false}>
                    <p>{study.description}</p>
                    <p>{`Created On ${(new Date(study.life.createdTime)).toLocaleDateString()}`}</p>
                </Card>
            </Col>
            <Col span={6}>
                <Card title='Users' bordered={false}>
                    <Statistic title='Users' value={Array.from(new Set(getStudyRoles.data.map(el => el.users).reduce((a, c) => {
                        a = a.concat(c);
                        return a;
                    }, []))).length} />
                </Card>
            </Col>
            <Col span={6}>
                <Card title='Roles' bordered={false}>
                    <Statistic title='Roles' value={getStudyRoles.data.length} />
                </Card>
            </Col>
        </Row><br />
        <Row gutter={16}><br />
            <Col span={12}>
                <div className={css['pie-chart-container']}>
                    <ResponsivePieCanvas
                        data={dataByUploaders}
                        margin={{ top: 40, right: 200, bottom: 40, left: 80 }}
                        innerRadius={0.5}
                        padAngle={0.7}
                        cornerRadius={3}
                        activeOuterRadiusOffset={8}
                        colors={{ scheme: 'paired' }}
                        borderColor={{
                            from: 'color',
                            modifiers: [
                                [
                                    'darker',
                                    0.6
                                ]
                            ]
                        }}
                        arcLinkLabelsSkipAngle={10}
                        arcLinkLabelsTextColor="#333333"
                        arcLinkLabelsThickness={2}
                        arcLinkLabelsColor={{ from: 'color' }}
                        arcLabelsSkipAngle={10}
                        arcLabelsTextColor="#333333"
                        legends={[
                            {
                                anchor: 'right',
                                direction: 'column',
                                justify: false,
                                translateX: 140,
                                translateY: 0,
                                itemsSpacing: 2,
                                itemWidth: 60,
                                itemHeight: 14,
                                itemTextColor: '#999',
                                itemDirection: 'left-to-right',
                                itemOpacity: 1,
                                symbolSize: 14,
                                symbolShape: 'circle'
                            }
                        ]}
                    />
                    <div className={css['pie-chart-title']}>Sources</div>
                </div>
            </Col>
            <Col span={12}>
                <div className={css['pie-chart-container']}>
                    <ResponsivePieCanvas
                        data={dataByUsers}
                        margin={{ top: 40, right: 200, bottom: 40, left: 80 }}
                        innerRadius={0.5}
                        padAngle={0.7}
                        cornerRadius={3}
                        activeOuterRadiusOffset={8}
                        colors={{ scheme: 'paired' }}
                        borderColor={{
                            from: 'color',
                            modifiers: [
                                [
                                    'darker',
                                    0.6
                                ]
                            ]
                        }}
                        arcLinkLabelsSkipAngle={10}
                        arcLinkLabelsTextColor="#333333"
                        arcLinkLabelsThickness={2}
                        arcLinkLabelsColor={{ from: 'color' }}
                        arcLabelsSkipAngle={10}
                        arcLabelsTextColor="#333333"
                        legends={[
                            {
                                anchor: 'right',
                                direction: 'column',
                                justify: false,
                                translateX: 140,
                                translateY: 0,
                                itemsSpacing: 2,
                                itemWidth: 60,
                                itemHeight: 14,
                                itemTextColor: '#999',
                                itemDirection: 'left-to-right',
                                itemOpacity: 1,
                                symbolSize: 14,
                                symbolShape: 'circle'
                            }
                        ]}
                    />
                    <div className={css['pie-chart-title']}>Usage</div>
                </div>
            </Col>
        </Row><br />
    </div >;
};


export const DataVersionBlock: FunctionComponent<{ study: IStudy, dataSummary: IDataSetSummary }> = ({ study, dataSummary }) => {
    const [form] = Form.useForm();
    const createStudyDataVersion = trpc.study.createDataVersion.useMutation({
        onSuccess: () => {
            void message.success('Data version created successfully');
        },
        onError: () => {
            void message.error('Failed to create data version: ');
        }
    });

    const calendarDate = study.dataVersions.map(el => {
        return {
            day: dayjs.unix(el.life.createdTime / 1000).format('YYYY-MM-DD'),
            value: 1,
            info: el.version
        };
    });
    return <div style={{ width: '100%' }}>
        <div style={{ width: '50%', float: 'left', height: '500px' }}>
            <ResponsiveCalendar
                data={calendarDate}
                from="2022-01-01"
                to={dayjs().format('YYYY-MM-DD')}
                emptyColor="#eeeeee"
                colors={['#61cdbb', '#97e3d5', '#e8c1a0', '#f47560']}
                margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                yearSpacing={40}
                monthBorderColor="#ffffff"
                dayBorderWidth={2}
                dayBorderColor="#ffffff"
                legends={[
                    {
                        anchor: 'bottom-right',
                        direction: 'row',
                        translateY: 36,
                        itemCount: 4,
                        itemWidth: 42,
                        itemHeight: 36,
                        itemsSpacing: 14,
                        itemDirection: 'right-to-left'
                    }
                ]}
                tooltip={({ day }) => {
                    const version = calendarDate.find(el => el.day === day);
                    return <Tooltip
                        title={version ? version.info : 'No data version'}
                    ><span>{version ? version.info : 'No data version'}</span></Tooltip>;
                }}
            />
        </div>
        <div style={{ width: '45%', float: 'right' }}>
            <Divider>Data Summaries</Divider>
            <Row gutter={16}><br />
                <Col span={12}>
                    <Statistic title={<div style={{ backgroundColor: '#39F848' }}>Versioned Data</div>} value={dataSummary.numberOfVersionedRecords} />
                </Col>
                <Col span={12}>
                    <Statistic title={<div style={{ backgroundColor: '#39F848' }}>Versioned Fields</div>} value={dataSummary.numberOfVersionedFields} />
                </Col>
            </Row><br />
            <Row gutter={16}><br />
                <Col span={12}>
                    <Statistic title={<div style={{ backgroundColor: '#ff9b9b' }}>Unversioned Data</div>} value={dataSummary.numberOfUnversionedRecords} />
                </Col>
                <Col span={12}>
                    <Statistic title={<div style={{ backgroundColor: '#ff9b9b' }}>Unversioned Fields</div>} value={dataSummary.numberOfUnversionedFields} />
                </Col>
            </Row>
            <Divider>Create New Data Version</Divider>
            <Form
                form={form}
            >
                <Form.Item
                    name='dataVersion'
                    label='Data Version'
                    rules={[{ required: true, message: 'Please input the data version' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name='tag'
                    label='Tag'
                    rules={[{ required: true, message: 'Please input the tag' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item>
                    <Button type='primary' onClick={() => {
                        const values = form.getFieldsValue();
                        void createStudyDataVersion.mutate({
                            studyId: study.id,
                            dataVersion: values.dataVersion.toString(),
                            tag: values.tag.toString()
                        });
                    }}>Create Data Version</Button>
                </Form.Item>
            </Form>
        </div>
    </div >;
};
