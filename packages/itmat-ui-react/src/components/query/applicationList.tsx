import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query } from "react-apollo";
import * as css from '../studies/studyPage.module.css';
import { GET_STUDIES_LIST } from '../../graphql/study';
import { NavLink } from 'react-router-dom';
import { WHO_AM_I } from '../../graphql/user';

export const StudyListSection: React.FunctionComponent = props => {
    return (
        <Query query={WHO_AM_I}>
            {({ data: whoAmIdata }) => <Query
                query={GET_STUDIES_LIST}
                pollInterval={5000}
            >
                {({loading, error, data }) => {
                    if (loading) return <p>Loading...</p>;
                    if (error) return <p>Error :( {error}</p>;
                    if (data.getStudies === null || data.getStudies === undefined || data.getStudies.length === 0) {
                        return 'There is no study.'
                    }

                    const yourStudies = whoAmIdata.whoAmI.type === 'ADMIN' ? data.getStudies : data.getStudies.filter((el: any) => el.allUsers.includes(whoAmIdata.whoAmI.username));

                    return (
                        <>
                        <h4>Your studies:</h4>
                        { yourStudies.length !== 0 ?
                            yourStudies.map((el: Models.Study.IStudy) => <OneStudy key={el.id} el={el} whoAmI={whoAmIdata.whoAmI}/>)
                            : <span>You haven't been added to any study.</span>
                        }
                        </>
                    );
                }}
            </Query>
            }
        </Query>
    );
};


const OneStudy: React.FunctionComponent<{el: Models.Study.IStudy, whoAmI: Models.UserModels.IUserWithoutToken }> = ({ el, whoAmI }) => {
    return (
        <>
        <h3>{el.name}</h3>
        {el.applications.map(app => {
            if (whoAmI.type === 'ADMIN' || app.applicationAdmins.includes(whoAmI.username) || app.applicationUsers.includes(whoAmI.username)) {
                return (<NavLink key={`/queries/${el.name}/${app.name}`} to={`/queries/${el.name}/${app.name}`}>
                    <button className={css.applicatonButton}>{app.name}</button>
                </NavLink>);
            } else {
                return null;
            }
        })}
        </>
    );
};