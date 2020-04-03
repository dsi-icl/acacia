import { Models } from 'itmat-commons';
import * as React from 'react';
import { Query } from '@apollo/react-components'
import { NavLink } from 'react-router-dom';
import { WHO_AM_I } from 'itmat-commons/dist/graphql/user';

export const DatasetList: React.FC = (props) => (
    <Query<any, any>
        query={WHO_AM_I}
        pollInterval={5000}
    >
        {({ loading, error, data }) => {
            if (loading) { return <p>Loading...</p>; }
            if (error) {
                return (
                    <p>
                        Error :(
                        {error}
                    </p>
                );
            }
            if (data.whoAmI && data.whoAmI.access && data.whoAmI.access.studies) {
                const datasets = data.whoAmI.access.studies;
                if (datasets.length > 0) {
                    return <PickDatasetSection datasets={datasets} />;
                }
            }
            return <p>There is no dataset or you have not been added to any. Please contact admin.</p>;
        }}
    </Query>
);

const PickDatasetSection: React.FC<{ datasets: Models.Study.IStudy[] }> = ({ datasets }) => (
    <>
        Please pick the study you would like to access:
        {' '}
        <br />
        <br />
        <br />
        {datasets.map((el) => (
            <NavLink key={el.id} to={`/datasets/${el.id}/dashboard`}>
                <button>{el.name}</button>
            </NavLink>
        ))}
    </>
);
