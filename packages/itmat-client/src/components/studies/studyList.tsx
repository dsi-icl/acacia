import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query } from "react-apollo";
import * as css from '../../css/studyPage.css';
import { GET_STUDIES_LIST } from '../../graphql/study';
import { NavLink } from 'react-router-dom';

export const StudyListSection: React.FunctionComponent = props => {
    return (
        <div className={css.studyList}>
            <NavLink to={`/studies/createNewStudy`}>
                <button>Create new study</button>
            </NavLink>
            <br/>
            
            <h4>Available studies:</h4>
            <Query
                query={GET_STUDIES_LIST}
                pollInterval={5000}
            >
                {({loading, error, data }) => {
                    if (loading) return <p>Loading...</p>;
                    if (error) return <p>Error :( {error}</p>;
                    if (data.getStudies === null || data.getStudies === undefined || data.getStudies.length === 0) {
                        return 'There is no study.'
                    }
                    return data.getStudies.map((el: Models.Study.IStudy) => <StudyButton key={el.name} data={el}/>);
                }}
            </Query>

        </div>
    );
};

export const StudyButton: React.FunctionComponent<{ data: Models.Study.IStudy }> = ({data}) =>
    <NavLink to={`/studies/details/${data.name}`}>
        <button>{data.name}</button>
    </NavLink>;
