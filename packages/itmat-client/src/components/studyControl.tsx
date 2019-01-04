import * as React from 'react';
import { Query } from "react-apollo";
import { GET_STUDIES } from '../graphql/study';
import * as css from '../css/studyControl.css';
import { Models } from 'itmat-utils';
import { Application } from './studies';

export const StudyControl: React.FunctionComponent<{ name: string }> = ({ name }) => {
    return (
        <Query query={GET_STUDIES} variables={{ name }}>
            {({ loading, error, data }) => {
                if (loading) return null;
                if (error) return `Error!: ${error.message}`;
                console.log(data);
                const study: Models.Study.IStudy = data.getStudies[0];
                return (
                    <div className={css.studyControl}>
                        <h2>{study.name}</h2>
                        <GenericListSection title='Study Managers' list={study.studyAndDataManagers} mapfunc={(el: string) => <p key={el}>{el}</p>} />
                        <GenericListSection title='Applications' list={study.applications} mapfunc={(el: Models.Study.IApplication) => <Application key={el.name} data={el}/>} />
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