import { Models } from 'itmat-utils';
import * as React from 'react';

export const Application: React.FunctionComponent<{ data: Models.Study.IApplication }> = props => {
    const { name, pendingUserApprovals, applicationAdmins, applicationUsers, approvedFields } = props.data;
    const [detailsShown, setDetailsShown] = React.useState(false);
    return (
        <div>
            <p>{name}</p> <button onClick={() => setDetailsShown(!detailsShown)}>{detailsShown ? 'Show less' : 'Show more' }</button>
            { detailsShown ?
            <>
                Admins: {applicationAdmins.map(el => <span key={`Admin_${el}`}>{el}</span>)} <br/>
                Users: {applicationUsers.map(el => <span key={`User_${el}`}>{el}</span>)} <br/>
                Pending approvals: {pendingUserApprovals.map(el => <span key={`User_${el.user}_${el.type}`}>{el.user} | {el.type} </span>)} <br/>
                Approved fields: {approvedFields.map(el => <span key={`User_${el}`}>{el}</span>)}

            </> : null }
        </div>
    );
};