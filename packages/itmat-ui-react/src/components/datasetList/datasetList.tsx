import { Models } from 'itmat-commons';
import * as React from 'react';
import { Query } from 'react-apollo';
import { WHO_AM_I } from '../../graphql/user';
import { NavLink, Redirect } from 'react-router-dom';

export const DatasetList: React.FunctionComponent = props => {
    return (
        <Query
            query={WHO_AM_I}
            pollInterval={5000}
        >
            {({ loading, error, data }) => {
                if (loading) return <p>Loading...</p>;
                if (error) return <p>Error :( {error}</p>;
                if (data.whoAmI && data.whoAmI.access && data.whoAmI.access.studies) {
                    const datasets = data.whoAmI.access.studies;
                    if (datasets.length === 1) {
                        return <Redirect to={`/datasets/${datasets[0].id}/dashboard`} />;
                    }
                    if (datasets.length > 1) {
                        return <PickDatasetSection datasets={datasets} />;
                    }
                }
                console.log('error: ', data);
                return <p>There is no dataset or you have not been added to any. Please contact admin.</p>;
            }
            }
        </Query>
    );
};

const PickDatasetSection: React.FunctionComponent<{ datasets: Models.Study.IStudy[] }> = ({ datasets }) => {
    return <>
        You have access to two or more datasets. Please pick the one you would like to access: <br /><br /><br />
        {datasets.map(el =>
            <NavLink key={el.id} to={`/datasets/${el.id}/dashboard`}>
                <button>{el.name}</button>
            </NavLink>
        )}
    </>
}