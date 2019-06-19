import * as React from 'react';
import * as css from './tabContent.module.css';
import { Subsection } from '../../../reusable/subsection';
import { ProjectListSection } from './projectListSection';
import { Switch, Route } from 'react-router-dom';
import { ProjectDetail } from './detailSections/projectDetail';

export const ProjectsTabContent:React.FunctionComponent<{ studyId: string, projectList: { id: string, name: string }[] }> = ({ studyId, projectList }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
        <Subsection title='PROJECTS'>
            <ProjectListSection studyId={studyId} projectList={projectList}/>
        </Subsection>
        </div>
        <div className={css.right_panel}>
            <Switch>
                <Route path='/datasets/:studyId/projects/:projectId' render={({ match }) => <ProjectDetail projectId={match.params.projectId}  studyId={match.params.studyId}/>}/>
                <Route path='/' render={() => <></>}/>
            </Switch>
        </div>
    </div>;
};