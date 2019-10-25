import * as React from 'react';
import { Query } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { FieldListSection } from '../../../reusable/fieldList';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { Subsection } from '../../../reusable/subsection';
import * as css from './tabContent.module.css';

export const DataTabContent: React.FunctionComponent<{ studyId: string, projectId: string }> = ({ projectId }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title="Variables">
                <Query query={GET_PROJECT} variables={{ projectId, admin: false }}>
                    {({ loading, data, error }) => {
                        if (loading) { return <LoadingBalls />; }
                        if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }

                        return <FieldListSection checkable={false} fieldList={data.getProject.fields} />;
                    }}
                </Query>

            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
        </div>
    </div>;
};
