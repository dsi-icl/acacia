import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Editor } from './editor';
// import { StudyListSection } from './applicationList';
import { PastQueries } from './pastQuery';
import css from '../../css/query.module.css';
import { Query } from "react-apollo";
import { GET_AVAILABLE_FIELDS } from '../../graphql/fields';
// import { FieldListSection } from './fields';

export const AppQuery: React.FunctionComponent = props => {
    return (

            <Switch>
                <Route path='/queries/:studyName/:applicationName' render={({match}) =>
                    <div className={css.pageContainer_query}> 
                        <div className={css.pastQueries}>
                            <PastQueries studyName={match.params.studyName} applicationName={match.params.applicationName}/>
                        </div>
                        <Query query={GET_AVAILABLE_FIELDS} variables={{ study: "UKBIOBANK" }}>
                            {({ data, loading, error}) => {
                                if (loading) return <div></div>;
                                return <>
                                    <div className={css.editor} style={{ padding: 0 }}><Editor studyName={match.params.studyName} applicationName={match.params.applicationName} fieldList={data.getAvailableFields}/></div>
                                    {/* <div className={css.fields}><FieldListSection fieldList={data.getAvailableFields}/></div> */}
                                </>;
                            }}
                        </Query>
                    </div>
                }/>
                <Route path='/queries/' render={() =>
                    <div className={css.pageContainer_list}> 
                        <div className={css.list}>
                            {/* <StudyListSection/> */}
                        </div>
                    </div>
                }/>          
            </Switch>
    );
};