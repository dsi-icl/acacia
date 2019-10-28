import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Subsection } from '../../../reusable/subsection';
import { ProjectDetail } from './detailSections/projectDetail';
import { ProjectListSection } from './projectListSection';
import * as css from './tabContent.module.css';

export const ProjectsTabContent:React.FunctionComponent<{ studyId: string, projectList: { id: string, name: string }[] }> = ({ studyId, projectList }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Projects'>
            <ProjectListSection studyId={studyId} projectList={projectList}/>
        </Subsection>
    </div>;
};
