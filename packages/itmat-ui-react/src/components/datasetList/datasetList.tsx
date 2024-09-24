import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IStudy } from '@itmat-broker/itmat-types';
import { Button, Table } from 'antd';
import { ContainerOutlined } from '@ant-design/icons';
import LoadSpinner from '../reusable/loadSpinner';
import { trpc } from '../../utils/trpc';

export const DatasetList: FunctionComponent = () => {
    const getStudies = trpc.study.getStudies.useQuery({});

    if (getStudies.isLoading) {
        return <LoadSpinner />;
    }
    if (getStudies.isError) {
        return <>
            An error occured.
        </>;
    }

    if (getStudies.data.length > 0) {
        return <PickDatasetSection datasets={getStudies.data} />;
    } else {
        return <p>There is no dataset or you have not been granted access to any. Please contact your data custodian.</p>;
    }
};

const PickDatasetSection: FunctionComponent<{ datasets: IStudy[] }> = ({ datasets }) => {

    const navigate = useNavigate();
    const columns = [
        {
            title: 'Dataset name',
            dataIndex: 'name',
            key: 'name',
            render: (__unused__value, record) => {
                return (<Button icon={<ContainerOutlined />} key={record.id} style={{
                    width: '100%',
                    display: 'block',
                    overflow: 'hidden'
                }} title={record.name} onClick={() => { navigate(`${record.id}/files`); }}>
                    {record.name}
                </Button>);
            }
        },
        {
            title: 'Dataset Type',
            dataIndex: 'type',
            key: 'type',
            render: (__unused__value, record) => {
                return record.type ?? 'GENERIC';
            }
        }
    ];
    return <>
        Available datasets: <br /> <br />
        <Table
            rowKey={(rec) => rec.id}
            pagination={false}
            columns={columns}
            dataSource={datasets.sort((a, b) => a.name.localeCompare(b.name))}
            size='small'
        />
        <br /><br />
    </>;
};
