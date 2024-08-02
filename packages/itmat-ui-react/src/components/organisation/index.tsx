import { FunctionComponent } from 'react';
import css from './organisations.module.css';
import { OrganisationListSection } from './organisationList';

export const OrganisationPage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.user_list_section + ' page_section'}>
                <div className='page_ariane'>
                    Organisations
                </div>
                <div className='page_content'>
                    <OrganisationListSection />
                </div>
            </div>
        </div>
    );
};
