import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Subsection } from '../../../reusable/subsection/subsection';
import { ProjectDetail } from './detailSections/projectDetail';
import { ProjectListSection } from './projectListSection';
import css from './tabContent.module.css';

type ProjectsTabContentProps = {
    studyId: string;
    projectList: {
        id: string;
        name: string;
    }[];
};

export const ProjectsTabContent: React.FC<ProjectsTabContentProps> = ({ studyId, projectList }) => (
    <div className={css.scaffold_wrapper}>
        <Switch>
            <Route path="/datasets/:studyId/projects/:projectId" component={ProjectDetail} />
            <Route
                path="/datasets/:studyId/projects" render={() => (
                    <div className={`${css.tab_page_wrapper} ${css.left_panel}`}>
                        <Subsection title="Projects">
                            <ProjectListSection studyId={studyId} projectList={projectList} />
                        </Subsection>
                    </div>
                )}
            />
            <Route path="/" render={() => <></>} />
        </Switch>
    </div>
);

export default ProjectsTabContent;
