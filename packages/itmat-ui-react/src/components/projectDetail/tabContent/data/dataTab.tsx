import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT } from 'itmat-commons';
// import { FieldListSection } from '../../../reusable/fieldList/fieldList';
import { LoadingBalls } from '../../../reusable/icons/loadingBalls';
import { Subsection } from '../../../reusable/subsection/subsection';
import css from './tabContent.module.css';

export const DataTabContent: React.FunctionComponent<{ studyId: string; projectId: string }> = ({ projectId }) => {
    return <div className={css.scaffold_wrapper}>
        <div className={css.tab_page_wrapper + ' ' + css.left_panel}>
            <Subsection title='Variables'>
                <Query<any, any> query={GET_PROJECT} variables={{ projectId, admin: false }}>
                    {({ loading, data, error }) => {
                        if (loading) { return <LoadingBalls />; }
                        if (error) { return <p>Error :( {JSON.stringify(error)}</p>; }

                        if (Object.keys(data.getProject.fields).length === 0) { return <p>No fields uploaded or available to you. If this should not be the case, check your permission with admin.</p>; }
                        // return <FieldListSelectionStateProject fields={data.getProject.fields} />;
                        return <></>;
                    }}
                </Query>

            </Subsection>
        </div>
        <div className={css.tab_page_wrapper + ' ' + css.right_panel}>
        </div>
    </div>;
};

// const FieldListSelectionStateProject: React.FunctionComponent<{ fields: { [fieldTreeId: string]: IFieldEntry[] } }> = ({ fields }) => {
//     /* PRECONDITION: it is given (checked by parent component that fields at least have one key */
//     const [selectedTree, setSelectedTree] = React.useState(Object.keys(fields)[0]);

//     return <>
//         <label>Select field tree: </label><select onChange={(e) => setSelectedTree(e.target.value)} value={selectedTree}>{Object.keys(fields).map((el) => <option key={el} value={el}>{el}</option>)}</select><br /><br />
//         <FieldListSection checkable={false} fieldList={fields[selectedTree]} />
//     </>;

// };
