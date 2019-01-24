import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as css from '../../css/studyPage.css';
import { StudyListSection } from './studyList';
import { CreateStudyPage } from './createStudyPage';
import { ApplyToApplicationSection } from './applyToApplication';

export const StudiesPage: React.FunctionComponent = props => {
    return (
        <div className={css.pageContainer}>
            <StudyListSection/>
            <Switch>
                <Route path='/studies/createNewStudy' render={() => <CreateStudyPage/>}/>
                <Route path='/' render={() => <ApplyToApplicationSection studyName='HELLO FRESH'/>}/>
            </Switch>
        </div>
    );
};