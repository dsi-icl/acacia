import * as React from 'react';
import { useQuery } from 'react-apollo';
import { Subsection } from '../../../reusable';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import css from './tabContent.module.css';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import { GET_STUDY } from 'itmat-commons/dist/graphql/study';

export const AdminTabContent: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { data, loading } = useQuery(GET_STUDY, { variables: { studyId }});
    if (loading) { return <LoadingBalls/>; }

    return <div className={css.tab_page_wrapper_grid}>
        <div className={css.tab_page_wrapper + ' ' + css.main_page}>
            <Subsection title='Roles'>
                <RoleControlSection studyId={studyId} roles={data.getStudy.roles}/>
            </Subsection>

            <Subsection title='Wipe patient data'>
            </Subsection>

            <Subsection title='Delete study'>
                <p> wipe data or not?</p>
            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.sub_page + ' additional_panel'}>
            <Subsection title='User Access Log'>
                <div>

                </div>
            </Subsection>
        </div>
    </div>;
};