import * as React from 'react';
import { Query } from "react-apollo";
import { GET_STUDIES } from '../../graphql/study';
import * as css from '../../css/studyControl.css';
import { Models } from 'itmat-utils';
import { Application } from './applicationsSection';
import { JobSection } from './jobsSection';
import { ExportSection } from './exportSection';
import { CurationSection } from './curationSection';

/**
 * Sections:
 * Data update log
 * Data managers
 * Applications
 *      - application admin
 *      - application user
 *      - pending user
 *      - approvedFields
 * Jobs
 * Export
 * Curation
 */

export const StudyControl: React.FunctionComponent<{ name: string }> = ({ name }) => {
    return (
        <Query query={GET_STUDIES} variables={{ name }}>
            {({ loading, error, data }) => {
                if (loading) return null;
                if (error) return `Error!: ${error.message}`;
                console.log(data);
                const study: Models.Study.IStudy & { jobs: Models.JobModels.IJobEntry<any>[] } = data.getStudies[0];
                return (
                    <div className={css.studyControl}>
                        <h2>{study.name}</h2>
                        <GenericListSection title='Study Managers' list={study.studyAndDataManagers} mapfunc={(el: string) => <p key={el}>{el}</p>} />
                        <GenericListSection title='Applications' list={study.applications} mapfunc={(el: Models.Study.IApplication) => <Application key={el.name} data={el}/>} />
                        <JobSection data={study.jobs}/>
                        <CurationSection/>
                        <ExportSection/>
                    </div>
                );
            }}
        </Query>
    );
};

const GenericListSection: React.FunctionComponent<{ title: String, list: any[], mapfunc: Function }> = ({title, list, mapfunc}) =>
    <div>
        <h3>{title}</h3>
        {list.map(mapfunc as any)}
    </div>
;






