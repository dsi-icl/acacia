import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_PROJECT } from '../../../../graphql/projects';
import { CREATE_USER } from '../../../../graphql/appUsers';
import * as css from './tabContent.module.css';
import { NavLink, Redirect } from 'react-router-dom';
import { Subsection, GenericUserList, SECTIONTYPE } from '../../../reusable';

export const AdminTabContent: React.FunctionComponent<{roles: Models.Study.IRole[]}> = ({ roles }) => {
    return <div className={css.tab_page_wrapper}>
        <Subsection title='Roles'>
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
        </Subsection>
    </div>;
};


export const OneRole: React.FunctionComponent<{ role: Models.Study.IRole }> = ({ role }) => {
    return <div className={css.one_role}>
        <label className={css.role_name}>{role.name}</label>
        <label>Permissions: </label>
        {role.permissions.map(el => <React.Fragment key={el}>{el}<br/><br/></React.Fragment>)}
        <label>Users of this role: </label>
        <br/> <br/>
        <GenericUserList
            title='ot'
            mutationToAddUser={CREATE_USER}
            mutationToDeleteUser={CREATE_USER}
            type={SECTIONTYPE.ADMINS}
            listOfUsers={role.users}
            studyName='fsdafds'
            submitButtonString='fsdfdsa'
        />
        <br/><br/>
    </div>
};


export const AddRole: React.FunctionComponent = props => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [inputNameString, setInputNameString] = React.useState('');

    if (!isExpanded) return <span className={css.add_new_role_button} onClick={() => setIsExpanded(true)}>Add new role</span>;
    return <div className={css.add_new_role_section}>
        <span>Create new role</span><br/><br/>
        <label>Name: </label><input placeholder='Role name' value={inputNameString} onChange={e => setInputNameString(e.target.value)}/> <br/>
        <label>Permissions: </label><input placeholder='Role name' value={inputNameString} onChange={e => setInputNameString(e.target.value)}/> <br/>
        <div className={css.add_new_role_buttons_wrapper}>
            <button className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
            <button onClick={() => setIsExpanded(false)}>Submit</button>
        </div>
    </div>;
}