import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Editor } from './editor';
import { StudyListSection } from './applicationList';
import { PastQueries } from './pastQuery';
import css from '../../css/query.module.css';

export const Query: React.FunctionComponent = props => {
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
                    <Editor studyName={match.params.studyName} applicationName={match.params.applicationName}/>
                    </>
                }/>          
            </Switch>
        </div>
    );
};