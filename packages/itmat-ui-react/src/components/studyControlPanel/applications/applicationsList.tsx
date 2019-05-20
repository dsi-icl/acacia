export const a  = 1;
// import { Models } from 'itmat-utils'
// import * as React from 'react';
// import { NavLink } from 'react-router-dom';
// import css from '../../studies/studyPage.module.css';

// export const ApplicationListSection: React.FunctionComponent<{ subscribeToNewApplication: Function, studyName: string, list: Models.Study.IApplication[]}> = ({ subscribeToNewApplication, list, studyName}) => {
//     // const [addNewApplicationShown, setAddNewApplicationShown] = React.useState(false);
//     React.useEffect(() => {
//         console.log('starting subscription');
//         subscribeToNewApplication();
//     }, [studyName]);

//     return (
//         <div style={{ gridArea: 'applicationList'}}>
//             <h4>Applications</h4>
//             {
//                 list.length === 0 ?
//                 <p>No application has been created.</p> : 
//                 list.map(el => <Application key={el.name} name={el.name} studyName={studyName}/>)
//             }
//             <NavLink to={`/studies/details/${studyName}/application/addNewApplication`}><span> Add new application </span></NavLink>
//         </div>
//     );
// };


// const Application: React.FunctionComponent<{ name: string, studyName: string }> = ({ name, studyName }) => {
//     return (
//         <NavLink to={`/studies/details/${studyName}/application/${name}`}><button className={css.applicatonButton}>{name}</button></NavLink>
//     );
// };
