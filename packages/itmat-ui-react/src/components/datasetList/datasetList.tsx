import * as React from 'react';
import { Query } from 'react-apollo';
import { useHistory } from 'react-router-dom';
import { Models, WHO_AM_I } from 'itmat-commons';
import { Button } from 'antd';
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

    return <>
        Available datasets: <br /> <br />
        {datasets.map((el) =>
            <Button icon={<ContainerOutlined />} key={el.id} style={{
                width: '100%',
                marginBottom: '1rem'
            }} onClick={() => { history.push(`/datasets/${el.id}/files`); }}>
                {el.name}
            </Button>
        )}
        <br /><br />
    </>;
};
