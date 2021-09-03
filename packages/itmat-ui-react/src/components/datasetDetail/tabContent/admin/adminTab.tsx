import * as React from 'react';
import { useQuery } from '@apollo/client/react/hooks';
import { Subsection } from '../../../reusable';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import css from './tabContent.module.css';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import { GET_STUDY } from 'itmat-commons';
import { RouteComponentProps } from 'react-router-dom';

type AdminTabContentProps = RouteComponentProps<{
    studyId: string
}>;

export const AdminTabContent: React.FunctionComponent<AdminTabContentProps> = ({ match: { params: { studyId } } }) => {
    const { data, loading } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadingBalls />; }

    return <div className={css.tab_page_wrapper_grid + ' fade_in'}>
        <div className={css.tab_page_wrapper + ' ' + css.main_page}>
            <Subsection title='Roles'>
                <RoleControlSection studyId={studyId} roles={data.getStudy.roles} />
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
