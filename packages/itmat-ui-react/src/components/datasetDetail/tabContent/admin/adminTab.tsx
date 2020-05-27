import * as React from 'react';
import { useQuery } from 'react-apollo';
import { Subsection } from '../../../reusable';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import css from './tabContent.module.css';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import { GET_STUDY } from 'itmat-commons/dist/graphql/study';
import { RouteComponentProps } from 'react-router';

type AdminTabContentProps = RouteComponentProps<{
    studyId: string
}>;

export const AdminTabContent: React.FunctionComponent<AdminTabContentProps> = ({ match: { params: { studyId } } }) => {
    const { data, loading } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadingBalls />; }

    return (
        <div className={`${css.tab_page_wrapper_grid} fade_in`}>
            <div className={`${css.tab_page_wrapper} ${css.cover_page}`}>
                <Subsection title="Roles">
                    <RoleControlSection studyId={studyId} roles={data.getStudy.roles} />
                </Subsection>
            </div>
        </div>
    );
};
