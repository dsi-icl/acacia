import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { Subsection, GenericUserList, SECTIONTYPE } from '../../../reusable';

export const DataTabContent: React.FunctionComponent<{roles: Models.Study.IRole[]}> = ({ roles }) => {
    return <div className={css.tab_page_wrapper}>
        
        {/* <Subsection title='Roles'>
            <div>
                {
                    roles.map((el, ind) => <OneRole key={el.id} role={el}/>)
                }
                <AddRole/>
            </div>
        </Subsection>
        <Subsection title='Patient ID Mapping'>
            <div>
                <button>Fetch mapping</button>
            </div>
        </Subsection> */}
    </div>;
};