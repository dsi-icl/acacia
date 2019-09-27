import * as React from 'react';
import * as css from './tabContent.module.css';
import { Subsection } from '../../../reusable/subsection';
import { ProjectListSection } from './projectListSection';
import { Switch, Route } from 'react-router-dom';
import { ProjectDetail } from './detailSections/projectDetail';

export const ProjectsTabContent:React.FunctionComponent<{ studyId: string, projectList: { id: string, name: string }[] }> = ({ studyId, projectList }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Projects'>
            <ProjectListSection studyId={studyId} projectList={projectList}/>
        </Subsection>
    </div>;
};