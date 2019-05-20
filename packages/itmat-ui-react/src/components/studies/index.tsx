import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as css from './studyPage.module.css';
import { StudyListSection } from './studyList';
import { CreateStudyPage } from './createStudyPage';

export const StudiesPage: React.FunctionComponent = props => {
    return (
        <div className={css.pageContainer}>
            <div className={css.studyList}>
                <StudyListSection/>
            </div>
            <div className={css.extraActionPanel}>
                <Switch>
                    <Route path='/studies/createNewStudy' render={() => <CreateStudyPage/>}/>
                </Switch>
            </div>
        </div>
    );
};