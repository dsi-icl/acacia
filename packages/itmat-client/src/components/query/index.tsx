import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Editor } from './editor';
import { StudyListSection } from './applicationList';
import { PastQueries } from './pastQuery';
import css from '../../css/query.module.css';
import { Query } from "react-apollo";
import { GET_AVAILABLE_FIELDS } from '../../graphql/fields';

export const AppQuery: React.FunctionComponent = props => {
    return (
        <div className={css.pageContainer}> 
            <div className={css.list}>
                <StudyListSection/>
            </div>
            <Switch>
                <Route path='/queries/:studyName/:applicationName' render={({match}) => <>
                    <div className={css.pastQueries}>
                        <PastQueries studyName={match.params.studyName} applicationName={match.params.applicationName}/>
                    </div>
                    <Query query={GET_AVAILABLE_FIELDS} variables={{ study: "UKBIOBANK" }}>
                    {({ data, loading, error}) => {
                        if (loading) return <div></div>;
                        return <Editor studyName={match.params.studyName} applicationName={match.params.applicationName} fieldList={data.getAvailableFields}/>;
                    }}
                    </Query>
                    </>
                }/>          
            </Switch>
        </div>
    );
};