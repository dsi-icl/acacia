import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { FieldListSection } from './fieldList';
import { Subsection } from '../../../reusable/subsection';
import { LoadingBalls } from '../../../reusable/loadingBalls';
import { GET_AVAILABLE_FIELDS } from '../../../../graphql/fields';

export const DataTabContent:React.FunctionComponent<{ studyId: string, projectId: string }> = ({ studyId, projectId }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
        <Subsection title='Variables'>
            <Query query={GET_AVAILABLE_FIELDS} variables={{ studyId }}>
            {({ loading, data, error }) => {
                if (loading) return <LoadingBalls/>;
                if (error) return <p>Error :( {JSON.stringify(error)}</p>; 

                return <FieldListSection fieldList={data.getAvailableFields}/>;
            }}
            </Query>
            
        </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
        </div>
    </div>;
};