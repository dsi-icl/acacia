import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as css from '../../css/scaffold.css';
import { UserPage } from '../users';
import { StudyControl } from '../studyControlPanel';
import { StudiesPage } from '../studies';
import { SettingsPage } from '../settings';

// import { AddApplication } from '../studyControlPanel/applicationsSection';

export const RightPanel: React.FunctionComponent = props => {
    return (
        <div className={css.rightPanel}>
            <Switch>
                <Route path='/settings' render={({match}) => <SettingsPage/>}/>
                {/* <Route path='/studies/details/:studyName' render={({ match }) => <AddApplication studyName={match.params.studyName}/>}/> */}
                <Route path='/studies/details/:studyName' render={({ match }) => <StudyControl name={match.params.studyName}/>}/>
                <Route path='/studies' render={({match}) => <StudiesPage/>}/>
                <Route path='/users' render={() => <UserPage/>}/>
                <Route path='/' render={() => <></>}/>
            </Switch>
        </div>
    );
};