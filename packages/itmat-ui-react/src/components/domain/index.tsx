import { FunctionComponent } from 'react';
import { DomainSection } from './domains';
import css from './domains.module.css';

export const DomainPage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.domain_list_section + ' page_section'}>
                <div className='page_ariane'>
                    Domains
                </div>
                <div className='page_content'>
                    <DomainSection />
                </div>
            </div>
        </div>
    );
};
