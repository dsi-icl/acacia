// import { UKBCSVDataCuratorBase } from './curationImplementations/UKBCuratorBaseClass'; 
// import { UKBCSVDataCurator as implementation1 } from './curationImplementations/implementation1';


// const flag = '--documentShape=';
// const errorMessage = 'Usage of --documentShape=: --documentShape=[number]';
// let chosenImplementation: UKBCSVDataCuratorBase;
// let userOption;

// for (let each of process.argv) {
//     if (each.indexOf(flag) !== -1) {
//         if (each.indexOf(flag) !== 0) {
//             throw Error(errorMessage);
//         }
//         userOption = each.slice(flag.length);
//     }
// }

// switch (userOption) {
//     case undefined:
//         chosenImplementation =  implementation1;
//         break;
//     case "1":
//         chosenImplementation =  implementation1;
//         break;
//     default:
//         throw Error(errorMessage);
// }

// export { chosenImplementation as UKBCSVDataCurator };