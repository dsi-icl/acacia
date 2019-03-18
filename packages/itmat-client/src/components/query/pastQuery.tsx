import * as React from 'react';
import { Query } from "react-apollo";
import { IQueryEntry } from 'itmat-utils/dist/models/query';
import { GET_QUERY } from '../../graphql/query';

export const PastQueries: React.FunctionComponent<{studyName: string, applicationName: string}> = ({ studyName, applicationName }) => {
    return (
        <>
        <h4>Past Queries</h4>
            <Query query={GET_QUERY} variables={{ study: studyName, application: applicationName }}>
                {({ data, loading, error }) => {
                    if (loading) return 'loading';
                    if (error) return error.message;
                    if (data.getQueries === null || data.getQueries.length === 0) {
                        return <p>You have no past queries.</p>;
                    }
                    return data.getQueries.map((el: IQueryEntry) => {
                        return <div key={el.id}>
                            <label>Query: </label> <span>{el.queryString}</span><br/>
                            <label>Status: </label> <span>{el.status}</span>
                        </div>;
                    });
                }}
            </Query>
        </>
    );
};

// id: string,
// queryString: string,
// study: string,
// application: string,
// requester: string,
// claimedBy?: string,
// lastClaimed?: number,
// status: string,
// error: null | object,
// cancelled: boolean,
// cancelledTime?: number,
// queryResult?: string