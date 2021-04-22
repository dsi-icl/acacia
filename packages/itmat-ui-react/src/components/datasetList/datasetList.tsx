import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { useHistory } from 'react-router-dom';
import { Models, WHO_AM_I } from 'itmat-commons';
import { Button, Table } from 'antd';
import { ContainerOutlined } from '@ant-design/icons';
import LoadSpinner from '../reusable/loadSpinner';

export const DatasetList: React.FunctionComponent = () => {
    return (
        <Query<any, any>
            query={WHO_AM_I}>
            {({ loading, error, data }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) { return <p>Error :( {error}</p>; }
                if (data.whoAmI && data.whoAmI.access && data.whoAmI.access.studies) {
                    console.log(data.whoAmI.access);
                    const datasets = data.whoAmI.access.studies;
                    if (datasets.length > 0) {
                        return <PickDatasetSection datasets={datasets} />;
                    }
                }
                return <p>There is no dataset or you have not been granted access to any. Please contact your data custodian.</p>;
            }
            }
        </Query>
    );
};

const PickDatasetSection: React.FunctionComponent<{ datasets: Models.Study.IStudy[] }> = ({ datasets }) => {

    const history = useHistory();
    console.log(datasets);
    const columns = [
        {
            title: 'Dataset name',
            dataIndex: 'name',
            key: 'name',
            render: (__unused__value, record) => {
                return (<Button icon={<ContainerOutlined />} key={record.id} style={{
                    width: '50%',
                    marginBottom: '1rem'
                }} onClick={() => { history.push(`/datasets/${record.id}/files`); }}>
                    {record.name}
                </Button>);
            }
        },
        {
            title: 'Dataset Type',
            dataIndex: 'type',
            key: 'type',
            render: (__unused__value, record) => {
                return <p>{record.type}</p>;
            }
        }
    ];
    return <>
        Available datasets: <br /> <br />
        <Table
            rowKey={(rec) => rec.id}
            pagination={false}
            columns={columns}
            dataSource={datasets}
            size='small'
        />
        <br/><br/>
    </>;
};
