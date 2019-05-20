import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query } from "react-apollo";
import { GET_STUDIES_LIST } from '../../graphql/study';
import { NavLink } from 'react-router-dom';

export const ProjectList: React.FunctionComponent = props => {
    return (
            <Query
                query={GET_STUDIES_LIST}
                pollInterval={5000}
            >
                {({loading, error, data }) => {
                    if (loading) return <p>Loading...</p>;
                    if (error) return <p>Error :( {error}</p>;
                    if (data.getStudies === null || data.getStudies === undefined || data.getStudies.length === 0) {
                        return 'There is no project or you have not been added to any. Please contact admin.';
                    }
                }
            }
            </Query>
    );
};


export const ProjectButton: React.FunctionComponent<{ data: Models.Study.IStudy }> = ({ data }) =>
    <NavLink to={`/studies/details/${data.name}`}>
        <button>{data.name}</button>
    </NavLink>;
