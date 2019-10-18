import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Subsection } from '../../../reusable/subsection';
import { ProjectDetail } from './detailSections/projectDetail';
import { ProjectListSection } from './projectListSection';
import * as css from './tabContent.module.css';

export const ProjectsTabContent: React.FunctionComponent<{ studyId: string, projectList: Array<{ id: string, name: string }> }> = ({ studyId, projectList }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title="Projects">
                <ProjectListSection studyId={studyId} projectList={projectList} />
            </Subsection>
        </div>
        <div className={css.right_panel}>
            <Switch>
                <Route path="/datasets/:studyId/projects/:projectId" render={({ match }) => <ProjectDetail projectId={match.params.projectId} studyId={match.params.studyId} />} />
                <Route path="/" render={() => <></>} />
            </Switch>
        </div>
    </div>;
};
