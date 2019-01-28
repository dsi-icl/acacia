import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query } from "react-apollo";
import * as css from '../../css/studyPage.module.css';
import { GET_STUDIES_LIST } from '../../graphql/study';
import { NavLink } from 'react-router-dom';

export const StudyListSection: React.FunctionComponent = props => {
    return (
        <div className={css.studyList}>
            <NavLink to={`/studies/createNewStudy`}>
                <button>Create new study</button>
            </NavLink>
            <br/>
            
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

                    const yourStudies = data.getStudies.filter((el: any) => el.iHaveAccess);
                    const otherStudies = data.getStudies.filter((el: any) => !el.iHaveAccess);

                    return (
                        <>
                        <h4>Your studies:</h4>
                        { yourStudies.length !== 0 ?
                            yourStudies.map((el: Models.Study.IStudy) => <StudyButton iHaveAccess={true} key={el.name} data={el}/>)
                            : <span>You haven't been added to any study.</span>
                        }
                        { otherStudies.length !== 0 ?
                            <><h4>Other studies:</h4>
                            {otherStudies.map((el: Models.Study.IStudy) => <StudyButton iHaveAccess={false} key={el.name} data={el}/>) } </>
                            : null
                        }
                        </>
                    );
                }}
            </Query>

        </div>
    );
};

export const StudyButton: React.FunctionComponent<{ data: Models.Study.IStudy, iHaveAccess: boolean }> = ({data, iHaveAccess}) =>
    <NavLink to={ iHaveAccess ? `/studies/details/${data.name}` : `/studies/apply/${data.name}` }>
        <button>{data.name}</button>
    </NavLink>;
