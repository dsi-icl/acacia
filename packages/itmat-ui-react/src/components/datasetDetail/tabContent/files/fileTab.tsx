import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { FieldListSection } from '../../../reusable/fieldList';
import { Subsection } from '../../../reusable/subsection';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { GET_STUDY } from '../../../../graphql/study';

export const FileRepositoryTabContent:React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Existing files'>

            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
            <Subsection title='Upload new file'>

            </Subsection>
        </div>
    </div>;
};